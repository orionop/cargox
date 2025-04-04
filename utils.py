from typing import List, Dict, Any
import io
import csv
import logging

logger = logging.getLogger(__name__)

def parse_containers_csv(contents: bytes) -> List[Dict[str, Any]]:
    """Parse a CSV file containing container information."""
    try:
        decoded = contents.decode('utf-8')
        csv_file = io.StringIO(decoded)
        reader = csv.DictReader(csv_file)
        
        containers = []
        for row in reader:
            try:
                # Debug info
                logger.info(f"Processing row: {row}")
                
                # Handle new CSV format with columns zone, container_id, width_cm, depth_cm, height_cm
                if all(key in row for key in ['zone', 'container_id', 'width_cm', 'depth_cm', 'height_cm']):
                    container = {
                        'id': row['container_id'],
                        'width': float(row['width_cm']) / 100,  # Convert cm to meters
                        'height': float(row['height_cm']) / 100,  # Convert cm to meters
                        'depth': float(row['depth_cm']) / 100,  # Convert cm to meters
                        'capacity': 10,  # Default capacity as it's not in the new format
                        'container_type': 'storage',  # Default type
                        'zone': row['zone']
                    }
                # Handle standard format with id, width, height, depth, capacity
                elif all(key in row for key in ['id', 'width', 'height', 'depth']):
                    container = {
                        'id': row['id'],
                        'width': float(row['width']),
                        'height': float(row['height']),
                        'depth': float(row['depth']),
                        'capacity': int(row['capacity']) if 'capacity' in row else 10,
                    }
                    
                    # Add optional fields if present
                    if 'zone' in row:
                        container['zone'] = row['zone']
                    if 'container_type' in row:
                        container['container_type'] = row['container_type']
                else:
                    logger.warning(f"Skipping row with unknown format: {row}")
                    continue
                
                containers.append(container)
            except (KeyError, ValueError) as e:
                logger.warning(f"Skipping row due to error: {e} - {row}")
                continue
        
        return containers
    except Exception as e:
        logger.error(f"Error parsing containers CSV: {e}")
        return [] 