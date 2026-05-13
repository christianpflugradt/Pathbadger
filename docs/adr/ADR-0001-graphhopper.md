# ADR-0001: Use GraphHopper For Self-Hosted Routing

## Status

accepted

## Context

The product requires self-hosted route generation without mandatory third-party registration. Route legality, distance fit, and custom scoring need a deterministic routing engine that can run locally against Schleswig-Holstein OSM data.

## Decision

Use GraphHopper as the routing engine for the initial product architecture.

## Consequences

Positive:

- supports self-hosted routing
- works with OSM extracts
- can be integrated behind a small backend adapter

Negative:

- requires local data import and cache management
- route quality still depends on our candidate generation and scoring logic

## Alternatives considered

- hosted routing APIs rejected because registration or paid plans would violate project constraints
- custom routing engine rejected because it would slow down early product progress substantially
