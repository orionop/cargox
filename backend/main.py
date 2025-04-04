import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

# Load environment variables early
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn
from loguru import logger
from sqlalchemy import or_
from pydantic import BaseModel

from database import get_db
from models import Container, Item, ImportResponse, PlacementResult, RetrievalResponse, WasteManagementResponse, SimulationResponse, LogEntry, LogEntryResponse
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

# Track item retrieval (usage)
@app.post("/retrieve/{item_id}")
async def retrieve_item_usage(
    item_id: str,
    astronaut: str = Body("system"),
    db: Session = Depends(get_db)
):
    try:
        # Get the item
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_id} not found"
            )
        
        # Update usage count if limit exists
        if item.usage_limit is not None:
            item.usage_count += 1
            
            # Check if item is now waste (fully used)
            if item.usage_limit > 0 and item.usage_count >= item.usage_limit:
                item.is_waste = True
                logger.info(f"Item {item_id} marked as waste: usage limit reached")
        
        # Record retrieval time and user
        item.last_retrieved = datetime.now().date()
        item.last_retrieved_by = astronaut
        
        # Temporarily remove item from container (will be placed back with /place endpoint)
        old_container_id = item.container_id
        item.container_id = None
        item.position_x = None
        item.position_y = None
        item.position_z = None
        item.is_placed = False
        
        # Save changes
        db.commit()
        
        # Log the retrieval
        log_action(db, "retrieval", item_id, old_container_id, astronaut, 
                  f"Item retrieved. New usage count: {item.usage_count}/{item.usage_limit if item.usage_limit else 'unlimited'}")
        
        return {
            "success": True,
            "message": f"Item {item_id} retrieved by {astronaut}",
            "item": {
                "id": item.id,
                "name": item.name,
                "usage_count": item.usage_count,
                "usage_limit": item.usage_limit,
                "is_waste": item.is_waste,
                "last_retrieved": item.last_retrieved.isoformat() if item.last_retrieved else None,
                "last_retrieved_by": item.last_retrieved_by
            }
        }
    
    except HTTPException:
        raise
    
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

# Pydantic model for usage plan
class UsagePlanRequest(BaseModel):
    usage_plan: Dict[str, int] = {}

# Simulate a day passing in the system
@app.post("/simulate/day")
async def simulate_day(
    request: UsagePlanRequest = Body(...),
    db: Session = Depends(get_db)
):
    try:
        usage_plan = request.usage_plan
        
        # Move forward one day
        simulated_date = datetime.now().date() + timedelta(days=1)
        expired_items = []
        used_items = []
        
        # Process usage plan (use each item the specified number of times)
        for item_id, uses in usage_plan.items():
            item = db.query(Item).filter(Item.id == item_id).first()
            if not item:
                logger.warning(f"Item {item_id} from usage plan not found")
                continue
                
            # Skip waste items
            if item.is_waste:
                continue
                
            # Update usage count
            if item.usage_limit is not None:
                old_count = item.usage_count
                item.usage_count += uses
                
                used_items.append({
                    "id": item.id,
                    "name": item.name,
                    "old_count": old_count,
                    "new_count": item.usage_count,
                    "limit": item.usage_limit
                })
                
                # Check if item is now waste (fully used)
                if item.usage_limit > 0 and item.usage_count >= item.usage_limit:
                    item.is_waste = True
                    logger.info(f"Item {item_id} marked as waste: usage limit reached during simulation")
        
        # Check for expired items
        items = db.query(Item).filter(Item.is_waste == False).all()
        for item in items:
            if item.expiry_date and item.expiry_date <= simulated_date:
                item.is_waste = True
                expired_items.append({
                    "id": item.id,
                    "name": item.name,
                    "expiry_date": item.expiry_date.isoformat()
                })
                logger.info(f"Item {item.id} marked as waste: expired during simulation")
        
        # Save changes
        db.commit()
        
        # Log the simulation
        log_action(db, "day_simulation", None, None, "system", 
                  f"Simulated day: {len(used_items)} items used, {len(expired_items)} items expired")
        
        return {
            "success": True,
            "message": f"Simulated day (now {simulated_date.isoformat()})",
            "simulated_date": simulated_date.isoformat(),
            "used_items": used_items,
            "expired_items": expired_items
        }
    
    except Exception as e:
        logger.error(f"Error simulating day: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error simulating day: {str(e)}"
        )

