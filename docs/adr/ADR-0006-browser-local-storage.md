# ADR-0006: Use Browser-Local Storage For Initial Preferences

## Status

accepted

## Context

The product needs lightweight persistence for defaults such as last start point and surface preferences, but the scope explicitly avoids premature database adoption.

## Decision

Use browser-local storage as the initial persistence layer for local preferences and transient state.

## Consequences

Positive:

- no extra service dependency
- aligns with the single-user self-hosted scope
- easy to evolve later if stronger persistence becomes necessary

Negative:

- state remains device-local
- no cross-device synchronization

## Alternatives considered

- PostgreSQL and other persistent services rejected because the brief requires evidence before adding them
