from database import engine, Base
from models import Container, Item, LogEntry
from loguru import logger

def init_db():
    """
    Initialize the database by creating all tables.
    This function is called when the application starts.
    """
    try:
        # Import Base which contains all model definitions
        from database import Base, engine
        from models import Container, Item, LogEntry
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise 