# ADR-0003: Restrict Initial Data Scope To Schleswig-Holstein

## Status

accepted

## Context

The product is designed for one private user and must stay resource-conscious on a host with limited free RAM. A smaller regional extract makes self-hosted routing and tiles more practical.

## Decision

Limit the initial routing and tile data scope to Schleswig-Holstein.

## Consequences

Positive:

- lowers memory and storage pressure
- keeps early routing behavior easier to reason about
- aligns with the explicit product scope

Negative:

- routes near the border may need rejection or boundary warnings
- scaling to broader coverage will be a future architectural and data task

## Alternatives considered

- Germany-wide coverage rejected because it adds unnecessary runtime and data complexity too early
