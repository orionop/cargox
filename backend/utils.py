import csv
import io
from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from loguru import logger
from models import Container, Item

def parse_containers_csv(file_content: bytes) -> List[Dict[str, Any]]:
    """
    Parse a containers CSV file and return a list of container dictionaries.
    
    Args:
        file_content: The content of the CSV file as bytes
        
    Returns:
        List of container dictionaries
    """
    containers = []
    standard_columns = {'id', 'width', 'height', 'depth', 'capacity'}
    alternate_columns = {'zone', 'container_id', 'width_cm', 'depth_cm', 'height_cm'}
    
    try:
        decoded_content = file_content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded_content))
        fieldnames = set(csv_reader.fieldnames) if csv_reader.fieldnames else set()
        
        # Check if we're using the alternate format
        using_alternate_format = alternate_columns.issubset(fieldnames)
        
        # Check if standard format is used
        using_standard_format = standard_columns.issubset(fieldnames)
        
        if not (using_standard_format or using_alternate_format):
            logger.error(f"CSV does not match any supported format. Fields: {fieldnames}")
            return []
        
        for row in csv_reader:
            try:
                if using_alternate_format:
                    # Using alternate format (zone, container_id, width_cm, depth_cm, height_cm)
                    container = {
                        'id': row['container_id'],
                        'width': float(row['width_cm']),
                        'height': float(row['height_cm']),
                        'depth': float(row['depth_cm']),
                        'capacity': 5  # Default capacity since it's not in the input
                    }
                else:
                    # Using standard format
                    container = {
                        'id': row['id'],
                        'width': float(row['width']),
                        'height': float(row['height']),
                        'depth': float(row['depth']),
                        'capacity': int(row['capacity'])
                    }
                containers.append(container)
            except (ValueError, KeyError) as e:
                logger.error(f"Error parsing container row: {row}, Error: {str(e)}")
        
        logger.info(f"Successfully parsed {len(containers)} containers from CSV")
        return containers
    
    except Exception as e:
        logger.error(f"Error parsing containers CSV: {str(e)}")
        return []

def parse_items_csv(file_content: bytes) -> List[Dict[str, Any]]:
    """
    Parse an items CSV file and return a list of item dictionaries.
    
    Args:
        file_content: The content of the CSV file as bytes
        
    Returns:
        List of item dictionaries
    """
    items = []
    standard_columns = {'id', 'name', 'width', 'height', 'depth', 'weight'}
    alternate_columns = {'item_id', 'name', 'width_cm', 'depth_cm', 'height_cm', 'mass_kg'}
    
    try:
        decoded_content = file_content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded_content))
        fieldnames = set(csv_reader.fieldnames) if csv_reader.fieldnames else set()
        
        # Check if we're using the alternate format
        using_alternate_format = 'item_id' in fieldnames and 'width_cm' in fieldnames
        
        # Check if standard format is used
        using_standard_format = standard_columns.issubset(fieldnames)
        
        if not (using_standard_format or using_alternate_format):
            logger.error(f"CSV does not match any supported format. Fields: {fieldnames}")
            return []
        
        for row in csv_reader:
            try:
                if using_alternate_format:
                    # Using alternate format with item_id, width_cm etc.
                    item = {
                        'id': row['item_id'],
                        'name': row['name'],
                        'width': float(row['width_cm']),
                        'height': float(row['height_cm']),
                        'depth': float(row['depth_cm']),
                        'weight': float(row['mass_kg'])
                    }
                else:
                    # Using standard format
                    item = {
                        'id': row['id'],
                        'name': row['name'],
                        'width': float(row['width']),
                        'height': float(row['height']),
                        'depth': float(row['depth']),
                        'weight': float(row['weight'])
                    }
                items.append(item)
            except (ValueError, KeyError) as e:
                logger.error(f"Error parsing item row: {row}, Error: {str(e)}")
        
        logger.info(f"Successfully parsed {len(items)} items from CSV")
        return items
    
    except Exception as e:
        logger.error(f"Error parsing items CSV: {str(e)}")
        return []

def import_containers_to_db(db: Session, containers: List[Dict[str, Any]]) -> int:
    """
    Import containers into the database.
    
    Args:
        db: Database session
        containers: List of container dictionaries
        
    Returns:
        Number of containers imported
    """
    try:
        count = 0
        for container_data in containers:
            container = Container(**container_data)
            db.merge(container)  # Using merge to handle duplicates
            count += 1
        
        db.commit()
        logger.info(f"Successfully imported {count} containers to database")
        return count
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error importing containers to database: {str(e)}")
        return 0

def import_items_to_db(db: Session, items: List[Dict[str, Any]]) -> int:
    """
    Import items into the database.
    
    Args:
        db: Database session
        items: List of item dictionaries
        
    Returns:
        Number of items imported
    """
    try:
        count = 0
        for item_data in items:
            item = Item(**item_data)
            db.merge(item)  # Using merge to handle duplicates
            count += 1
        
        db.commit()
        logger.info(f"Successfully imported {count} items to database")
        return count
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error importing items to database: {str(e)}")
        return 0

def clear_placements(db: Session) -> int:
    """
    Clear all item placements in the database.
    
    Args:
        db: Database session
        
    Returns:
        Number of items reset
    """
    try:
        items = db.query(Item).all()
        count = 0
        
        for item in items:
            item.container_id = None
            item.position_x = None
            item.position_y = None
            item.position_z = None
            item.is_placed = False
            count += 1
        
        db.commit()
        logger.info(f"Successfully cleared placements for {count} items")
        return count
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error clearing placements: {str(e)}")
        return 0 