# TODOs: Frictionless dev/test user setup

Spec: SPEC-264 | Status: in-progress | Progress: 6/8

## Setup

- [x] T-001: Add markUserReady helper skeleton (complexity: 2)

## Core

- [x] T-002: Implement read-modify-write merge in markUserReady (complexity: 4) [blocked by T-001]

## Testing

- [x] T-003: Unit tests for markUserReady (complexity: 4) [blocked by T-002]

## Integration

- [x] T-004: Wire markUserReady into testUsers.seed.ts (complexity: 3) [blocked by T-002]
- [x] T-005: Add db:seed:ready-user ad-hoc CLI script (complexity: 3) [blocked by T-002]
- [x] T-008: Suppress cookie-consent banner in apps/e2e web tests (complexity: 3)

## Docs

- [ ] T-006: Document the ready-user flow (complexity: 2) [blocked by T-005]

## Cleanup / Verify

- [ ] T-007: Verify SC-1..SC-4 via db:fresh-dev + login (complexity: 3) [blocked by T-004, T-005]
