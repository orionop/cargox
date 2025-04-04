import os
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional

# Load environment variables early
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn
from loguru import logger

from database import get_db
from models import Container, Item, ImportResponse, PlacementResult, RetrievalResponse, WasteManagementResponse, SimulationResponse
from utils import (
    parse_containers_csv, parse_items_csv, 
    import_containers_to_db, import_items_to_db,
    clear_placements, log_action
)
from services.placement import PlacementService
from init_db import init_db

# Configure logging
log_file = f"logs/cargox_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logger.add(log_file, rotation="10 MB", level="INFO")
logger.info("Starting CargoX API")

# Initialize FastAPI app
app = FastAPI(
    title="CargoX API",
    description="API for the CargoX cargo placement and retrieval system",
    version="1.0.0",
)

# Configure CORS - Allow requests from any origin during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database tables on startup
@app.on_event("startup")
async def startup_event():
    try:
        init_db()
        logger.info("CargoX API started successfully")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")

# Root endpoint (health check)
@app.get("/")
async def read_root():
    return {
        "status": "ok",
        "api": "CargoX",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

# Import containers from CSV
@app.post("/import/containers", response_model=ImportResponse)
async def import_containers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported"
        )
    
    try:
        # Read file contents
        contents = await file.read()
        
        # Parse CSV
        containers = parse_containers_csv(contents)
        if not containers:
            return ImportResponse(
                success=False,
                message="No valid containers found in CSV or format error"
            )
        
        # Import to database
        count = import_containers_to_db(db, containers)
        
        return ImportResponse(
            success=True,
            message=f"Successfully imported {count} containers",
            containers_count=count
        )
    
    except Exception as e:
        logger.error(f"Error importing containers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error importing containers: {str(e)}"
        )

# Import items from CSV
@app.post("/import/items", response_model=ImportResponse)
async def import_items(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported"
        )
    
    try:
        # Read file contents
        contents = await file.read()
        
        # Parse CSV
        items = parse_items_csv(contents)
        if not items:
            return ImportResponse(
                success=False,
                message="No valid items found in CSV or format error"
            )
        
        # Import to database
        count = import_items_to_db(db, items)
        
        return ImportResponse(
            success=True,
            message=f"Successfully imported {count} items",
            items_count=count
        )
    
    except Exception as e:
        logger.error(f"Error importing items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error importing items: {str(e)}"
        )

