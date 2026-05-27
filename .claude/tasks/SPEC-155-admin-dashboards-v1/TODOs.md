# SPEC-155 — Admin Dashboards V1: Task Breakdown

**Total tasks**: 41 | **Average complexity**: 2.4 | **Status**: All pending

---

## Suggested first tasks (no dependencies — start immediately)

These tasks have no blockedBy entries and can all start in parallel:

| Task | Complexity | Why start here |
|------|:---:|---|
| **T-001** | 1 | Unblocks the entire frontend track (17 tasks depend on it) |
| **T-002** | 3 | Long-running audit; unblocks T-015 (billing permission revoke) |
| **T-003** | 2 | Independent backend aggregation route |
| **T-004** | 3 | Independent backend aggregation route |
| **T-005** | 3 | Independent backend aggregation route |
| **T-006** | 2 | Independent backend aggregation route |
| **T-007** | 2 | Independent backend aggregation route |
| **T-008** | 3 | Independent backend aggregation route |
| **T-009** | 2 | Independent backend aggregation route |
| **T-010** | 3 | Independent backend aggregation route |
| **T-011** | 2 | Independent backend aggregation route |
| **T-013** | 1 | Unblocks T-014 (EDITOR newsletter grant) |

---

## Critical Path

The longest sequential dependency chain (the bottleneck — start these first):

```
T-001 → T-017 → T-020 → T-031 → T-034 → T-035 → T-036 → T-037
```

Critical path depth: **8 tasks**. This chain also requires T-008 + T-009 + T-010 + T-011 before T-020, so in practice:

```
T-008/T-009/T-010/T-011 (parallel) → T-020
T-001 → T-017 → T-020 → T-031 → T-034 → T-035 → T-036 → T-037
```

An alternate critical path of equal length runs through the HOST track:
```
T-003/T-004 (parallel) → T-018 → T-029 → T-034 → T-035 → T-036 → T-037
```

---

## Parallel Tracks

```
Track A — Backend HOST (can start day 1):
  T-003 → T-004 → [feeds T-018 → T-029]

Track B — Backend EDITOR (can start day 1):
  T-005, T-006, T-007 (parallel) → [feeds T-019 → T-030]

Track C — Backend ADMIN (can start day 1):
  T-008, T-009, T-010, T-011 (parallel) → [feeds T-020 → T-031]

Track D — Backend tests (after all routes):
  T-012 (waits for T-003..T-011)

Track E — Permission changes (parallel to backend):
  T-013 → T-014 (EDITOR grant, low-risk, ship independently)
  T-002 → T-015 → T-016 (ADMIN revoke, high-risk, separate gate)

Track F — Frontend infra (after T-001):
  T-001 → T-017 → T-018, T-019, T-020, T-021 (parallel, each waiting for their routes)
  T-001 → T-022

Track G — Widget renderers (after T-001, fully parallel with each other):
  T-001 → T-023, T-024, T-025, T-026, T-027, T-028 (all parallel)

Track H — Configs (after resolver + respective routes):
  T-018 → T-029
  T-019 → T-030
  T-020 → T-031
  T-021 → T-032
  T-029 + T-030 + T-031 + T-032 → T-033 (CI validation)

Merge point → T-034 (needs all widgets + all configs + T-022):
  T-034 → T-035 → T-036 → T-037

Phase 7 (all after T-034):
  T-038 (also needs T-018)
  T-039
  T-040
  T-041 (also needs T-022)
```

---

## Dependency Graph Levels

**Level 0 — No dependencies (start immediately)**
T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-011, T-013

**Level 1 — Depends on level 0 only**
T-012 (←T-003..T-011), T-014 (←T-013), T-015 (←T-002), T-017 (←T-001), T-022 (←T-001), T-023 (←T-001), T-024 (←T-001), T-025 (←T-001), T-026 (←T-001), T-027 (←T-001), T-028 (←T-001)

**Level 2 — Depends on level 1**
T-016 (←T-015), T-018 (←T-017,T-003,T-004), T-019 (←T-017,T-005,T-006,T-007), T-020 (←T-017,T-008,T-009,T-010,T-011), T-021 (←T-017)

**Level 3 — Depends on level 2**
T-029 (←T-018), T-030 (←T-019), T-031 (←T-020), T-032 (←T-021)

**Level 4 — Depends on level 3**
T-033 (←T-029,T-030,T-031,T-032)
T-034 (←T-022,T-023..T-028,T-029,T-030,T-031,T-032)

**Level 5 — Depends on level 4**
T-035 (←T-034), T-038 (←T-018,T-034), T-039 (←T-034), T-040 (←T-034), T-041 (←T-022,T-034)

**Level 6 — Depends on level 5**
T-036 (←T-035)

**Level 7 — Depends on level 6**
T-037 (←T-036)

---

## Phase 0 — Pre-work (blockers)

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-001 | Confirm SPEC-154 exports | 1 | — | T-017, T-022, T-023..T-028 |
| T-002 | ADMIN billing blast-radius audit | 3 | — | T-015 |

---

