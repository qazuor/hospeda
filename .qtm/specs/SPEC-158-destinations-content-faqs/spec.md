---
spec-id: SPEC-158
title: Destinations Rich Content + Structured FAQs
type: feature
complexity: high
status: in-progress
created: 2026-05-26T00:00:00Z
---

# SPEC-158 — Destinations Rich Content + Structured FAQs

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal.** Enrich the 22 `CITY`-type destinations (seed files `001`–`022` in
`packages/seed/src/data/destination/`) with (a) rich, web-researched markdown
tourist descriptions that weave the destination's attractions into a narrative,
and (b) a NEW structured FAQs field per destination that enables `FAQPage`
JSON-LD rich results on the public destination pages.

**Motivation.** Destination detail pages today render a short plain description
(≤2000 chars) and a `DestinationFaqPlaceholder.astro`. Accommodations already
have a full structured FAQ feature (schema + DB table + service + public API +
web accordion + `FAQPage` JSON-LD). Destinations should reach content parity to
improve SEO (rich content + FAQ rich results) and user value, reusing the
accommodation pattern verified file-level (engram `#767`).

**Success criteria.**

- All 22 CITY destinations have a markdown `description` of ~2000–3500 chars
  (3–5 paragraphs, attractions narrative embedded) sourced from real web
  research — NO invented data.
- All 22 CITY destinations have 5–7 structured FAQs each, with a guaranteed
  category baseline (`Cómo llegar`, `Qué hacer`, `Cuándo visitar`, `Servicios`)
  plus optional free categories where the city warrants it.
- The public destination detail response includes `faqs`.
- The public destination page renders a FAQ accordion (zero-JS) and emits valid
  `FAQPage` JSON-LD.
- `pnpm db:fresh-dev` seeds the FAQs into a local `destination_faqs` table.
- All schema, service, API, and seed tests pass; ≥90% coverage on new code.

**Target users.** Public web visitors (SEO + content), and the seed/local-dev
workflow. Spanish-only content (matches the existing single-string `description`
model and the `es` default market).

**Decisions locked (do not re-litigate).**

- Target = SEED JSON + local DB only. Do NOT push to staging/prod DB.
- Phase 1 only. Admin/protected FAQ CRUD + editing UI is deferred to Phase 2.
- Reuse `BaseFaqSchema` (`packages/schemas/src/common/faq.schema.ts`) and the
  generic `FAQPageJsonLd.astro`.
- Content is Spanish-only. `description` stays a flat string (only `.max` rises).
- FAQ count 5–7/city. Category baseline guaranteed in all; extra categories free.
- Description length ~2000–3500 chars markdown.
- Content tasks are granular: one task per city (22 content tasks), executed by
  delegating to sub-agents in geographic batches (with WebSearch) when the
  content phase is reached; orchestrator reviews quality before each commit.

### 2. User Stories & Acceptance Criteria (BDD)

**US-1 — Visitor reads a rich destination description.**

- GIVEN a CITY destination with a markdown `description`
- WHEN a visitor opens `/{lang}/destinos/{...path}`
- THEN the page renders the markdown as sanitized HTML via `renderContent()`
- AND headings/paragraphs/lists in the markdown render correctly.

**US-2 — Visitor sees destination FAQs grouped by category.**

- GIVEN a CITY destination with ≥1 FAQ
- WHEN the visitor opens the destination detail page
- THEN a FAQ section renders as native `<details>/<summary>` (zero JS)
- AND FAQs are grouped by `category`
- AND a destination with zero FAQs renders no FAQ section (no empty shell).

**US-3 — Search engines get FAQPage structured data.**

- GIVEN a destination with ≥1 FAQ
- WHEN the page is served
- THEN a single valid `FAQPage` JSON-LD `<script>` is emitted with one
  `Question`/`acceptedAnswer` per FAQ
- AND a destination with zero FAQs emits NO `FAQPage` JSON-LD.

**US-4 — Public API returns FAQs in destination detail.**

- GIVEN a destination with FAQs in the DB
- WHEN `GET` the public destination detail (by path / by slug)
- THEN the response `data` includes a `faqs` array of `{id, question, answer,
  category}` ordered deterministically
- AND a destination without FAQs returns `faqs: []`.

**US-5 — Seed loads destination FAQs.**

- GIVEN a destination seed JSON with a `faqs: [{question, answer, category}]`
- WHEN `pnpm db:fresh-dev` runs
- THEN each FAQ is inserted into `destination_faqs` with its `category`
- AND re-running the seed is idempotent (ALREADY_EXISTS handled).

**Edge cases (each → a test).**

- Destination with no `faqs` key → empty array, no JSON-LD, no accordion.
- FAQ `answer` at the 2000-char boundary (BaseFaqSchema max) → valid.
- FAQ `question` < 10 chars → rejected by schema.
- `description` at 8000-char boundary → valid; at 8001 → rejected.
- Historic destination fixture (pre-faqs) → still `safeParse`s (compat).
- Hierarchy nodes `100`–`103` → untouched (no faqs, no rich-content change).

