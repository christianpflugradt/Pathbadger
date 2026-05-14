# Tile Server

This directory holds the local vector-tile service used by the supported planning-map flow.

The frontend consumes the self-hosted style endpoint through
`PUBLIC_TILE_STYLE_URL`, which defaults to `/styles/basic/style.json` through
the frontend proxy.
If that endpoint is missing or unreachable, the app should surface a hard map
failure instead of falling back to bundled map art.

The supported browser-facing topology keeps this service internal-only. Do not
reintroduce direct browser access to the tile server; the frontend should proxy
style and tile requests on its behalf.

## Data scopes

Tile data lives outside Git under `data/tiles/`.

- `PATHBADGER_TILE_DATA_SCOPE=starter` loads `data/tiles/bad-bramstedt-50km.geojson`
  and is the default supported local flow.
- `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein` loads
  `data/tiles/schleswig-holstein-basemap.geojson` for a whole-state map slice.
- `PATHBADGER_TILE_DATA_FILE=/absolute/path/to/custom.geojson` overrides either
  default file path when you want to point the tile service at another generated
  dataset.

`make run-app`, `make rebuild-app`, and `npm run compose:test` call
`scripts/ensure-map-data.sh` before compose starts. That helper generates the
selected dataset into `data/tiles/` when it is missing.

## Notes

- The `starter` scope is a real OpenStreetMap-derived slice covering at least a
  50 km radius around Bad Bramstedt so the default planning area has visible
  roads and trails without committing bulky artifacts to the repository.
- The `schleswig_holstein` scope is intended for the broader live map. Its
  first build is much larger and can take noticeably longer to prepare.
