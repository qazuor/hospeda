# TODOs: Dependabot CI Hardening & Dependency Bump Merge Strategy

Spec: SPEC-219 | Status: draft | Progress: 0/8

## Setup

- [ ] T-001: Document the Dependabot CI Build failure baseline (absent secrets) (complexity: 2)

## Core

- [ ] T-002: Make CI Build resilient to absent secrets (Dependabot context) (complexity: 5) [blocked by T-001]
- [ ] T-003: Update `.github/dependabot.yml` grouping & major isolation (complexity: 4) [blocked by T-001]

## Integration

- [ ] T-004: Re-validate PR #1548 passes CI after the build fix (complexity: 2) [blocked by T-002]
- [ ] T-005: Triage PR #1570 per the new strategy (peel off breaking majors) (complexity: 4) [blocked by T-003]

## Testing

- [ ] T-006: Guard — production build must reject placeholder URLs (complexity: 3) [blocked by T-002]

## Docs

- [ ] T-007: Write `docs/guides/dependabot-policy.md` (complexity: 3) [blocked by T-002, T-003]

## Cleanup

- [ ] T-008: Link SPEC-219 to the major-migration specs (owner handoff) (complexity: 2) [blocked by T-005]
