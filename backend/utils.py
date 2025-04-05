import csv
import io
from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from loguru import logger
from models import Container, Item, LogEntry
from datetime import datetime
import logging

def parse_containers_csv(contents: str) -> List[Dict[str, Any]]:
    """Parse a CSV file containing container information."""
    try:
        if isinstance(contents, bytes):
            contents = contents.decode('utf-8')
            
        # Debug the raw content
        logger.info(f"CSV Content (first 200 chars): {contents[:200]}")
        
        csv_file = io.StringIO(contents)
        reader = csv.DictReader(csv_file)
        
        containers = []
        row_count = 0
        
        for row in reader:
            try:
                row_count += 1
                # Debug info
                logger.info(f"Processing container row {row_count}: {row}")
                
                # Handle new CSV format with columns zone, container_id, width_cm, depth_cm, height_cm
                if all(key in row and row[key] for key in ['zone', 'container_id', 'width_cm', 'depth_cm', 'height_cm']):
                    container = {
                        'id': row['container_id'],
                        'width': float(row['width_cm']) / 100,  # Convert cm to meters
                        'height': float(row['height_cm']) / 100,  # Convert cm to meters
                        'depth': float(row['depth_cm']) / 100,  # Convert cm to meters
                        'capacity': 10,  # Default capacity as it's not in the new format
                        'container_type': 'storage',  # Default type
                        'zone': row['zone']
                    }
                    containers.append(container)
                    logger.info(f"Added container from new format: {container}")
                # Handle standard format with id, width, height, depth, capacity
                elif all(key in row for key in ['id', 'width', 'height', 'depth']):
                    container = {
                        'id': row['id'],
                        'width': float(row['width']),
                        'height': float(row['height']),
                        'depth': float(row['depth']),
                        'capacity': int(row['capacity']) if 'capacity' in row and row['capacity'] else 10,
                        'container_type': 'storage',  # Default type
                        'zone': None  # Default zone
                    }
                    
                    # Add optional fields if present
                    if 'zone' in row and row['zone']:
                        container['zone'] = row['zone']
                    if 'container_type' in row and row['container_type']:
                        container['container_type'] = row['container_type'].lower()
                    
                    containers.append(container)
                    logger.info(f"Added container from standard format: {container}")
                else:
                    # If we get here, try a more lenient parsing approach
                    container = {}
                    
                    # Try to extract essential fields
                    if 'id' in row and row['id']:
                        container['id'] = row['id']
                    elif 'container_id' in row and row['container_id']:
                        container['id'] = row['container_id']
                    else:
                        logger.warning(f"Row {row_count} missing ID field, skipping")
                        continue
                    
                    # Try to get dimensional data
                    try:
                        if all(key in row for key in ['width', 'height', 'depth']):
                            container['width'] = float(row['width'])
                            container['height'] = float(row['height'])
                            container['depth'] = float(row['depth'])
                        elif all(key in row for key in ['width_cm', 'height_cm', 'depth_cm']):
                            container['width'] = float(row['width_cm']) / 100
                            container['height'] = float(row['height_cm']) / 100
                            container['depth'] = float(row['depth_cm']) / 100
                        else:
                            logger.warning(f"Row {row_count} missing dimensional data, using defaults")
                            container['width'] = 2.0
                            container['height'] = 2.0
                            container['depth'] = 2.0
                    except ValueError as e:
                        logger.warning(f"Row {row_count} has invalid dimensional data: {e}, using defaults")
                        container['width'] = 2.0
                        container['height'] = 2.0
                        container['depth'] = 2.0
                    
                    # Get capacity
                    try:
                        container['capacity'] = int(row['capacity']) if 'capacity' in row and row['capacity'] else 10
                    except ValueError:
                        container['capacity'] = 10
                        logger.warning(f"Row {row_count} has invalid capacity, using default")
                    
                    # Get zone and type
                    container['zone'] = row['zone'] if 'zone' in row and row['zone'] else None
                    container['container_type'] = row['container_type'].lower() if 'container_type' in row and row['container_type'] else 'storage'
                    
                    containers.append(container)
                    logger.info(f"Added container using lenient parsing: {container}")
            except (KeyError, ValueError) as e:
                logger.warning(f"Error processing row {row_count}: {e} - {row}")
                continue
        
        logger.info(f"Successfully parsed {len(containers)} containers")
        return containers
    except Exception as e:
        logger.error(f"Error parsing containers CSV: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []

def parse_items_csv(contents: bytes) -> List[Dict[str, Any]]:
    """Parse a CSV file containing item information."""
    try:
        decoded = contents.decode('utf-8')
        csv_file = io.StringIO(decoded)
        reader = csv.DictReader(csv_file)
        
        items = []
        for row in reader:
            try:
                # Debug info
                logger.info(f"Processing item row: {row}")
                
                # Handle new format with item_id, width_cm, depth_cm, height_cm, mass_kg
                if all(key in row and row[key] for key in ['item_id', 'name', 'width_cm', 'depth_cm', 'height_cm', 'mass_kg']):
                    item = {
                        'id': row['item_id'],
                        'name': row['name'],
                        'width': float(row['width_cm']) / 100,  # Convert cm to meters
                        'height': float(row['height_cm']) / 100,  # Convert cm to meters
                        'depth': float(row['depth_cm']) / 100,  # Convert cm to meters
                        'weight': float(row['mass_kg']),
                    }
                    
                    # Add priority if present
                    if 'priority' in row and row['priority']:
                        try:
                            item['priority'] = int(row['priority'])
                        except ValueError:
                            logger.warning(f"Invalid priority for item {row['item_id']}: {row['priority']}")
                    
                    # Add preferred zone if present
                    if 'preferred_zone' in row and row['preferred_zone']:
                        item['preferred_zone'] = row['preferred_zone']
                    
                    # Add expiry date if present and valid
                    if 'expiry_date' in row and row['expiry_date'] and row['expiry_date'].lower() != 'n/a':
                        try:
                            item['expiry_date'] = datetime.strptime(row['expiry_date'], '%Y-%m-%d').date()
                        except ValueError:
                            logger.warning(f"Invalid expiry date format for item {row['item_id']}: {row['expiry_date']}")
                    
                    # Add usage limit if present
                    if 'usage_limit' in row and row['usage_limit']:
                        try:
                            item['usage_limit'] = int(row['usage_limit'])
                        except ValueError:
                            logger.warning(f"Invalid usage_limit for item {row['item_id']}: {row['usage_limit']}")
                    
                    items.append(item)
                # Handle standard format with id, width, height, depth, weight
                elif all(key in row and row[key] for key in ['id', 'name', 'width', 'height', 'depth']):
                    item = {
                        'id': row['id'],
                        'name': row['name'],
                        'width': float(row['width']),
                        'height': float(row['height']),
                        'depth': float(row['depth']),
                        'weight': float(row['weight']) if 'weight' in row and row['weight'] else 1.0,
                    }
                    
                    # Add priority if present
                    if 'priority' in row and row['priority']:
                        try:
                            item['priority'] = int(row['priority'])
                        except ValueError:
                            logger.warning(f"Invalid priority for item {row['id']}: {row['priority']}")
                    
                    # Add preferred zone if present
                    if 'preferred_zone' in row and row['preferred_zone']:
                        item['preferred_zone'] = row['preferred_zone']
                    
                    # Add expiry date if present and valid
                    if 'expiry_date' in row and row['expiry_date'] and row['expiry_date'].lower() != 'n/a':
                        try:
                            item['expiry_date'] = datetime.strptime(row['expiry_date'], '%Y-%m-%d').date()
                        except ValueError:
                            logger.warning(f"Invalid expiry date format for item {row['id']}: {row['expiry_date']}")
                    
                    # Add usage limit if present
                    if 'usage_limit' in row and row['usage_limit']:
                        try:
                            item['usage_limit'] = int(row['usage_limit'])
                        except ValueError:
                            logger.warning(f"Invalid usage_limit for item {row['id']}: {row['usage_limit']}")
                    
                    items.append(item)
                else:
                    logger.warning(f"Skipping row with unknown format: {row}")
            except (KeyError, ValueError) as e:
                logger.warning(f"Skipping row due to error: {e} - {row}")
                continue
        
        return items
    except Exception as e:
        logger.error(f"Error parsing items CSV: {e}")
        return []

def import_containers_to_db(db: Session, containers: List[Dict[str, Any]]) -> int:
    """Import containers into the database, returns count of imported containers."""
    count = 0
    for container_data in containers:
        # Check if container already exists
        existing = db.query(Container).filter(Container.id == container_data['id']).first()
        
        if existing:
            # Update existing container
            for key, value in container_data.items():
                setattr(existing, key, value)
        else:
            # Create new container
            container = Container(**container_data)
            db.add(container)
        
        count += 1
    
    db.commit()
    return count

def import_items_to_db(db: Session, items: List[Dict[str, Any]]) -> int:
    """Import items into the database, returns count of imported items."""
    count = 0
    for item_data in items:
        # Always set placement-related fields to indicate unplaced
        item_data['is_placed'] = False
        item_data['container_id'] = None
        item_data['position_x'] = None
        item_data['position_y'] = None
        item_data['position_z'] = None
        
        # Check if item already exists
        existing = db.query(Item).filter(Item.id == item_data['id']).first()
        
        if existing:
            # Update existing item
            for key, value in item_data.items():
                setattr(existing, key, value)
        else:
            # Create new item
            item = Item(**item_data)
            db.add(item)
        
        count += 1
    
    db.commit()
    return count

def clear_placements(db: Session) -> None:
    """Clear all item placements (reset container_id and position)."""
    items = db.query(Item).all()
    
    for item in items:
        item.container_id = None
        item.position_x = None
        item.position_y = None
        item.position_z = None
        item.is_placed = False
    
    db.commit()

def log_action(db: Session, action: str, item_id: str = None, container_id: str = None, user: str = "system", details: str = None):
    """Log actions performed on items and containers."""
    try:
        # Log to console
        logger.info(f"ACTION: {action} | ITEM: {item_id} | CONTAINER: {container_id} | USER: {user} | DETAILS: {details}")
        
        # Create log entry in database
        log_entry = LogEntry(
            action=action,
            item_id=item_id,
            container_id=container_id,
            user=user,
            details=details
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        logger.error(f"Error logging action: {str(e)}")
        # Don't raise exception to avoid disrupting main functionality 