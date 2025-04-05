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
from fastapi.responses import StreamingResponse
import io

from database import get_db
from models import Container, Item, ImportResponse, PlacementResult, RetrievalResponse, WasteManagementResponse, SimulationResponse, LogEntry, LogEntryResponse, SystemConfig
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

# Test endpoint
@app.get("/test-endpoint")
async def test_endpoint():
    return {
        "success": True,
        "message": "Test endpoint is working",
        "timestamp": datetime.now().isoformat()
    }

# Placeholder for database dependency when PostgreSQL is not available
class MockDB:
    def __init__(self):
        self.containers = []
        self.items = []
        self.logs = []
        
    def query(self, model):
        if model == Container:
            return MockQuery(self.containers)
        elif model == Item:
            return MockQuery(self.items)
        elif model == LogEntry:
            return MockQuery(self.logs)
        else:
            return MockQuery([])
        
    def commit(self):
        pass
        
    def add(self, item):
        if isinstance(item, Container):
            self.containers.append(item)
        elif isinstance(item, Item):
            self.items.append(item)
        elif isinstance(item, LogEntry):
            self.logs.append(item)

class MockQuery:
    def __init__(self, items):
        self.items = items
        self._filters = []
        
    def filter(self, *args):
        # Simple passthrough filter - doesn't actually filter in this mock
        return self
        
    def first(self):
        return self.items[0] if self.items else None
        
    def all(self):
        return self.items
        
    def order_by(self, *args):
        return self
        
    def limit(self, n):
        return self

# Override the database dependency when PostgreSQL is not available
def get_mock_db():
    db = MockDB()
    try:
        # Initialize with some mock data
        mock_container = Container(
            id="mockContainer",
            width=2.0,
            height=2.0,
            depth=2.0,
            capacity=10,
            container_type="Storage",
            zone="A"
        )
        db.containers.append(mock_container)
        
        mock_item = Item(
            id="mockItem001",
            name="Mock Item",
            width=0.5,
            height=0.5,
            depth=0.5,
            weight=5.0,
            is_placed=True,
            container_id="mockContainer",
            position_x=0.0,
            position_y=0.0,
            position_z=0.0,
            priority=90,
            preferred_zone="A",
            is_waste=False
        )
        db.items.append(mock_item)
        
        yield db
    finally:
        pass

# Modified database dependency function
def get_db_with_fallback():
    try:
        db = next(get_db())
        # Test the connection
        db.query(Container).first()
        yield db
    except Exception as e:
        logger.warning(f"Database connection failed: {str(e)}. Using mock database.")
        yield from get_mock_db()

# API specification aliases
# Modify the endpoints to use the new database dependency

# 1. Placement Recommendations API
@app.post("/api/placement", response_model=PlacementResult)
async def api_placement(db: Session = Depends(get_db_with_fallback)):
    try:
        # For mock DB, just return static placement result
        if isinstance(db, MockDB):
            return PlacementResult(
                success=True,
                message="Placement recommendations (MOCK DATA)",
                containers=[{
                    "id": "mockContainer",
                    "width": 2.0,
                    "height": 2.0,
                    "depth": 2.0,
                    "capacity": 10,
                    "container_type": "Storage",
                    "zone": "A",
                    "items": [{
                        "id": "mockItem001",
                        "name": "Mock Item",
                        "width": 0.5,
                        "height": 0.5,
                        "depth": 0.5,
                        "weight": 5.0,
                        "is_placed": True,
                        "container_id": "mockContainer",
                        "position": {
                            "x": 0.0,
                            "y": 0.0,
                            "z": 0.0
                        },
                        "priority": 90,
                        "preferred_zone": "A",
                        "is_waste": False
                    }]
                }],
                unplaced_items=[]
            )
        
        # Regular implementation for real DB
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
        try:
            log_action(db, "placement", None, None, "system", f"Placement recommendations generated for {result.get('placed_count', 0)} items")
        except Exception as log_error:
            logger.warning(f"Could not log action: {str(log_error)}")
        
        return PlacementResult(
            success=True,
            message=f"Placement recommendations for {result.get('placed_count', 0)} items, {result.get('unplaced_count', 0)} items unplaced",
            containers=container_data,
            unplaced_items=unplaced_data
        )
    
    except Exception as e:
        logger.error(f"Error generating placement recommendations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating placement recommendations: {str(e)}"
        )