## Phase 1 — Aggregation routes (backend)

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-003 | GET /host/favorites/breakdown route | 2 | — | T-012, T-018 |
| T-004 | GET /host/conversations/response-rate route | 3 | — | T-012, T-018 |
| T-005 | GET /admin/newsletter/subscribers/by-preference route | 3 | — | T-012, T-019 |
| T-006 | GET /admin/posts/trend route | 2 | — | T-012, T-019 |
| T-007 | Verify/build recent-comments listing endpoint | 2 | — | T-012, T-019 |
| T-008 | GET /admin/moderation/pending-count route | 3 | — | T-012, T-020 |
| T-009 | GET /admin/reviews/pending-count route | 2 | — | T-012, T-020 |
| T-010 | GET /admin/users/stats route | 3 | — | T-012, T-020 |
| T-011 | Expose maintenance-mode readable flag | 2 | — | T-012, T-020 |
| T-012 | Integration tests for all 9 aggregation routes | 4 | T-003..T-011 | — |

---

## Phase 2 — Permission changes

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-013 | Verify EDITOR newsletter permission enum entries | 1 | — | T-014 |
| T-014 | Seed EDITOR newsletter permission grant | 2 | T-013 | — |
| T-015 | Seed ADMIN billing permission revoke | 3 | **T-002** (HARD GATE) | T-016 |
| T-016 | Verify admin billing UI graceful degradation | 2 | T-015 | — |

> **WARNING**: T-015 is gated by T-002. The blast-radius audit MUST pass before the seed change ships.

---

## Phase 3 — Frontend infrastructure

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-017 | Source resolver registry skeleton | 2 | T-001 | T-018, T-019, T-020, T-021 |
| T-018 | Register HOST data sources | 3 | T-001, T-003, T-004, T-017 | T-029, T-038 |
| T-019 | Register EDITOR data sources | 3 | T-001, T-005, T-006, T-007, T-017 | T-030 |
| T-020 | Register ADMIN base data sources | 3 | T-001, T-008, T-009, T-010, T-011, T-017 | T-031 |
| T-021 | Register SUPER_ADMIN-only data sources | 2 | T-001, T-017 | T-032 |
| T-022 | DeferredWidget component | 2 | T-001 | T-034, T-041 |

---

## Phase 4 — Widget renderers

All renderers are blocked by T-001 only and can run in parallel with each other.

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-023 | KpiWidget component | 2 | T-001 | T-034 |
| T-024 | ListWidget component | 2 | T-001 | T-034 |
| T-025 | ChartWidget component | 3 | T-001 | T-034 |
| T-026 | ChecklistWidget component | 3 | T-001 | T-034 |
| T-027 | StatusWidget component | 2 | T-001 | T-034 |
| T-028 | Shared loading skeleton, error callout, empty state | 2 | T-001 | T-034 |

---

## Phase 5 — Dashboard configs

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-029 | hostDashboard config (7 cards) | 3 | T-001, T-018 | T-033, T-034 |
| T-030 | editorDashboard config (8 cards) | 3 | T-001, T-019 | T-033, T-034 |
| T-031 | adminBaseDashboard config (7 cards) | 3 | T-001, T-020 | T-033, T-034 |
| T-032 | superAdminOnlySection config (2 cards) | 2 | T-001, T-021 | T-033, T-034 |
| T-033 | CI config validation test suite | 2 | T-029, T-030, T-031, T-032 | — |

---

## Phase 6 — Dashboard renderer and migration

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-034 | Dashboard renderer component | 3 | T-022..T-032 (all widgets + all configs) | T-035, T-038, T-039, T-040, T-041 |
| T-035 | Migrate dashboard page to per-role renderer | 2 | T-034 | T-036 |
| T-036 | Parity verification (6 ADMIN KPIs) | 3 | T-035 | T-037 |
| T-037 | Delete useDashboardStats hook | 1 | T-036 | — |

---

## Phase 7 — Tests and hardening

| ID | Title | Complexity | Blocked By | Blocks |
|----|-------|:---:|---|---|
| T-038 | HOST scope isolation tests | 3 | T-018, T-034 | — |
| T-039 | SUPER gating tests | 2 | T-034 | — |
| T-040 | Performance baseline tests | 2 | T-034 | — |
| T-041 | Deferred-placeholder rendering tests | 2 | T-022, T-034 | — |

---

## Notes on phase vocabulary

The `phase` field in `state.json` uses the Task Master schema vocabulary:

| Spec phase | state.json phase |
|---|---|
| Phase 0 (Pre-work) | `setup` |
| Phase 1 (Aggregation routes) | `core` |
| Phase 2 (Permission changes) | `core` |
| Phase 3 (Frontend infra) | `integration` |
| Phase 4 (Widget renderers) | `integration` |
| Phase 5 (Dashboard configs) | `integration` |
| Phase 6 (Renderer + migration) | `integration` |
| Phase 7 (Tests + hardening) | `testing` |

T-037 is tagged `cleanup` in its tags but assigned to the `integration` phase because it is a direct migration step, not standalone cleanup work.

---

## Dependency issues fixed

None. All 41 tasks from the spec were mapped without cycles or missing references. The spec's explicit gates (T-002→T-015, T-036→T-037) are honored. Bidirectional consistency was verified for all 41 `blockedBy`/`blocks` pairs.
