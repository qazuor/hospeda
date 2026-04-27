# SPEC-095: Destination Relationship Cleanup for Accommodation and EventLocation

> **Status**: draft
> **Priority**: P1 (pre-beta data model correctness)
> **Complexity**: L
> **Origin**: 2026-04-27 — BBT-11 location.city audit revealed three-layer asymmetry between DB JSONB type, Zod entity schemas, and frontend reads. Owner decision: replace free-text city/state/country with a strict FK to a portal `destination` of type `CITY`, derive geographic context from the destination hierarchy.
> **Affected packages**: packages/schemas, packages/db, packages/service-core, apps/api, apps/web, packages/seed
> **Created**: 2026-04-27
> **Estimated effort**: ~16-24 hours (~2-3 days senior)
> **Depends on**: existing destination hierarchy (path, pathIds, level, destinationType), `getAncestors`/`getBreadcrumb` helpers, current `accommodations.destinationId` FK
> **Blocks**: BBT-11 final closure, beta launch geographic data integrity, any future filtering by city/region against accommodations or eventLocations
> **Supersedes**: commit `7d19f59c` (the additive `city` field on `BaseLocationSchema`) — that fix is reverted as part of this spec

---

## Overview

Today the geographic location of an `accommodation` and an `eventLocation` is duplicated across
three layers that drift independently:

1. **DB column type**: `accommodations.location` is declared `jsonb('location').$type<FullLocationType>()`, expecting `street`, `number`, `city`, `state`, `country`, `coordinates`, etc.
2. **Zod entity schema**: `AccommodationSchema` uses `BaseLocationFields` which exposes only `state`, `zipCode`, `country`, `coordinates` (and now an additive `city` from the hotfix). The full address fields exist in DB but are never validated by Zod.
3. **Frontend**: Cards and JSON-LD components read `data.location.city` directly. The host onboarding form writes `location.city` but the API silently strips it.

The same pattern exists in `eventLocation`. Meanwhile the `destinations` table already maintains
a complete hierarchy (`COUNTRY → REGION → PROVINCE → DEPARTMENT → CITY → TOWN → NEIGHBORHOOD`)
with `path`, `pathIds`, `level`, and helper services (`getAncestors`, `getBreadcrumb`,
`getByPath`). `accommodations.destinationId` already exists as an FK but with no constraint on
the destination type — a host could publish under a `PROVINCE` destination, leaving `city` as
the only specificity signal.

This spec consolidates the geographic source of truth: a single FK to a `destination` of type
`CITY` per accommodation/eventLocation, plus a postal-address JSONB for the building. City,
state, country, and any administrative subdivision are read from the destination hierarchy at
query time. The frontend receives a `cityDestination` relation in every response.

The change is **breaking**. Hospeda has no production data; the cutover is a single push +
re-seed.

---

## Goals

- Single source of truth for city/state/country/region: the `destinations` table.
- Strict FK constraint: `accommodations.destinationId` and `eventLocations.destinationId` must
  reference a destination of type `CITY` exactly. No PROVINCE, no TOWN, no NEIGHBORHOOD.
- Eliminate `city`, `state`, `country`, `zipCode`, `neighborhood`, `department` from the
  `location` JSONB of accommodations and eventLocations.
- Every API response that returns an accommodation or eventLocation includes a
  `cityDestination` relation (Pick of `DestinationPublicSchema`) so the frontend never has to
  resolve geography client-side.
- Host onboarding form replaces the free-text `city` input with an autocomplete that pegs
  against existing CITY destinations + an explicit "no encuentro mi ciudad → contactar admin"
  escape hatch.
- `user.location` and `destination.location` are NOT touched. They are out of scope.
- Naming cleanup (`location` → `address`) is NOT done here. Tracked as `GAP-095-01` in
  `.claude/gaps-postergados.md`.

### Success Metrics

- 100% of accommodations and eventLocations in the seeded DB have a `destinationId` of type
  `CITY` after cutover.
- A host onboarding payload with `location.city` as a free string is **rejected** by the API
  with a clear validation error (`destinationId must reference a CITY destination`).
- Card components (`AccommodationCard`, `PropertyCard`, `EventCard`, `EventCardHorizontal`,
  `EventCardFeatured`) and JSON-LD components (`LodgingBusinessJsonLd`, `EventJsonLd`) read
  city from `cityDestination.name` and country/state from `cityDestination.path` — zero reads
  of `location.city`.