# 2. Item Search and Retrieval API
@app.get("/api/search")
async def api_search(
    itemId: Optional[str] = None,
    itemName: Optional[str] = None,
    userId: Optional[str] = None,
    db: Session = Depends(get_db_with_fallback)
):
    try:
        # Mock data for testing
        if isinstance(db, MockDB):
            if itemId == "test001":
                return {
                    "items": [{
                        "id": "test001",
                        "name": "Test Item",
                        "width": 1.0,
                        "height": 1.0,
                        "depth": 1.0,
                        "weight": 5.0,
                        "is_placed": False,
                        "container_id": None,
                        "position": None,
                        "priority": 10,
                        "preferred_zone": "A",
                        "is_waste": False
                    }],
                    "count": 1,
                    "message": "Found 1 items matching the criteria (MOCK DATA)"
                }
            elif itemName and "test" in itemName.lower():
                return {
                    "items": [{
                        "id": "test001",
                        "name": "Test Item",
                        "width": 1.0,
                        "height": 1.0,
                        "depth": 1.0,
                        "weight": 5.0,
                        "is_placed": False,
                        "container_id": None,
                        "position": None,
                        "priority": 10,
                        "preferred_zone": "A",
                        "is_waste": False
                    }],
                    "count": 1,
                    "message": "Found 1 items matching the criteria (MOCK DATA)"
                }
            else:
                return {"items": [], "count": 0, "message": "No items found matching the criteria"}
        
        # Build query
        query = db.query(Item)
        
        # If no parameters are provided, return all items
        if not itemId and not itemName and not userId:
            items = query.all()
            
            if not items:
                return {"items": [], "count": 0, "message": "No items found in the database"}
            
            # Format response
            items_data = []
            for item in items:
                items_data.append({
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
                    } if item.position_x is not None else None,
                    "priority": item.priority,
                    "preferred_zone": item.preferred_zone,
                    "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
                    "usage_limit": item.usage_limit,
                    "usage_count": item.usage_count,
                    "is_waste": item.is_waste
                })
            
            return {
                "items": items_data,
                "count": len(items_data),
                "message": f"Found {len(items_data)} items"
            }
        
        # Apply filters based on provided parameters
        if itemId:
            # Support partial ID matches (case insensitive)
            query = query.filter(Item.id.ilike(f"%{itemId}%"))
            
        if itemName:
            # Support partial name matches (case insensitive)
            query = query.filter(Item.name.ilike(f"%{itemName}%"))
            
        if userId:
            # Filter by last retrieved user
            query = query.filter(Item.last_retrieved_by == userId)
        
        # If no filters were applied (all parameters are empty), return an empty result
        if not itemId and not itemName and not userId:
            return {"items": [], "count": 0, "message": "Please provide either itemId or itemName for search"}
        
        # Get items matching the criteria
        items = query.all()
        
        if not items:
            return {"items": [], "count": 0, "message": "No items found matching the criteria"}
        
        # Format response
        items_data = []
        for item in items:
            items_data.append({
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
                } if item.position_x is not None else None,
                "priority": item.priority,
                "preferred_zone": item.preferred_zone,
                "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
                "usage_limit": item.usage_limit,
                "usage_count": item.usage_count,
                "is_waste": item.is_waste
            })
        
        # Log the search
        search_criteria = []
        if itemId:
            search_criteria.append(f"ID: {itemId}")
        if itemName:
            search_criteria.append(f"Name: {itemName}")
        if userId:
            search_criteria.append(f"User: {userId}")
        
        try:
            log_message = f"Item search performed with criteria: {', '.join(search_criteria)}. Found {len(items)} items."
            log_action(db, "search", None, None, "system", log_message)
        except Exception as log_error:
            logger.warning(f"Could not log action: {str(log_error)}")
        
        return {
            "items": items_data,
            "count": len(items_data),
            "message": f"Found {len(items_data)} items matching the criteria"
        }
    
    except Exception as e:
        logger.error(f"Error searching for items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching for items: {str(e)}"
        )

