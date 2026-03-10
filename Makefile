.PHONY: help up down restart build rebuild logs ps migrate test lint clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose restart

build: ## Build all services
	docker compose build

rebuild: ## Rebuild all services (no cache)
	docker compose build --no-cache

ps: ## Show status of all containers
	docker compose ps -a

logs: ## Tail logs for all services
	docker compose logs -f

logs-backend: ## Tail backend logs
	docker compose logs -f backend

logs-frontend: ## Tail frontend logs
	docker compose logs -f frontend

migrate: ## Run database migrations
	docker compose exec backend alembic upgrade head

migration: ## Create a new migration (usage: make migration msg="description")
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

test: ## Run backend tests
	docker compose exec backend pytest -v

test-cov: ## Run backend tests with coverage
	docker compose exec backend pytest --cov=app --cov-report=term-missing

lint: ## Run linting
	docker compose exec backend ruff check app
	docker compose exec backend ruff format --check app

lint-fix: ## Fix linting issues
	docker compose exec backend ruff check --fix app
	docker compose exec backend ruff format app

clean: ## Remove all containers, volumes, and images
	docker compose down -v --rmi local

shell-backend: ## Open a shell in the backend container
	docker compose exec backend bash

shell-db: ## Open a psql shell
	docker compose exec db psql -U postgres -d wrapiq