- `pnpm typecheck && pnpm lint && pnpm test` pass across all affected packages with no new
  errors after migration is complete.
- The schema test suite continues to pass with updated fixtures (no `location.city` in
  accommodation/eventLocation fixtures).

---

## Phase 0: Schema Foundation

This phase introduces the new schemas without removing the old ones, so the codebase stays
compileable while downstream layers are migrated.

### REQ-095-01: Create AccommodationLocationSchema (postal address shape)

**Problem**: `AccommodationSchema` reuses the generic `BaseLocationFields` which mixes
geographic context (state, country) with postal address fields. The two concerns must
separate so that geographic data flows from the destination relation while the JSONB column
holds only the building address.

**Acceptance Criteria**

```
Given the new AccommodationLocationSchema is defined,
When I inspect its shape,
Then it contains exactly these fields: coordinates (optional CoordinatesSchema), street
  (optional string 2-50), number (optional string 1-10), floor (optional string 1-10),
  apartment (optional string 1-10).
And it does NOT contain city, state, country, zipCode, neighborhood, or department.

Given the schema lives at packages/schemas/src/entities/accommodation/accommodation.location.schema.ts,
When other modules import it,
Then they get a Zod object schema and the inferred AccommodationLocationType TypeScript type.
```

**Implementation notes**: New file in the accommodation entity folder. Exports
`AccommodationLocationSchema`, `AccommodationLocationType`, and an `AccommodationLocationFields`
helper for spread composition into `AccommodationSchema`.

---

### REQ-095-02: Create EventLocationAddressSchema (postal address shape)

**Problem**: `EventLocationSchema` extends `BaseLocationSchema` and adds its own `city`,
`street`, `number`, `floor`, `apartment`, `neighborhood`, `department`, `placeName`. After
this refactor, only the postal address fields plus `placeName` belong here.

**Acceptance Criteria**

```
Given the new EventLocationAddressSchema is defined,
When I inspect its shape,
Then it contains exactly: coordinates (optional), street, number, floor, apartment, placeName
  (all optional with the existing min/max constraints), and the destinationId FK.
And it does NOT contain city, state, country, zipCode, neighborhood, or department.
```

**Implementation notes**: The existing `EventLocationSchema` is rewritten in place. The id,
slug, audit, lifecycle, and admin fields stay; only the location fields are restructured.

---

### REQ-095-03: Create CityDestinationRefSchema (relation projection)

**Problem**: API responses must include a destination projection rich enough for the frontend
to render city name, breadcrumb, and SEO-friendly links — but light enough to avoid bloating
listings. The full `DestinationPublicSchema` is too heavy (media, attractions, reviewsCount).

**Acceptance Criteria**

```
Given CityDestinationRefSchema is defined,
When I inspect its shape,
Then it picks exactly these fields from DestinationSchema: id, slug, name, summary,
  destinationType, level, path, pathIds.
And the inferred CityDestinationRef type is exported.

Given a response containing a cityDestination field,
When I parse it with CityDestinationRefSchema,
Then validation succeeds for any destination of type CITY.
```

**Implementation notes**: Lives in `packages/schemas/src/entities/destination/destination.schema.ts` (or a sibling
`destination.refs.schema.ts` if file size warrants splitting). Exported alongside the existing
public/admin destination schemas.

---

## Phase 1: Entity Schema Migration

### REQ-095-04: Replace BaseLocationFields with AccommodationLocationFields in AccommodationSchema

**Problem**: `AccommodationSchema` line 61 currently spreads `BaseLocationFields`. This must
become `AccommodationLocationFields` so the entity no longer contains city/state/country.

**Acceptance Criteria**

```
Given AccommodationSchema is rebuilt,
When I inspect the inferred Accommodation type,
Then `accommodation.location.city` does not exist (TypeScript flags `Property 'city' does not
  exist on type AccommodationLocationType`).
And `accommodation.destinationId` is still required (no change).

Given the existing http/admin/query schemas extend AccommodationSchema,
When I rebuild them,
Then they compile without referencing city/state/country in any nested location shape.
```

**Implementation notes**: Update `accommodation.schema.ts` import and spread. Audit
`accommodation.http.schema.ts` (line ~223 maps flat HTTP fields to nested location) and rewrite
that mapping to drop city/state/country mappings. Same for `accommodation.crud.schema.ts` if it
references location fields.

