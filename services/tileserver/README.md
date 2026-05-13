# Tile Server

This directory holds the tile server configuration and documents where regional MBTiles or style assets should live under `data/tiles/`.

Initialization keeps the service self-hosted in architecture without pretending that production-ready tile artifacts already exist.

The frontend should consume a self-hosted style JSON endpoint through
`PUBLIC_TILE_STYLE_URL`. The intended initial contract is a TileServer GL style
document such as `http://localhost:8080/styles/basic/style.json` when the
`maps` profile is active. If that endpoint is missing or unreachable, the app
should surface a hard map failure instead of falling back to bundled map art.
