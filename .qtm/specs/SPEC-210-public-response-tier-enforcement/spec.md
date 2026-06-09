---
specId: SPEC-210
title: Public Response Tier Enforcement — make schema-tier serialization mandatory and fail-closed so public endpoints can never leak undeclared DB columns
slug: public-response-tier-enforcement
type: refactor
complexity: high
status: draft
owner: qazuor
created: 2026-06-09
base: staging
tags:
  - api
  - security
  - schemas
  - data-exposure
  - response-contract
  - route-factory
  - hardening
relatedSpecs:
  - SPEC-187
  - SPEC-100
linearIssues: []
---

# SPEC-210 — Public Response Tier Enforcement

## 1. Origin & problem statement

Every read method on `BaseModel` (`packages/db/src/base/base.model.ts`) runs
`db.select().from(table)` — a `SELECT *` with **no column projection**
(`findAll:186`, `findById:219`, `findOne:244`, `findWithRelations:673`, and the
relational `findOneWithRelations:828` / `findAllWithRelations:985`). 49 models
inherit this. Service output normalizers (the only one is
`normalizeAccommodationOutput`) spread the full row (`...accommodation`). So
**every DB column is present on the row at runtime**, even when the static
return type omits it.

The ONLY thing that stops those columns reaching the wire is the response-layer
schema-tier system: per-entity `EntityPublicSchema = EntitySchema.pick({...})`
allowlists (24 entities have an `*.access.schema.ts`) enforced by
`stripWithSchema` (`apps/api/src/utils/response-helpers.ts:90`) inside
`createResponse`. Zod `.safeParse()` on a `.pick()` schema strips undeclared
keys. This system is **well-designed but opt-in**, and that is the bug:

- **`stripWithSchema` fails OPEN when no `responseSchema` is passed** — it returns
  the data unchanged (`response-helpers.ts:90-93`). A public route that forgets
  the schema sends the raw row.
- **Some public routes wire the wrong schema.** Confirmed leaks today:
  - `apps/api/src/routes/accommodation/public/similar.ts:29` →
    `z.array(z.record(z.string(), z.unknown()))` strips nothing (full row).
  - `apps/api/src/routes/exchange-rates/public/list.ts:49` → `ExchangeRateSchema`
    (full) leaks `source`, `expiresAt`, audit fields. A `ExchangeRatePublicSchema`
    exists but is not used.
  - `apps/api/src/routes/sponsorship-level/public/getById.ts` & `list.ts` →
    `SponsorshipLevelSchema` (full) leaks `BaseAuditFields` (`createdById`,
    `updatedById`, `deletedAt`, `deletedById`).
- **Adding any new DB column re-opens the risk on every public route.** SPEC-187
  (PR #1505) lived this: the new premium `accommodation.rich_description` column
  leaked on **7** public endpoints and had to be patched one-by-one. Even the
  adversarial review missed one route (`destination/public/getAccommodations`).

This spec makes the tier system **mandatory and fail-closed** so a public route
**cannot** be written (or shipped) without declaring a real public-tier
response schema, and fixes every known leak. It does **not** add column
projection to `BaseModel` (rejected: 49-model blast radius, duplicates the Zod
allowlist into a second source of truth, high regression risk for no extra
guarantee once the response boundary is fail-closed). It does **not** re-do
SPEC-187's per-endpoint patches.

## 2. Goals & success criteria

**Goal:** a public API response can only ever contain fields declared in an
explicit public-tier response schema; omitting or mis-wiring the schema is
impossible to ship.

Success criteria (all measurable / testable):

1. `createPublicRoute` (and `createPublicListRoute` / any public route factory)
   **requires** a `responseSchema` — missing it is a TypeScript error AND a
   startup-time throw (fail-closed, not per-request).
2. `stripWithSchema` no longer fails open: called without a schema it throws,
   never returns raw data. (The public factory guarantees a schema is always
   present.)
3. A permissive/passthrough response schema (`z.record`, `z.any`, `z.unknown`,
   bare `z.object({}).passthrough()`) is rejected by the public factory at
   startup.
4. The 3 known wiring leaks (`similar`, `exchange-rates/list`,
   `sponsorship-level`) return only their public-tier fields.
5. A full audit of all ~86 public route files is complete; every one wires a
   real entity public-tier schema, and the audit result is recorded.
6. Zero regressions: full typecheck + lint + test suites green across packages.

## 3. User stories & acceptance criteria

### US-1 — As a platform operator, a public endpoint never leaks internal columns

- **AC-1.1** Given any public route, When it returns an entity, Then only fields
  declared in that entity's `*PublicSchema` appear in the JSON payload (audit
  fields, owner-internal fields, premium-gated fields are absent unless the
  public tier explicitly includes them).
