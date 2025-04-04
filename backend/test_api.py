#!/usr/bin/env python3
"""
Simple script to test the CargoX API
"""
import requests
import os
from pprint import pprint

# API endpoint
API_URL = os.getenv("API_URL", "http://localhost:8000")

def test_health():
    """Test the health endpoint"""
    response = requests.get(f"{API_URL}/")
    print("=== API Health Check ===")
    pprint(response.json())
    print()

def test_import_containers():
    """Test importing containers from CSV"""
    with open("data/containers.csv", "rb") as f:
        files = {"file": ("containers.csv", f, "text/csv")}
        response = requests.post(f"{API_URL}/import/containers", files=files)
    
    print("=== Import Containers ===")
    pprint(response.json())
    print()

def test_import_items():
    """Test importing items from CSV"""
    with open("data/input_items.csv", "rb") as f:
        files = {"file": ("input_items.csv", f, "text/csv")}
        response = requests.post(f"{API_URL}/import/items", files=files)
    
    print("=== Import Items ===")
    pprint(response.json())
    print()

def test_place_items():
    """Test placing items in containers"""
    response = requests.post(f"{API_URL}/place-items")
    
    print("=== Place Items ===")
    print(f"Success: {response.json().get('success')}")
    print(f"Message: {response.json().get('message')}")
    print(f"Container count: {len(response.json().get('containers', []))}")
    print(f"Unplaced items: {len(response.json().get('unplaced_items', []))}")
    print()

def test_retrieve_item():
    """Test retrieving an item"""
    response = requests.get(f"{API_URL}/retrieve/I001")
    
    print("=== Retrieve Item ===")
    print(f"Found: {response.json().get('found')}")
    print(f"Item ID: {response.json().get('item_id')}")
    print("Path:")
    for step in response.json().get('path', []):
        print(f"  - {step}")
    
    print(f"Disturbed items: {response.json().get('disturbed_items')}")
    if response.json().get('location'):
        print(f"Location: Container {response.json().get('location').get('container')}")
        pos = response.json().get('location').get('position')
        print(f"Position: ({pos.get('x')}, {pos.get('y')}, {pos.get('z')})")
    print()

def main():
    """Run all tests"""
    print("Starting CargoX API tests...\n")
    
    try:
        test_health()
        test_import_containers()
        test_import_items()
        test_place_items()
        test_retrieve_item()
        
        print("All tests completed successfully!")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main() 