# CargoX Backend

This is the backend service for the CargoX Cargo Stowage Management System. It provides a REST API for managing containers, items, and optimizing cargo placement.

## Features

- CSV data import for containers and items
- 3D bin packing algorithm for optimizing item placement
- Retrieval path calculation with disturbance analysis
- Repacking capability
- PostgreSQL database integration
- Full RESTful API with comprehensive documentation

## Requirements

- Python 3.8+
- PostgreSQL 12+
- Docker and Docker Compose (for containerized deployment)

## Getting Started

### Local Development

1. Set up a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Make sure PostgreSQL is running and create a database:

```bash
createdb cargox
```

4. Run the application:

```bash
python main.py
```

The API will be available at http://localhost:8000.

### Using Docker Compose

For a more production-like setup, you can use Docker Compose:

```bash
docker-compose up -d
```

This will start the following services:
- The CargoX API at http://localhost:8000
- PostgreSQL on port 5432
- A simple Nginx server serving the frontend on http://localhost:80

## API Endpoints

### Import Data

- `POST /import` - Import both containers and items CSV files
- `POST /import/containers` - Import only containers CSV file
- `POST /import/items` - Import only items CSV file

### Container Management

- `GET /containers` - List all containers with their items

### Placement

- `POST /place-items` - Run the placement algorithm
- `POST /repack` - Clear current placements and rerun the algorithm

### Retrieval

- `GET /retrieve/{item_id}` - Get retrieval steps for a specific item

## CSV File Format

### Containers CSV

Example:
```csv
id,width,height,depth,capacity
C001,10.0,5.0,8.0,5
C002,8.0,4.0,6.0,3
```

### Items CSV

Example:
```csv
id,name,width,height,depth,weight
I001,Electronics Box,2.0,1.5,3.0,5.2
I002,Medical Supplies,3.0,2.0,2.5,4.5
```

## Project Structure

- `main.py` - FastAPI application and routes
- `models.py` - SQLAlchemy and Pydantic models
- `database.py` - Database configuration
- `utils.py` - Utility functions for CSV parsing and data processing
- `services/placement.py` - 3D bin packing algorithm implementation
- `data/` - Sample CSV files for testing

## License

MIT 