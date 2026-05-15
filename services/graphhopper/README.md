# GraphHopper Service

This directory holds the self-hosted GraphHopper configuration for Schleswig-Holstein-only routing.

The runtime service is defined in `docker-compose.yml` under the `maps` profile.
Pathbadger uses the community image that the upstream GraphHopper README links
to, because GraphHopper itself does not publish an official Docker image.
The default `make run-app` flow activates that profile so the product can
generate routes in its normal local boot path.

## Local boot

- `make run-app` is the supported default local workflow for route-preview and
  navigation verification.
- `make run-routing-app` remains an explicit alias for the same routing-capable
  boot when you want route-focused command wording.
- `make run-map-app` is the lighter opt-out when you intentionally want the map
  stack without GraphHopper.
- `make run-routing-app-elevation` is the supported heavier local workflow when
  you need real elevation gain in the routed preview summary.
- `scripts/ensure-routing-data.sh` downloads
  `data/osm/schleswig-holstein-latest.osm.pbf` when it is missing.
- GraphHopper then imports that extract into `data/graphhopper/cache` on the
  first default app boot and reuses the cache later.
- The elevation-capable flow keeps a separate import under
  `data/graphhopper/cache-elevation` and caches downloaded SRTM tiles under
  `data/graphhopper/elevation` so the lighter default stack stays unchanged.

## Config notes

- The repo config enables the `foot` and `bike` profiles that the API adapter
  currently maps from Pathbadger activities.
- `surface` and `road_class` encoded values stay enabled because the route
  preview scorer and summary UI already consume those path details.
- The supported local workflow currently leaves `GRAPHHOPPER_HAS_ELEVATION`
  disabled, so the API reports elevation gain as unavailable instead of
  overstating a 2D route import as real climb data.
- `config-elevation.yml` turns on GraphHopper's SRTM elevation provider for the
  explicit elevation-capable boot while keeping the original default config and
  graph cache intact.
