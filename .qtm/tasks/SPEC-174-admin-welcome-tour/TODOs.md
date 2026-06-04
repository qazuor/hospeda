# SPEC-174: Admin Guided Welcome Tour (role-based, config-driven)

## Progress: 0/18 tasks (0%)

**Average Complexity:** 2.4/10 (all tasks ≤ 3)
**Critical Path:** T-004 → T-005 → T-006 → T-007 → T-011 → T-013 → T-018 (7 steps)
**Parallel Tracks:** backend (T-001..T-003 ∥ config chain) · engine (T-008/T-009 after T-005/T-001)

> Foundation inherited from SPEC-175 (already merged): `onboarding.adminTours` schema field,
> `USER_SETTINGS_UPDATE` guard, REPLACE-mode JSONB → RMW service pattern (`markWhatsNewSeen`
> as the mirror), and the `suppressed` seam on `WhatsNewAutoTrigger` for D12.

---

### Backend Phase

- [ ] **T-001** (c1) Tour-progress body schema · blocks T-003, T-009
- [ ] **T-002** (c2) markAdminTourSeen service (RMW) · blocks T-003
- [ ] **T-003** (c2) PATCH /protected/users/me/tour-progress · needs T-001, T-002 · blocks T-017

### Config Phase

- [ ] **T-004** (c2) primitives.ts extraction (no behavior change) · blocks T-005
- [ ] **T-005** (c2) tour.schema.ts + KNOWN_DATA_TOUR_IDS · blocks T-006..T-008, T-011, T-012
- [ ] **T-006** (c3) AdminIAConfigSchema wiring + cross-checks T1–T3 · blocks T-007
- [ ] **T-007** (c3) tours.ts: 4 welcome tours + index wiring · blocks T-011, T-016

### Engine Phase

- [ ] **T-008** (c3) lib/tour pure modules ×4 (incl. D13 redirect decision) · blocks T-010, T-013
- [ ] **T-009** (c2) use-admin-tour-state.ts · blocks T-010, T-013
- [ ] **T-010** (c3) driver.js + tour-context + TourWelcomeModal · blocks T-013..T-015
- [ ] **T-011** (c2) use-tours.ts selectors · blocks T-013, T-014

### Wiring Phase

- [ ] **T-012** (c2) data-tour attributes (run pre-existing layout suites!) · blocks T-013, T-016
- [ ] **T-013** (c3) TourAutoTrigger + D13 redirect + D12 whats-new suppression · blocks T-018
- [ ] **T-014** (c2) "Ver guía" entry points + i18n chrome · blocks T-018
- [ ] **T-015** (c2) A11y pass · blocks T-018

### Content Phase

- [ ] **T-016** (c3) 15 contextual mini-tours content es/en/pt · blocks T-018

### Testing Phase

- [ ] **T-017** (c2) Backend e2e (real DB, sibling preservation both directions)
- [ ] **T-018** (c3) Admin cross-surface integration + pre-existing-suite sweep

---

## Dependency Graph

```
Level 0: T-001, T-002, T-004
Level 1: T-003, T-005, T-009
Level 2: T-006, T-008, T-012, T-017
Level 3: T-007, T-010
Level 4: T-011, T-015
Level 5: T-013*, T-014, T-016
Level 6: T-018
(*T-013 also needs T-008/T-009/T-010/T-012)
```

## Decisions locked (no re-litigation)

- D13: welcome auto-fires from any authed route; redirect to /dashboard when needed (only when offering).
- D14: SUPER_ADMIN reuses admin.* contextual; super variants only plataforma/analisis.
- D15: no master opt-out in v1.
- D16: USER_SETTINGS_UPDATE guard + RMW (evidence from SPEC-175).
- D12: welcome tour suppresses What's New auto-modal via `suppressed` prop (T-013).
- D2: driver.js approved dependency exception (T-010, document in PR).

## Suggested Start

T-001 + T-002 + T-004 (independent, levels 0).
