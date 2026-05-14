SHELL := /bin/bash

APP_URL ?= http://localhost:5173

.PHONY: run-app stopp-app rebuild-app
.PHONY: run-routing-app rebuild-routing-app

run-app:
	@./scripts/dev-up.sh
	@printf 'App should be available at %s\n' "$(APP_URL)"

run-routing-app:
	@./scripts/dev-up.sh --with-routing
	@printf 'Routing-capable app should be available at %s\n' "$(APP_URL)"

stopp-app:
	@./scripts/dev-down.sh

rebuild-app:
	@docker compose down --remove-orphans
	@./scripts/dev-up.sh --force-recreate
	@printf 'App should be available at %s\n' "$(APP_URL)"

rebuild-routing-app:
	@docker compose down --remove-orphans
	@./scripts/dev-up.sh --with-routing --force-recreate
	@printf 'Routing-capable app should be available at %s\n' "$(APP_URL)"