- **AC-1.2** Given a public route handler that returns a row containing an
  undeclared column (e.g. a future `secret_internal` column), When the response
  is serialized, Then the column is stripped (Zod `.pick()` strip mode), proven
  by a test that injects an extra field and asserts its absence.

### US-2 — As a developer, I cannot ship a public route without a tier schema

- **AC-2.1** Given a new public route authored without a `responseSchema`, When
  the project is typechecked, Then it is a compile error (the factory param is
  required, not optional).
- **AC-2.2** Given a public route wired with a passthrough schema (`z.record`,
  `z.any`, `z.unknown`), When the app starts (route registration), Then it throws
  a clear error naming the offending route, and the app does not start.
- **AC-2.3** Given `stripWithSchema` is called with no schema, When invoked, Then
  it throws (no fail-open path remains).

### US-3 — As a security reviewer, known leaks are closed

- **AC-3.1** `GET /api/v1/public/accommodations/:id/similar` returns only public
  card fields; `richDescription` and any audit/internal field are absent.
- **AC-3.2** `GET /api/v1/public/exchange-rates` returns only
  `ExchangeRatePublicSchema` fields; `source`, `expiresAt`, and audit fields are
  absent.
- **AC-3.3** `GET /api/v1/public/sponsorship-levels` and `.../:id` return only a
  public-tier shape; `createdById`, `updatedById`, `deletedAt`, `deletedById` are
  absent.

### US-4 — As a maintainer, the audit of all public routes is recorded

- **AC-4.1** A checklist enumerating every `apps/api/src/routes/**/public/*.ts`
  route (excluding `index.ts`) with its wired response schema and a pass/fix
  status lives in the spec docs and is fully resolved.

## 4. Out of scope

- Adding column projection to `BaseModel` read methods (explicitly rejected).
- Changing `protected` or `admin` tier behavior (those run in authenticated
  contexts with their own gating; this spec is about the PUBLIC surface). A
  follow-up may extend fail-closed to protected, but not here.
- Re-doing SPEC-187's per-endpoint richDescription gates/strips (already shipped
  in PR #1505).
- Entitlement/permission logic (richDescription owner-gating stays where SPEC-187
  put it; this spec only governs which columns are *serializable*, not who may
  see premium content).
- A static CI lint guard. The owner chose **runtime fail-closed** (startup-time)
  as the prevention mechanism; a CI guard is noted as a possible future addition
  but is NOT in this spec.

## 5. Architecture & technical approach

### 5.1 Make the public route factory require a tier schema

In the public route factory(ies) under `apps/api/src/utils/route-factory*`
(`createPublicRoute`, `createPublicListRoute`, and any public variant):

- Change the `responseSchema` option from optional to **required** at the type
  level (so omission is a TS error — satisfies AC-2.1).
- At route construction (module load / registration), assert the provided schema
  is a "concrete" object schema, not a passthrough. Reject `z.record`, `z.any`,
  `z.unknown`, and `ZodObject` in `passthrough` mode. Throw a descriptive error
  naming the route path (satisfies AC-2.2). This is a startup-time guard
  (fail-closed before serving traffic), per the owner's "runtime fail-closed"
  choice.

A helper `assertConcretePublicSchema(schema, routePath)` centralizes the
passthrough detection (inspect the Zod def `typeName` and `unknownKeys`).

### 5.2 Make `stripWithSchema` fail-closed

`apps/api/src/utils/response-helpers.ts:90`: remove the fail-open branch.
- If called with no schema → throw `ServiceError(INTERNAL_ERROR, ...)` (never
  return raw data). Satisfies AC-2.3.
