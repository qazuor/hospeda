# TODOs: AI Usage Dashboard

Spec: SPEC-260 | Status: draft | Progress: 0/23

## Setup

- [ ] T-001: Add AI usage row schemas in @repo/schemas (complexity: 2)

## Core

- [ ] T-002: Add formatMicroUsd helper (complexity: 1)
- [ ] T-007: Extend buildConditions for model/provider filters (complexity: 2) [blocked by T-001]
- [ ] T-003: aggregateAiUsageByModel storage query (complexity: 3) [blocked by T-001, T-007]
- [ ] T-004: aggregateAiUsageByProvider storage query (complexity: 2) [blocked by T-001, T-007]
- [ ] T-005: aggregateAiUsageByFeatureModel storage query (the cross) (complexity: 3) [blocked by T-001]
- [ ] T-006: aggregateAiUsageDaily storage query (complexity: 3) [blocked by T-001, T-007]
- [ ] T-008: Public reporting wrappers + daily zero-fill (complexity: 3) [blocked by T-003, T-004, T-005, T-006]

## Integration

- [ ] T-009: GET /admin/ai/usage/by-model endpoint (complexity: 3) [blocked by T-008, T-001]
- [ ] T-010: GET /admin/ai/usage/by-provider endpoint (complexity: 2) [blocked by T-008, T-001]
- [ ] T-011: GET /admin/ai/usage/by-feature-model endpoint (complexity: 2) [blocked by T-008, T-001]
- [ ] T-012: GET /admin/ai/usage/daily endpoint (complexity: 3) [blocked by T-008, T-001]
- [ ] T-013: TanStack Query hooks + URL search-param filters (complexity: 3) [blocked by T-009, T-010, T-011, T-012]
- [ ] T-014: usage.tsx page scaffold + route guard + nav link (complexity: 3) [blocked by T-013]
- [ ] T-015: Totals card + by-feature/by-model/by-provider tables (complexity: 3) [blocked by T-014, T-002]
- [ ] T-016: Feature x model table + grouped bar chart (complexity: 3) [blocked by T-014, T-002]
- [ ] T-017: Daily cost chart (complexity: 2) [blocked by T-014, T-002]
- [ ] T-018: i18n keys ai.usage.* (es/en/pt) (complexity: 2) [blocked by T-014]
- [ ] T-019: Per-block empty/loading/error states (complexity: 2) [blocked by T-015, T-016, T-017, T-018]

## Testing

- [ ] T-020: Reconciliation test (totals == /by-feature) (complexity: 2) [blocked by T-008, T-009]
- [ ] T-021: Admin page component tests (complexity: 3) [blocked by T-019]
- [ ] T-022: Accessibility pass (complexity: 2) [blocked by T-019]

## Docs

- [ ] T-023: Docs: admin usage surface note (complexity: 1) [blocked by T-021]