### 3. UX Considerations

- FAQ accordion mirrors `apps/web/src/components/accommodation/FaqAccordion.astro`:
  native `<details>/<summary>`, grouped by category, zero client JS.
- Description renders through the existing `renderContent()` (marked + sanitize)
  into `set:html` on `[...path].astro`. `contentHtml` (TipTap) still takes
  precedence over `description` when present; seeds set only `description`.
- Loading/error states unchanged (SSR page; no new client fetch).
- Accessibility: `<summary>` is natively focusable/keyboard-operable; headings in
  the FAQ section preserve hierarchy under the page's existing structure.

### 4. Out of Scope

- Phase 2: protected (`/api/v1/protected/*`) + admin (`/api/v1/admin/*`) FAQ
  CRUD routes (`updateFaq`, `removeFaq` endpoints) and the admin TanStack Form
  editing UI.
- Multi-locale (en/pt) content. Spanish-only here.
- Pushing data to staging/prod DB.
- Changing the `summary` field, media, attractions data, or hierarchy nodes.
- `iaData` parity (accommodation has it; not in this spec).

## Part 2 — Technical Analysis

### 5. Architecture

Mirror the accommodation FAQ feature one-to-one for destinations. The FAQ is a
SEPARATE 1-to-N child table (NOT JSONB on the parent), exactly like
`accommodation_faqs`. The parent `DestinationSchema` exposes `faqs` as an
optional read array for API responses (`z.array(BaseFaqSchema).optional()`),
matching how `accommodation.schema.ts` exposes it.

Integration points (consumers): `@repo/schemas` → `@repo/db` → `@repo/service-core`
→ `apps/api` (public read) → `apps/web` (render + JSON-LD); `@repo/seed` loads
content into the local DB via the service.

### 6. Data Model Changes

