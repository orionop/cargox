#!/usr/bin/env python3
import sys
import os
import csv
import io
from pathlib import Path
import logging
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
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
                # Handle standard format with id, width, height, depth, capacity
                elif all(key in row and row[key] for key in ['id', 'width', 'height', 'depth']):
                    container = {
                        'id': row['id'],
                        'width': float(row['width']),
                        'height': float(row['height']),
                        'depth': float(row['depth']),
                        'capacity': int(row['capacity']) if 'capacity' in row and row['capacity'] else 10,
                    }
                    
                    # Add optional fields if present
                    if 'zone' in row and row['zone']:
                        container['zone'] = row['zone']
                    if 'container_type' in row and row['container_type']:
                        container['container_type'] = row['container_type']
                    
                    containers.append(container)
                else:
                    logger.warning(f"Skipping row with unknown format: {row}")
            except (KeyError, ValueError) as e:
                logger.warning(f"Skipping row due to error: {e} - {row}")
                continue
        
        return containers
    except Exception as e:
        logger.error(f"Error parsing containers CSV: {e}")
        return []

def test_parse_containers_csv(file_path):
    """Test parsing a containers CSV file directly"""
    try:
        with open(file_path, 'rb') as f:
            contents = f.read()
        
        logger.info(f"Reading file: {file_path}")
        containers = parse_containers_csv(contents)
        
        if containers:
            logger.info(f"Successfully parsed {len(containers)} containers:")
            for i, container in enumerate(containers[:5]):  # Show first 5 only
                logger.info(f"  Container {i+1}: {container}")
            if len(containers) > 5:
                logger.info(f"  ... and {len(containers) - 5} more")
        else:
            logger.error(f"No containers parsed from file.")
        
        return containers
    except Exception as e:
        logger.error(f"Error testing CSV parser: {e}")
        return []

def main():
    # Test the standard format
    logger.info("------ Testing standard format ------")
    containers = test_parse_containers_csv("data/containers.csv")
    
    # Test the new format
    logger.info("\n------ Testing new format ------")
    containers = test_parse_containers_csv("samples/containers.csv")

if __name__ == "__main__":
    main() 