# HOS-377: Partner mentions log — record manual promotion actions and show them to the partner

## Progress: 5/32 tasks (16%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-004 → T-008 → T-010 → T-017 → T-026 → T-027 → T-028 (10 steps)
**Parallel Tracks:** 5 independent entry points (T-001, T-019, T-025, T-029, T-032)

> Decisions locked before decomposition (spec §6/§7/§11): 8-value closed channel enum
> (no `PRESS`), **one row per channel** with a server-generated `batchId` grouping a
> multi-network submission, per-channel URL requirement, **one email per batch**, and
> mentions editable/soft-deletable. HOS-278 already shipped `partners.ownerUserId`,
> `partners.contactInfo` and `GET /protected/partners/mine`, so the partner-facing half
> is **not** blocked and ships in the same cut.

---

### Setup Phase (2 tasks, avg 1.0)

- [x] **T-001** (complexity: 1) — Add `PartnerMentionChannelEnum` to `@repo/schemas` ✅
  - 8 values: INSTAGRAM, FACEBOOK, TWITTER, YOUTUBE, TIKTOK, NEWSLETTER, WHATSAPP, OTHER
  - Also: `.schema.ts` companion, `zodError` key in es/en/pt, `requiresMentionUrl` helper
  - 24 tests · mutation-verified (adding PRESS turns 4 red) · lint/typecheck/tests green
  - Blocked by: none · Blocks: T-002, T-005

- [x] **T-002** (complexity: 1) — Add `PartnerMentionChannelPgEnum` to the db enum schema ✅
  - `partner_mention_channel_enum` via `enumToTuple`; 4 in-process parity tests
  - ⚠ `test/enum-consistency.test.ts` is EXCLUDED in `vitest.config.ts:55` — never runs
  - Blocked by: T-001 · Blocks: T-003

### Core Phase (9 tasks, avg 2.3)

- [x] **T-003** (complexity: 3) — Create the `partner_mentions` Drizzle table schema ✅
  - 13 columns, 3 indexes, 4 FKs (`partner_id` cascade, audit trio `set null`), no FK on `batch_id`
  - 30 in-process tests · mutation-verified (FK tampering turns 3 red)
  - Blocked by: T-002 · Blocks: T-004, T-008

- [x] **T-004** (complexity: 2) — Generate and review the structural migration ✅
  - `0085_dizzy_jane_foster.sql` — purely additive; 0085 was unclaimed on every ref
  - Zero residual drift; `check-schema-drift.sh` green on a clean tree
  - Blocked by: T-003 · Blocks: T-008

- [x] **T-005** (complexity: 2) — Base `partnerMentionSchema` ✅
  - Plus `PARTNER_MENTION_ADMIN_ONLY_MASK` + `partnerMentionPublicSchema` (entity minus mask)
  - Refine-free on purpose so T-006/T-007 can slice it; a test asserts it
  - 14 tests · mutation-verified (shrinking the mask turns 2 red)
  - Blocked by: T-001 · Blocks: T-006, T-007

- [ ] **T-006** (complexity: 3) — `createPartnerMentionBatchSchema` + per-channel URL rule
  - One test per branch of the 8-channel rule; `batchId` never accepted from the client
  - Blocked by: T-005 · Blocks: T-009

- [ ] **T-007** (complexity: 2) — Update and search schemas
  - Blocked by: T-005 · Blocks: T-010

- [ ] **T-008** (complexity: 3) — `PartnerMentionModel` extending `BaseModel`
  - Integration tests: cascade on parent delete, newest-first, soft-delete exclusion
  - Blocked by: T-003, T-004 · Blocks: T-009, T-010

- [ ] **T-009** (complexity: 3) — `createBatch`: N rows, one transaction, server-side `batchId`
  - Blocked by: T-006, T-008 · Blocks: T-011, T-012, T-020

- [ ] **T-010** (complexity: 2) — Service list / update / soft-delete + `listForOwner`
  - Blocked by: T-007, T-008 · Blocks: T-011, T-013, T-014, T-015, T-017

- [ ] **T-011** (complexity: 3) — Service unit tests
  - Batch grouping, R-5 client `batchId` ignored, rollback, ownership fail-closed
  - Blocked by: T-009, T-010 · Blocks: none

### Integration Phase (18 tasks, avg 2.5)

- [ ] **T-012** (complexity: 3) — `POST /admin/partners/{partnerId}/mentions` (batch create)
  - Blocked by: T-009 · Blocks: T-016

