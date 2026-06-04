# SPEC-175: Admin What's New / Release Notes Dialog

## Progress: 0/20 tasks (0%)

**Average Complexity:** 2.3/10 (all tasks ≤ 3)
**Critical Path:** T-001 → T-009 → T-011 → T-012 → T-013 → T-020 (6 steps)
**Parallel Tracks:** backend (T-002→T-003→T-006/T-007) ∥ admin-core (T-008/T-009/T-010) ∥ dashboard prep (T-015)

---

### Schemas Phase

- [ ] **T-001** (complexity: 2) - Add WhatsNew entity schemas to @repo/schemas
  - Blocked by: none · Blocks: T-004, T-005, T-007, T-008, T-009, T-016
- [ ] **T-002** (complexity: 2) - Add onboarding namespace to UserSettingsSchema (whatsNew + adminTours)
  - Blocked by: none · Blocks: T-003, T-006, T-007

### Service Phase

- [ ] **T-003** (complexity: 3) - Add markWhatsNewSeen service method with server-side merge
  - Blocked by: T-002 · Blocks: T-006, T-007 · Resolves spec Q2 (JSONB replace vs merge)

### API Phase

- [ ] **T-004** (complexity: 1) - Create curated whats-new data file with boot validation
  - Blocked by: T-001 · Blocks: T-006, T-018
- [ ] **T-005** (complexity: 2) - Pure server helpers: role filter, seen computation, locale resolution
  - Blocked by: T-001 · Blocks: T-006
- [ ] **T-006** (complexity: 3) - GET /api/v1/protected/whats-new with lazy-init
  - Blocked by: T-002, T-003, T-004, T-005 · Blocks: T-016, T-019
- [ ] **T-007** (complexity: 2) - PATCH /api/v1/protected/users/me/whats-new-seen
  - Blocked by: T-001, T-002, T-003 · Blocks: T-019 · Resolves spec Q1 (permission guard)

### Admin-Core Phase

- [ ] **T-008** (complexity: 2) - Admin pure lib: has-unseen-highlights, resolve-entry-locale
  - Blocked by: T-001 · Blocks: T-014
- [ ] **T-009** (complexity: 3) - useWhatsNew() shared hook (single source of truth)
  - Blocked by: T-001 · Blocks: T-011, T-012, T-013, T-014
- [ ] **T-010** (complexity: 1) - admin-whats-new i18n namespace (es/en/pt)
  - Blocked by: none · Blocks: T-011, T-012, T-013

### Admin-UI Phase

- [ ] **T-011** (complexity: 3) - WhatsNewModal (highlight list + single-entry mode) — resolves TBD-1
  - Blocked by: T-009, T-010 · Blocks: T-012, T-014, T-017, T-020
- [ ] **T-012** (complexity: 3) - WhatsNewPanel (Sheet + mark-all-read) — resolves Q3
  - Blocked by: T-009, T-010, T-011 · Blocks: T-013, T-017, T-020
- [ ] **T-013** (complexity: 2) - WhatsNewBadge + Header wiring — resolves Q2 (icon)
  - Blocked by: T-009, T-010, T-012 · Blocks: T-020
- [ ] **T-014** (complexity: 2) - WhatsNewAutoTrigger + AppLayout mount (D17 seam documented)
  - Blocked by: T-008, T-009, T-011 · Blocks: T-020

### Dashboard Phase

- [ ] **T-015** (complexity: 2) - Extend ListWidget config: footerLink + onItemClick — resolves Q4/Q5
  - Blocked by: none · Blocks: T-017
- [ ] **T-016** (complexity: 2) - Register whats-new.recent dashboard source (4 role files)
  - Blocked by: T-001, T-006 · Blocks: T-017
- [ ] **T-017** (complexity: 2) - Add whats-new widget to all four role dashboards
  - Blocked by: T-011, T-012, T-015, T-016 · Blocks: T-020

### Ops Phase

- [ ] **T-018** (complexity: 2) - CSP image-origin allowlist test (TBD-2 guard)
  - Blocked by: T-004 · Blocks: none

### Testing Phase

- [ ] **T-019** (complexity: 3) - API integration tests: GET + PATCH with real DB (incl. AC-17)
  - Blocked by: T-006, T-007 · Blocks: none
- [ ] **T-020** (complexity: 3) - Admin component integration tests (Testing Library + MSW)
  - Blocked by: T-011, T-012, T-013, T-014, T-017 · Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002, T-010, T-015
Level 1: T-003, T-004, T-005, T-008, T-009
Level 2: T-006, T-007, T-011, T-018
Level 3: T-012, T-014, T-016, T-019
Level 4: T-013, T-017
Level 5: T-020
```

## Open questions routed to tasks

- **Q1** (permission guard) → resolved in T-007 (check seed; consult owner if ambiguous)
- **Q2** (badge icon) → resolved in T-013 (verify @repo/icons exports)
- **Q3** (Sheet modality) → resolved in T-012 (consult owner)
- **Q4/Q5** (ListWidget footerLink/onItemClick) → resolved in T-015 (option 1 recommended, confirm with owner)
- **TBD-1** (markdown renderer) → resolved in T-011 (TipTap read-only recommended)
- **TBD-2** (CDN origin) → guarded by T-018 (owner/ops decision, blocks image entries only)

## Suggested Start

Begin with **T-001** and **T-002** (both complexity 2, no dependencies) — they unblock the entire backend chain.
