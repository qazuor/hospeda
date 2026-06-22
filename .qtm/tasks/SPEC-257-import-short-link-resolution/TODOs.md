Spec: SPEC-257 | Status: draft | Progress: 0/11

## Setup

- [ ] T-001: Confirm worktree dev env + import rate limit (complexity: 1)

## Core

- [ ] T-002: Add resolveOnly mode to safeExternalFetch (complexity: 4)
- [ ] T-003: Rewire resolveCanonicalUrl to resolveOnly (complexity: 2) [blocked by T-002]
- [ ] T-004: Enrich Airbnb adapter output mapping (complexity: 3)
- [ ] T-005: Update Booking + Google import help copy (i18n) (complexity: 2)

## Integration

- [ ] T-006: Non-mocked safe-fetch resolve-only integration test (complexity: 3) [blocked by T-002]
- [ ] T-007: Unit tests: resolveCanonicalUrl rewire + adapter routing (complexity: 2) [blocked by T-003]
- [ ] T-008: Unit tests: Airbnb mapping enrichment (complexity: 2) [blocked by T-004]
- [ ] T-009: i18n suite passes (no missing keys) (complexity: 1) [blocked by T-005]

## Testing

- [ ] T-010: Real Chrome smoke + confirm Airbnb actor fields (complexity: 4) [blocked by T-003, T-004, T-005, T-006]

## Docs

- [ ] T-011: Cross-ref SPEC-222 + open PR to staging (complexity: 2) [blocked by T-010]
