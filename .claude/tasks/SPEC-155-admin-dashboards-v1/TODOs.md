# SPEC-155 — Admin Dashboards V1: Task Breakdown

> Regenerated after spec §6 rewrite (2026-05-26). Phase 0.5 schema extension added.
> T-001 and T-002 are COMPLETED. Old billing-revoke tasks removed. All other tasks pending.

**Total tasks**: 41 | **Average complexity**: 2.4 | **Completed**: 2 | **Pending**: 39

---

## Suggested next tasks (immediately startable after replan)

| Task | Complexity | Why start here |
|------|:---:|---|
| **T-003** | 2 | SCHEMA GATE — unblocks 17 tasks in Phases 3-5. Start first. |
| **T-004** | 2 | SCHEMA GATE — unblocks 17 tasks in Phases 3-5. Start first. |
| **T-005** | 2 | HOST favorites route — unblocked, feeds T-018 |
| **T-006** | 3 | HOST response-rate route — unblocked, feeds T-018 |
| **T-007** | 3 | EDITOR newsletter prefs route — unblocked, feeds T-019 |
| **T-008** | 2 | EDITOR posts trend route — unblocked, feeds T-019 |
| **T-009** | 2 | Comments listing — unblocked, feeds T-019 |
| **T-010** | 3 | ADMIN moderation count — unblocked, feeds T-020 |
| **T-011** | 2 | ADMIN reviews count — unblocked, feeds T-020 |
| **T-012** | 3 | ADMIN users stats — unblocked, feeds T-020 |
| **T-013** | 2 | Maintenance-mode flag — unblocked, feeds T-020 |
| **T-015** | 1 | T-002 is done — verify EDITOR newsletter perm names |

---

## Critical Path

The longest sequential dependency chain (the bottleneck — start T-003/T-004 first):

```
T-003/T-004 (schema extension, parallel)
  → T-017 (resolver skeleton)
    → T-020 (ADMIN sources; also waits for T-010..T-013)
      → T-031 (adminBaseDashboard config)
        → T-034 (renderer component; also waits for all widgets + other configs)
          → T-035 (page migration)
            → T-036 (parity verification)
              → T-037 (delete old hook)
```

Critical path depth: **9 sequential steps**. T-010..T-013 (ADMIN routes) also feed T-020, adding a parallel pre-condition:

```
T-010/T-011/T-012/T-013 (parallel, no blockers) → T-020
T-003/T-004 (parallel, no blockers) → T-017 → T-020 → T-031 → T-034 → T-035 → T-036 → T-037
```

---

## Parallel Tracks

```
Track A — Schema extension (start day 1, CRITICAL GATE):
  T-003 (extend WidgetSchema) — parallel with T-004
  T-004 (reconcile stubs)     — parallel with T-003
  Both unblock Phases 3-5 (17 tasks)

Track B — Backend HOST routes (start day 1):
  T-005 (favorites/breakdown), T-006 (response-rate) → T-014 (integration tests) → T-018 → T-029

Track C — Backend EDITOR routes (start day 1):
  T-007 (newsletter prefs), T-008 (posts trend), T-009 (comments) → T-014 → T-019 → T-030

Track D — Backend ADMIN routes (start day 1):
  T-010 (moderation), T-011 (reviews), T-012 (users), T-013 (maintenance) → T-014 → T-020 → T-031

Track E — Backend test consolidation:
  T-014 (waits for T-005..T-013 all complete)

Track F — Permission changes (parallel to backend):
  T-002 [done] → T-015 → T-016 (EDITOR newsletter grant, low-risk)

Track G — Frontend infra (after T-001 done + T-003/T-004):
  T-001+T-003+T-004 → T-017 (skeleton)
  T-017 → T-018, T-019, T-020, T-021 (source registrations, parallel)
  T-001+T-003+T-004 → T-022 (DeferredWidget)

Track H — Widget renderers (after T-001 done + T-003/T-004):
  T-001+T-003+T-004 → T-023, T-024, T-025, T-026, T-027, T-028 (all parallel)

Track I — Dashboard configs (after resolvers + schema):
  T-018 → T-029 (hostDashboard)
  T-019 → T-030 (editorDashboard)
  T-020 → T-031 (adminBaseDashboard)
  T-021 → T-032 (superAdminOnlySection)
  T-029+T-030+T-031+T-032 → T-033 (CI validation)

Merge point → T-034 (needs all widgets T-022..T-028 + all configs T-029..T-032):
  T-034 → T-035 → T-036 → T-037

Phase 7 (all after T-034):
  T-038 (also needs T-018), T-039, T-040 — parallel
  T-041 (also needs T-022)
```

---

## Dependency Graph Levels

