# ADR-0002: Use MapLibre For Map Rendering

## Status

accepted

## Context

The product requires a browser-based route planning and navigation map without introducing a mandatory proprietary map provider account.

## Decision

Use MapLibre GL JS as the target map renderer for the frontend.

## Consequences

Positive:

- supports self-hosted tile strategies
- avoids Google Maps backend dependency
- fits the mobile-friendly web app direction

Negative:

- still requires us to prepare and host tile artifacts
- map UX quality depends on our own styling and interaction work

## Alternatives considered

- Google Maps rejected because the brief forbids it
- registration-required hosted map stacks rejected as core dependencies
