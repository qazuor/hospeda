# SPEC-170 — Per-User Granular Permission Management Panel
## Task Overview

**Progress:** 0/31 tasks completed  
**Average Complexity:** 2.6 / 5  
**Estimated Effort:** 24-32 h  
**Created:** 2026-05-30

---

## Phase Breakdown

| Phase       | Tasks | Avg Complexity |
|-------------|-------|----------------|
| setup       | 3     | 1.7            |
| core        | 10    | 2.5            |
| integration | 10    | 2.5            |
| testing     | 8     | 2.9            |

---

## Critical Path

```
T-001 (PermissionEffectSchema)
  → T-003 (pgEnum declaration)
    → T-004 (DB column + migration)
      → T-005 (getUserPermissionsWithEffect in cache)
        → T-006 (TDD: 10 actor.ts test cases — WRITE FIRST)
          → T-007 (actor.ts deny-resolution — GATE)
            ├─→ T-008 (assignPermissionToUser upsert)
            │     → T-010 (removePermissionFromUser cache+audit)
            │       → T-011 (seed fix PERMISSION_*)
            ├─→ T-009 (getPermissionOverridesForUser method)
            │
            ├─→ T-015 (GET route)
            ├─→ T-016 (POST route)
            ├─→ T-017 (DELETE route)
            │     └─→ T-018 (API integration tests)
            │
            └─→ T-019/T-020 (TQ hooks)
                  → T-024 (PermissionOverridesCard)
                    → T-025 (wire into page)
                      ├─→ T-029 (E2E: grant)
                      └─→ T-030 (E2E: deny)
                            → T-031 (smoke test)
```

**Critical path depth:** 14 tasks sequential (T-001 → T-031)  
**Float tasks (can be delayed):** T-012/T-013 (grouping helper), T-014 (i18n), T-021/T-022/T-023 (UI components), T-026/T-027/T-028 (dedicated UI tests)

---

## Parallel Tracks

**Track A — Backend critical (must be sequential):**
T-001 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-010 → T-011

**Track B — Schemas (after T-001):**
T-001 → T-002 (API endpoint schemas)

**Track C — Grouping helper (TDD, after T-001):**
T-001 → T-012 (TDD tests first) → T-013 (implementation)

**Track D — i18n (no deps):**
T-014 (independent, can start immediately)

**Track E — API routes (after T-007 + T-009):**
T-015, T-016, T-017 can run in parallel once T-007 is done

**Track F — UI components (after T-013 + T-014):**
T-021 → T-026 (can start in parallel with backend tracks, only needs i18n)
T-022 → needs T-013 + T-014
T-023 → needs T-013 + T-014 + T-022
T-024 → needs T-019 + T-020 + T-021 + T-023

**Merge point:** T-018 (needs T-007 + T-011 + T-015-17)  
**Final merge:** T-025 (needs T-024), then T-029/T-030, then T-031

---

## Dependency Graph by Level

```
Level 0 (no deps):
  T-014 (i18n keys)

Level 1 (depends on T-001 only):
  T-002 (API schemas)
  T-003 (pgEnum)
  T-012 (grouping TDD)

Level 2:
  T-004 (depends T-003)
  T-013 (depends T-012)

Level 3:
  T-005 (depends T-001 + T-004)

Level 4:
  T-006 (depends T-005) — TDD GATE

Level 5:
  T-007 (depends T-006) — IMPLEMENTATION GATE

Level 6 (depends T-007):
  T-008, T-009

Level 7:
  T-010 (depends T-007 + T-008)
  T-015 (depends T-002 + T-007 + T-009)
  T-016 (depends T-002 + T-007 + T-008)
  T-017 (depends T-002 + T-007 + T-010)
  T-019 (depends T-002 + T-007)
  T-020 (depends T-002 + T-007)
  T-021 (depends T-014)
  T-022 (depends T-013 + T-014)

Level 8:
  T-011 (depends T-010)
  T-018 (depends T-007 + T-011 + T-015 + T-016 + T-017)
  T-023 (depends T-013 + T-014 + T-022)
  T-026 (depends T-021 + T-022)

Level 9:
  T-024 (depends T-019 + T-020 + T-021 + T-023)
  T-027 (depends T-023)

Level 10:
  T-025 (depends T-014 + T-020 + T-024)
  T-028 (depends T-024)

Level 11:
  T-029 (depends T-018 + T-025)
  T-030 (depends T-018 + T-025)

Level 12:
  T-031 (depends T-029 + T-030)
```

---

## Tasks by Phase

### setup (3 tasks)

