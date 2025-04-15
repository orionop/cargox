from sqlalchemy.orm import Session
from typing import List, Dict, Tuple, Optional
import heapq
import math
from datetime import datetime

from models import Item, Container, RearrangementMovement, RearrangementPlan

class RearrangementService:
    """Service for generating rearrangement recommendations to optimize space usage"""
    
    def __init__(self, db: Session):
        self.db = db
        
    def calculate_container_utilization(self, container_id: str) -> float:
        """Calculate the utilization percentage of a container"""
        container = self.db.query(Container).filter(Container.id == container_id).first()
        if not container:
            return 0.0
            
        items = self.db.query(Item).filter(Item.container_id == container_id, Item.is_placed == True).all()
        
        container_volume = container.width * container.height * container.depth
        used_volume = sum(item.width * item.height * item.depth for item in items)
        
        return (used_volume / container_volume) * 100 if container_volume > 0 else 0.0
    
    def get_container_efficiency_score(self, container: Container) -> float:
        """Calculate efficiency score for a container based on utilization
        
        Returns a score where lower is worse (more inefficient)
        Containers with utilization close to 75% are considered optimal.
        Scores range from 0-100
        """
        utilization = self.calculate_container_utilization(container.id)
        
        # Calculate how far from the optimal utilization (75%)
        distance_from_optimal = abs(75.0 - utilization)
        
        # Convert to a score (0-100) where lower is worse
        # Highest inefficiency at 0% and 100% utilization
        score = 100 - distance_from_optimal
        
        # Make empty and nearly empty containers score worse
        if utilization < 20:
            score *= 0.7
        # Make nearly full containers score slightly less worse 
        elif utilization > 90: 
            score *= 0.8
            
        return score
    
    def get_disorganized_containers(self, excluded_types=["waste"]) -> List[Dict]:
        """Get all containers sorted by inefficiency (most inefficient first)
        
        Args:
            excluded_types: List of container types to exclude from results
            
        Returns:
            List of container dictionaries with utilization information
        """
        containers = self.db.query(Container).all()
        
        # Filter out excluded container types
        containers = [c for c in containers if c.container_type.lower() not in [t.lower() for t in excluded_types]]
        
        container_data = []
        for container in containers:
            utilization = self.calculate_container_utilization(container.id)
            efficiency_score = self.get_container_efficiency_score(container)
            
            # Calculate containers with the most inefficiency
            items = self.db.query(Item).filter(Item.container_id == container.id, Item.is_placed == True).count()
            low_priority_items = self.db.query(Item).filter(
                Item.container_id == container.id, 
                Item.is_placed == True,
                Item.priority <= 30
            ).count()
            
            container_data.append({
                "id": container.id,
                "zone": container.zone,
                "type": container.container_type,
                "dimensions": {
                    "width": container.width,
                    "height": container.height,
                    "depth": container.depth
                },
                "utilization": utilization,
                "efficiency_score": efficiency_score,
                "total_items": items,
                "low_priority_items": low_priority_items,
                "inefficiency_score": 100 - efficiency_score  # Higher is more inefficient
            })
        
        # Sort by inefficiency (highest inefficiency first)
        container_data.sort(key=lambda x: x["inefficiency_score"], reverse=True)
        
        return container_data
    
    def estimate_movement_time(self, item: Item, from_container: Optional[Container], to_container: Container) -> float:
        """Estimate the time in minutes needed to move an item between containers"""
        # Base movement time based on item weight
        base_time = item.weight * 0.5  # Heavier items take longer to move
        
        # Add time for distance between containers (if both containers are specified)
        distance_time = 0
        if from_container and to_container:
            # Use container zones to estimate distance
            if from_container.zone != to_container.zone:
                distance_time = 10  # Moving between zones takes extra time
            else:
                distance_time = 3   # Moving within the same zone
        
        # Add time for item size
        size_time = (item.width * item.height * item.depth) * 0.2
        
        # Add time for careful handling of high priority items
        priority_time = 0
        if item.priority > 70:
            priority_time = 5  # High priority items need careful handling
        
        return base_time + distance_time + size_time + priority_time
    
    def find_optimal_container(self, item: Item) -> Tuple[Container, float]:
        """Find the optimal container for an item based on zone preference and space"""
        containers = self.db.query(Container).all()
        
        # Score each container based on multiple factors
        container_scores = []
        for container in containers:
            # Skip if container doesn't have enough space
            container_items = self.db.query(Item).filter(Item.container_id == container.id, Item.is_placed == True).all()
            used_volume = sum(i.width * i.height * i.depth for i in container_items)
            container_volume = container.width * container.height * container.depth
            remaining_volume = container_volume - used_volume
            item_volume = item.width * item.height * item.depth
            
            if item_volume > remaining_volume:
                continue
                
            # Base score on remaining space
            space_score = (remaining_volume - item_volume) / container_volume
            
            # Zone preference score
            zone_score = 1.0
            if item.preferred_zone and container.zone == item.preferred_zone:
                zone_score = 0.5  # Lower score is better (will be used in a min-heap)
            
            # Utilization score - prefer containers that are already partially filled
            utilization = used_volume / container_volume if container_volume > 0 else 0
            # Sweet spot is around 70-80% utilization
            utilization_score = abs(0.75 - utilization)
            
            # Combined score (lower is better)
            score = zone_score * 0.5 + space_score * 0.3 + utilization_score * 0.2
            
            container_scores.append((score, container))
        
        if not container_scores:
            return None, 0.0
            
        # Get the best container (lowest score)
        heapq.heapify(container_scores)
        best_score, best_container = heapq.heappop(container_scores)
        
        # Calculate the fit score (0-100%), higher is better
        item_volume = item.width * item.height * item.depth
        container_volume = best_container.width * best_container.height * best_container.depth
        fit_score = 100 - ((container_volume - item_volume) / container_volume * 100)
        
        return best_container, fit_score
    
    def generate_rearrangement_plan(self, 
                                    space_target: float = 15.0,
                                    priority_threshold: int = 30,
                                    max_movements: int = 10) -> RearrangementPlan:
        """
        Generate a rearrangement plan to optimize space usage
        
        Args:
            space_target: Target percentage improvement in space utilization
            priority_threshold: Only move items with priority below this threshold
            max_movements: Maximum number of movements to recommend
            
        Returns:
            RearrangementPlan object with movements and statistics
        """
        # Get containers and their utilization
        containers = self.db.query(Container).all()
        container_utilization = {c.id: self.calculate_container_utilization(c.id) for c in containers}
        
        # Create container capacity map to check for capacity constraints
        container_capacity_map = {}
        for container in containers:
            # Count items currently in the container
            items_count = self.db.query(Item).filter(
                Item.container_id == container.id,
                Item.is_placed == True
            ).count()
            
            # Calculate available capacity
            available_capacity = max(0, container.capacity - items_count)
            
            container_capacity_map[container.id] = {
                "capacity": container.capacity,
                "items_count": items_count,
                "available_capacity": available_capacity,
                "is_full": items_count >= container.capacity
            }
        
        # Get disorganized containers for the response
        disorganized_containers = self.get_disorganized_containers(excluded_types=["waste"])
        
        # If no containers at all, return early
        if not containers or len(containers) < 2:
            return RearrangementPlan(
                success=True,
                message="Not enough containers to generate a rearrangement plan",
                total_steps=0,
                space_optimization=0.0,
                disorganized_containers=disorganized_containers[:10]  # Include first 10 containers
            )
        
        # More flexible approach to identify containers for rebalancing
        # Using disorganized containers as primary source of items to move
        source_containers = []
        
        # First try finding very overutilized containers (> 85%)
        overutilized = [c for c in containers if container_utilization[c.id] > 85]
        if overutilized:
            source_containers.extend(overutilized)
        
        # Then add containers with inefficiency score (from disorganized_containers)
        if disorganized_containers:
            # Get container IDs from disorganized_containers
            disorganized_ids = [c["id"] for c in disorganized_containers if c.get("inefficiency_score", 0) > 30]
            
            # Find matching Container objects
            for container in containers:
                if container.id in disorganized_ids and container not in source_containers:
                    source_containers.append(container)
        
        # If we still don't have source containers, try containers with non-optimal utilization (>60%)
        if not source_containers:
            source_containers = [c for c in containers if container_utilization[c.id] > 60]
        
        # Find potential target containers that have space
        potential_targets = []
        
        # Filter out containers that are already at capacity
        available_containers = [c for c in containers if not container_capacity_map[c.id]["is_full"]]
        
        # First try very underutilized containers (<50%)
        underutilized = [c for c in available_containers if container_utilization[c.id] < 50]
        if underutilized:
            potential_targets.extend(underutilized)
        
        # If no underutilized containers, try containers with moderate utilization
        if not potential_targets:
            potential_targets = [c for c in available_containers if container_utilization[c.id] < 70]
        
        # If we still don't have targets, use any container not in source_containers that has available capacity
        if not potential_targets:
            potential_targets = [c for c in available_containers if c not in source_containers]
        
        # Final check - if we have no source or target containers, return early
        if not source_containers or not potential_targets:
            return RearrangementPlan(
                success=True,
                message="No suitable containers found for rearrangement",
                total_steps=0,
                space_optimization=0.0,
                disorganized_containers=disorganized_containers[:10]
            )
        
        # Find movable items from source containers with more flexible priority threshold
        # Start with provided threshold, but raise it if needed
        current_priority_threshold = priority_threshold
        movable_items = []
        
        # Try to find items up to 3 times with increasing priority thresholds
        for attempt in range(3):
            for container in source_containers:
                items = self.db.query(Item).filter(
                    Item.container_id == container.id,
                    Item.is_placed == True,
                    Item.priority <= current_priority_threshold
                ).all()
                
                for item in items:
                    # Only add items not already in movable_items
                    if not any(existing_item[0].id == item.id for existing_item in movable_items):
                        movable_items.append((item, container))
            
            # If we found enough movable items, break
            if len(movable_items) >= max_movements:
                break
            
            # Otherwise increase the priority threshold for the next attempt
            current_priority_threshold += 20
            
            # Cap at 80 to avoid moving truly high-priority items
            if current_priority_threshold > 80:
                break
        
        # If we still don't have movable items, return early
        if not movable_items:
            return RearrangementPlan(
                success=True,
                message="No suitable items found for rearrangement",
                total_steps=0,
                space_optimization=0.0,
                disorganized_containers=disorganized_containers[:10]
            )
        
        # Sort items by priority (lowest first)
        movable_items.sort(key=lambda x: x[0].priority)
        
        # Calculate initial space utilization
        initial_utilization = sum(container_utilization.values()) / len(container_utilization)
        
        # Generate movement plan
        movements = []
        moved_item_ids = []
        untouched_high_priority_items = [
            item.id for item in self.db.query(Item).filter(Item.priority > current_priority_threshold).all()
        ]
        
        # Track virtual container usage to simulate moves before they happen
        virtual_container_usage = {container_id: info["items_count"] for container_id, info in container_capacity_map.items()}
        
        for i, (item, from_container) in enumerate(movable_items):
            if i >= max_movements:
                break
            
            # Find optimal container for this item preferring potential_targets
            best_container = None
            best_fit_score = 0
            
            # First try to find a target among the potential_targets
            for target in potential_targets:
                # Skip the same container
                if target.id == from_container.id:
                    continue
                
                # Skip containers that would be at capacity after this move
                # Check both actual capacity limits and current virtual usage 
                if virtual_container_usage[target.id] >= target.capacity:
                    continue
                
                # Check if item fits in target
                container_items = self.db.query(Item).filter(
                    Item.container_id == target.id, 
                    Item.is_placed == True
                ).all()
                
                used_volume = sum(i.width * i.height * i.depth for i in container_items)
                container_volume = target.width * target.height * target.depth
                remaining_volume = container_volume - used_volume
                item_volume = item.width * item.height * item.depth
                
                if item_volume <= remaining_volume:
                    # Calculate fit score
                    fit_score = 100 - ((container_volume - item_volume) / container_volume * 100)
                    
                    if best_container is None or fit_score > best_fit_score:
                        best_container = target
                        best_fit_score = fit_score
            
            # Skip if no suitable container found among potential_targets
            if best_container is None:
                # Use find_optimal_container as fallback but only if container isn't at capacity
                try:
                    candidate_container, candidate_fit_score = self.find_optimal_container(item)
                    # Only use the container if it has capacity
                    if (candidate_container and 
                        candidate_container.id != from_container.id and
                        virtual_container_usage[candidate_container.id] < candidate_container.capacity):
                        best_container = candidate_container
                        best_fit_score = candidate_fit_score
                except Exception as e:
                    # Log error but continue with the next item
                    print(f"Error finding optimal container for {item.id}: {str(e)}")
            
            # Skip if no suitable container found
            if best_container is None:
                continue
            
            # Skip if moving to the same container
            if best_container.id == from_container.id:
                continue
            
            # Calculate movement time
            movement_time = self.estimate_movement_time(item, from_container, best_container)
            
            # Create movement step
            movement = RearrangementMovement(
                step=i+1,
                item_id=item.id,
                item_name=item.name,
                from_container_id=from_container.id,
                to_container_id=best_container.id,
                from_zone=from_container.zone,
                to_zone=best_container.zone,
                estimated_time=movement_time,
                priority=item.priority,
                description=f"Move {item.name} from {from_container.id} ({from_container.zone or 'unzoned'}) to {best_container.id} ({best_container.zone or 'unzoned'})"
            )
            
            # Update virtual container usage
            virtual_container_usage[from_container.id] -= 1
            virtual_container_usage[best_container.id] += 1
            
            movements.append(movement)
            moved_item_ids.append(item.id)
            
            # Update utilization calculation after this move
            item_volume = item.width * item.height * item.depth
            from_volume = from_container.width * from_container.height * from_container.depth
            to_volume = best_container.width * best_container.height * best_container.depth
            
            # Recalculate utilization for the source and destination containers
            utilization_from = container_utilization[from_container.id]
            utilization_to = container_utilization[best_container.id]
            
            # Adjust utilization based on item volume
            adjusted_from = utilization_from - ((item_volume / from_volume) * 100)
            adjusted_to = utilization_to + ((item_volume / to_volume) * 100)
            
            container_utilization[from_container.id] = max(0, adjusted_from)
            container_utilization[best_container.id] = min(100, adjusted_to)
        
        # Calculate final space utilization after all movements
        final_utilization = sum(container_utilization.values()) / len(container_utilization) if container_utilization else 0
        
        # Calculate optimization percentage (positive means improvement)
        optimization = final_utilization - initial_utilization
        
        # Calculate total estimated time
        total_time = sum(m.estimated_time for m in movements)
        
        return RearrangementPlan(
            success=True,
            message=f"Generated rearrangement plan with {len(movements)} movements",
            total_steps=len(movements),
            total_estimated_time=total_time,
            space_optimization=optimization,
            movements=movements,
            low_priority_items_moved=moved_item_ids,
            high_priority_items_untouched=untouched_high_priority_items,
            disorganized_containers=disorganized_containers[:10]  # Include first 10 containers
        ) 