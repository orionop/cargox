#!/usr/bin/env python3
import sys
import os
import json
import urllib.request
import urllib.error
from pathlib import Path

def post_file(url, file_path):
    """Post a file to the API using urllib"""
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    
    with open(file_path, 'rb') as f:
        file_data = f.read()
    
    headers = {
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
    
    body = []
    body.append(f'--{boundary}'.encode())
    body.append(f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(file_path)}"'.encode())
    body.append('Content-Type: text/csv'.encode())
    body.append(''.encode())
    body.append(file_data)
    body.append(f'--{boundary}--'.encode())
    
    body = b'\r\n'.join(body)
    
    req = urllib.request.Request(url, data=body, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            response_data = response.read()
            return response.getcode(), json.loads(response_data)
    except urllib.error.HTTPError as e:
        return e.code, {"error": str(e)}

def post_json(url, data=None):
    """Post JSON data to the API using urllib"""
    headers = {
        'Content-Type': 'application/json'
    }
    
    post_data = json.dumps(data or {}).encode('utf-8')
    
    req = urllib.request.Request(url, data=post_data, headers=headers)
    req.method = 'POST'
    
    try:
        with urllib.request.urlopen(req) as response:
            response_data = response.read()
            return response.getcode(), json.loads(response_data)
    except urllib.error.HTTPError as e:
        return e.code, {"error": str(e)}

def main():
    """Test script to import container and item data from CSV files"""
    base_url = "http://localhost:8000"
    
    # Test importing containers from samples
    containers_file = Path("../samples/containers.csv")
    if containers_file.exists():
        print(f"Importing containers from {containers_file}")
        
        status, response = post_file(f"{base_url}/import/containers", containers_file)
        print(f"Status: {status}")
        print(f"Response: {response}")
    else:
        print(f"File not found: {containers_file}")

    # Also test the original containers format
    containers_file = Path("data/containers.csv")
    if containers_file.exists():
        print(f"\nImporting containers from {containers_file}")
        
        status, response = post_file(f"{base_url}/import/containers", containers_file)
        print(f"Status: {status}")
        print(f"Response: {response}")
    else:
        print(f"File not found: {containers_file}")
    
    # Test importing items
    items_file = Path("data/input_items.csv")
    if items_file.exists():
        print(f"\nImporting items from {items_file}")
        
        status, response = post_file(f"{base_url}/import/items", items_file)
        print(f"Status: {status}")
        print(f"Response: {response}")
    else:
        print(f"File not found: {items_file}")
    
    # Test the placement API
    print("\nPlacing items in containers")
    status, response = post_json(f"{base_url}/place-items")
    print(f"Status: {status}")
    if status == 200:
        print(f"Placed {response.get('message')}")
    else:
        print(f"Error: {response}")

if __name__ == "__main__":
    main() 