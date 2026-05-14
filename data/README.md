# Data Directories

- `data/osm/`: Schleswig-Holstein OSM extracts
- `data/graphhopper/`: GraphHopper import cache and runtime graph data
- `data/tiles/`: ignored self-hosted tile artifacts and generated GeoJSON
  basemap files used by the local tile service

Large generated artifacts stay out of Git.

The routing-capable local boot downloads `schleswig-holstein-latest.osm.pbf`
into `data/osm/` on first use and reuses the imported GraphHopper cache under
`data/graphhopper/` on later runs.

The explicit elevation-capable routing boot keeps its heavier artifacts
separate:

- `data/graphhopper/cache/`: default routed-preview graph without elevation
- `data/graphhopper/cache-elevation/`: elevation-capable routed-preview graph
- `data/graphhopper/elevation/`: cached SRTM tiles used during elevation import
