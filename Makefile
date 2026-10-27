.DEFAULT_GOAL := help

COMPOSE ?= docker compose
ENV_DOCKER ?= .env.docker
ENV_PROD ?= .env.production
BACKUP_DIR ?= backups

.PHONY: help install dev build lint test prisma-generate prisma-migrate prisma-reset seed \
	docker-build docker-up docker-down docker-logs docker-restart docker-seed \
	prod-build prod-up prod-down prod-logs prod-seed prod-update \
	status clean backup-db backup-uploads

##@ Development
help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n"} /^##@/ {printf "\n%s\n", substr($$0, 5)} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies from the lockfile
	npm ci

dev: ## Start the local development server
	npm run dev

build: ## Build the Next.js application
	npm run build

lint: ## Run the project's configured lint command
	npm run lint

test: ## Run configured tests when present, then check TypeScript
	npm test --if-present
	npx tsc --noEmit

##@ Database
prisma-generate: ## Generate the Prisma client
	npx prisma generate

prisma-migrate: ## Apply development migrations
	npx prisma migrate dev

prisma-reset: ## Reset the development database (destructive)
	npx prisma migrate reset

seed: ## Seed the database using the local environment
	npm run db:seed

##@ Local Docker (.env.docker)
docker-build: ## Build local Docker images
	$(COMPOSE) --env-file $(ENV_DOCKER) build

docker-up: ## Start the local Docker stack
	$(COMPOSE) --env-file $(ENV_DOCKER) up -d

docker-down: ## Stop the local Docker stack; preserve volumes
	$(COMPOSE) --env-file $(ENV_DOCKER) down

docker-logs: ## Follow local Docker logs
	$(COMPOSE) --env-file $(ENV_DOCKER) logs -f --tail=100

docker-restart: ## Restart local Docker services
	$(COMPOSE) --env-file $(ENV_DOCKER) restart

docker-seed: ## Run the local one-time seed service
	$(COMPOSE) --env-file $(ENV_DOCKER) --profile seed run --rm seed

##@ Production Docker (.env.production)
prod-build: ## Build production Docker images
	$(COMPOSE) --env-file $(ENV_PROD) build

prod-up: ## Start the production Docker stack
	$(COMPOSE) --env-file $(ENV_PROD) up -d

prod-down: ## Stop the production Docker stack; preserve volumes
	$(COMPOSE) --env-file $(ENV_PROD) down

prod-logs: ## Follow production Docker logs
	$(COMPOSE) --env-file $(ENV_PROD) logs -f --tail=100

prod-seed: ## Run the production one-time seed service
	$(COMPOSE) --env-file $(ENV_PROD) --profile seed run --rm seed

prod-update: ## Rebuild and update production services
	$(COMPOSE) --env-file $(ENV_PROD) up -d --build --remove-orphans

##@ Utilities
status: ## Show local Docker service status
	$(COMPOSE) --env-file $(ENV_DOCKER) ps

clean: ## Remove local build and test artifacts
	rm -rf .next out coverage tsconfig.tsbuildinfo

backup-db: ## Dump the local Docker PostgreSQL database to BACKUP_DIR
	@mkdir -p "$(BACKUP_DIR)"
	@set -eu; file="$(BACKUP_DIR)/opslog-db-$$(date +%Y%m%d-%H%M%S).sql"; \
	$(COMPOSE) --env-file $(ENV_DOCKER) exec -T db sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > "$$file"; \
	printf 'Database backup written to %s\n' "$$file"

backup-uploads: ## Archive local Docker uploads to BACKUP_DIR
	@mkdir -p "$(BACKUP_DIR)"
	@set -eu; file="$(BACKUP_DIR)/opslog-uploads-$$(date +%Y%m%d-%H%M%S).tar.gz"; \
	$(COMPOSE) --env-file $(ENV_DOCKER) exec -T app tar -czf - -C /app/public/uploads . > "$$file"; \
	printf 'Uploads backup written to %s\n' "$$file"
