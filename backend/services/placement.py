from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from loguru import logger
from models import Container, Item
import math
from datetime import datetime, date, timedelta

class PlacementService:
    """Service for placing items in containers using a 3D bin packing algorithm with priority and zone preferences"""
    
    def __init__(self, db: Session):
        """Initialize the placement service with a database session"""
        self.db = db
    
    def place_items(self) -> Dict[str, Any]:
        """
        Place all unplaced items into containers using a priority-based algorithm.
        
        Returns:
            Dictionary with count of placed and unplaced items, and lists of each
        """
        # Clear any existing placements
        self._clear_existing_placements()
        
        # Get all containers and items from database
        containers = self.db.query(Container).all()
        items = self.db.query(Item).filter(Item.is_waste == False).all()
        
        # Group containers by zone
        containers_by_zone = {}
        for container in containers:
            if container.zone not in containers_by_zone:
                containers_by_zone[container.zone] = []
            containers_by_zone[container.zone].append(container)
        
        # Sort items by priority (highest first) and then by volume
        items.sort(key=lambda i: (-i.priority, -(i.width * i.height * i.depth)))
        
        placed_items = []
        unplaced_items = []
        
        # Try to place each item in the best container
        for item in items:
            placed = False
            preferred_zone = item.preferred_zone
            
            # First try to place in preferred zone containers
            if preferred_zone and preferred_zone in containers_by_zone:
                zone_containers = containers_by_zone[preferred_zone]
                # Sort containers within zone by available space (largest first)
                zone_containers.sort(key=lambda c: c.width * c.height * c.depth, reverse=True)
                
                for container in zone_containers:
                    # Get items already in this container
                    existing_items = [i for i in placed_items if i.container_id == container.id]
                    
                    # Find a valid position for the item in this container
                    # For high priority items, prefer positions closer to the open face
                    position = self._find_position(container, item, existing_items, prioritize_access=item.priority > 50)
                    
                    if position:
                        # Place the item in the container at the found position
                        self._place_item(item, container, position)
                        placed_items.append(item)
                        placed = True
                        break
            
            # If not placed in preferred zone, try any container
            if not placed:
                # Flatten all containers and sort by available space
                all_containers = [c for containers in containers_by_zone.values() for c in containers]
                all_containers.sort(key=lambda c: c.width * c.height * c.depth, reverse=True)
                
                for container in all_containers:
                    if container.zone == preferred_zone:
                        continue  # Skip already-tried preferred zone containers
                    
                    # Get items already in this container
                    existing_items = [i for i in placed_items if i.container_id == container.id]
                    
                    # Find a valid position for the item in this container
                    position = self._find_position(container, item, existing_items)
                    
                    if position:
                        # Place the item in the container at the found position
                        self._place_item(item, container, position)
                        placed_items.append(item)
                        placed = True
                        break
            
            if not placed:
                unplaced_items.append(item)
        
        # Commit changes to database
        try:
            self.db.commit()
            logger.info(f"Successfully placed {len(placed_items)} items, {len(unplaced_items)} items unplaced")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error committing placement changes: {str(e)}")
            return {
                "placed_count": 0, 
                "unplaced_count": len(items),
                "placed_items": [],
                "unplaced_items": items
            }
        
        return {
            "placed_count": len(placed_items),
            "unplaced_count": len(unplaced_items),
            "placed_items": placed_items,
            "unplaced_items": unplaced_items
        }
    
    def _clear_existing_placements(self):
        """Clear all existing placements by resetting relevant fields"""
        items = self.db.query(Item).all()
        
        for item in items:
            item.container_id = None
            item.position_x = None
            item.position_y = None
            item.position_z = None
            item.is_placed = False
    
    def _find_position(self, container: Container, item: Item, existing_items: List[Item], prioritize_access: bool = False) -> Optional[Tuple[float, float, float]]:
        """
        Find a valid position for an item in a container, considering existing items.
        
        Args:
            container: The container to place the item in
            item: The item to place
            existing_items: List of items already in the container
            prioritize_access: If True, prioritize positions near the open face (z=0)
            
        Returns:
            A tuple (x, y, z) representing a valid position, or None if no valid position found
        """
        # Check if the item is too large for the container in any dimension
        if (item.width > container.width or 
            item.height > container.height or 
            item.depth > container.depth):
            return None
        
        # Check if the container is already at capacity
        if len(existing_items) >= container.capacity:
            return None
        
        # Create a list of all possible positions
        positions = []
        
        for z in range(0, math.floor(container.depth - item.depth) + 1):
            for y in range(0, math.floor(container.height - item.height) + 1):
                for x in range(0, math.floor(container.width - item.width) + 1):
                    position = (x, y, z)
                    
                    # Check if this position would cause a collision with any existing item
                    collision = False
                    for existing_item in existing_items:
                        if self._check_collision(
                            (x, y, z), 
                            (item.width, item.height, item.depth),
                            (existing_item.position_x, existing_item.position_y, existing_item.position_z),
                            (existing_item.width, existing_item.height, existing_item.depth)
                        ):
                            collision = True
                            break
                    
                    if not collision:
                        positions.append(position)
        
        if not positions:
            return None
            
        # Sort positions based on preference
        if prioritize_access:
            # For high priority items, prefer positions near the front (smallest z)
            positions.sort(key=lambda pos: pos[2])
        else:
            # For other items, optimize space usage by placing at the back
            positions.sort(key=lambda pos: -pos[2])
            
        return positions[0]
    
    def _check_collision(self, 
                         pos1: Tuple[float, float, float], 
                         dim1: Tuple[float, float, float],
                         pos2: Tuple[float, float, float], 
                         dim2: Tuple[float, float, float]) -> bool:
        """
        Check if two 3D boxes collide.
        
        Args:
            pos1: Position (x, y, z) of first box
            dim1: Dimensions (width, height, depth) of first box
            pos2: Position (x, y, z) of second box
            dim2: Dimensions (width, height, depth) of second box
            
        Returns:
            True if boxes collide, False otherwise
        """
        # Extract positions and dimensions
        x1, y1, z1 = pos1
        width1, height1, depth1 = dim1
        
        x2, y2, z2 = pos2
        width2, height2, depth2 = dim2
        
        # Check for non-collision on each axis
        no_collision_x = x1 + width1 <= x2 or x2 + width2 <= x1
        no_collision_y = y1 + height1 <= y2 or y2 + height2 <= y1
        no_collision_z = z1 + depth1 <= z2 or z2 + depth2 <= z1
        
        # If there's no collision on any axis, the boxes don't collide
        return not (no_collision_x or no_collision_y or no_collision_z)
    
    def _place_item(self, item: Item, container: Container, position: Tuple[float, float, float]):
        """
        Place an item in a container at a specified position.
        
        Args:
            item: The item to place
            container: The container to place the item in
            position: The position (x, y, z) to place the item at
        """
        x, y, z = position
        
        item.container_id = container.id
        item.position_x = x
        item.position_y = y
        item.position_z = z
        item.is_placed = True
        
        # Log the placement
        logger.info(f"Placed item {item.id} in container {container.id} at position ({x}, {y}, {z})")
    
    def get_retrieval_path(self, item_id: str, user: str = "system") -> Dict[str, Any]:
        """
        Calculate the retrieval path for an item, considering expiry date and usage counts.
        
        Args:
            item_id: The ID of the item to retrieve
            user: The person retrieving the item
            
        Returns:
            Dictionary with retrieval information including any items that need to be moved
        """
        # Get the item from database
        item = self.db.query(Item).filter(Item.id == item_id).first()
        
        if not item:
            logger.warning(f"Item {item_id} not found")
            return {
                "found": False,
                "item_id": item_id,
                "path": [],
                "disturbed_items": [],
                "location": None,
                "retrieval_time": datetime.now().isoformat(),
                "retrieved_by": user
            }
        
        if not item.is_placed or not item.container_id:
            logger.warning(f"Item {item_id} is not placed in any container")
            return {
                "found": True,
                "item_id": item_id,
                "path": ["Item is not placed in any container"],
                "disturbed_items": [],
                "location": None,
                "retrieval_time": datetime.now().isoformat(),
                "retrieved_by": user
            }
        
        # Get the container
        container = self.db.query(Container).filter(Container.id == item.container_id).first()
        
        if not container:
            logger.error(f"Container {item.container_id} not found for item {item_id}")
            return {
                "found": True,
                "item_id": item_id,
                "path": ["Error: Container not found"],
                "disturbed_items": [],
                "location": None,
                "retrieval_time": datetime.now().isoformat(),
                "retrieved_by": user
            }
        
        # Get all items in the container
        container_items = self.db.query(Item).filter(
            Item.container_id == container.id,
            Item.id != item_id,
            Item.is_placed == True
        ).all()
        
        # Calculate items that need to be moved to access this item
        disturbed_items = []
        for other_item in container_items:
            # An item blocks access if it's positioned in front of the target item
            if (other_item.position_z < item.position_z and
                self._check_collision(
                    (item.position_x, item.position_y, item.position_z),
                    (item.width, item.height, item.depth),
                    (other_item.position_x, other_item.position_y, item.position_z),
                    (other_item.width, other_item.height, other_item.depth)
                )):
                disturbed_items.append(other_item.id)
        
        # Update retrieval statistics for the item
        item.last_retrieved = date.today()
        item.last_retrieved_by = user
        
        # Create the retrieval path
        path = []
        path.append(f"Open container {container.id}")
        
        if disturbed_items:
            path.append(f"Remove {len(disturbed_items)} items that block access")
            for i, disturbed_id in enumerate(disturbed_items):
                path.append(f"  {i+1}. Remove item {disturbed_id}")
        
        path.append(f"Extract item {item_id}")
        
        if disturbed_items:
            path.append("Replace removed items")
        
        path.append(f"Close container {container.id}")
        
        # Try to commit the retrieval stats update
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating retrieval stats: {str(e)}")
        
        return {
            "found": True,
            "item_id": item_id,
            "path": path,
            "disturbed_items": disturbed_items,
            "location": {
                "container": container.id,
                "position": {
                    "x": item.position_x,
                    "y": item.position_y,
                    "z": item.position_z
                }
            },
            "retrieval_time": datetime.now().isoformat(),
            "retrieved_by": user
        }

    def suggest_rearrangement(self, new_items: List[Item] = None) -> Dict[str, Any]:
        """
        Suggest a rearrangement plan when containers are full or to optimize access.
        
        Args:
            new_items: Optional list of new items that need to be placed
            
        Returns:
            Dictionary with rearrangement suggestions and step-by-step plan
        """
        # Get container utilization
        containers = self.db.query(Container).all()
        items = self.db.query(Item).filter(Item.is_placed == True).all()
        
        # Identify full or nearly full containers
        full_containers = []
        for container in containers:
            container_items = [i for i in items if i.container_id == container.id]
            if len(container_items) >= container.capacity - 1:
                full_containers.append(container.id)
        
        # Find low-priority items that could be moved
        moveable_items = []
        for item in items:
            if item.priority < 30 and item.container_id in full_containers:
                moveable_items.append({
                    "id": item.id,
                    "name": item.name,
                    "priority": item.priority,
                    "container_id": item.container_id
                })
        
        # Sort by priority (lowest first)
        moveable_items.sort(key=lambda i: i["priority"])
        
        # Calculate available space in non-full containers
        available_containers = []
        for container in containers:
            if container.id not in full_containers:
                container_items = [i for i in items if i.container_id == container.id]
                available_slots = container.capacity - len(container_items)
                if available_slots > 0:
                    available_containers.append({
                        "id": container.id,
                        "available_slots": available_slots
                    })
        
        # Create rearrangement plan
        rearrangement_plan = []
        for item in moveable_items[:5]:  # Limit to 5 moves for simplicity
            if available_containers:
                target_container = available_containers[0]
                rearrangement_plan.append({
                    "item_id": item["id"],
                    "item_name": item["name"],
                    "from_container": item["container_id"],
                    "to_container": target_container["id"]
                })
                target_container["available_slots"] -= 1
                if target_container["available_slots"] <= 0:
                    available_containers.pop(0)
        
        return {
            "full_containers": full_containers,
            "moveable_items_count": len(moveable_items),
            "rearrangement_plan": rearrangement_plan
        }
    
    def manage_waste(self, undocking: bool = False, max_weight: float = None) -> Dict[str, Any]:
        """
        Identify waste items (expired or fully used) and suggest waste management.
        
        Args:
            undocking: If True, prepare for undocking (move waste to waste containers)
            max_weight: Maximum weight limit for undocking waste
            
        Returns:
            Dictionary with waste management information
        """
        # Identify waste items (expired or fully used)
        today = date.today()
        
        # Get items that are expired or fully used
        expired_items = self.db.query(Item).filter(
            Item.expiry_date != None,
            Item.expiry_date < today,
            Item.is_waste == False
        ).all()
        
        fully_used_items = self.db.query(Item).filter(
            Item.usage_limit != None,
            Item.usage_count >= Item.usage_limit,
            Item.is_waste == False
        ).all()
        
        # Mark these items as waste in the database
        waste_items = expired_items + fully_used_items
        for item in waste_items:
            item.is_waste = True
        
        try:
            self.db.commit()
            logger.info(f"Marked {len(waste_items)} items as waste")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error marking waste items: {str(e)}")
        
        # Find waste containers
        waste_containers = self.db.query(Container).filter(
            Container.container_type == "waste"
        ).all()
        
        waste_container_ids = [c.id for c in waste_containers]
        
        # Calculate total waste mass
        total_waste_mass = sum(item.weight for item in waste_items)
        
        # If undocking, suggest moving waste to waste containers
        waste_movement_plan = []
        if undocking and waste_containers:
            waste_to_move = []
            current_weight = 0
            
            # Sort waste by weight (heaviest first to optimize container usage)
            placed_waste = [item for item in waste_items if item.is_placed]
            placed_waste.sort(key=lambda i: i.weight, reverse=True)
            
            for item in placed_waste:
                if max_weight and current_weight + item.weight > max_weight:
                    continue
                
                waste_to_move.append({
                    "id": item.id,
                    "name": item.name,
                    "weight": item.weight,
                    "current_container": item.container_id
                })
                current_weight += item.weight
            
            # Simple allocation of waste to waste containers
            container_idx = 0
            for item in waste_to_move:
                if container_idx >= len(waste_containers):
                    container_idx = 0
                
                waste_movement_plan.append({
                    "item_id": item["id"],
                    "item_name": item["name"],
                    "from_container": item["current_container"],
                    "to_container": waste_containers[container_idx].id
                })
                container_idx += 1
        
        return {
            "success": True,
            "message": f"Identified {len(waste_items)} waste items",
            "waste_items": [item.id for item in waste_items],
            "waste_containers": waste_container_ids,
            "total_waste_mass": total_waste_mass,
            "waste_movement_plan": waste_movement_plan if undocking else []
        }
    
    def simulate_time(self, days: int = 1, usage_plan: Dict[str, int] = None) -> Dict[str, Any]:
        """
        Simulate the passage of time and item usage.
        
        Args:
            days: Number of days to simulate
            usage_plan: Dictionary mapping item IDs to usage count increments
            
        Returns:
            Dictionary with simulation results
        """
        today = date.today()
        simulated_date = today + timedelta(days=days)
        
        # Apply usage if a plan is provided
        used_items = []
        if usage_plan:
            for item_id, usage in usage_plan.items():
                item = self.db.query(Item).filter(Item.id == item_id).first()
                if item:
                    item.usage_count += usage
                    used_items.append(item_id)
        
        # Check for newly expired items
        newly_expired = self.db.query(Item).filter(
            Item.expiry_date != None,
            Item.expiry_date > today,
            Item.expiry_date <= simulated_date,
            Item.is_waste == False
        ).all()
        
        # Check for newly fully used items
        newly_used_up = self.db.query(Item).filter(
            Item.usage_limit != None,
            Item.usage_count < Item.usage_limit,
            Item.is_waste == False
        ).all()
        
        newly_used_up = [item for item in newly_used_up if item.usage_count >= item.usage_limit]
        
        # Mark waste items
        new_waste_items = []
        for item in newly_expired + newly_used_up:
            item.is_waste = True
            new_waste_items.append(item.id)
        
        # Commit changes
        try:
            self.db.commit()
            logger.info(f"Simulated {days} days with {len(used_items)} items used")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error during time simulation: {str(e)}")
        
        return {
            "success": True,
            "message": f"Successfully simulated {days} days",
            "days_simulated": days,
            "simulated_date": simulated_date.isoformat(),
            "items_used": used_items,
            "items_expired": [item.id for item in newly_expired],
            "items_fully_used": [item.id for item in newly_used_up],
            "new_waste_items": new_waste_items
        } 