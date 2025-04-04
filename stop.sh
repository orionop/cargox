#!/bin/bash

# CargoX Cleanup Script

echo "Stopping CargoX backend services..."

# Stop Docker containers
docker-compose down

echo "Docker containers have been stopped."
echo "To restart the services, run: ./start.sh"

# Note: The frontend Vite server needs to be stopped manually with Ctrl+C
echo "NOTE: If the frontend development server is running,"
echo "      you need to stop it manually with Ctrl+C in its terminal."

# Optionally clean up volumes (uncomment if needed)
# echo "Removing persistent data (volumes)..."
# docker volume rm project_postgres-data 