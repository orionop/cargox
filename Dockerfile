# Start from Ubuntu:22.04 as the base image
FROM ubuntu:22.04

# Set environment variables to avoid interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Update package lists and install Python and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-dev build-essential libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy requirements file
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY backend/ .

# Create logs directory
RUN mkdir -p logs

# Expose port 8000 to the outside world
EXPOSE 8000

# Command to run the Python application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 