# Scripts

- `verify.sh`: lint, typecheck, test, and format checks
- `show-workspace-summary.sh`: deterministic workspace summary for `make show`
- `test-compose.sh`: docker compose validation plus runtime smoke for the `api`, `web`, and `tileserver` services
- `browser-smoke.mjs`: fixture-backed Playwright smoke plus live-app map contract checks
- `live-route-quality-check.mjs`: frontend-proxied live route-quality evidence checks for geometry, first/last instruction endpoint anchoring, distance-fit honesty, surface-summary honesty, explicit out-of-region failure handling, and optional non-null elevation evidence after the explicit elevation-capable boot
- `dev-up.sh`: start the compose stack with routing enabled by default, with optional `--without-routing` for map-only work or `--with-routing-elevation` for the heavier elevation-capable routing boot
- `dev-down.sh`: stop the compose stack, including the optional `maps` profile when it is active
- `ensure-map-data.sh`: generate the selected ignored map dataset before compose boots
- `ensure-routing-data.sh`: download the Schleswig-Holstein routing extract before GraphHopper boots
- `setup-data.sh`: guide the local data preparation workflow
