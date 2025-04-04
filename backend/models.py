from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from database import Base

# SQLAlchemy Models
class Container(Base):
    __tablename__ = "containers"

    id = Column(String, primary_key=True, index=True)
    width = Column(Float)
    height = Column(Float)
    depth = Column(Float)
    capacity = Column(Integer)
    
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
    
    # Is the item placed in a container?
    is_placed = Column(Boolean, default=False)
    
    # Relationship with container
    container = relationship("Container", back_populates="items")

# Pydantic Models for API
class ContainerBase(BaseModel):
    id: str
    width: float
    height: float
    depth: float
    capacity: int

class ContainerCreate(ContainerBase):
    pass

class ItemBase(BaseModel):
    id: str
    name: str
    width: float
    height: float
    depth: float
    weight: float

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