# Import both containers and items
@app.post("/import", response_model=ImportResponse)
async def import_data(
    containers_file: Optional[UploadFile] = File(None),
    items_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    containers_count = 0
    items_count = 0
    success = True
    message = "Import completed"
    
    # Import containers if provided
    if containers_file:
        if not containers_file.filename.endswith('.csv'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are supported for containers"
            )
        
        try:
            contents = await containers_file.read()
            containers = parse_containers_csv(contents)
            containers_count = import_containers_to_db(db, containers)
        except Exception as e:
            success = False
            message = f"Error importing containers: {str(e)}"
    
    # Import items if provided
    if items_file:
        if not items_file.filename.endswith('.csv'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are supported for items"
            )
        
        try:
            contents = await items_file.read()
            items = parse_items_csv(contents)
            items_count = import_items_to_db(db, items)
        except Exception as e:
            success = False
            message = f"{message}. Error importing items: {str(e)}"
    
    # Return combined results
    return ImportResponse(
        success=success,
        message=message,
        containers_count=containers_count,
        items_count=items_count
    )

# Get all containers with their items
@app.get("/containers")
async def get_containers(db: Session = Depends(get_db)):
    try:
        # Get all containers
        containers = db.query(Container).all()
        
        # Prepare response
        response = []
        for container in containers:
            # Get items in this container
            items = []
            for item in container.items:
                items.append({
                    "id": item.id,
                    "name": item.name,
                    "width": item.width,
                    "height": item.height,
                    "depth": item.depth,
                    "weight": item.weight,
                    "is_placed": item.is_placed,
                    "container_id": item.container_id,
                    "position": {
                        "x": item.position_x,
                        "y": item.position_y,
                        "z": item.position_z
                    } if item.is_placed else None,
                    "priority": item.priority,
                    "preferred_zone": item.preferred_zone,
                    "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
                    "usage_limit": item.usage_limit,
                    "usage_count": item.usage_count,
                    "is_waste": item.is_waste
                })
            
            response.append({
                "id": container.id,
                "width": container.width,
                "height": container.height,
                "depth": container.depth,
                "capacity": container.capacity,
                "container_type": container.container_type,
                "zone": container.zone,
                "items": items
            })
        
        return response
    
    except Exception as e:
        logger.error(f"Error retrieving containers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving containers: {str(e)}"
        )

# Place items in containers
@app.post("/place-items", response_model=PlacementResult)
async def place_items(db: Session = Depends(get_db)):
    try:
        # Initialize the placement service
        placement_service = PlacementService(db)
        
        # Run the placement algorithm
        result = placement_service.place_items()
        
        # Get all containers with their items
        containers = db.query(Container).all()
        container_data = []
        
        for container in containers:
            # Get items in this container
            items = []
            for item in container.items:
                if item.is_placed:
                    items.append({
                        "id": item.id,
                        "name": item.name,
                        "width": item.width,
                        "height": item.height,
                        "depth": item.depth,
                        "weight": item.weight,
                        "is_placed": item.is_placed,
                        "container_id": item.container_id,
                        "position": {
                            "x": item.position_x,
                            "y": item.position_y,
                            "z": item.position_z
                        },
                        "priority": item.priority,
                        "preferred_zone": item.preferred_zone,
                        "is_waste": item.is_waste
                    })
            
            container_data.append({
                "id": container.id,
                "width": container.width,
                "height": container.height,
                "depth": container.depth,
                "capacity": container.capacity,
                "container_type": container.container_type,
                "zone": container.zone,
                "items": items
            })
        
        # Convert unplaced items to the expected format
        unplaced_data = [
            {
                "id": item.id,
                "name": item.name,
                "width": item.width,
                "height": item.height,
                "depth": item.depth,
                "weight": item.weight,
                "priority": item.priority,
                "preferred_zone": item.preferred_zone
            }
            for item in result.get("unplaced_items", [])
        ]
        
        # Log the placement action
        log_action(db, "placement", None, None, "system", f"Placed {result.get('placed_count', 0)} items")
        
        return PlacementResult(
            success=True,
            message=f"Placed {result.get('placed_count', 0)} items, {result.get('unplaced_count', 0)} items unplaced",
            containers=container_data,
            unplaced_items=unplaced_data
        )
    
    except Exception as e:
        logger.error(f"Error placing items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error placing items: {str(e)}"
        )

# Get retrieval path for an item
@app.get("/retrieve/{item_id}", response_model=RetrievalResponse)
async def retrieve_item(
    item_id: str, 
    astronaut: str = "system",
    db: Session = Depends(get_db)
):
    try:
        # Initialize the placement service
        placement_service = PlacementService(db)
        
        # Get the retrieval path
        result = placement_service.get_retrieval_path(item_id, user=astronaut)
        
        # Log the retrieval action
        if result["found"]:
            container_id = result["location"]["container"] if result["location"] else None
            log_action(db, "retrieval", item_id, container_id, astronaut, "Item retrieved")
        
        return result
    
    except Exception as e:
        logger.error(f"Error retrieving item {item_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving item: {str(e)}"
        )

# Clear all placements and rerun the placement algorithm
@app.post("/repack", response_model=PlacementResult)
async def repack_items(db: Session = Depends(get_db)):
    try:
        # Clear all placements
        clear_placements(db)
        
        # Run the placement algorithm again
        placement_service = PlacementService(db)
        result = placement_service.place_items()
        
        # Get all containers with their items
        containers = db.query(Container).all()
        container_data = []
        
        for container in containers:
            # Get items in this container
            items = []
            for item in container.items:
                if item.is_placed:
                    items.append({
                        "id": item.id,
                        "name": item.name,
                        "width": item.width,
                        "height": item.height,
                        "depth": item.depth,
                        "weight": item.weight,
                        "is_placed": item.is_placed,
                        "container_id": item.container_id,
                        "position": {
                            "x": item.position_x,
                            "y": item.position_y,
                            "z": item.position_z
                        },
                        "priority": item.priority,
                        "preferred_zone": item.preferred_zone,
                        "is_waste": item.is_waste
                    })
            
            container_data.append({
                "id": container.id,
                "width": container.width,
                "height": container.height,
                "depth": container.depth,
                "capacity": container.capacity,
                "container_type": container.container_type,
                "zone": container.zone,
                "items": items
            })
        
        # Convert unplaced items to the expected format
        unplaced_data = [
            {
                "id": item.id,
                "name": item.name,
                "width": item.width,
                "height": item.height,
                "depth": item.depth,
                "weight": item.weight,
                "priority": item.priority,
                "preferred_zone": item.preferred_zone
            }
            for item in result.get("unplaced_items", [])
        ]
        
        # Log the repack action
        log_action(db, "repack", None, None, "system", f"Repacked all items")
        
        return PlacementResult(
            success=True,
            message=f"Repacked items: placed {result.get('placed_count', 0)} items, {result.get('unplaced_count', 0)} items unplaced",
            containers=container_data,
            unplaced_items=unplaced_data
        )
    
    except Exception as e:
        logger.error(f"Error repacking items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error repacking items: {str(e)}"
        )

# Get rearrangement recommendations
@app.post("/rearrangement-recommendation")
async def get_rearrangement_recommendation(db: Session = Depends(get_db)):
    try:
        # Initialize the placement service
        placement_service = PlacementService(db)
        
        # Get rearrangement recommendations
        result = placement_service.suggest_rearrangement()
        
        # Log the rearrangement recommendation
        log_action(db, "rearrangement_recommendation", None, None, "system", 
                  f"Rearrangement recommendation with {len(result.get('rearrangement_plan', []))} moves")
        
        return result
    
    except Exception as e:
        logger.error(f"Error getting rearrangement recommendation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting rearrangement recommendation: {str(e)}"
        )

# Waste management
@app.post("/waste-management", response_model=WasteManagementResponse)
async def manage_waste(
    undocking: bool = False, 
    max_weight: Optional[float] = None,
    db: Session = Depends(get_db)
):
    try:
        # Initialize the placement service
        placement_service = PlacementService(db)
        
        # Run waste management
        result = placement_service.manage_waste(undocking=undocking, max_weight=max_weight)
        
        # Log the waste management action
        log_action(db, "waste_management", None, None, "system", 
                  f"Waste management {'with undocking' if undocking else 'without undocking'}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error in waste management: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in waste management: {str(e)}"
        )

# Time simulation
@app.post("/simulate-time", response_model=SimulationResponse)
async def simulate_time(
    days: int = Body(1),
    usage_plan: Dict[str, int] = Body({}),
    db: Session = Depends(get_db)
):
    try:
        # Initialize the placement service
        placement_service = PlacementService(db)
        
        # Run time simulation
        result = placement_service.simulate_time(days=days, usage_plan=usage_plan)
        
        # Log the time simulation
        log_action(db, "time_simulation", None, None, "system", 
                  f"Simulated {days} days with {len(usage_plan)} items used")
        
        return result
    
    except Exception as e:
        logger.error(f"Error in time simulation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in time simulation: {str(e)}"
        )

# Simulate a day with basic usage
@app.post("/simulate-day", response_model=SimulationResponse)
async def simulate_day(db: Session = Depends(get_db)):
    try:
        # Initialize the placement service
        placement_service = PlacementService(db)
        
        # Run time simulation for 1 day with no specific usage plan
        result = placement_service.simulate_time(days=1)
        
        # Log the day simulation
        log_action(db, "day_simulation", None, None, "system", "Simulated 1 day")
        
        return result
    
    except Exception as e:
        logger.error(f"Error in day simulation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in day simulation: {str(e)}"
        )

# Run the application
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 