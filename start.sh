#!/bin/bash

# CargoX Startup Script

echo "Starting CargoX services..."

# Start backend services with Docker
echo "Starting backend services..."
docker-compose up -d

# Check if containers are running
echo "Checking container status..."
docker-compose ps

echo "Backend API should now be available at:"
echo "  - http://localhost:8000"

echo ""
echo "To start the frontend, run:"
echo "  npm run dev"
echo ""
echo "Frontend will be available at:"
echo "  - http://localhost:5173"
echo ""
echo "To stop the backend services, run: ./stop.sh" 