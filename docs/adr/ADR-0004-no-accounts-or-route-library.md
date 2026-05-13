# ADR-0004: Avoid Accounts And Route Library Features Initially

## Status

accepted

## Context

The product is for spontaneous personal route generation, not long-term route management or multi-user collaboration.

## Decision

Do not add authentication, user accounts, or route-library management to the initial product scope.

## Consequences

Positive:

- keeps the product focused on route generation and navigation
- reduces privacy, persistence, and operational complexity

Negative:

- saved-route workflows remain out of scope
- debugging route history may require temporary tooling later

## Alternatives considered

- account-based personalization rejected because it does not solve the primary routing problem