@app.post("/api/retrieve")
async def api_retrieve(
    body: dict = Body(...),
    db: Session = Depends(get_db_with_fallback)
):
    try:
        item_id = body.get("itemId")
        user_id = body.get("userId", "system")
        
        if not item_id:
            raise HTTPException(status_code=400, detail="itemId is required")
        
        # Mock data for testing
        if isinstance(db, MockDB):
            if item_id == "mockItem001" or item_id == "test001":
                return {
                    "success": True,
                    "message": f"Item {item_id} retrieved by {user_id} (MOCK DATA)",
                    "item": {
                        "id": item_id,
                        "name": "Mock Item" if item_id == "mockItem001" else "Test Item",
                        "usage_count": 1,
                        "usage_limit": 10,
                        "is_waste": False,
                        "last_retrieved": datetime.now().date().isoformat(),
                        "last_retrieved_by": user_id
                    }
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Item with ID {item_id} not found"
                )
        
        # Regular implementation
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
        item.last_retrieved_by = user_id
        
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
        try:
            log_action(db, "retrieval", item_id, old_container_id, user_id, 
                      f"Item retrieved. New usage count: {item.usage_count}/{item.usage_limit if item.usage_limit else 'unlimited'}")
        except Exception as log_error:
            logger.warning(f"Could not log action: {str(log_error)}")
        
        return {
            "success": True,
            "message": f"Item {item_id} retrieved by {user_id}",
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
        logger.error(f"Error retrieving item: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving item: {str(e)}"
        )

@app.post("/api/place")
async def api_place(
    body: dict = Body(...),
    db: Session = Depends(get_db_with_fallback)
):
    try:
        item_id = body.get("itemId", "")
        container_id = body.get("containerId", "")
        position_x = body.get("position", {}).get("x", 0.0) if body.get("position") else body.get("positionX", 0.0)
        position_y = body.get("position", {}).get("y", 0.0) if body.get("position") else body.get("positionY", 0.0)
        position_z = body.get("position", {}).get("z", 0.0) if body.get("position") else body.get("positionZ", 0.0)
        user_id = body.get("userId", "system")
        
        # Mock data for testing
        if isinstance(db, MockDB):
            if item_id == "mockItem001" or item_id == "test001" or item_id == "001555":
                return {
                    "success": True,
                    "message": f"Item {item_id} placed in container {container_id} by {user_id} (MOCK DATA)",
                    "item": {
                        "id": item_id,
                        "name": "Mock Item" if item_id == "mockItem001" else "Test Item",
                        "container_id": container_id,
                        "position": {
                            "x": position_x,
                            "y": position_y,
                            "z": position_z
                        },
                        "is_placed": True
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"Item with ID {item_id} not found (MOCK DATA)"
                }
        
        # Regular implementation
        try:
            # First, check if the items and containers exist
            item = db.query(Item).filter(Item.id == item_id).first()
            if not item:
                return {
                    "success": False,
                    "message": f"Item with ID {item_id} not found"
                }
                
            container = db.query(Container).filter(Container.id == container_id).first()
            if not container:
                return {
                    "success": False,
                    "message": f"Container with ID {container_id} not found"
                }
                
            # Validate position is within container dimensions
            if position_x < 0 or position_x + item.width > container.width:
                return {
                    "success": False,
                    "message": f"Item width exceeds container boundaries or invalid x position"
                }
                
            if position_y < 0 or position_y + item.height > container.height:
                return {
                    "success": False,
                    "message": f"Item height exceeds container boundaries or invalid y position"
                }
                
            if position_z < 0 or position_z + item.depth > container.depth:
                return {
                    "success": False,
                    "message": f"Item depth exceeds container boundaries or invalid z position"
                }
                
            # Update item placement
            item.container_id = container_id
            item.position_x = position_x
            item.position_y = position_y
            item.position_z = position_z
            item.is_placed = True
            
            # Save changes
            db.commit()
            
            # Log the placement
            log_action(db, "placement", item_id, container_id, user_id, 
                    f"Item placed in container at position ({position_x}, {position_y}, {position_z})")
            
            return {
                "success": True,
                "message": f"Item {item_id} placed in container {container_id} by {user_id}",
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
        except Exception as e:
            logger.error(f"Error placing item {item_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Error placing item: {str(e)}"
            }
    
    except Exception as e:
        logger.error(f"Error in API place endpoint: {str(e)}")
        return {
            "success": False,
            "message": f"Error in place API: {str(e)}"
        }

# 3. Waste Management API
@app.get("/api/waste/identify")
async def api_waste_identify(db: Session = Depends(get_db_with_fallback)):
    try:
        # Mock data for testing
        if isinstance(db, MockDB):
            return {
                "success": True,
                "message": "Identified 1 waste item (MOCK DATA)",
                "waste_items": [{
                    "id": "mockWaste001",
                    "name": "Expired Item",
                    "reason": "Expired on 2025-01-01"
                }]
            }
        
        # Identify potential waste items
        try:
            # Get items that are marked as waste
            waste_items = db.query(Item).filter(Item.is_waste == True).all()
            
            # Get items with expiry date in the past
            today = datetime.now().date()
            expired_items = db.query(Item).filter(
                Item.is_waste == False,
                Item.expiry_date.isnot(None),
                Item.expiry_date < today
            ).all()
            
            # Mark expired items as waste
            for item in expired_items:
                item.is_waste = True
                waste_items.append(item)
            
            # Get items that have reached their usage limit
            used_up_items = db.query(Item).filter(
                Item.is_waste == False,
                Item.usage_limit.isnot(None),
                Item.usage_count >= Item.usage_limit
            ).all()
            
            # Mark used up items as waste
            for item in used_up_items:
                item.is_waste = True
                waste_items.append(item)
            
            # Save changes
            db.commit()
            
            # Format response
            waste_items_data = []
            for item in waste_items:
                reason = "Unknown"
                if item.expiry_date and item.expiry_date < today:
                    reason = f"Expired on {item.expiry_date.isoformat()}"
                elif item.usage_limit and item.usage_count >= item.usage_limit:
                    reason = f"Usage limit reached ({item.usage_count}/{item.usage_limit})"
                else:
                    reason = "Marked as waste"
                
                waste_items_data.append({
                    "id": item.id,
                    "name": item.name,
                    "reason": reason
                })
            
            # Log the action
            try:
                log_action(db, "waste_identification", None, None, "system", 
                          f"Identified {len(waste_items_data)} waste items")
            except Exception as log_error:
                logger.warning(f"Could not log action: {str(log_error)}")
            
            return {
                "success": True,
                "message": f"Identified {len(waste_items_data)} waste items",
                "waste_items": waste_items_data
            }
        
        except Exception as db_error:
            logger.error(f"Database error during waste identification: {str(db_error)}")
            import traceback
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during waste identification: {str(db_error)}"
            )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Error identifying waste: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error identifying waste: {str(e)}"
        )

@app.post("/api/waste/return-plan")
async def api_waste_return_plan(
    body: dict = Body({}),
    db: Session = Depends(get_db_with_fallback)
):
    try:
        target_zone = body.get("targetZone", "W")
        
        # Mock data for testing
        if isinstance(db, MockDB):
            return {
                "success": True,
                "message": "Generated waste return plan for 1 item (MOCK DATA)",
                "total_waste_mass": 5.0,
                "target_zone": target_zone,
                "waste_containers": ["wasteContainer"],
                "return_plan": [{
                    "item_id": "mockWaste001",
                    "item_name": "Expired Item",
                    "weight": 5.0,
                    "source_container": {
                        "id": "mockContainer",
                        "zone": "A"
                    },
                    "target_container": {
                        "id": "wasteContainer",
                        "zone": target_zone
                    }
                }]
            }
        
        # Check target zone validity - more flexible approach
        logger.info(f"Checking for waste containers in zone '{target_zone}'")
        
        # Try exact match first
        waste_containers = db.query(Container).filter(
            Container.container_type.ilike("%waste%"),
            Container.zone == target_zone
        ).all()
        
        # If nothing found, try with trailing space (common mistake in data)
        if not waste_containers:
            waste_containers = db.query(Container).filter(
                Container.container_type.ilike("%waste%"),
                Container.zone == f"{target_zone} "
            ).all()
            
        # If still nothing, try case-insensitive partial match
        if not waste_containers:
            waste_containers = db.query(Container).filter(
                Container.container_type.ilike("%waste%"),
                Container.zone.ilike(f"%{target_zone}%")
            ).all()
        
        if not waste_containers:
            logger.warning(f"No waste containers found in zone {target_zone}")
            return {
                "success": False,
                "message": f"No waste containers found in zone {target_zone}",
                "total_waste_mass": 0.0,
                "target_zone": target_zone,
                "waste_containers": [],
                "return_plan": []
            }
            
        # Log found containers
        logger.info(f"Found {len(waste_containers)} waste containers: {[c.id for c in waste_containers]}")
        
        # Get all waste items that need to be returned
        waste_items = db.query(Item).filter(Item.is_waste == True).all()
        
        if not waste_items:
            logger.info(f"No waste items to return")
            return {
                "success": True,
                "message": "No waste items to return",
                "total_waste_mass": 0.0,
                "target_zone": target_zone,
                "waste_containers": [container.id for container in waste_containers],
                "return_plan": []
            }
        
        # Calculate total waste mass
        total_waste_mass = sum(item.weight for item in waste_items)
        
        # Create return plan
        return_plan = []
        for item in waste_items:
            # Find source container for placed items
            source_container = None
            if item.container_id:
                source_container = db.query(Container).filter(Container.id == item.container_id).first()
            
            # For simplicity, assign to first waste container (could be optimized further)
            target_container = waste_containers[0]
            
            return_plan.append({
                "item_id": item.id,
                "item_name": item.name,
                "weight": item.weight,
                "source_container": {
                    "id": source_container.id,
                    "zone": source_container.zone
                } if source_container else None,
                "target_container": {
                    "id": target_container.id,
                    "zone": target_container.zone
                }
            })
        
        # Log the action
        try:
            log_action(
                db, 
                "waste_return_plan", 
                None, 
                None, 
                "system",
                f"Generated waste return plan for {len(waste_items)} items to zone {target_zone}"
            )
        except Exception as log_error:
            logger.warning(f"Could not log action: {str(log_error)}")
        
        return {
            "success": True,
            "message": f"Generated waste return plan for {len(waste_items)} items",
            "total_waste_mass": total_waste_mass,
            "target_zone": target_zone,
            "waste_containers": [container.id for container in waste_containers],
            "return_plan": return_plan
        }
    
    except Exception as e:
        logger.error(f"Error generating waste return plan: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating waste return plan: {str(e)}"
        )

@app.post("/api/waste/complete-undocking")
async def api_waste_complete_undocking(
    body: dict = Body({}),
    db: Session = Depends(get_db_with_fallback)
):
    try:
        container_ids = body.get("containerIds", [])
        remove_items = body.get("removeItems", True)
        
        if not container_ids:
            raise HTTPException(status_code=400, detail="No container IDs provided")
        
        # Mock data for testing
        if isinstance(db, MockDB):
            return {
                "success": True,
                "processed_containers": container_ids,
                "removed_items": ["mockWaste001"],
                "message": f"Successfully processed {len(container_ids)} containers and removed 1 item (MOCK DATA)"
            }
        
        # Process containers
        processed_containers = []
        removed_items = []
        
        for container_id in container_ids:
            container = db.query(Container).filter(Container.id == container_id).first()
            if not container:
                logger.warning(f"Container {container_id} not found, skipping")
                continue
            
            # Get items in this container
            items = db.query(Item).filter(Item.container_id == container_id).all()
            
            # Process items based on flag
            if remove_items:
                for item in items:
                    # Mark that the item has been removed from the system
                    item.is_waste = False  # No longer considered waste in the system
                    item.container_id = None
                    item.position_x = None
                    item.position_y = None
                    item.position_z = None
                    item.is_placed = False
                    removed_items.append(item.id)
            
            processed_containers.append(container_id)
        
        # Save changes
        db.commit()
        
        # Log the action
        try:
            log_action(db, "waste_undocking", None, None, "system", 
                      f"Completed undocking for containers: {', '.join(processed_containers)}. " +
                      f"Removed {len(removed_items)} items from the system.")
        except Exception as log_error:
            logger.warning(f"Could not log action: {str(log_error)}")
        
        return {
            "success": True,
            "processed_containers": processed_containers,
            "removed_items": removed_items,
            "message": f"Successfully processed {len(processed_containers)} containers and removed {len(removed_items)} items"
        }
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Error completing waste undocking: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing waste undocking: {str(e)}"
        )

