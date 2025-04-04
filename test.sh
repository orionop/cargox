#!/bin/bash

# Test script for CargoX API
echo "Testing CargoX API..."

# Health check
echo -e "\n=== Health Check ==="
curl -s http://localhost:8000/ | jq

# Import containers
echo -e "\n=== Import Containers ==="
curl -s -X POST -F 'file=@backend/data/containers.csv' http://localhost:8000/import/containers | jq

# Import items
echo -e "\n=== Import Items ==="
curl -s -X POST -F 'file=@backend/data/input_items.csv' http://localhost:8000/import/items | jq

# Place items
echo -e "\n=== Place Items ==="
curl -s -X POST http://localhost:8000/place-items | jq '.message'

# Retrieve item
echo -e "\n=== Retrieve Item ==="
curl -s http://localhost:8000/retrieve/I001 | jq '.path'

echo -e "\nAll tests completed!" 