- [ ] **T-013** (complexity: 2) — `GET /admin/partners/{partnerId}/mentions` (list)
  - `page`+`pageSize`, never `limit`
  - Blocked by: T-010 · Blocks: T-016

- [ ] **T-014** (complexity: 2) — `PATCH .../mentions/{id}`
  - Blocked by: T-010 · Blocks: T-016

- [ ] **T-015** (complexity: 2) — `DELETE .../mentions/{id}` (soft only)
  - Blocked by: T-010 · Blocks: T-016

- [ ] **T-016** (complexity: 3) — Mount the admin route group + e2e coverage
  - Confirm the test file actually runs in CI — `apps/api` has three vitest configs
  - Blocked by: T-012, T-013, T-014, T-015 · Blocks: T-022

- [ ] **T-017** (complexity: 3) — `GET /protected/partners/mine/mentions`
  - Ownership gate mirroring `mine.ts` — NOT a permission
  - Blocked by: T-010 · Blocks: T-018, T-026

- [ ] **T-018** (complexity: 3) — Protected route tests: `internalNote` leak + ownership
  - The cross-owner test needs a partner row that EXISTS, or 404 fires before the gate
  - Blocked by: T-017 · Blocks: none

- [ ] **T-019** (complexity: 2) — Notification type + email template
  - Blocked by: none · Blocks: T-020

- [ ] **T-020** (complexity: 3) — One email per batch, after commit, degrading silently
  - `contactInfo` is nullable and all-nullish: no address must not fail the insert
  - Blocked by: T-009, T-019 · Blocks: T-021

- [ ] **T-021** (complexity: 3) — Notification tests: send count and degradation
  - Assert count === 1 for a 4-entry batch, not merely "a mail went out"
  - Blocked by: T-020 · Blocks: none

- [ ] **T-022** (complexity: 2) — Admin TanStack Query hooks
  - Blocked by: T-016 · Blocks: T-023, T-024

- [ ] **T-023** (complexity: 3) — Admin mentions list section
  - Blocked by: T-022, T-025 · Blocks: none

- [ ] **T-024** (complexity: 3) — Admin multi-channel form (AC-7)
  - N channels → N URL fields → ONE request
  - Blocked by: T-022, T-025 · Blocks: none

- [ ] **T-025** (complexity: 1) — Admin i18n keys
  - Blocked by: none · Blocks: T-023, T-024, T-030

- [ ] **T-026** (complexity: 2) — Web fetcher for `/mine/mentions`
  - Blocked by: T-017 · Blocks: T-027

- [ ] **T-027** (complexity: 3) — Web "Bitácora de menciones", grouped by batch (AC-10)
  - CSS Modules, not Tailwind
  - Blocked by: T-026, T-029 · Blocks: T-028, T-031

- [ ] **T-028** (complexity: 3) — Wire the bitácora into `/mi-cuenta/aliados`
  - Never add an `acquiredPermission` to the partner door
  - Blocked by: T-027 · Blocks: none

- [ ] **T-029** (complexity: 2) — Web i18n keys + AC-5 separation comment
  - Verify `CLIENT_I18N_KEY_PREFIXES` coverage or PROD ships raw keys
  - Blocked by: none · Blocks: T-027, T-030

### Testing Phase (2 tasks, avg 2.5)

- [ ] **T-030** (complexity: 3) — Static copy guard for AC-3
  - A constraint over every present and future string needs a guard, not N assertions
  - Blocked by: T-025, T-029 · Blocks: none

- [ ] **T-031** (complexity: 2) — AC-4: gold and silver render identically (and bronze)
  - Blocked by: T-027 · Blocks: none

### Docs Phase (1 task, avg 1.0)

- [ ] **T-032** (complexity: 1) — File the `partners.analytics` removal follow-up (R-3)
  - Blocked by: none · Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-019, T-025, T-029, T-032
Level 1: T-002, T-005, T-030
Level 2: T-003, T-006, T-007
Level 3: T-004
Level 4: T-008
Level 5: T-009, T-010
Level 6: T-011, T-012, T-013, T-014, T-015, T-017, T-020
Level 7: T-016, T-018, T-021, T-026
Level 8: T-022, T-027
Level 9: T-023, T-024, T-028, T-031
```

Validated: 32/32 tasks resolve, no cycles, all `blocks`/`blockedBy` edges symmetric.

## Suggested Start

Begin with **T-001** (complexity: 1) — no dependencies, and it sits at the head of the
critical path: every DB, schema, service, route and UI task descends from the channel
enum. T-019 (notification template), T-025/T-029 (i18n) and T-032 (follow-up issue) can
run in parallel from the start if a second track is wanted.