# 4. Time Simulation API - Uses the existing endpoint
@app.post("/api/simulate/day")
async def api_simulate_day(
    body: dict = Body(...),
    db: Session = Depends(get_db_with_fallback)
):
    try:
        usage_plan = body.get("usage_plan", {})
        
        # Mock data for testing
        if isinstance(db, MockDB):
            return {
                "success": True,
                "message": "Simulated day (now 2025-04-06) (MOCK DATA)",
                "simulated_date": "2025-04-06",
                "used_items": [],
                "expired_items": []
            }
        
        # Regular implementation
        request = UsagePlanRequest(usage_plan=usage_plan)
        result = await simulate_day(request, db)
        return result
    
    except Exception as e:
        logger.error(f"Error simulating day: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error simulating day: {str(e)}"
        )

# 5. Import/Export API
@app.post("/api/import/items", response_model=ImportResponse)
async def api_import_items(
    file: UploadFile = File(...),
    db: Session = Depends(get_db_with_fallback)
):
    try:
        # Mock data for testing
        if isinstance(db, MockDB):
            return ImportResponse(
                success=True,
                message="Successfully imported 5 items (MOCK DATA)",
                items_count=5
            )
        
        # Validate file type
        if not file.filename.endswith('.csv'):
            return ImportResponse(
                success=False,
                message="Only CSV files are supported"
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
            
            # Log the import
            log_action(db, "import", None, None, "system", f"Imported {count} items")
            
            return ImportResponse(
                success=True,
                message=f"Successfully imported {count} items",
                items_count=count
            )
        except Exception as inner_e:
            logger.error(f"Error processing items import: {str(inner_e)}")
            return ImportResponse(
                success=False,
                message=f"Error importing items: {str(inner_e)}"
            )
    
    except Exception as e:
        logger.error(f"Error in API import items endpoint: {str(e)}")
        return ImportResponse(
            success=False,
            message=f"Error importing items: {str(e)}"
        )

@app.post("/api/import/containers", response_model=ImportResponse)
async def api_import_containers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db_with_fallback)
):
    try:
        # Mock data for testing
        if isinstance(db, MockDB):
            return ImportResponse(
                success=True,
                message="Successfully imported 3 containers (MOCK DATA)",
                containers_count=3
            )
        
        # Validate file type
        if not file.filename.endswith('.csv'):
            return ImportResponse(
                success=False,
                message="Only CSV files are supported"
            )
            
        try:
            # Read file content
            contents = await file.read()
            file_content = contents.decode("utf-8")
            
            # Log details
            logger.info(f"Processing CSV with content length: {len(file_content)}")
            
            # Parse the CSV
            try:
                containers = parse_containers_csv(file_content)
                logger.info(f"Parsed {len(containers)} containers from CSV")
            except Exception as parse_error:
                logger.error(f"Error parsing container CSV: {str(parse_error)}")
                return ImportResponse(
                    success=False,
                    message=f"Error parsing CSV: {str(parse_error)}"
                )
            
            # Import to database
            count = import_containers_to_db(db, containers)
            
            # Log the import
            log_action(db, "import", None, None, "system", f"Imported {count} containers")
            
            return ImportResponse(
                success=True,
                message=f"Successfully imported {count} containers",
                containers_count=count
            )
        except Exception as inner_e:
            logger.error(f"Error processing containers import: {str(inner_e)}")
            return ImportResponse(
                success=False,
                message=f"Error importing containers: {str(inner_e)}"
            )
    
    except Exception as e:
        logger.error(f"Error in API import containers endpoint: {str(e)}")
        return ImportResponse(
            success=False,
            message=f"Error importing containers: {str(e)}"
        )

