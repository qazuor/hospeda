# HOS-377: Partner mentions log — record manual promotion actions and show them to the partner

## Progress: 21/32 tasks (66%)

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

- [x] **T-006** (complexity: 3) — `createPartnerMentionBatchSchema` + per-channel URL rule ✅
  - Entry = `.pick({channel,url})` + superRefine reporting on the `['url']` path
  - `partnerId` (path is authoritative) and `batchId` (server-generated) both stripped
  - 36 tests · mutation-verified twice (URL rule → 5 red across two suites; entry pick → 1 red)
  - ⚠ T-009 must insert from the PARSED output — the raw body bypasses the stripping
  - Blocked by: T-005 · Blocks: T-009

- [x] **T-007** (complexity: 2) — Update and search schemas ✅
  - A channel switch to a permalink channel must carry the url in the same patch
  - `partnerId`/`batchId` not patchable; search declares channel, batchId, mentionedAfter/Before
  - 24 tests · mutation-verified (neutralising the switch guard turns 2 red)
  - ⚠ T-010 must re-validate the MERGED row — `{url: null}` alone is invisible to the patch schema
  - Blocked by: T-005 · Blocks: T-010

- [x] **T-008** (complexity: 3) — `PartnerMentionModel` extending `BaseModel` ✅
  - 19 integration tests against real Postgres (the FKs FIRE, not just declared)
  - Ordering defect found by mutation: `now()` is transaction-scoped, so a batch's
    rows share `created_at` — the tie-break needed `id` to be total
  - `findByBatch` sorts by pg enum declaration order, not insertion order
  - Blocked by: T-003, T-004 · Blocks: T-009, T-010

- [x] **T-009** (complexity: 3) — `createBatch`: N rows, one transaction, server-side `batchId` ✅
  - Inherited `create()` and unscoped search both SEALED (throw pointing at the right method)
  - Notification is an injected port, once per batch, failures swallowed
  - 13 tests · mutation-verified (per-row notify + null batchId turns 4 red)
  - Blocked by: T-006, T-008 · Blocks: T-011, T-012, T-020

- [x] **T-010** (complexity: 2) — Service list / update / soft-delete + `listForOwner` ✅
  - `correct()` re-validates the MERGED row — closes the gap T-007 structurally could not
  - `listForOwner` fails closed on ownership; admin fields stripped by DELETE, not by parse
    (a read that validates 500s the whole log on one legacy row)
  - Blocked by: T-007, T-008 · Blocks: T-011, T-013, T-014, T-015, T-017

- [x] **T-011** (complexity: 3) — Service unit tests ✅
  - 34 tests across two files; 79 green in `test/services/partner/`
  - ⚠ Transaction-rollback case NOT covered by the mocked suite — belongs in an
    integration test (the model stub cannot roll anything back)
  - Blocked by: T-009, T-010 · Blocks: none

### Integration Phase (18 tasks, avg 2.5)

- [x] **T-012** (complexity: 3) — `POST /admin/partners/{partnerId}/mentions` (batch create) ✅
  - Handler spreads the PARSED body with the path `partnerId` LAST — that ordering is
    what makes the schema's stripping decide ownership; a test pins it against a body
    carrying a foreign `partnerId` + `batchId`
  - ⚠ `auditLog` uses `BILLING_MUTATION` (the only variant with `resourceType`), which
    is in `CRITICAL_AUDIT_EVENTS` → Sentry warning level. Same precedent as the sibling
    `manual-payment.ts`
  - Blocked by: T-009 · Blocks: T-016

- [x] **T-013** (complexity: 2) — `GET /admin/partners/{partnerId}/mentions` (list) ✅
  - `page`+`pageSize`, never `limit`; a test asserts `limit` is not a declared param
  - Needed a real total the model did not have: added `countByPartner`, sharing its
    WHERE terms with `findByPartner` via a private builder. `listForPartner` now
    returns `{ mentions, total }`
  - Blocked by: T-010 · Blocks: T-016