- [ ] **T-001** `[complexity:2]` Add PermissionEffectSchema and PermissionEffect type to @repo/schemas
- [ ] **T-002** `[complexity:2]` Add API endpoint Zod schemas for user permission overrides
- [ ] **T-003** `[complexity:1]` Add PermissionEffectPgEnum to DB enums and pgEnum declaration

### core (10 tasks)

- [ ] **T-004** `[complexity:2]` Add effect column to user_permission DB schema and run migration
- [ ] **T-005** `[complexity:2]` Add getUserPermissionsWithEffect export to user-permissions-cache.ts
- [ ] **T-006** `[complexity:3]` ⚠️ [TDD] Write all 10 actor.ts precedence test cases BEFORE touching actor.ts
- [ ] **T-007** `[complexity:3]` ⚠️ Implement deny-override resolution in actor.ts — make all 10 tests pass
- [ ] **T-008** `[complexity:3]` Extend PermissionService.assignPermissionToUser with effect param and upsert
- [ ] **T-009** `[complexity:3]` Add getPermissionOverridesForUser service method
- [ ] **T-010** `[complexity:2]` Add audit emission and cache invalidation to removePermissionFromUser
- [ ] **T-011** `[complexity:1]` Fix seed: add PERMISSION_VIEW, PERMISSION_ASSIGN, PERMISSION_REVOKE to SUPER_ADMIN
- [ ] **T-012** `[complexity:2]` ⚠️ [TDD] Write permission-grouping helper with tests first
- [ ] **T-013** `[complexity:3]` Implement permission-grouping.ts helper — make all grouping tests pass
- [ ] **T-014** `[complexity:1]` Add i18n keys for user permissions panel to admin-pages.json

### integration (10 tasks)

- [ ] **T-015** `[complexity:3]` Create GET /admin/users/:id/permissions API route
- [ ] **T-016** `[complexity:3]` Create POST /admin/users/:id/permissions API route
- [ ] **T-017** `[complexity:2]` Create DELETE /admin/users/:id/permissions/:permission API route
- [ ] **T-019** `[complexity:2]` Create useUserPermissionOverrides TanStack Query hook
- [ ] **T-020** `[complexity:2]` Create useAssignUserPermission and useRevokeUserPermission mutation hooks
- [ ] **T-021** `[complexity:2]` Create OverrideRow component
- [ ] **T-022** `[complexity:1]` Create RolePermissionBadge component
- [ ] **T-023** `[complexity:4]` Create PermissionPicker dialog component
- [ ] **T-024** `[complexity:4]` Create PermissionOverridesCard component
- [ ] **T-025** `[complexity:2]` Wire PermissionOverridesCard into $id_.permissions.tsx, replace stub

### testing (8 tasks)

- [ ] **T-018** `[complexity:4]` Write API integration tests for all 3 permission routes
- [ ] **T-026** `[complexity:2]` Write RTL tests for OverrideRow and RolePermissionBadge
- [ ] **T-027** `[complexity:3]` Write RTL tests for PermissionPicker
- [ ] **T-028** `[complexity:3]` Write RTL tests for PermissionOverridesCard
- [ ] **T-029** `[complexity:3]` Write E2E test: grant override → re-auth → actor.permissions includes override
- [ ] **T-030** `[complexity:3]` Write E2E test: deny override → re-auth → actor.permissions excludes denied perm
- [ ] **T-031** `[complexity:2]` Smoke test: db:fresh-dev + manual QA of full grant/revoke/deny flow

---

## Suggested Start

**Start immediately (no deps):**
1. **T-014** — i18n keys (complexity 1, no deps, can run in parallel with everything)
2. **T-001** — PermissionEffectSchema (complexity 2, foundation for everything)

**After T-001:**
- Spawn T-003 (pgEnum) + T-002 (API schemas) + T-012 (TDD grouping tests) in parallel

**Critical milestone — T-007 (actor.ts gate):**
- MUST be reached before API routes or UI integration can be meaningfully tested.
- Path: T-001 → T-003 → T-004 → T-005 → T-006 (TDD) → T-007.
- Priority 1 for the backend developer.

---

## Risk Flags

- **R-4 (CRITICAL):** T-006/T-007 (actor.ts precedence) — mandatory TDD. A precedence bug here is a platform-wide auth failure. Write tests first, implementation second. No exceptions.
- **R-1:** PermissionPicker (T-023) must show sensitive-permission warning for `_VIEW_ALL`, `_READ_ALL`, `_HARD_DELETE`.
- **Upsert pattern:** T-008 needs to verify whether Drizzle's `onConflictDoUpdate` works with the base model; may need raw query or delete+create fallback (document the choice).
- **Route registration order (T-015):** `/:id/permissions` must be registered BEFORE `/:id` in the user admin router or Hono will try to parse `permissions` as a UUID.
