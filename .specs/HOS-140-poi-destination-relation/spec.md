---
title: POI-destination relation kind (PRIMARY/NEARBY)
linear: HOS-140
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - db
  - api
---

# POI-destination relation kind (PRIMARY/NEARBY)

> **Depends on**: HOS-138 (POI v2 model core) — this spec's column lands on
> the existing `r_destination_point_of_interest` join table, unmodified in
> shape by HOS-138 but conceptually downstream of it (same migration window).
> **Sibling**: HOS-139 (categories model) — independent, both depend only on
> HOS-138; unrelated data (see HOS-139 R-4 for the "two different `isPrimary`/
> `relation` concepts" disambiguation).
> **Blocks**: the future "qué hay cerca"/destination-map issues (`[H]`/`[I]`
> in the approved plan `/home/qazuor/.claude/plans/functional-prancing-rabin.md`),
> which need to distinguish a destination's own landmarks from nearby
> cross-references. Neither is filed as its own `HOS-N` issue yet.

## 1. Summary

HOS-113's `r_destination_point_of_interest` join table is a plain M2M mapping
with no metadata: every row means "this POI belongs to this destination,"
full stop. The 914-POI dataset's `nearbyDestinations` field (331 rows) encodes
a second, distinct kind of association — "this POI is not IN this destination,
but is close enough to be worth surfacing from it" (e.g. a POI physically
inside Concordia that is still worth showing on Colón's page because it's a
short trip away). This spec adds a `relation` column (`PRIMARY | NEARBY`,
default `PRIMARY`) to the join table so both kinds of association can live in
the same table without conflating them, and updates the read paths that
currently return every joined POI undifferentiated.

## 2. Problem

- `r_destination_point_of_interest`
  (`packages/db/src/schemas/destination/r_destination_point_of_interest.dbschema.ts:12-32`)
  has exactly two columns, both part of the composite PK: `destinationId`,
  `pointOfInterestId`. There is no way to express "this row exists because the
  POI is nearby, not because it belongs here" — every row is semantically
  identical today.
- The dataset explicitly separates these two concepts:
  a POI's own destination (where it physically is) versus a
  `nearbyDestinations` list (331 cross-references across the dataset) that
  should surface the POI as a suggestion from a *different* destination's
  page without claiming the POI is actually located there. Importing
  `nearbyDestinations` naively as ordinary join rows would make every
  destination's POI section (and any future "count of POIs per destination")
  silently include landmarks that are not actually in that destination.
- Every current read path that walks this join table returns an
  undifferentiated set:
  `PointOfInterestService.getPointsOfInterestForDestination`
  (`packages/service-core/src/services/point-of-interest/point-of-interest.service.ts:335-380`)
  fetches `this.relatedModel.findAll({ destinationId })` with no relation
  filter; `DestinationModel.getPointsOfInterestMap`
  (`packages/db/src/models/destination/destination.model.ts:497-582`) does
  the same via a plain `innerJoin` with no `relation` column in its `select`.
  Adding the column without also deciding these methods' default filtering
  behavior would either (a) silently start returning NEARBY rows once any
  exist, changing `DestinationPOISection.astro`'s rendered output with no
  code change on the web side, or (b) require every caller to be updated in
  lockstep before any NEARBY row can safely exist.

## 3. Goals

- **G-1** Add `relation` (`point_of_interest_relation_enum`: `PRIMARY |
  NEARBY`, `NOT NULL DEFAULT 'PRIMARY'`) to `r_destination_point_of_interest`,
  as a plain column outside the composite PK (the PK stays exactly
  `(destinationId, pointOfInterestId)` — see §6.1 for why no PK change is
  needed or wanted).
- **G-2** New pgEnum + Zod enum (`PointOfInterestDestinationRelationEnum`),
  following the exact `enumToTuple`/`pgEnum` convention every other domain
  enum in `packages/db/src/schemas/enums.dbschema.ts` uses.
