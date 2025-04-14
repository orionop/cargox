from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, JSON, Date, DateTime
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from database import Base

# SQLAlchemy Models
class Container(Base):
    __tablename__ = "containers"

    id = Column(String, primary_key=True, index=True)
    width = Column(Float)
    height = Column(Float)
    depth = Column(Float)
    capacity = Column(Integer)
    # Type of container (regular storage, waste container, etc.)
    container_type = Column(String, default="storage")
    # Zone identifier (Crew Quarters, Medical Bay, etc.)
    zone = Column(String, nullable=True)
    
    # Relationship with items
    items = relationship("Item", back_populates="container")

class Item(Base):
    __tablename__ = "items"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    width = Column(Float)
    height = Column(Float)
    depth = Column(Float)
    weight = Column(Float)
    container_id = Column(String, ForeignKey("containers.id"), nullable=True)
    
    # Position within container
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    position_z = Column(Float, nullable=True)
    
    # Priority (1-100, higher = more important)
    priority = Column(Integer, default=50)
    
    # Preferred zone for this item
    preferred_zone = Column(String, nullable=True)
    
    # Expiry date if applicable
    expiry_date = Column(Date, nullable=True)
    
    # Usage tracking
    usage_limit = Column(Integer, nullable=True)
    usage_count = Column(Integer, default=0)
    
    # Is the item placed in a container?
    is_placed = Column(Boolean, default=False)
    
    # Is this item waste (expired or fully used)?
    is_waste = Column(Boolean, default=False)
    
    # Timestamp for last retrieval
    last_retrieved = Column(Date, nullable=True)
    
    # Who last retrieved this item
    last_retrieved_by = Column(String, nullable=True)
    
    # Relationship with container
    container = relationship("Container", back_populates="items")

# Pydantic Models for API
class ContainerBase(BaseModel):
    id: str
    width: float
    height: float
    depth: float
    capacity: int
    container_type: str = "storage"
    zone: Optional[str] = None

class ContainerCreate(ContainerBase):
    pass

class ItemBase(BaseModel):
    id: str
    name: str
    width: float
    height: float
    depth: float
    weight: float
    priority: int = 50
    preferred_zone: Optional[str] = None
    expiry_date: Optional[date] = None
    usage_limit: Optional[int] = None
    usage_count: int = 0
    is_waste: bool = False

class ItemCreate(ItemBase):
    pass

class Position(BaseModel):
    x: float
    y: float
    z: float

class ItemInContainer(ItemBase):
    container_id: Optional[str] = None
    position: Optional[Position] = None
    is_placed: bool = False
    last_retrieved: Optional[date] = None
    last_retrieved_by: Optional[str] = None

    class Config:
        from_attributes = True

class ContainerWithItems(ContainerBase):
    items: List[ItemInContainer] = []

    class Config:
        from_attributes = True

class ImportResponse(BaseModel):
    success: bool
    message: str
    containers_count: Optional[int] = None
    items_count: Optional[int] = None

class PlacementResult(BaseModel):
    success: bool
    message: str
    containers: List[ContainerWithItems] = []
    unplaced_items: List[ItemBase] = []

class RetrievalStep(BaseModel):
    description: str
    item_id: Optional[str] = None

class RetrievalResponse(BaseModel):
    found: bool
    item_id: str
    path: List[str] = []
    disturbed_items: List[str] = []
    location: Optional[Dict[str, Any]] = None
    retrieval_time: str = None
    retrieved_by: Optional[str] = None

class WasteManagementResponse(BaseModel):
    success: bool
    message: str
    waste_items: List[str] = []
    waste_containers: List[str] = []
    total_waste_mass: float = 0

class SimulationResponse(BaseModel):
    success: bool
    message: str
    days_simulated: int = 0
    items_used: List[str] = []
    items_expired: List[str] = []
    new_waste_items: List[str] = []

# Rearrangement models
class RearrangementMovement(BaseModel):
    step: int
    item_id: str
    item_name: str
    from_container_id: Optional[str] = None
    to_container_id: str
    from_zone: Optional[str] = None
    to_zone: Optional[str] = None
    estimated_time: float  # Time in minutes
    priority: int
    description: str

class RearrangementPlan(BaseModel):
    success: bool
    message: str
    total_steps: int = 0
    total_estimated_time: float = 0  # Total time in minutes
    space_optimization: float = 0  # Percentage improvement in space utilization
    movements: List[RearrangementMovement] = []
    low_priority_items_moved: List[str] = []
    high_priority_items_untouched: List[str] = []
    disorganized_containers: List[Dict[str, Any]] = []  # List of containers with inefficiency information

# Log entry model
class LogEntry(Base):
    __tablename__ = "log_entries"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(Date, default=datetime.now().date)
    action = Column(String)
    item_id = Column(String, nullable=True)
    container_id = Column(String, nullable=True)
    user = Column(String, default="system")
    details = Column(String, nullable=True)
    
# Pydantic model for log entries
class LogEntryResponse(BaseModel):
    id: int
    timestamp: date
    action: str
    item_id: Optional[str] = None
    container_id: Optional[str] = None
    user: str = "system"
    details: Optional[str] = None
    
    class Config:
        from_attributes = True

# System configuration model
class SystemConfig(Base):
    __tablename__ = "system_config"
    
    key = Column(String, primary_key=True)
    value = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now) 