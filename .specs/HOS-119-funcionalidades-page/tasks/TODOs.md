# TODOs: Página pública /funcionalidades — catálogo de features

Spec: HOS-119 | Status: draft | Progress: 0/13

## Setup

- [ ] T-001: Create i18n namespace `features` (es/en/pt + config + types) (complexity: 3)

## Core

- [ ] T-002: Create features-content.ts (structure, no prices) (complexity: 3) [blocked by T-001]
- [ ] T-003: Build page index.astro with all sections + scoped styles on tokens (complexity: 3) [blocked by T-001, T-002]
- [ ] T-004: Hero animated blobs in CSS + reduced-motion (complexity: 2) [blocked by T-003]
- [ ] T-005: Responsive plan tables (overflow-x, tabular-nums) (complexity: 2) [blocked by T-003]

## Integration

- [ ] T-006: Audience subnav scroll-spy island (complexity: 3) [blocked by T-003]
- [ ] T-007: SEO wiring + JSON-LD (CollectionPage + ItemList + Breadcrumb) (complexity: 2) [blocked by T-003]

## Testing

- [ ] T-008: Page test (source-string assertions) (complexity: 2) [blocked by T-003, T-007]
- [ ] T-009: features-content.ts unit test (complexity: 2) [blocked by T-002]
- [ ] T-010: Subnav island test (testing-library) (complexity: 2) [blocked by T-006]
- [ ] T-011: check-locales + a11y sweep (both themes) (complexity: 2) [blocked by T-001, T-008]

## Docs

- [ ] T-012: Docs note (unlinked / share-manual page) (complexity: 1) [blocked by T-003]

## Cleanup

- [ ] T-013: Final gate: typecheck + lint + test + visual review (complexity: 2) [blocked by T-004..T-012]
