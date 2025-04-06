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
        
        # Log table metadata before creation
        logger.info("Preparing to create tables with the following models:")
        for table in Base.metadata.tables.values():
            logger.info(f"Table {table.name} columns: {[column.name for column in table.columns]}")
        
        # Drop all tables first to ensure clean state
        logger.info("Dropping existing tables...")
        # Base.metadata.drop_all(bind=engine)
        
        # Create all tables
        logger.info("Creating tables...")
        Base.metadata.create_all(bind=engine, )
        logger.info("Database tables created successfully")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(engine)
        for table_name in inspector.get_table_names():
            logger.info(f"Verified table {table_name} exists with columns: {[column['name'] for column in inspector.get_columns(table_name)]}")
            
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise 