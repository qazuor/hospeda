# SPEC-085: Guest-Owner Messaging System — Task Progress

> **Spec status**: draft (moves to `in-progress` when first task starts)
> **Priority**: P1
> **Complexity**: High
> **Created**: 2026-04-26
> **Last updated**: 2026-04-26

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 15 |
| Completed | 0 |
| In progress | 0 |
| Pending | 15 |
| Blocked | 0 |
| Average complexity | 2.73 |
| Max complexity (ceiling) | 3.0 |

---

## Phase Overview

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| phase-0: Foundation | 5 | 0/5 | pending |
| phase-1: Service Layer | 3 | 0/3 | pending |
| phase-2: API Routes | 3 | 0/3 | pending |
| phase-3: Email + Templates | 2 | 0/2 | pending |
| phase-4: Web + Admin UI | 2 | 0/2 | pending |

---

## Task List

| ID | Title | Phase | Complexity | Status | Blocked By |
|----|-------|-------|------------|--------|------------|
| T-001 | Add TypeScript enums, permission values, env vars, and advisory lock registrations | phase-0 | 2.0 | pending | — |
| T-002 | Create DB schemas, pgEnums, Drizzle relations, and manual SQL migration files | phase-0 | 3.0 | pending | T-001 |
| T-003 | Create Zod validation schemas in @repo/schemas | phase-0 | 3.0 | pending | T-001 |
| T-004 | Create DB models, extend ServiceError, extend error response helpers, seed role-permissions | phase-0 | 3.0 | pending | T-001, T-002 |
| T-005 | Create i18n namespace conversations.json for all three locales | phase-0 | 1.5 | pending | — |
| T-006 | Implement AccessTokenService and NotificationScheduleService | phase-1 | 3.0 | pending | T-002, T-003, T-004 |
| T-007 | Implement ConversationService with state machine, soft-delete cascade, metrics, and user.create linking hook | phase-1 | 3.0 | pending | T-002, T-003, T-004, T-006 |
| T-008 | Implement MessageService with content moderation, notification scheduling, and metrics updates | phase-1 | 3.0 | pending | T-002, T-003, T-004, T-006 |
| T-009 | Extend rate-limit middleware and implement public conversation API routes | phase-2 | 3.0 | pending | T-003, T-004, T-007, T-008 |
| T-010 | Implement protected conversation API routes for authenticated guests | phase-2 | 2.5 | pending | T-003, T-004, T-007, T-008 |
| T-011 | Implement admin conversation API routes and register cron endpoints | phase-2 | 3.0 | pending | T-003, T-004, T-006, T-007, T-008 |
| T-012 | Create five React Email templates for conversation notifications and verification | phase-3 | 2.5 | pending | T-005 |
| T-013 | Wire email templates into service and cron dispatch calls | phase-3 | 1.5 | pending | T-006, T-007, T-011, T-012 |
| T-014 | Build Web UI: ContactHost island, guest message pages, and anonymous token pages | phase-4 | 3.0 | pending | T-005, T-009, T-010 |
| T-015 | Build Admin UI: owner inbox, thread view, sidebar badge, content section, and feature directory | phase-4 | 3.0 | pending | T-005, T-011 |

---

## Dependency Graph

```
T-001 (enums/permissions/env)
  ├── T-002 (DB schemas + pgEnums + SQL migrations)
  │     └── T-004 (DB models + ServiceError + seed)
  ├── T-003 (Zod schemas)
  │     └── (feeds T-006, T-007, T-008, T-009, T-010, T-011)
  └── (T-004 also depends on T-002)

T-005 (i18n) — independent track
  └── T-012 (email templates)
        └── T-013 (wire templates into service/cron)

After T-002 + T-003 + T-004 are done:
  ├── T-006 (AccessTokenService + NotificationScheduleService)
  │     ├── T-007 (ConversationService)
  │     │     ├── T-009 (public routes)
  │     │     ├── T-010 (protected routes)
  │     │     └── T-011 (admin routes + crons)
  │     └── T-008 (MessageService)
  │           ├── T-009 (public routes)
  │           ├── T-010 (protected routes)
  │           └── T-011 (admin routes + crons)

T-011 + T-012 → T-013 (wiring)

T-009 + T-010 + T-005 → T-014 (web UI)
T-011 + T-005       → T-015 (admin UI)
```

### Parallel Tracks Available

**Track A — Foundation (must be first, 2 parallel streams):**
- T-001 and T-005 can start simultaneously

**Track B — DB Schema (after T-001):**
- T-002 and T-003 can run in parallel (both need T-001, independent of each other)

**Track C — DB Models (after T-001 + T-002):**
- T-004 can start as soon as T-001 and T-002 complete

**Track D — Service Layer (after T-002 + T-003 + T-004):**
- T-006, T-007 (depends on T-006), T-008 (depends on T-006) — T-007 and T-008 can run in parallel once T-006 completes

**Track E — API Layer (after service layer):**
- T-009, T-010, T-011 can run in parallel once T-007 and T-008 complete

**Track F — Email Templates (after T-005, independent of service/API):**
- T-012 can start as soon as T-005 completes

**Track G — UI (after API layer + i18n):**
- T-014 and T-015 can run in parallel

---

## Critical Path

The longest sequential dependency chain:

```
T-001 → T-002 → T-004 → T-006 → T-007 → T-011 → T-013
                                                ↘
                                           T-015 (admin UI)
```

Or equivalently through T-008:

```
T-001 → T-003 → T-006 → T-008 → T-009 → T-014
```

**Critical path length**: 6 sequential task-hops (T-001 → T-002 → T-004 → T-006 → T-007 → T-009 → T-014)

Start T-001 and T-005 first. T-005 (i18n, complexity 1.5) has float and can be deprioritized briefly, but T-012 (email templates) blocks T-013 which blocks the complete notification cron wiring.

---

## Atomization Notes

The following tasks hit exactly the complexity ceiling of 3.0 and were atomized into subtasks to keep them implementable in a single session:

| Task | Atomized Reason |
|------|-----------------|
| T-002 | 4 table schemas + 2 SQL migration files + pgEnum registration + barrel wiring = 3 implementation subtasks |
| T-003 | 7 schema files (entity split pattern) = 5 grouped subtasks by file type |
| T-004 | 4 model files + 3 cross-cutting code changes + seed data + test = 6 subtasks |
| T-006 | 2 services (AccessToken + NotificationSchedule) each with 4-5 methods + tests = 4 subtasks |
| T-007 | ConversationService is the most complex single piece: 12 methods + permissions module + auth hook integration + tests = 5 subtasks |
| T-008 | MessageService pipeline (8 steps) + blocklist env parsing + tests = 4 subtasks |
| T-009 | Rate-limit factory (new) + 5 public routes with dual limiters + tests = 6 subtasks |
| T-011 | 7 admin routes + 3 cron jobs + vercel.json + tests = 7 subtasks |
| T-014 | 1 React island + 5 Astro pages + 3 existing file modifications + 2 deletions + tests = 6 subtasks |
| T-015 | 20+ feature directory files + 2 route files + 3 sidebar modifications + tests = 6 subtasks |

---

## Next Recommended Task

**Start with T-001** (TypeScript enums, permissions, env vars, advisory locks).

- No blockers
- Complexity 2.0 (lowest among unblocked tasks other than T-005)
- Unlocks T-002 and T-003 (which together unlock all service layer work)
- All changes are additive to existing files (no risk of breaking existing behavior)

**In parallel with T-001, start T-005** (i18n files).

- No blockers
- Complexity 1.5 (lowest of all tasks)
- Completely independent track (unlocks email templates when T-012 can start)
- Pure JSON creation with no code dependencies

---

## Acceptance Criteria Reference Index

| AC Group | Satisfied by |
|----------|-------------|
| AC-001-01..06 (anon guest initiation + verification) | T-002, T-007, T-009 |
| AC-002-01..05 (auth guest initiation + inbox + thread) | T-007, T-010, T-014 |
| AC-003-01..09 (owner inbox + thread + actions) | T-007, T-008, T-011, T-015 |
| AC-004-01..04 (anonymous token access) | T-006, T-009, T-014 |
| AC-005-01..03 (anonymous → authenticated linking) | T-007 (user.create hook) |
| AC-006-01..06 (notification scheduling + streak) | T-006, T-008, T-011, T-012, T-013 |
| AC-007-01..03 (token expiry reminders) | T-006, T-011, T-012, T-013 |
| AC-008-01..03 (admin moderation + accommodation deletion) | T-007, T-011, T-015 |
| Feature BDD: rate limit | T-009 |
| Feature BDD: content moderation | T-008 |
| Feature BDD: state machine | T-007, T-008 |
| Feature BDD: notifications | T-006, T-011, T-012, T-013 |

---

## Key Implementation Warnings

1. **Partial unique indexes** must go in `packages/db/src/migrations/manual/0015_*` — Drizzle cannot declare them natively (R8 risk, confirmed).
2. **`drizzle-kit push` alone is not enough** — run `packages/db/scripts/apply-postgres-extras.sh` after every push (creates partial indexes + CHECK constraint).
3. **Advisory lock IDs 43020-43022** are confirmed free (max existing is 43010). Register in `packages/db/docs/advisory-locks.md` (T-001).
4. **`sendEmail` accepts ReactElement**, not pre-rendered HTML. Do NOT use `@react-email/render` in production dispatch paths (it is devDependency for tests only).
5. **`ServiceError` reason field** is a new 4th constructor arg — existing call sites are safe (optional + positional at end). Propagation is unconditional (not gated by HOSPEDA_API_DEBUG_ERRORS).
6. **Protected route ownership** is checked inline (`conversations.user_id = actor.userId`) — NOT via PermissionEnum. USER/GUEST roles have no CONVERSATION_* permissions.
7. **`jose` library** is a transitive dep via `better-auth@1.4.18` but must be added explicitly to `apps/api/package.json` with range `^6.1.0`.
8. **`guest` segment** must be added to `SESSION_OPTIONAL_SEGMENTS` in `apps/web/src/lib/routes.ts` or anonymous token pages will redirect to login (C4-03 in spec audit).
9. **`OwnerContact.client.tsx`** must be deleted and all references removed — ContactHost replaces it unconditionally for both anonymous and authenticated visitors (both `slug.astro` and `OwnerCard.astro` conditional guards must be removed).
10. **Cron vercel.json entries** are required for production (C4-01 in spec audit) — without them cron jobs are never invoked.
