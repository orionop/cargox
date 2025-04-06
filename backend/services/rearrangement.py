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
        
        # Get disorganized containers for the response
        disorganized_containers = self.get_disorganized_containers(excluded_types=["waste"])
        
        # Identify underutilized and overutilized containers
        underutilized = [c for c in containers if container_utilization[c.id] < 50]
        overutilized = [c for c in containers if container_utilization[c.id] > 85]
        
        if not underutilized or not overutilized:
            return RearrangementPlan(
                success=True,
                message="No rearrangement needed - container utilization is balanced",
                total_steps=0,
                space_optimization=0.0,
                disorganized_containers=disorganized_containers[:10]  # Include first 10 containers
            )
        
        # Find low priority items that can be moved from overutilized containers
        movable_items = []
        for container in overutilized:
            items = self.db.query(Item).filter(
                Item.container_id == container.id,
                Item.is_placed == True,
                Item.priority <= priority_threshold
            ).all()
            
            for item in items:
                movable_items.append((item, container))
        
        # Sort items by priority (lowest first)
        movable_items.sort(key=lambda x: x[0].priority)
        
        # Calculate initial space utilization
        initial_utilization = sum(container_utilization.values()) / len(container_utilization)
        
        # Generate movement plan
        movements = []
        moved_item_ids = []
        untouched_high_priority_items = [
            item.id for item in self.db.query(Item).filter(Item.priority > priority_threshold).all()
        ]
        
        for i, (item, from_container) in enumerate(movable_items):
            if i >= max_movements:
                break
                
            # Find optimal container for this item
            to_container, fit_score = self.find_optimal_container(item)
            if not to_container:
                continue
                
            # Skip if moving to the same container
            if to_container.id == from_container.id:
                continue
                
            # Calculate movement time
            movement_time = self.estimate_movement_time(item, from_container, to_container)
            
            # Create movement step
            movement = RearrangementMovement(
                step=i+1,
                item_id=item.id,
                item_name=item.name,
                from_container_id=from_container.id,
                to_container_id=to_container.id,
                estimated_time=movement_time,
                priority=item.priority,
                description=f"Move {item.name} from {from_container.id} ({from_container.zone or 'unzoned'}) to {to_container.id} ({to_container.zone or 'unzoned'})"
            )
            
            movements.append(movement)
            moved_item_ids.append(item.id)
            
            # Update utilization calculation after this move
            item_volume = item.width * item.height * item.depth
            from_volume = from_container.width * from_container.height * from_container.depth
            to_volume = to_container.width * to_container.height * to_container.depth
            
            # Recalculate utilization for the source and destination containers
            utilization_from = container_utilization[from_container.id]
            utilization_to = container_utilization[to_container.id]
            
            # Adjust utilization based on item volume
            adjusted_from = utilization_from - ((item_volume / from_volume) * 100)
            adjusted_to = utilization_to + ((item_volume / to_volume) * 100)
            
            container_utilization[from_container.id] = max(0, adjusted_from)
            container_utilization[to_container.id] = min(100, adjusted_to)
        
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