---
spec-id: SPEC-246
title: Revalidation log entity_id tracking + re-enable ACC-02 E2E
type: bugfix
complexity: medium
status: draft
created: 2026-06-17T00:00:00Z
base: staging
tags: [revalidation, cache, service-core, e2e, testing, bug]
---

# SPEC-246 — Revalidation log entity_id tracking + re-enable ACC-02 E2E

## 1. Overview

### Goal

Make `RevalidationService` persist the `entity_id` of the entity that triggered a
revalidation into the `revalidation_log` table, and re-enable the
`acc-02-edit-revalidation.spec.ts` E2E test that asserts it.

### Origin

Discovered during the env-hardening work (PR #1712). Env hardening made
`HOSPEDA_REVALIDATION_SECRET` an always-required env var. As a side effect, the
E2E job (`e2e-pr.yml`) now sets that secret, which **un-skipped** the previously
dormant test `apps/e2e/tests/accommodation/acc-02-edit-revalidation.spec.ts`.

That test had an in-body guard (`if (!process.env.HOSPEDA_REVALIDATION_SECRET) test.fixme()`)
so it had **never actually run in CI** on `staging` — the secret was never set
there. Once it ran for the first time, it failed and exposed a pre-existing bug.

To unblock the env-hardening PR, the test was re-marked `test.fixme(...)` (see
that PR's `test(e2e): re-skip ACC-02 ... (SPEC-246)` commit). This spec tracks the
real fix.

## 2. Problem analysis

The test asserts that after a host edits an accommodation, `revalidation_log`
contains an entry **scoped to the edited entity**:

```ts
await assertRevalidationTriggered({
    since,
    entityType: 'accommodation',
    entityId: accommodation.id, // a UUID
    timeoutMs: 5_000
});
```

`assertRevalidationTriggered` queries
`revalidation_log WHERE entity_type = $1 AND entity_id = $2`.

Two defects make this unsatisfiable:

### 2.1 `entity_id` is never written (primary)

Trace (in `packages/service-core/src/revalidation/revalidation.service.ts`):

- `_afterUpdate` (accommodation service) → `scheduleRevalidation({ entityType, slug, ... })`
- `resolveConfigAndSchedule` → `extractEntityId(event)` returns `event.slug`
  (the accommodation **slug**, not the UUID) → `debounceEntity({ ..., entityId: slug })`
- `debounceEntity` fires after the debounce and calls
  `revalidatePaths({ paths, reason, trigger, entityType })` — **`entityId` is not forwarded**
- `revalidatePaths` → `writeLog({ path, entityType, trigger, ... })` — **no `entityId` param**
- `writeLog` → `logModel.create({ ... })` — **`entity_id` column is never set → always NULL**

So every hook-triggered `revalidation_log` row has `entity_id = NULL`. The test's
`entity_id = <uuid>` filter can never match. There is also a slug-vs-UUID mismatch:
`extractEntityId` yields the slug, while the test expects the UUID.

### 2.2 Debounce vs timeout race (secondary)

The accommodation revalidation config seeds `debounceSeconds: 5`. The test timeout
is exactly `timeoutMs: 5_000`. Even after 2.1 is fixed, the log row is only written
after the 5s debounce elapses, so the assertion can time out under CI load.

## 3. Scope

In scope:

1. Thread `entityId` through the revalidation write path:
   `debounceEntity` → `revalidatePaths` → `writeLog` → `logModel.create` so the
   `revalidation_log.entity_id` column is populated.
2. Reconcile the entity identifier contract: decide whether `entity_id` stores the
   slug or the UUID, and align `extractEntityId` and the E2E assertion accordingly.
   (Recommended: store the canonical UUID; have the accommodation hook pass the id.)
3. Fix the debounce/timeout race: either lower `debounceSeconds` for the E2E seed,
   or raise the test timeout above the debounce window.
4. Re-enable `acc-02-edit-revalidation.spec.ts` (remove the `test.fixme`) and make
   it green.
5. Add/extend unit coverage in `@repo/service-core` for the revalidation write path
   asserting `entity_id` is persisted.

Out of scope:

- Changing the revalidation adapter behavior (NoOp in test, real in prod).
- Any change to the env-hardening surface (that shipped in PR #1712).
- Path-only revalidation semantics for entities that legitimately have no id.

## 4. Acceptance criteria

- **AC-1**: After an entity update that triggers revalidation, at least one
  `revalidation_log` row exists with a non-null `entity_id` matching the updated
  entity's canonical identifier.
- **AC-2**: `acc-02-edit-revalidation.spec.ts` runs (no `test.fixme`) and passes in
  CI for both the `chromium-web` and `chromium-admin` projects.
- **AC-3**: A `@repo/service-core` unit test asserts `writeLog`/`revalidatePaths`
  forward `entityId` to `logModel.create`.
- **AC-4**: No regression in existing revalidation behavior (path-based entries
  still written; no new failures in the revalidation suite).

## 5. References

- `packages/service-core/src/revalidation/revalidation.service.ts`
  (`scheduleRevalidation`, `resolveConfigAndSchedule`, `extractEntityId`,
  `debounceEntity`, `revalidatePaths`, `writeLog`)
- `packages/db/src/.../revalidation-log.dbschema.ts` (`entity_id` column, nullable)
- `apps/e2e/tests/accommodation/acc-02-edit-revalidation.spec.ts`
- `apps/e2e/fixtures/revalidation-spy.ts` (`assertRevalidationTriggered`)
- Revalidation config seed (`debounceSeconds: 5` for `accommodation`)
- Discovery context: PR #1712 (env-hardening); engram `spec-registry/hospeda`