**New table `destination_faqs`** — mirror `accommodation_faqs`
(`packages/db/src/schemas/accommodation/accommodation_faq.dbschema.ts`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK defaultRandom | |
| `destination_id` | uuid NOT NULL | FK → `destinations.id` ON DELETE CASCADE |
| `question` | text NOT NULL | |
| `answer` | text NOT NULL | |
| `category` | text NULL | |
| `lifecycle_state` | LifecycleStatusPgEnum NOT NULL default `ACTIVE` | |
| `admin_info` | jsonb `$type<AdminInfoType>()` | |
| `created_at` / `updated_at` | timestamptz default now NOT NULL | |
| `created_by_id` / `updated_by_id` / `deleted_by_id` | uuid FK → users ON DELETE SET NULL | |
| `deleted_at` | timestamptz NULL | soft delete |

Indexes: `destinationFaqs_destinationId_idx` on `destination_id`,
`destinationFaqs_category_idx` on `category`.
Relations: `one(destinations)` on the child; add `faqs: many(destinationFaqs)`
to `destination.dbschema.ts` relations.

**Migration approach.** Dev workflow is push-only:
`pnpm db:push` + `pnpm db:apply-extras`. No numbered migration file in this spec
(per the project's push-only policy). Verify the `set_updated_at` trigger covers
`destination_faqs` after `apply-postgres-extras` — if `manual/0019` enumerates
tables explicitly, add `destination_faqs` to it.

**`DestinationSchema` change** (`packages/schemas/src/entities/destination/destination.schema.ts`):

- Line 58: `description` `.max(2000)` → `.max(8000)` (additive/relaxing → safe per
  schema-compat policy).
- After `rating` (line 82): add `faqs: z.array(BaseFaqSchema).optional()`.

### 7. API Design (Phase 1 — public read only)

Extend the public destination detail routes under
`apps/api/src/routes/destination/public/` (by path and by slug) to include FAQs,
mirroring `apps/api/src/routes/accommodation/public/getBySlug.ts` (parallel
`getFaqs`, attach `faqs` to the detail response).

Response shape (additive): `data.faqs: Array<{ id, question, answer, category,
lifecycleState, ...audit }>` (the `DestinationFaqSchema` / `BaseFaqSchema`
shape). Empty array when none.

No new endpoints. No auth changes (public tier). `updateFaq`/`removeFaq`/admin
list endpoints are Phase 2.

### 8. Schema Files (`@repo/schemas`)

- `common/id.schema.ts`: add `DestinationFaqIdSchema` (mirror
  `AccommodationFaqIdSchema`).
- NEW `entities/destination/subtypes/destination.faq.schema.ts`: `DestinationFaqSchema
  = BaseFaqSchema.extend({ id: DestinationFaqIdSchema, destinationId: DestinationIdSchema })`
  - Add/Update/Remove/List input schemas + single/list output schemas (mirror
  `accommodation.faq.schema.ts`). Update/Remove inputs are defined now for Phase 2
  reuse but only Add/List are wired in Phase 1.
- `entities/destination/index.ts`: re-export the new subtype.

### 9. Service (`@repo/service-core`)

Add to `DestinationService` (mirror `AccommodationService`):

- `addFaq(actor, { destinationId, faq })` → insert via the destination FAQ model.
- `getFaqs(actor, { destinationId })` → list FAQs for a destination.
Permission checks via `PermissionEnum` only. `updateFaq`/`removeFaq` deferred to
Phase 2 (may be stubbed or omitted — do not wire routes for them now).

### 10. Web (`apps/web`)

- NEW `src/components/destination/DestinationFaqAccordion.astro` (mirror
  `accommodation/FaqAccordion.astro`).
- Wire the generic `src/components/seo/FAQPageJsonLd.astro` in
  `src/pages/[lang]/destinos/[...path].astro` (sections `{heading, body}` from FAQs).
- `src/lib/api/transforms.ts`: map `faqs` on the destination detail transform
  (mirror the accommodation transform near lines ~563 + ~683-688).
- Replace `DestinationFaqPlaceholder.astro` usage with the real accordion (render
  only when FAQs exist).

### 11. Seed (`@repo/seed`)

- Destination seed factory: add a `faqs` loop calling `service.addFaq` (mirror
  `packages/seed/src/example/accommodations.seed.ts` lines 214-259). IMPROVEMENT
  over the accommodation factory: pass `category` through (accommodation omits it).
- JSON shape per destination: `"faqs": [{ "question", "answer", "category" }]`.
- Rewrite the 22 CITY destination JSON files (`001`–`022`) with the new markdown
  `description` and `faqs` array. Content web-researched per city, Spanish-only.

### 12. Dependencies

- Internal: `@repo/schemas`, `@repo/db`, `@repo/service-core`, `@repo/seed`,
  `apps/api`, `apps/web`. No new external deps.

### 13. Risks & Mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| `set_updated_at` trigger misses `destination_faqs` | M | M | Verify after `apply-extras`; add to `manual/0019` if enumerated. |
| Schema-compat break on `description` change | L | H | Only relaxing `.max` + adding optional `faqs` → both safe; add historic fixture compat test. |
| Invented/inaccurate city content | M | H | Mandatory web research per city; orchestrator reviews each batch before commit; cite sources in task notes. |
| Thin content for small cities (Ceibas, Liebig) | M | M | Allow 5 FAQs (lower bound) + shorter description for genuinely small towns; never pad with filler. |
| Seed factory category drop (like accommodation) | L | M | Explicitly pass `category` in the destination loop + a seed test asserting categories persist. |
| `faqs` on parent schema vs separate `DestinationFaqSchema` drift | L | M | Parent uses `BaseFaqSchema` (read shape) exactly like accommodation; tests assert API shape. |

### 14. Performance Considerations

- One extra indexed query (`getFaqs`) per destination detail, run in parallel
  with the main fetch (mirrors accommodation). Negligible.
- FAQ accordion + JSON-LD are SSR/zero-JS — no client perf cost.
- Seed inserts are batched per destination; idempotent.

## Implementation Approach (Phased)

- **Phase `setup` (schemas):** id schema, `destination.faq.schema.ts`, raise
  `description` max, add `faqs` to parent, re-exports, schema tests + compat.
- **Phase `core` (db + service):** `destination_faq.dbschema.ts`, model,
  parent relation, schemas index; `DestinationService.addFaq`/`getFaqs` + unit
  tests; verify trigger coverage.
- **Phase `integration` (api + web):** public detail routes include faqs +
  integration tests; `DestinationFaqAccordion`, JSON-LD wire, transform, replace
  placeholder.
- **Phase `core` (seed plumbing):** factory `faqs` loop with category; seed
  parse test harness for destination content.
- **Phase `content` (22 tasks):** one task per city — web research + markdown
  description + 5–7 FAQs, validated against the schema. Delegated in geographic
  batches to sub-agents with WebSearch; reviewed before each commit.
- **Phase `testing`:** end-to-end seed parse for all 22; coverage check.
- **Phase `docs`/`cleanup`:** update `packages/seed` / `apps/web` docs if needed;
  remove dead placeholder.

### Testing Strategy

- **Schema (`@repo/schemas`):** `DestinationFaqSchema` valid/invalid; description
  8000 boundary; historic fixture compat (`.compat.test.ts`).
- **Service (`@repo/service-core`):** `addFaq` success + not-found + permission;
  `getFaqs` returns ordered list + empty.
- **API (`apps/api`):** public detail includes faqs (success); destination with
  no faqs → `faqs: []`; nonexistent destination → 404.
- **Web (`apps/web`):** accordion renders grouped FAQs; FAQPage JSON-LD present
  with N questions; absent when no FAQs.
- **Seed (`@repo/seed`):** all 22 JSON parse against schema; FAQ count 5–7;
  baseline categories present; description length within bounds; idempotent load.
