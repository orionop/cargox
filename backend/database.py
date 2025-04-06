import os
import time
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from loguru import logger

# Get database URL from environment or use SQLite for local development
DATABASE_URL = os.getenv(
    "SQLALCHEMY_DATABASE_URL", 
    "sqlite:///./cargox.db"
)

MAX_RETRIES = 5
RETRY_DELAY = 3  # seconds

def create_engine_with_retries():
    """Create database engine with retry logic for resilience during startup"""
    retries = 0
    last_exception = None
    
    while retries < MAX_RETRIES:
        try:
            # Create SQLAlchemy engine with proper parameters for SQLite
            if DATABASE_URL.startswith("sqlite"):
                engine = create_engine(
                    DATABASE_URL, 
                    connect_args={"check_same_thread": False},
                    pool_pre_ping=True  # Verify connections before using them
                )
                logger.info(f"Using SQLite database: {DATABASE_URL}")
            else:
                # For PostgreSQL, add connection pooling parameters
                engine = create_engine(
                    DATABASE_URL,
                    pool_size=5,
                    max_overflow=10,
                    pool_timeout=30,
                    pool_recycle=1800,  # Recycle connections after 30 min
                    pool_pre_ping=True  # Verify connections before using them
                )
                logger.info(f"Using PostgreSQL database: {DATABASE_URL}")
                
            # Test connection
            with engine.connect() as conn:
                logger.info("Database connection test successful")
                
            return engine
        except Exception as e:
            retries += 1
            last_exception = e
            logger.warning(f"Database connection attempt {retries}/{MAX_RETRIES} failed: {str(e)}")
            
            if retries < MAX_RETRIES:
                # Wait before retrying
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
    
    # If we've exhausted all retries, log and raise the last exception
    logger.error(f"Failed to connect to database after {MAX_RETRIES} attempts: {str(last_exception)}")
    raise last_exception

try:
    # Create engine with retries
    engine = create_engine_with_retries()
    
    # Create session factory
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create base class for models
    Base = declarative_base()
    
    logger.info(f"Database connection established successfully")
except Exception as e:
    logger.error(f"Failed to connect to database: {str(e)}")
    # Create a fallback SQLite engine for minimal functionality
    logger.warning("Creating fallback SQLite database for minimal functionality")
    engine = create_engine("sqlite:///./cargox_fallback.db", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 