**Level 0 — No dependencies (start immediately)**
T-001 [done], T-002 [done], T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-011, T-012, T-013

**Level 1 — Depends on level 0 only**
T-014 (←T-005..T-013), T-015 (←T-002[done]), T-017 (←T-001[done]+T-003+T-004), T-022 (←T-001[done]+T-003+T-004), T-023 (←T-001[done]+T-003+T-004), T-024 (←T-001[done]+T-003+T-004), T-025 (←T-001[done]+T-003+T-004), T-026 (←T-001[done]+T-003+T-004), T-027 (←T-001[done]+T-003+T-004), T-028 (←T-001[done]+T-003+T-004)

> T-015 is effectively level 0.5 since T-002 is already done — it can start now.

**Level 2 — Depends on level 1**
T-016 (←T-015), T-018 (←T-017+T-005+T-006), T-019 (←T-017+T-007+T-008+T-009), T-020 (←T-017+T-010+T-011+T-012+T-013), T-021 (←T-017)

**Level 3 — Depends on level 2**
T-029 (←T-003+T-004+T-018), T-030 (←T-003+T-004+T-019), T-031 (←T-003+T-004+T-020), T-032 (←T-003+T-004+T-021)

**Level 4 — Depends on level 3**
T-033 (←T-029+T-030+T-031+T-032)
T-034 (←T-022+T-023+T-024+T-025+T-026+T-027+T-028+T-029+T-030+T-031+T-032)

**Level 5 — Depends on level 4**
T-035 (←T-034), T-038 (←T-018+T-034), T-039 (←T-034), T-040 (←T-034), T-041 (←T-022+T-034)

**Level 6 — Depends on level 5**
T-036 (←T-035)

**Level 7 — Depends on level 6**
T-037 (←T-036)

---

## Phase 0 — Pre-work (blockers)

| ID | Title | Complexity | Blocked By | Status |
|----|-------|:---:|---|:---:|
| T-001 | Confirm SPEC-154 exports and identify schema gaps | 1 | — | DONE |
| T-002 | ADMIN billing blast-radius audit | 3 | — | DONE |

---

## Phase 0.5 — SPEC-154 schema extension (UNBLOCKED — start now)

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-003 | Extend WidgetSchema: add `onMissing` + `'checklist'` type | 2 | — | T-017..T-033 (17 tasks) |
| T-004 | Reconcile adminDashboard/superAdminDashboard stubs to new model | 2 | — | T-017..T-033 (17 tasks) |

> T-003 and T-004 have no blockers. They can run in parallel right now.

---

## Phase 1 — Aggregation routes (backend) — UNBLOCKED

### HOST routes

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-005 | GET /api/v1/protected/host/favorites/breakdown | 2 | — | T-014, T-018 |
| T-006 | GET /api/v1/protected/host/conversations/response-rate | 3 | — | T-014, T-018 |

### EDITOR routes

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-007 | GET /api/v1/admin/newsletter/subscribers/by-preference | 3 | — | T-014, T-019 |
| T-008 | GET /api/v1/admin/posts/trend | 2 | — | T-014, T-019 |
| T-009 | Verify/build recent-comments listing endpoint | 2 | — | T-014, T-019 |

### ADMIN routes

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-010 | GET /api/v1/admin/moderation/pending-count | 3 | — | T-014, T-020 |
| T-011 | GET /api/v1/admin/reviews/pending-count | 2 | — | T-014, T-020 |
| T-012 | GET /api/v1/admin/users/stats | 3 | — | T-014, T-020 |
| T-013 | Expose maintenance-mode readable flag via API | 2 | — | T-014, T-020 |

### Integration test consolidation

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-014 | Integration tests for all 9 routes (T-005..T-013) | 4 | T-005..T-013 | — |

---

## Phase 2 — Permission change (EDITOR grant)

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-015 | Verify EDITOR newsletter permission enum entries | 1 | T-002 [done] | T-016 |
| T-016 | Seed EDITOR newsletter permission grant | 2 | T-015 | — |

> T-015 is effectively unblocked (T-002 is done). Start T-015 now.
> EDITOR gets: `NEWSLETTER_CAMPAIGN_VIEW`, `NEWSLETTER_CAMPAIGN_WRITE`, `NEWSLETTER_SUBSCRIBER_VIEW`.
> EDITOR does NOT get `NEWSLETTER_CAMPAIGN_SEND` — sending stays admin-only.

---