- [x] **T-014** (complexity: 2) — `PATCH .../mentions/{id}` ✅
  - Cross-partner rejection lives in the SERVICE (`assertMentionBelongsTo`), not the
    route, so it travels with the data. NOT_FOUND, not FORBIDDEN — `PARTNER_MANAGE` is
    global, so this is correctness, and a distinct code would confirm the row exists
  - Blocked by: T-010 · Blocks: T-016

- [x] **T-015** (complexity: 2) — `DELETE .../mentions/{id}` (soft only) ✅
  - Returns a body rather than nothing: the factory answers 204 on an empty result
  - Blocked by: T-010 · Blocks: T-016

- [x] **T-016** (complexity: 3) — Mount the admin route group + e2e coverage ✅
  - CI question resolved AGAINST `test/e2e/`: `test:e2e` is in NO workflow. CI runs
    `turbo run test` → `vitest.config.ts` only. Suite lives at
    `test/routes/partners/admin/mentions/mentions-routes.test.ts`, 15 tests
  - Route factories mocked as identity fns, so the export IS the options object —
    path, method and permissions become assertable alongside the handler
  - ⚠ Found and fixed: `PartnerMentionService` was never exported from the
    `@repo/service-core` barrel, so no route could import it
  - Blocked by: T-012, T-013, T-014, T-015 · Blocks: T-022

- [x] **T-017** (complexity: 3) — `GET /protected/partners/mine/mentions` ✅
  - Ownership gate mirroring `mine.ts` — NOT a permission. Fails closed to an empty
    list, never 403 (which would confirm a partner exists)
  - The route re-strips NOTHING: the service owns the mask, and a second
    hand-maintained one here is how the two drift apart
  - Added `partnerMentionBatchSchema` to `@repo/schemas` as the shared batch contract;
    service-core's `PartnerMentionBatchView` is now an alias of the inferred type
  - Blocked by: T-010 · Blocks: T-018, T-026

- [x] **T-018** (complexity: 3) — Protected route tests: `internalNote` leak + ownership ✅
  - The cross-owner test needs a partner row that EXISTS, or 404 fires before the gate
    — so the fixture has TWO owners with TWO real logs
  - The REAL service runs against stub models; a stubbed `listForOwner` would prove
    only that the route forwards a value
  - Leak assertions are on the SERIALIZED payload, so a note under an unexpected key
    still fails. 8 tests · mutation-verified twice (strip → 2 red, ownership → 5 red)
  - Blocked by: T-017 · Blocks: none

- [x] **T-019** (complexity: 2) — Notification type + email template ✅
  - `PartnerMentionsLoggedPayload` carries the WHOLE batch, so once-per-submission is
    enforced by the type rather than by caller convention
  - `channelLabel` is a human label resolved by the CALLER: `@repo/notifications`
    deliberately has no `@repo/schemas` dep, and `providerLabel` already set that boundary
  - 11 tests asserting AC-3 on the RENDERED html — banned words AND the softer phrasings
    that promise the same measurement. Mutation-verified (injecting "alcance" → 2 red)
  - Blocked by: none · Blocks: T-020

- [x] **T-020** (complexity: 3) — One email per batch, after commit, degrading silently ✅
  - `contactInfo` is nullable and all-nullish: no address must not fail the insert
  - ⚠ `preferredEmail` is a PREFERENCE enum (`HOME`/`WORK`/`MOBILE`), NOT an address. It
    selects between `workEmail`/`personalEmail` and then falls THROUGH — "write to me at
    work" plus an empty work field is not a reason to go silent, and `MOBILE` names no
    email column at all
  - Writes to `contactInfo`, NOT the owner account the revoke port uses. Opposite
    pressures: a revocation goes to the account precisely because the partner's own
    details may be stale then
  - Blocked by: T-009, T-019 · Blocks: T-021

- [x] **T-021** (complexity: 3) — Notification tests: send count and degradation ✅
  - Assert count === 1 for a 4-entry batch, not merely "a mail went out" — 15 tests,
    mutation-verified (single send → per-mention loop turns the count test red)
  - The throwing-transport case was ALREADY covered by T-009's `createBatch` suite and is
    not duplicated: the service owns the swallow, the port owns the resolution
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