---

### REQ-095-05: Restructure EventLocationSchema to use the new address fields

**Problem**: Same as REQ-095-04 but for events.

**Acceptance Criteria**

```
Given EventLocationSchema is rebuilt,
When I inspect the inferred EventLocation type,
Then it has destinationId (UUID FK) and the postal-address fields only.
And `eventLocation.city` does not exist.

Given downstream Event-related schemas (EventSchema, EventPublicSchema, etc),
When I rebuild them,
Then they compile and no test fixture references eventLocation.city/state/country.
```

**Implementation notes**: The existing `EventLocationSchema` will need its `city` field
removed, the new `destinationId` field added (UUID, required), and the geographic fields
(state, country, etc inherited from BaseLocation) dropped.

---

### REQ-095-06: Revert the BBT-11 hotfix (`city` on BaseLocationSchema)

**Problem**: Commit `7d19f59c` added an optional `city` to `BaseLocationSchema`. With SPEC-095
in place, BaseLocation no longer needs city — the only consumer that benefited (accommodation)
no longer uses BaseLocation, and `eventLocation` already had its own city which is now removed.

**Acceptance Criteria**

```
Given BaseLocationSchema after this spec,
When I inspect its shape,
Then it contains exactly: state, zipCode, country, coordinates (the original pre-hotfix shape).

Given BEFORE_BETA_TESTING.md item 11,
When I read the location.city section,
Then it is marked as superseded by SPEC-095 (the hotfix is undone, the underlying problem is
  solved structurally).
```

**Implementation notes**: Edit `packages/schemas/src/common/location.schema.ts` to remove the
`city` block I added in `7d19f59c`. Update BBT-11 status note.

---

## Phase 2: DB and Service Layer

### REQ-095-07: Update DB column types and apply schema push

**Problem**: `accommodations.location` is `jsonb('location').$type<FullLocationType>()`. After
the Zod migration, the column should be typed `$type<AccommodationLocationType>`. Same for
event_locations.

**Acceptance Criteria**

```
Given the DB schema files in packages/db/src/schemas/,
When I inspect accommodations.dbschema.ts and event_locations.dbschema.ts,
Then the JSONB column types match the new postal-address-only shape.

Given drizzle-kit push runs against a fresh dev DB,
When I inspect the resulting columns,
Then the `location` column on accommodations and event_locations exists with no schema-level
  validation that requires city/state/country (the JSONB column itself has no DB-level CHECK
  constraints — type validation lives in the Zod entity schema).

Given the destinationId FK already exists on accommodations,
When I push the schema,
Then no NOT NULL or FK changes are needed (it was already required).
```

**Implementation notes**: Hospeda runs push-only migrations (per
`memory/project_push_only_migrations.md`). After this REQ, run
`packages/db/scripts/apply-postgres-extras.sh` to re-apply triggers/views/CHECKs. No numbered
migration file needed.

For event_locations: `destinationId` does not exist today. Add the column
(`destinationId: uuid().references(() => destinations.id).notNull()`) as part of this REQ.

---

### REQ-095-08: Service-level enforcement that destinationId is of type CITY

**Problem**: Today nothing prevents a host from publishing an accommodation under a `PROVINCE`
destination. Service must reject with `VALIDATION_ERROR` when the destination is the wrong
type.

**Acceptance Criteria**

```
Given AccommodationService._beforeCreate receives input with a destinationId,
When the referenced destination has destinationType !== 'CITY',
Then the service throws ServiceError with code VALIDATION_ERROR and message
  'destinationId must reference a destination of type CITY'.

Given AccommodationService._beforeUpdate receives input with a destinationId,
When the referenced destination is not CITY,
Then the same ServiceError is thrown.

Given the destination exists and is type CITY,
When the service proceeds,
Then no error is thrown and the create/update completes normally.

Given the destinationId references a destination that does not exist,
When the service runs,
Then it throws NOT_FOUND (existing behavior is preserved, this REQ does not regress it).

Given an analogous check is added for EventService (or whichever service writes
  eventLocation.destinationId),
Then the same three test cases pass for events.
```

