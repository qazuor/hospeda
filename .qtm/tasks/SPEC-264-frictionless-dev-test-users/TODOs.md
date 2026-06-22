# TODOs: Frictionless dev/test user setup

Spec: SPEC-264 | Status: draft | Progress: 0/7

## Setup

- [ ] T-001: Add markUserReady helper skeleton (complexity: 2)

## Core

- [ ] T-002: Implement read-modify-write merge in markUserReady (complexity: 4) [blocked by T-001]

## Testing

- [ ] T-003: Unit tests for markUserReady (complexity: 4) [blocked by T-002]

## Integration

- [ ] T-004: Wire markUserReady into testUsers.seed.ts (complexity: 3) [blocked by T-002]
- [ ] T-005: Add db:seed:ready-user ad-hoc CLI script (complexity: 3) [blocked by T-002]

## Docs

- [ ] T-006: Document the ready-user flow (complexity: 2) [blocked by T-005]

## Cleanup / Verify

- [ ] T-007: Verify SC-1..SC-4 via db:fresh-dev + login (complexity: 3) [blocked by T-004, T-005]
