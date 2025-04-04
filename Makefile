.PHONY: build run run-backend stop clean test-api

# Default variables
DOCKER_COMPOSE = docker-compose

build:
	$(DOCKER_COMPOSE) build

run:
	$(DOCKER_COMPOSE) up

run-backend:
	cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

stop:
	$(DOCKER_COMPOSE) down

clean:
	$(DOCKER_COMPOSE) down -v
	rm -rf backend/logs/*.log

test-api:
	cd backend && python test_api.py

setup-venv:
	python -m venv venv
	./venv/bin/pip install -r backend/requirements.txt

help:
	@echo "Available commands:"
	@echo "  make build       - Build all docker images"
	@echo "  make run         - Run all services with Docker Compose"
	@echo "  make run-backend - Run only the backend service locally"
	@echo "  make stop        - Stop all running containers"
	@echo "  make clean       - Stop containers and remove volumes"
	@echo "  make test-api    - Run API tests"
	@echo "  make setup-venv  - Create and setup a Python virtual environment" 