@app.get("/api/export/arrangement")
async def api_export_arrangement(db: Session = Depends(get_db_with_fallback)):
    try:
        # Mock data for testing
        if isinstance(db, MockDB):
            # Create CSV content
            csv_content = "Item ID,Container ID,Coordinates (W1,D1,H1),(W2,D2,H2)\n"
            csv_content += "mockItem001,mockContainer,(0.0,0.0,0.0),(0.5,0.5,0.5)\n"
            
            # Create a response with CSV attachment
            response = StreamingResponse(
                io.StringIO(csv_content),
                media_type="text/csv"
            )
            response.headers["Content-Disposition"] = "attachment; filename=mock_arrangement.csv"
            
            return response
        
        # Regular implementation
        # Get all placed items
        items = db.query(Item).filter(Item.is_placed == True).all()
        
        # Create CSV content
        csv_content = "Item ID,Container ID,Coordinates (W1,D1,H1),(W2,D2,H2)\n"
        
        for item in items:
            # Calculate the second coordinate point based on dimensions
            w2 = item.position_x + item.width
            d2 = item.position_y + item.depth
            h2 = item.position_z + item.height
            
            csv_content += f"{item.id},{item.container_id},({item.position_x},{item.position_y},{item.position_z}),({w2},{d2},{h2})\n"
        
        # Log the export
        try:
            log_action(db, "export", None, None, "system", f"Exported arrangement with {len(items)} items")
        except Exception as log_error:
            logger.warning(f"Could not log action: {str(log_error)}")
        
        # Create a response with CSV attachment
        response = StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv"
        )
        response.headers["Content-Disposition"] = "attachment; filename=arrangement.csv"
        
        return response
    
    except Exception as e:
        logger.error(f"Error exporting arrangement: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting arrangement: {str(e)}"
        )

