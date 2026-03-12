.PHONY: help up down restart build rebuild logs logs-api logs-web ps migrate test lint clean docker-prune-all prune-branches release

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

logs-api: ## Tail backend logs
	docker compose logs -f backend

logs-web: ## Tail frontend logs
	docker compose logs -f frontend

migrate: ## Run database migrations
	docker compose exec backend uv run alembic upgrade head

migration: ## Create a new migration (usage: make migration msg="description")
	docker compose exec backend uv run alembic revision --autogenerate -m "$(msg)"

test: ## Run backend tests
	docker compose exec backend uv run pytest -v

test-cov: ## Run backend tests with coverage
	docker compose exec backend uv run pytest --cov=app --cov-report=term-missing

lint: ## Run linting
	docker compose exec backend uv run ruff check app
	docker compose exec backend uv run ruff format --check app

lint-fix: ## Fix linting issues
	docker compose exec backend uv run ruff check --fix app
	docker compose exec backend uv run ruff format app

clean: ## Remove all containers, volumes, and images
	docker compose down -v --rmi local

shell-backend: ## Open a shell in the backend container
	docker compose exec backend bash

shell-db: ## Open a psql shell
	docker compose exec db psql -U postgres -d wrapiq

docker-prune-all: ## Remove all unused Docker data (containers, images, volumes, networks)
	docker system prune -a --volumes -f

prune-branches: ## Delete local branches already merged to main on remote
	git fetch -p
	git branch -vv | grep 'origin/.*: gone]' | awk '{print $$1}' | xargs -r git branch -d

# ---------------------------------------------------------------------------
# Release / Deploy
# ---------------------------------------------------------------------------
# Usage: make release type=patch  (default)
#        make release type=minor
#        make release type=major

RELEASE_TYPE ?= patch

release: ## Create a semver tag and push it (type=patch|minor|major)
	@latest=$$(git tag -l 'v*' --sort=-v:refname | head -n1); \
	if [ -z "$$latest" ]; then \
		major=0; minor=0; patch=0; \
	else \
		version=$${latest#v}; \
		major=$$(echo $$version | cut -d. -f1); \
		minor=$$(echo $$version | cut -d. -f2); \
		patch=$$(echo $$version | cut -d. -f3); \
	fi; \
	case "$(type)" in \
		major) major=$$((major + 1)); minor=0; patch=0;; \
		minor) minor=$$((minor + 1)); patch=0;; \
		patch) patch=$$((patch + 1));; \
		*) echo "Invalid type: $(type). Use patch, minor, or major."; exit 1;; \
	esac; \
	next="v$$major.$$minor.$$patch"; \
	echo "Current: $${latest:-none} → Next: $$next"; \
	git tag -a "$$next" -m "Release $$next"; \
	git push origin "$$next"; \
	echo "Tagged and pushed $$next"
