---
specId: SPEC-230
title: Soft-delete filtering in the service list() path — make BaseCrudService.list exclude soft-deleted rows by default so protected list endpoints stop returning deleted records
slug: list-soft-delete-filtering
type: bugfix
complexity: medium
status: draft
owner: qazuor
created: 2026-06-15
base: staging
tags:
  - service-core
  - data-integrity
  - soft-delete
  - base-crud
  - list-endpoints
  - hardening
relatedSpecs:
  - SPEC-169
linearIssues: []
---

# SPEC-230 — Soft-delete filtering in the service `list()` path

## 1. Origin & problem statement

While smoke-testing the owner-promotions CRUD end-to-end (PR #1631), a
soft-deleted promotion kept appearing in the owner's "Mis promociones" list
after a successful `DELETE`. Investigation showed this is **not** an
owner-promotion bug — it is a property of the shared service `list()` path.

`BaseCrudService.list()` (`packages/service-core/src/base/base.crud.read.ts:274`)
builds its query `where` clause as:

```ts
const whereClause = processedOptions.where ?? {};
```

It does **not** inject `deletedAt: null`. The clause is passed straight to
`BaseModel.findAll` (`packages/db/src/base/base.model.ts:165`) and
`BaseModel.findAllWithRelations` (`:983`), both of which call
`buildWhereClause(safeWhere, this.table)` and add **no** soft-delete predicate
of their own. So `list()` returns soft-deleted rows unless the caller manually
adds `deletedAt: null` to the `where`.

By contrast, the **admin search** path
(`base.crud.read.ts:494`) *does* add it explicitly:

```ts
if (!includeDeleted && 'deletedAt' in tableRecord) {
    where.deletedAt = null;
}
```

A repo-wide check found that **no** protected list route handler passes
`deletedAt: null` in its `where`. Therefore **every** protected list endpoint
built on `service.list()` returns soft-deleted rows. It went unnoticed because
most flows do not delete-then-list within the same view; owner-promotions
exposed it because the web CRUD lists immediately after delete.

This is a correctness/data-integrity bug: a soft-deleted record is, by the
project's own convention ("soft delete by default", CLAUDE.md), meant to be
invisible to normal reads.

## 2. Goals & success criteria

- `BaseCrudService.list()` excludes soft-deleted rows by default for any entity
  whose table has a `deletedAt` column.
- An explicit opt-in (e.g. `includeDeleted: true` in `ListOptions`, mirroring
  the admin-search flag) is required to see soft-deleted rows.
- Callers that already pass `deletedAt: null` manually keep working (idempotent).
- No protected list endpoint returns soft-deleted records after this ships.
- Entities without a `deletedAt` column are unaffected (no spurious predicate).

Success = a regression test proving `list()` omits a soft-deleted row by
default and includes it only under `includeDeleted: true`, plus the full
service-core + API suites green, plus a manual smoke on a representative
protected list (owner-promotions, accommodations) confirming deleted rows
disappear.

## 3. User stories & acceptance criteria

### US-1 — As an owner, a promotion I delete disappears from my list

- **Given** an owner with a soft-deleted promotion,
- **When** the web/API requests `GET /protected/owner-promotions`,
- **Then** the deleted promotion is NOT in the response.

### US-2 — As a developer, list() filters soft-deletes without per-caller boilerplate

- **Given** any service extending `BaseCrudService` over a `deletedAt` table,
- **When** I call `service.list()` without special options,
- **Then** soft-deleted rows are excluded automatically (no manual `where`).

### US-3 — As an admin tool, I can still opt into seeing deleted rows

- **Given** a caller that needs soft-deleted rows (e.g. a restore UI),
- **When** it calls `service.list({ includeDeleted: true })`,
- **Then** soft-deleted rows ARE returned.

### US-4 — As a maintainer, entities without soft-delete are untouched

- **Given** a table with no `deletedAt` column,
- **When** `list()` runs,
- **Then** no `deletedAt` predicate is added and the query is unchanged.

## 4. Out of scope

- Column projection / `SELECT *` hardening — that is SPEC-210.
- The `search()` / `_executeSearch()` public path (each entity already forces
  its own lifecycle/active filters; e.g. owner-promotion forces `ACTIVE`).
- The `adminSearch` path (already correct).
- Changing soft-delete semantics (lifecycleState vs deletedAt) — only the
  read-time filtering in `list()` is in scope.

## 5. Architecture & technical approach

### 5.1 Inject the predicate in `BaseCrudService.list()`

Mirror the admin-search logic at the point where `whereClause` is built
(`base.crud.read.ts:274`): when the resolved table has a `deletedAt` column and
the (new) `includeDeleted` option is not set, add `deletedAt: null` to the
clause, without clobbering a caller-supplied `deletedAt` (explicit caller intent
wins).

### 5.2 Add `includeDeleted` to `ListOptions`

Extend the `listOptionsSchema` / `ListOptions` type with an optional
`includeDeleted?: boolean` (default false), so callers can opt in symmetrically
with admin search.

### 5.3 Decide the injection layer (open question for tech analysis)

Two candidate layers — settle during tech-analysis:

- **Service layer** (`BaseCrudService.list`): smallest blast radius, only the
  `list()` path changes; `findAll`/`findAllWithRelations` stay generic.
- **Model layer** (`BaseModel.findAll` + `findAllWithRelations`): catches every
  caller of those methods, but widens blast radius to count(), search internals,
  and any direct model usage — higher regression risk.
Recommendation: service layer (matches where admin-search already does it).

### 5.4 Layers touched

- `packages/service-core/src/base/base.crud.read.ts` (list where-clause + options schema)
- Possibly `packages/service-core/src/types.ts` (ListOptions type)
- No DB migration. No schema (`@repo/schemas`) change.

## 6. Dependencies

None blocking. Independent of SPEC-210 (projection) and the owner-promotions
fixes in PR #1631 (which deliberately did NOT patch this systemically).

## 7. Risks & mitigations

- **Risk**: a caller today *relies* on `list()` returning soft-deleted rows.
  - *Mitigation*: grep all `service.list(`/`.list(` call sites; any that need
    deleted rows pass `includeDeleted: true`. Document findings in tech-analysis.
- **Risk**: double predicate when a caller already passes `deletedAt: null`.
  - *Mitigation*: only inject when `deletedAt` is absent from the caller's where.
- **Risk**: entities without `deletedAt` get a broken query.
  - *Mitigation*: guard on `'deletedAt' in table` exactly as admin-search does.

## 8. Testing strategy (no tests = not done)

- Unit (service-core): `list()` omits a soft-deleted row by default; includes it
  with `includeDeleted: true`; adds no predicate for a no-`deletedAt` table;
  respects a caller-supplied `deletedAt` value.
- Regression: a test reproducing the owner-promotions case (delete → list →
  absent) before the fix.
- Suite: full service-core + API suites green.
- Manual smoke: owner-promotions and one other protected list (accommodations)
  — delete a row, confirm it leaves the list.

## 9. Implementation approach (phases)

1. **Audit** — enumerate every `service.list()` caller and classify whether any
   intentionally wants soft-deleted rows. Output: a short table in tech-analysis.
2. **Implement** — add `includeDeleted` to `ListOptions`; inject `deletedAt: null`
   default in `BaseCrudService.list()`.
3. **Test** — unit + regression as above.
4. **Verify** — full suites + manual smoke on 2 representative protected lists.

## 10. Internal review notes

- Discovered during PR #1631 (owner-promotions CRUD smoke), 2026-06-15. The PR
  fixed three owner-promotion-specific blockers (slug generation, `accommodation`
  nullable in public/protected access schemas, route `_OWN` permission variants)
  but deliberately deferred this systemic `list()` filtering bug to this spec to
  avoid touching shared base-CRUD code inside a web-scoped PR.