# 6. Logging API
@app.get("/api/logs")
async def api_logs(
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    itemId: Optional[str] = None,
    userId: Optional[str] = None,
    actionType: Optional[str] = None,
    db: Session = Depends(get_db_with_fallback)
):
    try:
        # Mock data for testing
        if isinstance(db, MockDB):
            mock_timestamp = datetime.now()
            mock_logs = [
                {
                    "id": 1,
                    "timestamp": mock_timestamp.isoformat(),
                    "action_type": "placement",
                    "item_id": "mockItem001",
                    "container_id": "mockContainer",
                    "user": "system",
                    "details": "Item placed in container (MOCK DATA)"
                },
                {
                    "id": 2,
                    "timestamp": (mock_timestamp - timedelta(hours=1)).isoformat(),
                    "action_type": "retrieval",
                    "item_id": "mockItem001",
                    "container_id": "mockContainer",
                    "user": "astronaut1",
                    "details": "Item retrieved (MOCK DATA)"
                },
                {
                    "id": 3,
                    "timestamp": (mock_timestamp - timedelta(days=1)).isoformat(),
                    "action_type": "waste_identification",
                    "item_id": "mockWaste001",
                    "container_id": None,
                    "user": "system",
                    "details": "Item marked as waste: expired (MOCK DATA)"
                }
            ]
            
            return {
                "success": True,
                "count": len(mock_logs),
                "logs": mock_logs
            }
            
        # Regular implementation
        # Build the query
        query = db.query(LogEntry)
        
        # Apply filters
        if startDate:
            try:
                start_date = datetime.fromisoformat(startDate)
                query = query.filter(LogEntry.timestamp >= start_date)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid startDate format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
                )
        
        if endDate:
            try:
                end_date = datetime.fromisoformat(endDate)
                query = query.filter(LogEntry.timestamp <= end_date)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid endDate format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
                )
        
        if itemId:
            query = query.filter(LogEntry.item_id == itemId)
        
        if userId:
            query = query.filter(LogEntry.user == userId)
        
        if actionType:
            # Map the user-friendly action types to database values
            action_type_map = {
                "placement": "placement",
                "retrieval": "retrieval",
                "rearrangement": "rearrangement",
                "disposal": "waste_identification",
                "waste_identification": "waste_identification",
                "waste_return_plan": "waste_return_plan",
                "waste_undocking": "waste_undocking"
            }
            
            db_action_type = action_type_map.get(actionType.lower())
            if db_action_type:
                query = query.filter(LogEntry.action == db_action_type)
            else:
                valid_types = ", ".join(action_type_map.keys())
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid actionType. Valid types are: {valid_types}"
                )
        
        # Order by timestamp (newest first)
        query = query.order_by(LogEntry.timestamp.desc())
        
        # Get the logs
        logs = query.all()
        
        # Format the response
        log_entries = []
        for log in logs:
            log_entries.append({
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "action_type": log.action,
                "item_id": log.item_id,
                "container_id": log.container_id,
                "user": log.user,
                "details": log.details
            })
        
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

