# ADR-0005: Use Docker Compose For The Local Runtime Stack

## Status

accepted

## Context

The project needs a local, reproducible, self-hosted stack without introducing cloud infrastructure or orchestration complexity too early.

## Decision

Use Docker Compose as the service orchestration layer for local development and integration checks.

## Consequences

Positive:

- keeps the service topology explicit
- supports local verification of API, routing, and tile components
- avoids speculative infrastructure work

Negative:

- local data preparation and container health checks still need follow-up work
- memory budgeting must be managed carefully

## Alternatives considered

- Kubernetes and managed cloud infrastructure rejected as unnecessary complexity