- Keep the existing fail-closed-on-parse-error behavior (already throws 500).
- `createResponse` / `createPaginatedResponse` keep passing the (now always
  present, for public routes) schema.

Note: non-public factories that legitimately omit a schema (if any) must be
audited — either give them a schema or route them through a path that does not
call the strict `stripWithSchema`. This is captured as an audit task.

### 5.3 Provide/repair the missing public-tier schemas

- `ExchangeRatePublicSchema` already exists in `@repo/schemas` — wire it into
  `exchange-rates/public/list.ts` (replace `ExchangeRateSchema`).
- `SponsorshipLevelPublicSchema` — create it in
  `packages/schemas/.../sponsorship-level/*.access.schema.ts` following the
  `.pick()` convention (id, name, slug, public display fields only; NO audit
  fields), and wire it into `sponsorship-level/public/getById.ts` & `list.ts`.
- `similar.ts` — replace `z.array(z.record(...))` with
  `z.array(AccommodationPublicSchema)` (the card public tier). SPEC-187 already
  strips `richDescription` there at the data level; this makes the response
  schema concrete so the new factory guard accepts it and audit/internal fields
  are stripped too.

### 5.4 Audit all public routes

Produce `docs/public-route-audit.md` inside the spec dir: enumerate every
`apps/api/src/routes/**/public/*.ts` route, its wired `responseSchema`, and a
status (OK / fixed / N/A). Any route found wiring a full base schema or a
passthrough gets a public-tier schema (reusing existing ones where present,
creating new `*PublicSchema` where missing). This is the systematic sweep that
guarantees AC-1.1 / AC-4.1.

### 5.5 Data model

No DB schema changes. No migrations.

### 5.6 Layers touched

- `apps/api/src/utils/route-factory*` (factory signature + startup guard)
- `apps/api/src/utils/response-helpers.ts` (`stripWithSchema` fail-closed)
- `apps/api/src/routes/**/public/*.ts` (re-wire the leaking/passthrough routes)
- `packages/schemas/.../*.access.schema.ts` (add missing public tiers, e.g.
  sponsorship-level)

## 6. API design

No new endpoints. Behavior change is serialization-only: the response of the
fixed routes loses undeclared fields. Examples:

- `GET /api/v1/public/exchange-rates` — before: `{ id, base, target, rate,
  source, expiresAt, createdAt, ... }`; after: only `ExchangeRatePublicSchema`
  fields (e.g. `{ base, target, rate, asOf }` — exact set per the existing
  public schema).
- `GET /api/v1/public/sponsorship-levels/:id` — audit fields removed.
- `GET /api/v1/public/accommodations/:id/similar` — concrete card array;
  internal/premium fields removed.

These are tightening changes. Risk: a web consumer relying on a now-removed field
breaks. Mitigation in §8.

## 7. Dependencies

- Internal: `@repo/schemas` (tier schemas), `apps/api` route factory + helpers.
- External: none. No new packages.