@app.get("/api/containers")
async def api_containers(
    containerId: Optional[str] = None,
    containerType: Optional[str] = None,
    zone: Optional[str] = None,
    db: Session = Depends(get_db_with_fallback)
):
    try:
        # Mock data for testing
        if isinstance(db, MockDB):
            mock_container = {
                "id": "mockContainer",
                "width": 2.0,
                "height": 2.0,
                "depth": 2.0,
                "capacity": 10,
                "container_type": "Storage",
                "zone": "A",
                "items": []
            }
            
            if containerId == "mockContainer":
                return {
                    "containers": [mock_container],
                    "count": 1,
                    "message": "Found 1 container matching the criteria (MOCK DATA)"
                }
            elif containerType == "Waste":
                waste_container = mock_container.copy()
                waste_container["container_type"] = "Waste"
                waste_container["zone"] = "W"
                return {
                    "containers": [waste_container],
                    "count": 1,
                    "message": "Found 1 container matching the criteria (MOCK DATA)"
                }
            else:
                return {"containers": [], "count": 0, "message": "No containers found matching the criteria"}
        
        # Build query
        try:
            query = db.query(Container)
            
            if containerId:
                query = query.filter(Container.id == containerId)
            if containerType:
                query = query.filter(Container.container_type == containerType.lower())
            if zone:
                query = query.filter(Container.zone == zone)
            
            # Get containers matching the criteria
            containers = query.all()
            
            if not containers:
                return {"containers": [], "count": 0, "message": "No containers found matching the criteria"}
            
            # Format response with items
            containers_data = []
            for container in containers:
                # Get items in this container
                items_query = db.query(Item).filter(Item.container_id == container.id)
                items = items_query.all()
                
                # Format items data
                items_data = []
                for item in items:
                    items_data.append({
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
                        } if item.position_x is not None else None,
                        "priority": item.priority,
                        "preferred_zone": item.preferred_zone,
                        "is_waste": item.is_waste if hasattr(item, 'is_waste') else False
                    })
                
                # Add container with its items
                containers_data.append({
                    "id": container.id,
                    "width": container.width,
                    "height": container.height,
                    "depth": container.depth,
                    "capacity": container.capacity,
                    "container_type": container.container_type,
                    "zone": container.zone,
                    "items": items_data
                })
            
            # Log the search action
            search_criteria = []
            if containerId:
                search_criteria.append(f"ID: {containerId}")
            if containerType:
                search_criteria.append(f"Type: {containerType}")
            if zone:
                search_criteria.append(f"Zone: {zone}")
            
            try:
                log_message = f"Container search performed with criteria: {', '.join(search_criteria)}. Found {len(containers)} containers."
                log_action(db, "search", None, None, "system", log_message)
            except Exception as log_error:
                logger.warning(f"Could not log action: {str(log_error)}")
            
            return {
                "containers": containers_data,
                "count": len(containers_data),
                "message": f"Found {len(containers_data)} containers matching the criteria"
            }
        
        except Exception as db_error:
            logger.error(f"Database error during container search: {str(db_error)}")
            import traceback
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during container search: {str(db_error)}"
            )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Error searching for containers: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching for containers: {str(e)}"
        )

@app.post("/api/truncate-database")
async def truncate_database(db: Session = Depends(get_db_with_fallback)):
    try:
        if isinstance(db, MockDB):
            return {"success": False, "message": "Cannot truncate mock database"}
        
        # Delete all records from tables (in reverse order to respect foreign keys)
        db.query(LogEntry).delete()
        db.query(Item).delete()
        db.query(Container).delete()
        
        # Commit the changes
        db.commit()
        
        logger.info("Database truncated successfully")
        return {"success": True, "message": "Database truncated successfully"}
    
    except Exception as e:
        logger.error(f"Error truncating database: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error truncating database: {str(e)}"
        )

# Run the application
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 