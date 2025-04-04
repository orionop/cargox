
# CargoX - Cargo Management System

A modernized web application for optimizing cargo placement and retrieval.

## System Architecture

The application now uses a simplified architecture with two main components:

1. **Frontend**: Vite/React application running in development mode
2. **Backend**: FastAPI Python application with PostgreSQL database (running in Docker)

## Requirements

- Docker and Docker Compose (for backend)
- Node.js and npm (for frontend)
- Web browser with JavaScript enabled

## Getting Started

### Starting the Backend (Docker)

1. Start the backend services:
   ```
   docker-compose up -d
   ```

2. The backend API will be available at:
   - Backend API: http://localhost:8000

### Starting the Frontend (Vite)

1. Run the development server:
   ```
   cd frontend
   npm run dev
   ```

2. The frontend will be available at:
   - http://localhost:5173

## Using the Application

1. Navigate to http://localhost:5173/upload to access the upload page
2. Upload your containers.csv and items.csv files
3. The system will process these files and store the data in the PostgreSQL database
4. You can then use the placement algorithm to optimize item placement

## API Endpoints

- `GET /`: Health check
- `POST /import/containers`: Import containers from CSV
- `POST /import/items`: Import items from CSV
- `POST /place-items`: Run the placement algorithm
- `GET /retrieve/{item_id}`: Get retrieval path for an item
- `GET /containers`: List all containers
- `GET /items`: List all items

## CSV File Format

### Containers CSV
```
id,width,height,depth,capacity
C001,10.0,5.0,8.0,5
C002,8.0,4.0,6.0,3
```

### Items CSV
```
id,name,width,height,depth,weight
I001,Tool Kit,10.0,5.0,3.0,2.5
I002,First Aid,8.0,6.0,4.0,1.5
```

## Troubleshooting

If you encounter issues with CSV imports, ensure:

1. Your CSV has the correct column headers (exact match, case-sensitive)
2. There are no extra spaces or special characters
3. The file is saved in UTF-8 encoding
4. Numeric values use periods (.) as decimal separators, not commas


