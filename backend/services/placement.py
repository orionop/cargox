from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from loguru import logger
from models import Container, Item
import math

class PlacementService:
    """Service for placing items in containers using a 3D bin packing algorithm"""
    
    def __init__(self, db: Session):
        """Initialize the placement service with a database session"""
        self.db = db
    
    def place_items(self) -> Dict[str, Any]:
        """
        Place all unplaced items into containers using a best-fit algorithm.
        
        Returns:
            Dictionary with count of placed and unplaced items, and lists of each
        """
        # Clear any existing placements
        self._clear_existing_placements()
        
        # Get all containers and items from database
        containers = self.db.query(Container).all()
        items = self.db.query(Item).all()
        
        # Sort containers by volume (largest first)
        containers.sort(key=lambda c: c.width * c.height * c.depth, reverse=True)
        
        # Sort items by volume (largest first)
        items.sort(key=lambda i: i.width * i.height * i.depth, reverse=True)
        
        placed_items = []
        unplaced_items = []
        
        # Try to place each item in the best container
        for item in items:
            placed = False
            
            for container in containers:
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
    
    def _find_position(self, container: Container, item: Item, existing_items: List[Item]) -> Optional[Tuple[float, float, float]]:
        """
        Find a valid position for an item in a container, considering existing items.
        
        Uses a simple algorithm that tries to place items at the bottom-left-back corner
        and then checks for collisions with existing items.
        
        Args:
            container: The container to place the item in
            item: The item to place
            existing_items: List of items already in the container
            
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
        
        # Try different positions starting from the bottom-left-back corner
        # and moving right, forward, and up
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
                        return position
        
        # If we get here, no valid position was found
        return None
    
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
    
    def get_retrieval_path(self, item_id: str) -> Dict[str, Any]:
        """
        Calculate the retrieval path for an item.
        
        Args:
            item_id: The ID of the item to retrieve
            
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
                "location": None
            }
        
        if not item.is_placed or not item.container_id:
            logger.warning(f"Item {item_id} is not placed in any container")
            return {
                "found": True,
                "item_id": item_id,
                "path": ["Item is not placed in any container"],
                "disturbed_items": [],
                "location": None
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
                "location": None
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
            if (other_item.position_z > item.position_z and
                self._check_collision(
                    (item.position_x, item.position_y, item.position_z),
                    (item.width, item.height, item.depth),
                    (other_item.position_x, other_item.position_y, item.position_z),
                    (other_item.width, other_item.height, other_item.depth)
                )):
                disturbed_items.append(other_item.id)
        
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
            }
        } 