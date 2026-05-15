SHELL := /bin/bash

APP_URL ?= http://localhost:5173

.PHONY: show run-app run-map-app stopp-app rebuild-app rebuild-map-app
.PHONY: run-routing-app rebuild-routing-app
.PHONY: run-routing-app-elevation rebuild-routing-app-elevation

show:
	@./scripts/show-workspace-summary.sh

run-app:
	@./scripts/dev-up.sh
	@printf 'Routing-capable app should be available at %s\n' "$(APP_URL)"

run-map-app:
	@./scripts/dev-up.sh --without-routing
	@printf 'Map-only app should be available at %s\n' "$(APP_URL)"

run-routing-app:
	@./scripts/dev-up.sh --with-routing
	@printf 'Routing-capable app should be available at %s\n' "$(APP_URL)"

run-routing-app-elevation:
	@./scripts/dev-up.sh --with-routing-elevation
	@printf 'Elevation-capable routing app should be available at %s\n' "$(APP_URL)"

stopp-app:
	@./scripts/dev-down.sh

rebuild-app:
	@./scripts/dev-down.sh
	@./scripts/dev-up.sh --force-recreate
	@printf 'Routing-capable app should be available at %s\n' "$(APP_URL)"

rebuild-map-app:
	@./scripts/dev-down.sh
	@./scripts/dev-up.sh --without-routing --force-recreate
	@printf 'Map-only app should be available at %s\n' "$(APP_URL)"

rebuild-routing-app:
	@./scripts/dev-down.sh
	@./scripts/dev-up.sh --with-routing --force-recreate
	@printf 'Routing-capable app should be available at %s\n' "$(APP_URL)"

rebuild-routing-app-elevation:
	@./scripts/dev-down.sh
	@./scripts/dev-up.sh --with-routing-elevation --force-recreate
	@printf 'Elevation-capable routing app should be available at %s\n' "$(APP_URL)"