- **G-3** Update `PointOfInterestAddToDestinationInputSchema` and
  `PointOfInterestService.addPointOfInterestToDestination` to accept an
  optional `relation` (defaulting to `PRIMARY` when omitted, preserving every
  existing caller's behavior unchanged).
- **G-4** Decide and implement the default relation-filtering behavior for
  the two existing read paths (`getPointsOfInterestForDestination`,
  `getPointsOfInterestMap`) so that adding this column is a **behavior-
  preserving no-op** for every row that exists before this spec ships (all of
  which default to `PRIMARY` via the column default) and for any consumer
  that does not explicitly ask for NEARBY rows.
- **G-5** Expose an explicit, opt-in way to also fetch NEARBY rows, for the
  future consumer (`[H]`/`[I]` in the plan) that actually wants them.

## 4. Non-goals

- **NG-1** Importing the dataset's 331 `nearbyDestinations` rows. That is the
  future bulk-import issue (`[E]` in the plan), out of scope here — this spec
  only builds the column and the read/write plumbing that import will use.
- **NG-2** Any UI change. `DestinationPOISection.astro` keeps its current
  PRIMARY-only behavior unless/until a future consumer spec explicitly wires
  in NEARBY rendering (`[H]`/`[I]`).
- **NG-3** Allowing a `relation` value to be independently PATCHed after
  creation via a dedicated route/permission. Changing a row's `relation`
  today happens only by removing and re-adding it (reusing the existing
  create/delete permission pair, §7.3) — a dedicated "update relation kind"
  permission/endpoint is deferred (OQ-2).
- **NG-4** Any change to `poi_categories`/`r_poi_category` (HOS-139). Fully
  independent table, fully independent `isPrimary` concept (see HOS-139 R-4).

## 5. Current baseline

Verified against the working tree 2026-07-11:

- **Join table today**:
  `packages/db/src/schemas/destination/r_destination_point_of_interest.dbschema.ts:12-32` —
  `destinationId`/`pointOfInterestId`, both `uuid NOT NULL` FKs with
  `onDelete: 'cascade'`, composite PK via `primaryKey({columns: [...]})`,
  two indexes (the composite pair, plus a standalone index on
  `pointOfInterestId` for the reverse lookup). No other columns.
- **Zod relation schema** `PointOfInterestAddToDestinationInputSchema`
  (`packages/schemas/src/entities/point-of-interest/point-of-interest.crud.schema.ts:106-109`):
  currently exactly `{ destinationId, pointOfInterestId }` — no relation-kind
  field to extend.
- **Service write path**:
  `PointOfInterestService.addPointOfInterestToDestination`
  (`packages/service-core/src/services/point-of-interest/point-of-interest.service.ts:187-251`)
  validates existence of both sides + rejects a duplicate pair (`ALREADY_
  EXISTS`), then calls `this.relatedModel.create({destinationId,
  pointOfInterestId})` — no relation-kind parameter today.
- **Service read paths** (both currently relation-blind):
  - `getPointsOfInterestForDestination`
    (`point-of-interest.service.ts:335-380`): `this.relatedModel.findAll({
    destinationId })`, then fetches every matched POI id and sorts by
    `displayWeight` descending. No relation filter or field in the response
    shape.
  - `getDestinationsByPointOfInterest`
    (`point-of-interest.service.ts:390-437`): the reverse lookup, same
    relation-blind shape.
- **Model read path**: `DestinationModel.getPointsOfInterestMap`
  (`packages/db/src/models/destination/destination.model.ts:497-582`) selects
  `id, slug, lat, long, type, description, icon, isFeatured, isBuiltin,
  displayWeight` off `pointsOfInterest`, innerJoined through
  `rDestinationPointOfInterest`, with **no `relation` column in the select and
  no filter on it** — every joined row for the requested `destIds` is
  returned today, ordered by `displayWeight` descending.
- **`_executeSearch`/`resolveDestinationIdFilter`**
  (`point-of-interest.service.ts:494-540`) resolve a `destinationId` search
  filter by querying `this.relatedModel.findAll({ destinationId })` and
  building an `id IN (...)` condition — also currently relation-blind.
- **Dataset producer of NEARBY rows (future, out of scope)**: the 914-POI
  dataset's `nearbyDestinations` field, 331 rows total across the dataset —
  the eventual bulk-import issue (`[E]`) is the actual producer; this spec
  only prepares the column and read/write API it will use.
- **Enum convention precedent**: every domain enum in
  `packages/db/src/schemas/enums.dbschema.ts` follows the same three-line
  shape — e.g. `PointOfInterestTypePgEnum` itself
  (`enums.dbschema.ts:139-142`): `export const XPgEnum = pgEnum('x_enum',
  enumToTuple(XEnum))`, importing the Zod-side `XEnum` from `@repo/schemas`.
  This spec's `PointOfInterestDestinationRelationPgEnum` follows the same
  pattern exactly.

## 6. Proposed design

### 6.1 `relation` column — outside the PK, default `PRIMARY`

Add `relation` as a plain `NOT NULL` column with `DEFAULT 'PRIMARY'`,
**not** part of the composite PK. The PK remains `(destinationId,
pointOfInterestId)` exactly as today — this is a deliberate, load-bearing
design point worth stating precisely: the PK's job is to prevent the *same*
destination-POI pair from having more than one row, and that job is unchanged
by this spec. A single POI legitimately surfacing as `PRIMARY` for
destination A and `NEARBY` for destination B is already achievable today with
the *existing* PK, because A and B are different `destinationId` values —
two separate rows, no PK conflict, regardless of whether `relation` sits
inside or outside the key. Putting `relation` inside the PK would instead
allow the same `(destinationId, pointOfInterestId)` pair to have **two**
rows (one PRIMARY, one NEARBY) simultaneously for the *same* destination —
a state with no sensible meaning (a POI cannot be both "in" and "merely
nearby" the same destination at once). Keeping `relation` outside the PK is
what prevents that nonsensical double-row state.

**Alternatives considered:**

1. **`relation` as part of the composite PK**
   (`(destinationId, pointOfInterestId, relation)`). Rejected per the
   nonsensical-double-row argument above — it would let a POI be
   simultaneously PRIMARY and NEARBY for the identical destination, which is
   meaningless and would force every read path to defensively de-duplicate.
2. **(Chosen) `relation` as a plain column, PK unchanged.** Enforces exactly
   one relation kind per destination-POI pair for free, via the existing PK
   — no new constraint needed beyond the column itself.

### 6.2 Read-path default behavior — behavior-preserving no-op (G-4)

Both existing read paths change their default to **PRIMARY-only**, which is
provably a no-op for every row that exists today (all default to `PRIMARY`
via the column default, since no NEARBY rows exist yet — NG-1):

- `PointOfInterestService.getPointsOfInterestForDestination` gains an
  optional `relation` parameter (`'PRIMARY' | 'NEARBY' | 'ALL'`, default
  `'PRIMARY'`) — `this.relatedModel.findAll({ destinationId, ...(relation
  !== 'ALL' && { relation }) })`. Existing callers (none of which pass this
  new optional param) get identical output to today.
- `DestinationModel.getPointsOfInterestMap` gains an optional `relation`
  parameter with the same three-value contract and same default; the
  `select`/`where` clause is extended to include `relation` in the returned
  row shape (so a future consumer, e.g. `[H]`/`[I]`, can distinguish
  PRIMARY/NEARBY items even when `relation: 'ALL'` was requested) and to
  filter by it when a specific kind (not `'ALL'`) is requested.
- `resolveDestinationIdFilter`/`_executeSearch`
  (`point-of-interest.service.ts:494-540`) similarly default to
  PRIMARY-only for the `destinationId` search filter — searching "POIs in
  destination X" should not surface a landmark that is merely nearby X
  unless explicitly asked for.

**Alternatives considered:**

1. **Default to `'ALL'` (return both PRIMARY and NEARBY undifferentiated),
   let callers opt into PRIMARY-only.** Rejected: this is the "silently
   changes behavior once any NEARBY row exists" failure mode from §2 — a
   future NEARBY import would then silently start appearing on
   `DestinationPOISection.astro` with zero code change on the web side,
   which is exactly the kind of surprise this spec exists to prevent.
2. **(Chosen) Default to `'PRIMARY'`, explicit opt-in for `'NEARBY'`/`'ALL'`.**
   Guarantees G-4's behavior-preserving-no-op property regardless of what a
   future import does; any consumer that actually wants NEARBY rows
   (`[H]`/`[I]`) must say so explicitly, which is also the more legible
   contract at the call site.

### 6.3 Write path — optional `relation`, default `PRIMARY`

`addPointOfInterestToDestination`'s existing validation (both-sides-exist,
reject-duplicate-pair, `point-of-interest.service.ts:187-251`) is unchanged;
it gains an optional `relation` field on its input (defaulting to `PRIMARY`
in the Zod schema itself, so an omitted field behaves identically to every
call site written before this spec). The "duplicate pair" rejection
(`ALREADY_EXISTS`) is unaffected by `relation`'s value — per §6.1, the PK
alone already prevents a second row for the same pair regardless of what
`relation` would be on it, so there is no new "same pair, different
relation" case to special-case in the service.

## 7. Data model / contracts

### 7.1 `r_destination_point_of_interest` — full column list (v2)

| Column | Type | Change | Notes |
| --- | --- | --- | --- |
| `destinationId` | `uuid NOT NULL` | unchanged | FK, cascade, part of PK. |
| `pointOfInterestId` | `uuid NOT NULL` | unchanged | FK, cascade, part of PK. |
| `relation` | `point_of_interest_destination_relation_enum NOT NULL DEFAULT 'PRIMARY'` | **new** | Outside the PK (§6.1). |

### 7.2 Migration (Carril 1 — structural)

`pnpm db:generate` → next sequential migration after HOS-138's `0052_*`
(exact number depends on merge order relative to HOS-138/HOS-139; this is a
single additive `ALTER TABLE ... ADD COLUMN relation ... DEFAULT 'PRIMARY'`,
no `USING` conversion needed since every existing row gets the default with
no ambiguity).

### 7.3 Zod (`@repo/schemas`)

New enum `PointOfInterestDestinationRelationEnum` (`PRIMARY | NEARBY`) in the
enums package, its pgEnum sibling
`PointOfInterestDestinationRelationPgEnum` in `enums.dbschema.ts` following
the exact `enumToTuple` pattern (§5's precedent).

`PointOfInterestAddToDestinationInputSchema`
(`point-of-interest.crud.schema.ts:106-109`) gains
`relation: PointOfInterestDestinationRelationEnumSchema.default('PRIMARY')` —
additive, safe per the Schema Compatibility Policy (a new field with a
default is never a breaking change for existing callers).

`DestinationPointOfInterestRelationSchema`
(`packages/schemas/src/entities/point-of-interest/point-of-interest.relations.schema.ts:20-38`)
gains `relation: PointOfInterestDestinationRelationEnumSchema` (required —
every row, once read back, has a concrete value).

No new permission is introduced (§4 NG-3) — writing/removing a relation row
continues to use the existing `POINT_OF_INTEREST_CREATE`/`_DELETE`-backed
checks already wired to `_canAddPointOfInterestToDestination`/
`_canRemovePointOfInterestFromDestination`
(`point-of-interest.service.ts:160-165`).

### 7.4 Service surface changes

- `PointOfInterestAddToDestinationInput` type gains the optional `relation`
  field (defaulted by Zod, §7.3).
- `getPointsOfInterestForDestination(actor, {destinationId, relation?:
  'PRIMARY'|'NEARBY'|'ALL'}, ctx)` — new optional param, default `'PRIMARY'`
  (§6.2).
- `DestinationModel.getPointsOfInterestMap(destIds, tx?, relation?:
  'PRIMARY'|'NEARBY'|'ALL')` — new optional param, default `'PRIMARY'`; return
  shape gains `relation: 'PRIMARY' | 'NEARBY'` per entry (§6.2).
- `resolveDestinationIdFilter`'s internal `this.relatedModel.findAll({
  destinationId })` call (`point-of-interest.service.ts:532`) gains the same
  default-`PRIMARY` relation constraint.

### 7.5 Seed / dual-write (HOS-25)

The 12 existing seeded destination↔POI relationship rows are unaffected —
they all default to `relation: 'PRIMARY'` via the column default with zero
fixture edits required, since none of them are meant to represent a NEARBY
association. No baseline fixture change and no data-migration module are
needed for this spec's own scope (unlike HOS-138/HOS-139, which both touch
existing row *content*). The future bulk-import issue (`[E]`) is the actual
producer of any `relation: 'NEARBY'` rows, sourced from the dataset's
`nearbyDestinations` field (331 rows, out of scope here).

## 8. UX / UI behavior

No UI change (NG-2). `DestinationPOISection.astro` continues to receive
exactly the same PRIMARY-only POI set it does today, because
`getPointsOfInterestMap`'s new default preserves current behavior (§6.2) —
this spec's entire UX-facing contract is "nothing visibly changes yet."

## 9. Acceptance criteria

- **AC-1** `r_destination_point_of_interest` gains the `relation` column per
  §7.1, `NOT NULL DEFAULT 'PRIMARY'`; migration committed; `pnpm db:generate`
  drift guard passes.
- **AC-2** Every one of the 12 existing seeded destination↔POI relationship
  rows reads back `relation = 'PRIMARY'` after migration, with zero fixture
  changes (§7.5) — verified by a test querying the seeded rows directly.
- **AC-3** `addPointOfInterestToDestination` called with no `relation` field
  creates a row with `relation = 'PRIMARY'`; called with `relation: 'NEARBY'`
  creates a `NEARBY` row; the existing duplicate-pair `ALREADY_EXISTS`
  rejection is unaffected by which `relation` value is passed (§6.3).
- **AC-4** `getPointsOfInterestForDestination` called with no `relation`
  argument returns only `PRIMARY` rows; called with `relation: 'NEARBY'`
  returns only `NEARBY` rows; called with `relation: 'ALL'` returns both,
  each entry's `relation` field distinguishing them.
- **AC-5** `DestinationModel.getPointsOfInterestMap` exhibits the identical
  three-value contract as AC-4, verified against a destination with a mix of
  `PRIMARY` and `NEARBY` POIs (test-seeded, since no such row exists in the
  real fixtures yet).
- **AC-6** A regression test asserts `getPointsOfInterestForDestination`'s and
  `getPointsOfInterestMap`'s DEFAULT calls (no `relation` argument) against
  the 12 real seeded POIs produce byte-identical output to their pre-HOS-140
  behavior (G-4's behavior-preserving-no-op requirement, the practical
  version of AC-2).
- **AC-7** `pnpm typecheck` and the `@repo/db`/`@repo/service-core` test
  suites pass; ≥90% coverage on the new relation-filtering branches.

## 10. Risks

- **R-1 A future caller forgets the default and passes `relation: 'ALL'`
  where `'PRIMARY'` was intended**, silently surfacing NEARBY rows on a page
  that was not designed to distinguish them. Mitigation: the parameter name
  and its JSDoc explicitly document the three-value contract and note that
  `'ALL'` is opt-in only; AC-6's regression test locks the *default* call
  shape specifically so a future refactor cannot accidentally flip the
  default.
- **R-2 Conflating this spec's `relation` with HOS-139's `isPrimary`.** Both
  specs land around the same time and both involve a "primary" concept on a
  join table, on different tables, meaning different things (see HOS-139
  R-4). Mitigation: this spec never references `poi_categories`/
  `r_poi_category`, and vice versa; the two PRs should be reviewed
  independently.
- **R-3 No DB-level guard preventing an accidental `PRIMARY` + `NEARBY` pair
  of rows for the same (destination, POI, but conceptually "duplicated"
  intent) — actually structurally impossible per §6.1's PK argument, but
  worth re-stating as a risk in case a future schema change loosens the PK
  without re-reading this spec's rationale.** Mitigation: §6.1 documents the
  rationale in enough detail that a future PK change should trigger a review
  of this spec first.

## 11. Open questions

- **OQ-1** Should `getPointsOfInterestForDestination`'s NEARBY rows be
  ordered/limited differently from PRIMARY rows (e.g. capped at N nearest,
  or ordered by distance rather than `displayWeight`)? Deferred to whichever
  future consumer spec (`[H]`/`[I]`) actually renders NEARBY POIs — this
  spec's own read path just returns them in the same `displayWeight`-
  descending order as PRIMARY rows for now.
- **OQ-2** Does relation-kind ever need to be independently editable after
  creation (e.g. an admin correction: "this was seeded as NEARBY but should
  actually be PRIMARY") via a dedicated update path, rather than remove+
  re-add? Deferred (NG-3) — remove+re-add via the existing permission pair
  is sufficient until an admin CRUD UI for this relationship exists.

## 12. Implementation notes

Suggested phasing (for Task Master task generation):

1. **DB schema**: `relation` column + new pgEnum + migration.
2. **Zod schema**: new enum + `PointOfInterestAddToDestinationInputSchema`
   + `DestinationPointOfInterestRelationSchema` updates.
3. **Service/model read-path updates**: `getPointsOfInterestForDestination`,
   `getDestinationsByPointOfInterest` (if it also needs the param — confirm
   during implementation whether the reverse lookup needs relation-awareness
   or is inherently symmetric), `resolveDestinationIdFilter`,
   `DestinationModel.getPointsOfInterestMap` — each with the behavior-
   preserving-no-op regression test (AC-6) written FIRST, before the
   parameter is added, so it can fail-then-pass as evidence the refactor is
   safe.
4. **Service write-path update**: `addPointOfInterestToDestination`'s new
   optional `relation` field.
5. **Quality gate**: `pnpm typecheck`, `@repo/db`/`@repo/service-core` test
   suites, manual smoke confirming `DestinationPOISection.astro` renders
   identically for all 6 destinations that currently show POIs.

## 13. Linear

Canonical tracking:
HOS-140