**Implementation notes**: The check loads the destination from `DestinationModel` (or
through `DestinationService` if cross-service composition is preferred). Cache or load once per
request — the same actor often creates/updates multiple things in a session. Implementation
should follow the existing `_beforeCreate`/`_beforeUpdate` hook pattern; don't introduce new
plumbing.

---

### REQ-095-09: Eager-load destination as `cityDestination` in API responses

**Problem**: Every consumer of an accommodation or eventLocation needs the destination to
render city/country. Without eager loading the frontend would N+1.

**Acceptance Criteria**

```
Given AccommodationService.list, search, getById, getBySlug, adminList,
When the response is built,
Then each accommodation in the result includes a `cityDestination` field validated by
  CityDestinationRefSchema.

Given EventLocation-resolving methods (or Event methods that return location),
When the response is built,
Then `cityDestination` is populated.

Given a response payload with cityDestination,
When the frontend reads `accommodation.cityDestination.name`,
Then it gets the city name as a string.
And `accommodation.cityDestination.path` gives the full hierarchy slug
  (`/argentina/litoral/entre-rios/concepcion-del-uruguay`).
```

**Implementation notes**: Reuse the existing relation-loading pattern (`getDefaultGetByIdRelations`,
`getDefaultListRelations`). The `destination` relation is added to the default set; the
response transformer projects to `CityDestinationRefSchema` (so the wire payload doesn't carry
the heavy fields). For the projection, the service can apply `.parse()` on
`CityDestinationRefSchema` after model fetch, or the model query can `select` only the listed
columns. Decision deferred to implementation; both options are acceptable.

---

### REQ-095-10: Update API response schemas

**Problem**: Public, protected, and admin response schemas for accommodation and event must
declare `cityDestination` and drop the geographic fields from `location`.

**Acceptance Criteria**

```
Given AccommodationPublicSchema, AccommodationProtectedSchema, AccommodationAdminSchema,
When I inspect their shape,
Then they contain a required `cityDestination: CityDestinationRefSchema` field.
And `location` matches the new AccommodationLocationSchema shape.

Given the corresponding Event schemas,
When I inspect them,
Then `cityDestination` is present and `location` follows the new shape.

Given OpenAPI doc generation runs,
When I inspect the generated docs at /reference,
Then accommodation and event endpoints expose the new shape correctly with no orphaned city
  references.
```

**Implementation notes**: Most http schemas inherit from the entity schema; once REQ-095-04
and REQ-095-05 land, the http schemas follow. Manual review of every entity http schema is
required to catch overrides.

---

## Phase 3: Web App

### REQ-095-11: Update transforms to derive city from cityDestination

**Problem**: `apps/web/src/lib/api/transforms.ts` is the bridge between API and component
props. Today it likely passes `data.location.city` through. After the refactor it must read
`data.cityDestination.name` and project a clean prop shape for cards.

**Acceptance Criteria**

```
Given transformAccommodation in apps/web/src/lib/api/transforms.ts,
When it receives an API accommodation with `cityDestination` populated,
Then the returned card props expose `cityName: string` derived from
  cityDestination.name.
And `cityPath: string` derived from cityDestination.path (used for SEO link to /destinos).
And `cityDestinationSlug: string` for canonical URLs.

Given the same transform is wired for events (transformEvent or sibling),
When called,
Then it exposes the same three derived fields.

Given an accommodation in the response with cityDestination null/undefined (defensive),
When the transform runs,
Then it returns a fallback (empty string) and logs a warning via @repo/logger.
```

**Implementation notes**: All transforms must derive these fields once, not at each component
read. Components consume the flat string props.

---

### REQ-095-12: Update card and JSON-LD components to read derived city

**Problem**: Components like `AccommodationCard.astro:134`, `PropertyCard.astro:72`,
`EventCardFeatured.astro`, `EventCard.astro`, `EventCardHorizontal.astro`,
`LodgingBusinessJsonLd`, `EventJsonLd` read `data.location.city` directly.

**Acceptance Criteria**

```
Given the listed components after migration,
When I grep for `location.city` in apps/web/src/components,
Then there are zero matches.

Given the components instead read the transformed prop (e.g. `cityName`),
When the card or JSON-LD renders,
Then the city is displayed exactly as before from the user's perspective.

Given a JSON-LD component for accommodation,
When it builds the `address` object for the LodgingBusiness schema.org type,
Then it sets addressLocality from cityName, addressRegion from a derived state (parsed from
  cityDestination.path or pathIds → ancestor of type PROVINCE), and addressCountry from a
  similar lookup or hardcoded 'AR' for MVP.

Given the EventJsonLd component,
When it builds the location field,
Then the same pattern applies for the event venue.
```