# Search for items
@app.get("/search")
async def search_items(
    query: Optional[str] = None,
    zone: Optional[str] = None,
    priority_min: Optional[int] = None,
    priority_max: Optional[int] = None,
    is_waste: Optional[bool] = None,
    container_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        # Start with all items
        items_query = db.query(Item)
        
        # Apply filters
        if query:
            items_query = items_query.filter(
                or_(
                    Item.id.ilike(f"%{query}%"),
                    Item.name.ilike(f"%{query}%")
                )
            )
        
        if zone:
            containers_in_zone = db.query(Container.id).filter(Container.zone == zone)
            items_query = items_query.filter(Item.container_id.in_(containers_in_zone))
        
        if priority_min is not None:
            items_query = items_query.filter(Item.priority >= priority_min)
            
        if priority_max is not None:
            items_query = items_query.filter(Item.priority <= priority_max)
            
        if is_waste is not None:
            items_query = items_query.filter(Item.is_waste == is_waste)
            
        if container_id:
            items_query = items_query.filter(Item.container_id == container_id)
        
        # Execute query
        items = items_query.all()
        
        # Format results
        results = []
        for item in items:
            # Get container info if placed
            container_info = None
            if item.container_id:
                container = db.query(Container).filter(Container.id == item.container_id).first()
                if container:
                    container_info = {
                        "id": container.id,
                        "zone": container.zone,
                        "type": container.container_type
                    }
            
            results.append({
                "id": item.id,
                "name": item.name,
                "width": item.width,
                "height": item.height,
                "depth": item.depth,
                "weight": item.weight,
                "priority": item.priority,
                "preferred_zone": item.preferred_zone,
                "is_placed": item.is_placed,
                "container": container_info,
                "position": {
                    "x": item.position_x,
                    "y": item.position_y,
                    "z": item.position_z
                } if item.is_placed else None,
                "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
                "usage_limit": item.usage_limit,
                "usage_count": item.usage_count,
                "is_waste": item.is_waste
            })
        
        log_action(db, "search", None, None, "system", f"Searched for items: found {len(results)} results")
        return results
    
    except Exception as e:
        logger.error(f"Error searching items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching items: {str(e)}"
        )

# Place item in a container after use
@app.post("/place")
async def place_item(
    item_id: str = Body(...),
    container_id: str = Body(...),
    position_x: float = Body(0.0),
    position_y: float = Body(0.0),
    position_z: float = Body(0.0),
    astronaut: str = Body("system"),
    db: Session = Depends(get_db)
):
    try:
        # Get the item
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item with ID {item_id} not found"
            )
            
        # Get the container
        container = db.query(Container).filter(Container.id == container_id).first()
        if not container:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Container with ID {container_id} not found"
            )
            
        # Validate position is within container dimensions
        if position_x < 0 or position_x + item.width > container.width:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item width exceeds container boundaries or invalid x position"
            )
            
        if position_y < 0 or position_y + item.height > container.height:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item height exceeds container boundaries or invalid y position"
            )
            
        if position_z < 0 or position_z + item.depth > container.depth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item depth exceeds container boundaries or invalid z position"
            )
            
        # Update item placement
        item.container_id = container_id
        item.position_x = position_x
        item.position_y = position_y
        item.position_z = position_z
        item.is_placed = True
        
        # Save changes
        db.commit()
        
        # Log the placement
        log_action(db, "placement", item_id, container_id, astronaut, 
                  f"Item placed in container at position ({position_x}, {position_y}, {position_z})")
        
        return {
            "success": True,
            "message": f"Item {item_id} placed in container {container_id} by {astronaut}",
            "item": {
                "id": item.id,
                "name": item.name,
                "container_id": item.container_id,
                "position": {
                    "x": item.position_x,
                    "y": item.position_y,
                    "z": item.position_z
                },
                "is_placed": item.is_placed
            }
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Error placing item {item_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error placing item: {str(e)}"
        )

# Identify waste items based on expiry and usage
@app.get("/waste/identify")
async def identify_waste(
    db: Session = Depends(get_db)
):
    try:
        today = datetime.now().date()
        waste_items = []
        
        # Get all items
        items = db.query(Item).all()
        
        for item in items:
            # Skip items already marked as waste
            if item.is_waste:
                waste_items.append({
                    "id": item.id,
                    "name": item.name,
                    "reason": "Already marked as waste"
                })
                continue
                
            # Check for expired items
            if item.expiry_date and item.expiry_date < today:
                item.is_waste = True
                waste_items.append({
                    "id": item.id,
                    "name": item.name,
                    "reason": f"Expired on {item.expiry_date.isoformat()}"
                })
                
            # Check for depleted items (usage limit reached)
            elif item.usage_limit and item.usage_count >= item.usage_limit:
                item.is_waste = True
                waste_items.append({
                    "id": item.id,
                    "name": item.name,
                    "reason": f"Usage limit reached ({item.usage_count}/{item.usage_limit})"
                })
        
        # Save changes
        db.commit()
        
        # Log the waste identification
        log_action(db, "waste_identification", None, None, "system", 
                  f"Identified {len(waste_items)} waste items")
        
        return {
            "success": True,
            "message": f"Identified {len(waste_items)} waste items",
            "waste_items": waste_items
        }
    
    except Exception as e:
        logger.error(f"Error identifying waste: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error identifying waste: {str(e)}"
        )

# Generate a plan for returning waste items
@app.get("/waste/return-plan")
async def generate_waste_return_plan(
    target_zone: str = Query("W", description="The zone where waste should be moved to"),
    db: Session = Depends(get_db)
):
    try:
        # Get all waste items that are placed in containers
        waste_items = db.query(Item).filter(
            Item.is_waste == True,
            Item.is_placed == True
        ).all()
        
        # Get all containers in the target zone
        waste_containers = db.query(Container).filter(
            Container.zone == target_zone
        ).all()
        
        if not waste_containers:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No containers found in zone '{target_zone}'"
            )
        
        # Prepare the return plan
        return_plan = []
        total_waste_mass = 0
        
        # Assign each waste item to a waste container
        current_container_index = 0
        
        for item in waste_items:
            # Get the current waste item container
            source_container = db.query(Container).filter(Container.id == item.container_id).first()
            
            # Get the target waste container
            target_container = waste_containers[current_container_index]
            
            # Create movement instruction
            return_plan.append({
                "item_id": item.id,
                "item_name": item.name,
                "weight": item.weight,
                "source_container": {
                    "id": source_container.id,
                    "zone": source_container.zone
                },
                "target_container": {
                    "id": target_container.id,
                    "zone": target_container.zone
                }
            })
            
            total_waste_mass += item.weight
            
            # Move to next waste container if available (round-robin)
            current_container_index = (current_container_index + 1) % len(waste_containers)
        
        # Log the waste return plan
        log_action(db, "waste_return_plan", None, None, "system", 
                  f"Generated return plan for {len(return_plan)} waste items, total mass: {total_waste_mass} kg")
        
        return {
            "success": True,
            "message": f"Generated waste return plan for {len(return_plan)} items",
            "total_waste_mass": total_waste_mass,
            "target_zone": target_zone,
            "waste_containers": [c.id for c in waste_containers],
            "return_plan": return_plan
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Error generating waste return plan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating waste return plan: {str(e)}"
        )

