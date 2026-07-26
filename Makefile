COMPOSE := docker compose

.PHONY: up down build logs ps clean backend-test backend-lint backend-typecheck frontend-lint frontend-typecheck frontend-test frontend-build migrate

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

clean:
	$(COMPOSE) down --volumes --remove-orphans

backend-test:
	$(COMPOSE) exec backend pytest

backend-lint:
	$(COMPOSE) exec backend ruff check .

backend-typecheck:
	$(COMPOSE) exec backend mypy app tests

frontend-lint:
	$(COMPOSE) exec frontend pnpm lint

frontend-typecheck:
	$(COMPOSE) exec frontend pnpm typecheck

frontend-test:
	$(COMPOSE) exec frontend pnpm test

frontend-build:
	$(COMPOSE) exec frontend pnpm build

migrate:
	$(COMPOSE) exec backend alembic upgrade head
