import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from loguru import logger

# Get database URL from environment or use SQLite for local development
DATABASE_URL = os.getenv(
    "SQLALCHEMY_DATABASE_URL", 
    "sqlite:///./cargox.db"
)

try:
    # Create SQLAlchemy engine with proper parameters for SQLite
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(
            DATABASE_URL, 
            connect_args={"check_same_thread": False}
        )
        logger.info(f"Using SQLite database: {DATABASE_URL}")
    else:
        engine = create_engine(DATABASE_URL)
        logger.info(f"Using PostgreSQL database: {DATABASE_URL}")
    
    # Create session factory
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create base class for models
    Base = declarative_base()
    
    logger.info(f"Database connection established successfully")
except Exception as e:
    logger.error(f"Failed to connect to database: {str(e)}")
    raise

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 