# Get action logs
@app.get("/logs")
async def get_logs(
    action: Optional[str] = None,
    item_id: Optional[str] = None,
    container_id: Optional[str] = None,
    user: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    try:
        # Start with all logs
        query = db.query(LogEntry)
        
        # Apply filters
        if action:
            query = query.filter(LogEntry.action == action)
            
        if item_id:
            query = query.filter(LogEntry.item_id == item_id)
            
        if container_id:
            query = query.filter(LogEntry.container_id == container_id)
            
        if user:
            query = query.filter(LogEntry.user == user)
            
        if from_date:
            try:
                from_date_obj = datetime.strptime(from_date, '%Y-%m-%d').date()
                query = query.filter(LogEntry.timestamp >= from_date_obj)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid from_date format. Use YYYY-MM-DD"
                )
                
        if to_date:
            try:
                to_date_obj = datetime.strptime(to_date, '%Y-%m-%d').date()
                query = query.filter(LogEntry.timestamp <= to_date_obj)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid to_date format. Use YYYY-MM-DD"
                )
        
        # Order by timestamp and limit results
        logs = query.order_by(LogEntry.timestamp.desc(), LogEntry.id.desc()).limit(limit).all()
        
        # Convert to response model
        log_entries = [LogEntryResponse.from_orm(log) for log in logs]
        
        return {
            "success": True,
            "count": len(log_entries),
            "logs": log_entries
        }
    
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Error retrieving logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving logs: {str(e)}"
        )

# Run the application
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 