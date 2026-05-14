# Scripts

- `verify.sh`: lint, typecheck, test, and format checks
- `test-compose.sh`: docker compose validation plus runtime smoke for the `api`, `web`, and `tileserver` services
- `browser-smoke.mjs`: fixture-backed Playwright smoke plus live-app map contract checks
- `dev-up.sh`: start the compose stack
- `dev-down.sh`: stop the compose stack
- `ensure-map-data.sh`: generate the selected ignored map dataset before compose boots
- `setup-data.sh`: guide the local data preparation workflow