## Phase 3 — Frontend infrastructure (blocked by T-003 + T-004)

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-017 | Source resolver registry skeleton | 2 | T-001[done], T-003, T-004 | T-018, T-019, T-020, T-021 |
| T-018 | Register HOST data sources in resolver | 3 | T-001[done], T-003, T-004, T-005, T-006, T-017 | T-029, T-038 |
| T-019 | Register EDITOR data sources in resolver | 3 | T-001[done], T-003, T-004, T-007, T-008, T-009, T-017 | T-030 |
| T-020 | Register ADMIN base data sources in resolver | 3 | T-001[done], T-003, T-004, T-010, T-011, T-012, T-013, T-017 | T-031 |
| T-021 | Register SUPER_ADMIN-only data sources in resolver | 2 | T-001[done], T-003, T-004, T-017 | T-032 |
| T-022 | DeferredWidget component | 2 | T-001[done], T-003, T-004 | T-034, T-041 |

---

## Phase 4 — Widget renderers (blocked by T-003 + T-004)

All renderers can run in parallel once T-003 and T-004 complete.

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-023 | KpiWidget component | 2 | T-001[done], T-003, T-004 | T-034 |
| T-024 | ListWidget component | 2 | T-001[done], T-003, T-004 | T-034 |
| T-025 | ChartWidget component | 3 | T-001[done], T-003, T-004 | T-034 |
| T-026 | ChecklistWidget component (requires `'checklist'` from T-003) | 3 | T-001[done], T-003, T-004 | T-034 |
| T-027 | StatusWidget component | 2 | T-001[done], T-003, T-004 | T-034 |
| T-028 | Shared loading skeleton, error callout, empty state | 2 | T-001[done], T-003, T-004 | T-034 |

---

## Phase 5 — Dashboard configs (blocked by T-003 + T-004 + source resolvers)

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-029 | hostDashboard config (7 cards A–G) | 3 | T-003, T-004, T-018 | T-033, T-034 |
| T-030 | editorDashboard config (8 cards A–H) | 3 | T-003, T-004, T-019 | T-033, T-034 |
| T-031 | adminBaseDashboard config (7 cards A–G) | 3 | T-003, T-004, T-020 | T-033, T-034 |
| T-032 | superAdminOnlySection config (2 cards H–I, `onMissing: 'hide'`) | 2 | T-003, T-004, T-021 | T-033, T-034 |
| T-033 | CI config validation test suite | 2 | T-029, T-030, T-031, T-032 | — |

---

## Phase 6 — Dashboard renderer and migration

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-034 | Dashboard renderer component | 3 | T-022..T-032 (all widgets + all configs) | T-035, T-038, T-039, T-040, T-041 |
| T-035 | Migrate dashboard page to per-role renderer | 2 | T-034 | T-036 |
| T-036 | Parity verification for 6 ADMIN KPIs | 3 | T-035 | T-037 |
| T-037 | Delete `useDashboardStats()` hook | 1 | **T-036 (HARD GATE)** | — |

---

## Phase 7 — Tests and hardening

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-038 | HOST scope isolation tests | 3 | T-018, T-034 | — |
| T-039 | SUPER gating tests (ADMIN=7 cards, SUPER=9 cards) | 2 | T-034 | — |
| T-040 | Performance baseline tests (parallel queries, <500ms) | 2 | T-034 | — |
| T-041 | Deferred-placeholder rendering tests | 2 | T-022, T-034 | — |

---

## Notes on phase vocabulary

The `phase` field in `state.json` uses the Task Master schema vocabulary:

| Spec phase | state.json phase |
|---|---|
| Phase 0 + 0.5 (Pre-work + Schema ext.) | `setup` / `core` |
| Phase 1 (Aggregation routes) | `core` |
| Phase 2 (Permission changes) | `core` |
| Phase 3 (Frontend infra) | `integration` |
| Phase 4 (Widget renderers) | `integration` |
| Phase 5 (Dashboard configs) | `integration` |
| Phase 6 (Renderer + migration) | `integration` |
| Phase 7 (Tests + hardening) | `testing` |

T-037 is tagged `cleanup` in its tags but resides in the `integration` phase block since it is a mandatory migration step, not optional polish.

---

## Dependency fixes applied during replan

1. Old T-003..T-016 were stale (pre-replan task IDs pointing to aggregation routes instead of schema extension). All 39 pending tasks were rewritten to match the rewritten spec §6 task table.
2. T-003 and T-004 (Phase 0.5 schema extension) added as gates for Phases 3–5. The `blockedBy` list for T-017..T-033 was updated to include T-003 and T-004.
3. T-015 now correctly maps to "Verify EDITOR newsletter permission names" (not the old billing revoke task). T-016 maps to "Seed EDITOR newsletter grant".
4. T-002 (completed) remains the gate for T-015 — the audit finding confirmed T-015 is safe to proceed.
5. No cycles introduced. All `blockedBy`/`blocks` pairs are bidirectionally consistent across all 41 tasks.