**Implementation notes**: For the JSON-LD `addressRegion` and `addressCountry`, the cheapest
implementation is to split the `cityDestination.path` and pick known indices (the path is
`/argentina/litoral/entre-rios/concepcion-del-uruguay`, so index 0 is country, index 2 is
province). This couples to the path format; document the assumption in a code comment. A
cleaner alternative is to walk `pathIds` and resolve each ancestor — slower but accurate. For
400 accommodations the path-split is fine.

---

### REQ-095-13: Replace city free-text input with destination autocomplete in PropertyForm

**Problem**: `PropertyFormBasicSections.client.tsx` today renders a free-text `city` input. The
new flow needs a typeahead picker against `GET /destinations?type=CITY` (or equivalent),
plus an explicit escape link "No encuentro mi ciudad → contactar admin".

**User Stories**

> As a host adding a property,
> I want to pick the city from a list of cities the portal already supports,
> so that I cannot publish under a non-existent or misspelled city and my listing appears in
> the right destination page.

> As a host whose city is not in the catalog,
> I want a clear path to request the city be added,
> so that I am not blocked indefinitely.

**Acceptance Criteria**

```
Given the PropertyForm Section 2 (ubicación),
When I focus the city field,
Then I see an autocomplete that queries the API for destinations of type CITY.

Given I type 'concep',
When the request returns,
Then I see CITY destinations whose name or slug matches 'concep' (e.g. Concepción del Uruguay,
  Concepción del Bermejo).

Given I select a result,
When the form state updates,
Then `destinationId` is set to the selected destination's id and the previous free-text
  `city` field is removed from form state.

Given my city is not in the results,
When I look at the field,
Then I see a 'No encuentro mi ciudad' link below the input.
And clicking it opens (or links to) a contact form prefilled with subject 'Solicitud de nueva
  ciudad' and a textarea for the requested city + province + country.

Given I submit the publish action,
When destinationId is missing or invalid,
Then the form blocks submission with a clear error.
```

**Implementation notes**: The autocomplete component can be a new small island
(`CityDestinationPicker.client.tsx`) that wraps a fetch to the existing `/destinations`
endpoint with a `type=CITY` filter and a `search` query param. If the endpoint does not yet
support `?type=CITY`, add it as part of this REQ (small extension). The contact form for "no
encuentro mi ciudad" can reuse the existing `/feedback` page with a query-param prefill, or be
a dedicated lightweight modal — implementation choice during the task.

---

## Phase 4: Data and Tests

### REQ-095-14: Re-seed accommodations and event locations with CITY destinationId

**Problem**: Existing seed JSONs may reference destinations that are not CITY type. After the
service-level CHECK in REQ-095-08, those seeds will fail to load.

**Acceptance Criteria**

```
Given the seed files in packages/seed/src/data/accommodation/ and event_location-equivalent,
When I audit each seed's destinationId,
Then every referenced destination resolves to a destination of type CITY in destinations seeds.

Given pnpm db:fresh-dev runs against a clean DB,
When the seeds load,
Then no service throws VALIDATION_ERROR for an invalid destinationId.
And all accommodations end up with cityDestination resolvable.

Given the seed files are committed,
When I re-run db:fresh-dev later,
Then the result is reproducible (no implicit migration of seed data, the JSONs are
  authoritative).
```

**Implementation notes**: Audit the existing accommodation seed JSONs, map each one to a CITY
destination from the destinations seed (most are already in Concepción del Uruguay or similar).
Any accommodation pointing to a province-level or town-level destination must be reassigned.
The seed JSONs may also need to drop city/state/country from their `location` blocks since
the new schema rejects unknown keys (depending on Zod strict mode — verify during implementation).

---

### REQ-095-15: Schema-validation, service, and route tests

**Problem**: Existing tests assert on the old shape (location.city present, no
cityDestination). They must be rewritten to match the new contract.

**Acceptance Criteria**