## 8. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| A web/admin consumer depends on a field the public tier removes (e.g. exchange-rate `expiresAt`) | Med | High (broken page) | Before re-wiring each route, grep `apps/web` + `apps/admin` for usage of the fields the public tier would drop. If a field is genuinely needed publicly, add it to the public tier deliberately (not via a full-schema leak). Record the decision per route in the audit doc. |
| Making `responseSchema` required breaks non-public factories or shared code | Med | Med | Scope the required-schema change to the PUBLIC factory only; protected/admin factories unchanged. Typecheck the whole api after the change. |
| Startup guard falsely rejects a legitimate concrete schema | Low | Med | `assertConcretePublicSchema` only rejects `z.record`/`z.any`/`z.unknown`/`passthrough`; unit-test it against real tier schemas (must pass) and passthrough schemas (must throw). |
| `stripWithSchema` fail-closed surfaces a previously-hidden mismatch as a 500 in some route | Low | Med | The strict parse already exists for provided schemas; only the no-schema path changes. The route audit ensures every public route has a matching schema before flipping the default. |
| Audit misses a public route (like SPEC-187's review did) | Med | High | Drive the audit from a generated file list (`fd public *.ts`), not by hand; the startup guard is the backstop — any unschema'd/passthrough public route throws at boot, so a miss fails loudly instead of leaking. |

## 9. Performance considerations

Negligible. `stripWithSchema` already runs on every response with a schema; the
change only removes a fail-open branch and adds a one-time startup assertion per
public route at registration. No per-request overhead added.

## 10. Testing strategy (no tests = not done)

- **Unit — factory guard**: `assertConcretePublicSchema` accepts real tier
  schemas (`AccommodationPublicSchema`, etc.) and throws on `z.record`, `z.any`,
  `z.unknown`, and `passthrough()`. (AC-2.2)
- **Unit — stripWithSchema fail-closed**: throws when called with no schema;
  still strips undeclared keys when given a `.pick()` schema; still throws on
  parse mismatch. (AC-1.2, AC-2.3)
- **Type-level — required schema**: a route authored without `responseSchema`
  fails typecheck (covered by the typecheck gate; document the expectation).
  (AC-2.1)
- **Route regression — known leaks**: for `similar`, `exchange-rates/list`,
  `sponsorship-level/getById` & `list`, exercise the real handler returning a row
  WITH the leak-prone fields and assert those fields are ABSENT and the public
  fields PRESENT. (AC-3.1/3.2/3.3) — do NOT mock away the serialization layer.
- **Audit completeness**: a test (or the audit doc + the startup guard) ensures
  every public route has a concrete schema. The startup guard effectively makes
  the whole app a runtime assertion — add a test that boots the public router and
  asserts it registers without throwing.
- **Regression sweep**: full `apps/api` test suite + typecheck + biome green;
  `apps/web` / `apps/admin` typecheck green (consumers of changed responses).

## 11. Implementation approach (phases)

- **Phase 0 — Audit**: generate the public-route inventory, classify each by
  wired schema, identify all leak/passthrough/missing-tier cases, write
  `docs/public-route-audit.md`. (Blocks everything.)
- **Phase 1 — Schemas**: add missing public-tier schemas (sponsorship-level;
  any others the audit finds). Tests for the new schemas.
- **Phase 2 — Factory + helper hardening**: make `responseSchema` required on the
  public factory; add `assertConcretePublicSchema` startup guard; make
  `stripWithSchema` fail-closed. Unit tests.
- **Phase 3 — Re-wire routes**: fix `similar`, `exchange-rates/list`,
  `sponsorship-level/*`, plus every other route the audit flagged. Per-route
  consumer-usage check (web/admin grep) before dropping fields. Route regression
  tests.
- **Phase 4 — Verification**: full typecheck/lint/test across api + web + admin;
  boot-the-router test; confirm the audit doc is fully resolved.
- **Phase 5 — Docs**: document the public-response contract rule (every public
  route MUST declare a concrete public-tier schema; the factory enforces it) in
  the API docs / route-architecture doc.

## 12. Internal review notes

- **Strengthened during drafting**: chose tier-enforcement over BaseModel
  projection (owner deferred to recommendation) — rationale captured in §1/§5
  (single source of truth, blast radius, no duplicate allowlist). Prevention is
  runtime/startup fail-closed (owner choice), not a CI lint guard (noted as
  out-of-scope future work in §4).
- **Open question for implementation**: the exact public-field set for
  `SponsorshipLevelPublicSchema` and any newly-created tier must be confirmed
  against real web/admin consumer usage during Phase 3 (don't guess — grep
  consumers, §8). Each dropped field is a deliberate, recorded decision.
- **Overlap checked**: SPEC-100 "API Transform Pipeline Type Safety" (draft)
  concerns the web transform pipeline, not the api DB-read/response boundary —
  related but not duplicative. SPEC-187 shipped the per-endpoint richDescription
  fixes; this spec is the systemic follow-up it flagged.
- **Verified facts** (2026-06-09, against current `staging`):
  `base.model.ts` SELECT * at the cited lines; `stripWithSchema` fail-open at
  `response-helpers.ts:90`; the 3 leak routes wired as described; 49 models / 86
  public route files.
