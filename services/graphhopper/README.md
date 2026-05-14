# GraphHopper Service

This directory holds the self-hosted GraphHopper configuration for Schleswig-Holstein-only routing.

The runtime service is defined in `docker-compose.yml` under the `maps` profile.
Pathbadger uses the community image that the upstream GraphHopper README links
to, because GraphHopper itself does not publish an official Docker image.

## Local boot

- `make run-routing-app` is the supported local workflow for route-preview and
  navigation verification.
- `scripts/ensure-routing-data.sh` downloads
  `data/osm/schleswig-holstein-latest.osm.pbf` when it is missing.
- GraphHopper then imports that extract into `data/graphhopper/cache` on the
  first routing-capable boot and reuses the cache later.

## Config notes

- The repo config enables the `foot` and `bike` profiles that the API adapter
  currently maps from Pathbadger activities.
- `surface` and `road_class` encoded values stay enabled because the route
  preview scorer and summary UI already consume those path details.
- The supported local workflow currently leaves `GRAPHHOPPER_HAS_ELEVATION`
  disabled, so the API reports elevation gain as unavailable instead of
  overstating a 2D route import as real climb data.