```
Given the schema-validation tests in apps/api/test/schema-validation/,
When I inspect accommodation-getById-schema.test.ts and event-getById-schema.test.ts,
Then their fixtures contain a cityDestination object and no location.city/state/country.
And the tests pass against the rebuilt entity schemas.

Given the AccommodationService test suite,
When I look for a regression test on destinationType=CITY enforcement,
Then there is at least one test that creates an accommodation with a PROVINCE destinationId
  and asserts VALIDATION_ERROR.
And one test that creates with a CITY destinationId and asserts success.
And one test that updates a destinationId from a CITY to a PROVINCE and asserts the same
  rejection.

Given the equivalent EventService tests,
When I run them,
Then the same three scenarios are covered.

Given the web app card tests (Astro source-string assertions or React island tests),
When I read them,
Then they assert on cityName/cityPath props rather than location.city.
```

**Implementation notes**: Rewriting test fixtures is mechanical but high-volume. A grep for
`location.city` in `test/` and `apps/api/test/` lists every site to update.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Eager-loading destination on every list bloats response payload | Low (≤400 accommodations target) | Medium | The CityDestinationRef projection only carries 8 fields. Measure actual payload size after migration; if a problem, paginate-with-projection at the model layer. |
| Some seed accommodations reference non-CITY destinations | Medium | Low | Audited and remapped during REQ-095-14. Failure mode is loud (service throws), not silent. |
| Host onboarding UX feels slower with autocomplete vs free-text | Low | Medium | The autocomplete is the gate that prevents geographic chaos. Document the "no encuentro mi ciudad" escape hatch prominently. |
| JSON-LD `addressRegion`/`addressCountry` derivation from path string is fragile | Low | Low | The path format is enforced by the destination service. Document the assumption in a code comment; add a parse helper with a test. |
| Existing `?city=` query parameters on public listing routes break | Medium | Low | Audit during implementation. Replace with `?destinationId=` or `?destinationSlug=` in the same PR. |
| EventLocation refactor exposes deeper coupling not yet visible | Medium | Medium | Do EventLocation in the same spec to surface coupling, but split the implementation into separate atomic tasks so the work can pause if scope balloons. |

---

## Migration Notes (breaking change, pre-beta)

- **No production data exists**. The migration is `drizzle-kit push` + `apply-postgres-extras.sh` + `db:fresh-dev`.
- **The frontend is breaking-changed too**. After this spec lands, any third-party integrator
  reading `accommodation.location.city` from a previous build will fail. There are no third-party
  integrators today; document the wire-format change in a release note for completeness.
- **Commit `7d19f59c` is reverted**. The hotfix that added `city` to `BaseLocationSchema` is
  rolled back as part of REQ-095-06. BEFORE_BETA_TESTING.md item 11 is rewritten to reflect
  the structural fix.
- **GAP-095-01 (rename `location` → `address`)** is explicitly out of scope. Tracked
  in `.claude/gaps-postergados.md`.

---

## Out of Scope

- Renaming the JSONB column from `location` to `address`. Tracked as GAP-095-01.
- Touching `user.location` (free-text city is correct for users — they don't need to map to a
  portal destination).
- Touching `destination.location` (a destination is its own geography; nothing to derive).
- Adding a CITY-level autocomplete to the admin panel for non-host flows. The host form is the
  only mandatory consumer; admin uses ID-based selection elsewhere.
- Building a workflow for the "no encuentro mi ciudad" admin response (creating a new
  destination from a request). The current spec only ensures the host has a path to ask;
  fulfilling the request is operational and out of scope here.
- Changes to billing or addon-related schemas. Plans/customers do not have a city relation.
- Performance denormalization (e.g. caching city name on the accommodation row). Defer until
  the 400-accommodation target is exceeded by 5x and a profiler shows it matters.

---

## Success Criteria Recap

A reviewer can verify the spec is done by checking:

1. `grep -r "location.city" apps/web/src/components/ apps/api/src/routes/` returns zero
   functional matches (only comments or test annotations referring to history).
2. `pnpm typecheck && pnpm lint && pnpm test` pass across all affected packages.
3. The host form in `/publicar/nueva` shows an autocomplete instead of a free-text city input,
   with a visible "No encuentro mi ciudad" link.
4. Creating an accommodation via the API with a `destinationId` of a non-CITY destination
   returns 400/VALIDATION_ERROR.
5. The card components and JSON-LD render city/country correctly, sourced from
   `cityDestination`.
6. `pnpm db:fresh-dev` completes successfully with all seeds loading.
