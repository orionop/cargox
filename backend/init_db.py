from loguru import logger
import time

def init_db():
    """
    Initialize the database by creating all tables.
    This function is called when the application starts.
    """
    try:
        # Import Base which contains all model definitions
        from database import Base, engine
        # Import all models to ensure they're registered with the metadata
        from models import Container, Item, LogEntry, SystemConfig
        
        # Log table metadata before creation
        logger.info("Preparing to create tables with the following models:")
        for table in Base.metadata.tables.values():
            logger.info(f"Table {table.name} columns: {[column.name for column in table.columns]}")
        
        # Create all tables if they don't exist
        # We use checkfirst=True to avoid errors if tables already exist
        logger.info("Creating tables...")
        Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info("Database tables created successfully")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(engine)
        
        # Maximum retry attempts
        max_retries = 5
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                # Check if all tables exist
                expected_tables = set(Base.metadata.tables.keys())
                actual_tables = set(inspector.get_table_names())
                
                if expected_tables.issubset(actual_tables):
                    logger.info("All expected tables were created successfully")
                    
                    # Log details of each table
                    for table_name in expected_tables:
                        logger.info(f"Verified table {table_name} exists with columns: {[column['name'] for column in inspector.get_columns(table_name)]}")
                    
                    return  # All tables were created, exit the function
                else:
                    missing_tables = expected_tables - actual_tables
                    logger.warning(f"Some tables are missing: {missing_tables}. Retrying...")
                    
                    # Wait before retrying
                    time.sleep(2)
                    retry_count += 1
                    
                    # Try creating the missing tables again
                    Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables[table] for table in missing_tables])
            except Exception as e:
                logger.error(f"Error verifying tables (attempt {retry_count+1}/{max_retries}): {e}")
                time.sleep(2)
                retry_count += 1
        
        # If we've reached here, we couldn't create all tables after max retries
        logger.error(f"Failed to create all tables after {max_retries} attempts")
            
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise 