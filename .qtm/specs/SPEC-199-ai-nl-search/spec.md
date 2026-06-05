---
id: SPEC-199
slug: ai-nl-search
title: AI Natural-Language Search (Intent to Structured Query)
status: draft
owner: qazuor
created: 2026-06-05
parentSpec: SPEC-173
relatedSpecs:
  - SPEC-173  # AI foundation — this spec consumes extractIntent + quota enforcement
  - SPEC-145  # billing entitlements enforcement — quota middleware plugs here
  - SPEC-168  # admin-editable plans — determines plan limits for ai_search
tags: [ai, feature, search, intent-extraction, tourist, host, web]
---

# SPEC-199 — AI Natural-Language Search (Intent to Structured Query)

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every
> single case — without exception — if a change or decision is not *extremely*
> clear-cut, if there is even the slightest ambiguity, or if there is more than
> one viable option, **STOP and consult the owner (qazuor)**. Do not decide
> autonomously. See SPEC-173 §12.

## 1. Summary

Allow authenticated users to search for accommodations using free-form natural
language (e.g., "cabin near the river for 4 people with a pool, under $200 per
night"). The system extracts a structured `SearchIntent` from the query via the
`extractIntent` engine capability (SPEC-173), maps the slots to the existing
`AccommodationSearchHttpSchema` filter dimensions, and returns normal search
results through the existing public search infrastructure — no embeddings, no
vector store, no new result engine.

This spec covers **only the feature layer**: the protected API route that
performs intent extraction and returns a structured query, and the frontend
entry point (location TBD — §9.Q2) that sends the query and renders the
interpreted filters as chips. The AI engine, quota enforcement, and safety
layer are provided by SPEC-173 and are consumed as-is.

## 2. Context and Motivation

### 2.1 The problem

The existing accommodation search (`apps/web`) requires users to know the
filter vocabulary and interact with filter panels. Many users — especially
first-time visitors or mobile users — prefer expressing what they want in
plain language. The gap between "what I want to type" and "what the filter
UI accepts" causes friction and search abandonment.

### 2.2 What the foundation provides (verified in SPEC-173)

The following are **already shipped** and used as-is by this spec:

- `createConfiguredAiService()` (`apps/api/src/services/ai-service.factory.ts`)
  returns a fully configured `AiService`.
- `AiService.extractIntent({ query, locale })` — calls the model with
  `generateObject` under the hood and returns a validated `AiIntent` envelope
  (typed by `AiIntentSchema` from `@repo/schemas`). Returns a single structured
  object — **not a stream** (intent extraction is synchronous/buffered).
- `AiIntentSchema` (`packages/schemas/src/entities/ai/ai-intent.schema.ts`)
  is the generic base; this spec defines a `SearchIntentSchema` that extends it
  by replacing `entities: Record<string, unknown>` with typed search slots.
- `createAiQuotaMiddleware('search')` — enforces `ai_search` entitlement and
  `max_ai_search_per_month` limit. Per the SPEC-173 §5.7 matrix, ALL
  authenticated plans (including tourist-free at 30/month) have this feature.
- `createAiRateLimitMiddlewares('search')` — burst control pair from
  `apps/api/src/middlewares/ai-rate-limit.ts`.
- Prompt feature `'search'` has an in-code default prompt in
  `src/engine/default-prompts.ts`; the admin can override via
  `ai_prompt_versions`.
- Content moderation runs at the engine level on input for `extractIntent`.
- Usage is metered into `ai_usage` automatically.

### 2.3 What the existing search infrastructure provides (verified)

The public accommodation search is built on `AccommodationSearchHttpSchema`
(`packages/schemas/src/entities/accommodation/accommodation.http.schema.ts`),
which defines the following filter dimensions the NL mapper can target:

| Dimension | Type | Notes |
|-----------|------|-------|
| `q` | string | Full-text keyword query |
| `type` | AccommodationTypeEnum | villa, cabin, hotel, etc. |
| `destinationId` | UUID | Filter by known destination |
| `city` | string | Location city name |
| `latitude` / `longitude` / `radius` | numbers | Geo-radius search |
| `minPrice` / `maxPrice` | numbers | Price per night |
| `currency` | PriceCurrencyEnum | ARS, USD |
| `minGuests` / `maxGuests` | integers | Guest capacity |
| `minBedrooms` / `maxBedrooms` | integers | Bedroom count |
| `minBathrooms` / `maxBathrooms` | integers | Bathroom count |
| `minRating` / `maxRating` | 0–5 | Average rating |
| `hasPool` / `hasWifi` / `allowsPets` / `hasParking` | booleans | Amenity shortcuts |
| `amenities` | UUID[] | Specific amenity IDs |
| `features` | UUID[] | Specific feature IDs |
| `checkIn` / `checkOut` | dates | Availability dates |
| `isAvailable` | boolean | Availability flag |
| `isFeatured` | boolean | Featured listings only |
| `sortBy` / `sortOrder` | string / asc\|desc | Sorting |

The NL mapper translates `SearchIntent.entities` slots → a subset of these
parameters. It does NOT invent new filter dimensions.

### 2.4 Key tension: SPEC-173 §5.7 forbids anonymous AI

SPEC-173 §3 Non-goals and §5.7 explicitly state: **all AI features require an
authenticated user; anonymous calls are rejected**. The existing public search
box on `apps/web` is available to anonymous visitors. This creates a direct
tension:

> The NL search entry point must be auth-gated, **or** it must gracefully
> degrade to classic keyword search for anonymous users.

This tension is the top open question (§9.Q1) and must be resolved before
implementation can begin.

### 2.5 V1 scope: NO embeddings, NO vector search

SPEC-173 §11 explicitly defers vector DB / pgvector / semantic embeddings to
V2. V1 NL search is strictly: **user query → intent extraction →
`AccommodationSearchHttpSchema` parameters → existing search endpoint**. The
results are identical to what the user would get if they had set those filters
manually. There is no ranking boost, no semantic similarity scoring.

## 3. Goals and Non-goals

### Goals

1. Authenticated users can type a free-form query and receive search results
   that correspond to the interpreted filters.
2. The extracted filters are shown to the user as removable chips so they can
   understand and correct the interpretation.
3. Fallback to plain keyword search when intent confidence is low (open
   question §9.Q5 for threshold value).
4. Quota (monthly call limit per plan) is enforced transparently.
5. Moderation runs on the user's query input before extraction.
6. Multi-locale: the intent extraction is locale-aware.

### Non-goals

1. Anonymous AI search (explicitly excluded by SPEC-173 §5.7; see §9.Q1 for
   the UX degradation question).
2. Embeddings, vector search, semantic ranking — V2 (SPEC-173 §11).
3. Searching entities other than accommodations in V1 (events, posts, etc.).
4. Conversational/multi-turn search refinement — that is Child C (chat).
5. Any change to the existing public search endpoint or its schema.
6. Real-time suggestions as the user types (typeahead) — cost and latency
   make this impractical for a model call.

## 4. UX Flow Draft

> Note: entry point location and anon UX are open questions (§9.Q1, §9.Q2).

1. An authenticated user sees a NL search input (location TBD — §9.Q2).
2. The user types a free-form query, e.g., *"casita de campo tranquila para
   2 personas, cerca de la playa, con pileta, menos de 150 dólares"*.
3. The frontend sends `POST /api/v1/protected/ai/search-intent` with
   `{ query, locale }`.
4. The API returns a JSON object: `{ intent: SearchIntent, mappedParams: AccommodationSearchParams }`.
5. The frontend applies `mappedParams` to the existing search results page:
   - The search results are re-fetched using the existing public search
     endpoint with the mapped parameters.
   - The interpreted slots are displayed as removable chips above the results
     (e.g., "Type: cabin", "Max price: $150", "Has pool", "Guests: 2").
6. The user can remove a chip (which removes that filter and re-fetches), or
   edit the NL query and resubmit.
7. If the API returns low `confidence`: the frontend falls back to passing
   `intent.rawQuery` as the `q` parameter (keyword search), and shows a
   message "Could not fully interpret your query — showing keyword results for
   [raw query]."
8. If quota is exhausted (403): show an inline upgrade prompt. Do not break
   the search page — offer to fall back to classic filter search.
9. For anonymous users: the trigger is not shown (or the button is shown with
   a "Sign in to use AI search" tooltip) — open question §9.Q1.

## 5. Architecture

### 5.1 API route

```
POST /api/v1/protected/ai/search-intent
Content-Type: application/json
```

> Note: this route is **NOT streaming** — `extractIntent` uses `generateObject`
> internally and returns a single structured object. The response is a normal
> JSON endpoint.

**Mount location**: `apps/api/src/routes/ai/protected/search-intent.ts`

**Route factory**: `createProtectedRoute` (the non-streaming variant already
in `apps/api/src/utils/route-factory.ts`), not `createProtectedStreamingRoute`.

**Middleware stack**:

1. `protectedAuthMiddleware()` — injected by `createProtectedRoute`
   automatically.
2. `entitlementMiddleware()` — must already be mounted on the protected router.
3. `...createAiRateLimitMiddlewares('search')` — burst control pair.
4. `createAiQuotaMiddleware('search')` — monthly quota enforcement.

**Request body** (Zod schema, new file in `@repo/schemas`):

```ts
// Proposed: packages/schemas/src/entities/ai/ai-search-intent.schema.ts
const AiSearchIntentRequestSchema = z.object({
  query:  z.string().min(1).max(500),  // max length TBD §9.Q6
  locale: LanguageEnumSchema.optional(),
}).strict();
```

**Handler logic** (thin):

1. Validate request body with `AiSearchIntentRequestSchema`.
2. Obtain `aiService` via `createConfiguredAiService()`.
3. Call `aiService.extractIntent({ query, locale })` → `AiIntent`.
4. Validate `intent.entities` against `SearchIntentEntitiesSchema` (see §5.2).
5. Run the mapping layer: `mapIntentToSearchParams(intent.entities)` →
   `Partial<AccommodationSearchParams>` (see §5.3).
6. Return `{ intent, mappedParams }` as JSON.

**HTTP status codes**:

| Condition | HTTP |
|-----------|------|
| Not authenticated | 401 |
| Plan lacks `ai_search` entitlement | 403 ENTITLEMENT_REQUIRED |
| Monthly quota exceeded | 403 LIMIT_REACHED |
| Input moderation blocked | 422 MODERATION_BLOCKED |
| Feature disabled (kill-switch) | 503 FEATURE_DISABLED |
| Cost ceiling hit | 503 CEILING_HIT |
| All providers down | 502 ENGINE_EXHAUSTED |
| Request body invalid | 400 VALIDATION_ERROR |

**Response body**:

```ts
{
  success: true,
  data: {
    intent: AiIntent,           // raw intent envelope (kind, confidence, entities, rawQuery)
    mappedParams: Partial<AccommodationSearchParams>,  // ready to use as search filters
    confidence: number,         // intent.confidence echoed at top level for easy client access
    fallbackToKeyword: boolean  // true when confidence < threshold (§9.Q5)
  }
}
```

### 5.2 Schema design

Two new schemas in `packages/schemas/src/entities/ai/ai-search-intent.schema.ts`:

**`SearchIntentEntitiesSchema`** — extends `AiIntentSchema.shape.entities` with
typed search slots. This is the child-spec extension described in the
`AiIntentSchema` JSDoc:

```ts
const SearchIntentEntitiesSchema = z.object({
  locationType:    z.enum(['city', 'geo', 'destinationId']).optional(),
  city:            z.string().optional(),
  destinationId:   z.string().uuid().optional(),
  latitude:        z.number().min(-90).max(90).optional(),
  longitude:       z.number().min(-180).max(180).optional(),
  radius:          z.number().positive().optional(),
  accommodationType: AccommodationTypeEnumSchema.optional(),  // reuse from @repo/schemas
  minGuests:       z.number().int().min(1).optional(),
  maxGuests:       z.number().int().min(1).optional(),
  minPrice:        z.number().min(0).optional(),
  maxPrice:        z.number().min(0).optional(),
  currency:        PriceCurrencyEnumSchema.optional(),
  minRating:       z.number().min(0).max(5).optional(),
  hasPool:         z.boolean().optional(),
  hasWifi:         z.boolean().optional(),
  allowsPets:      z.boolean().optional(),
  hasParking:      z.boolean().optional(),
  checkIn:         z.coerce.date().optional(),
  checkOut:        z.coerce.date().optional(),
  // Open question §9.Q4: are there other slots worth extracting?
});

const SearchIntentSchema = AiIntentSchema.extend({
  kind:     z.literal('search'),
  entities: SearchIntentEntitiesSchema,
});
```

> This schema is validated AFTER `extractIntent` returns. The model is
> instructed to populate these slots; if the model returns extra or missing
> fields, Zod coercion handles it gracefully (partial — all slots are
> optional).

**`AiSearchIntentRequestSchema`** — see §5.1.

**`AiSearchIntentResponseSchema`** — see §5.1 response shape above.

### 5.3 Mapping layer

A pure mapping function (no AI calls, no DB calls, no side effects):

```ts
// Proposed: apps/api/src/routes/ai/protected/search-intent.mapper.ts

function mapIntentToSearchParams(
  entities: SearchIntentEntities
): Partial<AccommodationSearchParams>;
```

The mapping is mechanical (one-to-one slot → param) except for:

- `locationType` + `city` / `destinationId` / `latitude+longitude+radius`:
  only one location strategy is active at a time. If multiple are extracted,
  `destinationId` wins over `city` over geo-coordinates.
- Boolean amenity shortcuts (`hasPool`, `hasWifi`, `allowsPets`, `hasParking`)
  map directly to the `AccommodationSearchHttpSchema` boolean shortcuts.
- `amenities` as UUIDs cannot be extracted from a natural-language query
  because the user says "pool" not a UUID. The boolean shortcuts are the
  correct mapping target. Specific amenity UUID filtering is not possible
  without a lookup step (open question §9.Q7).

The mapper returns a `Partial<AccommodationSearchParams>` — only the slots
that were actually extracted. It does NOT add default values.

The mapper MUST validate its output against a whitelist of allowed parameter
names (no hallucinated filter dimensions). Any slot not in
`AccommodationSearchHttpSchema` is silently dropped. This is the primary
defense against model hallucination (R-1).

### 5.4 Frontend entry point

**Location**: TBD — see §9.Q2. Candidates:

- A dedicated search bar in `apps/web` (inside the existing search page).
- The existing search input, with NL detection or a toggle.

**Component structure** (draft):

```
NlSearchInput
  ├── <TextInput placeholder="Describe what you're looking for..." />
  ├── <IntentChips chips={mappedSlots} onRemove={...} />  (shown after extraction)
  └── <AiSearchStatus />   (loading, quota error, fallback notice)
```

**Styling**: Astro + vanilla CSS / CSS Modules (web app convention — NO
Tailwind utility classes).

**Flow**:

1. On submit, call the protected endpoint (requires a session cookie).
2. On 401 (anonymous): show "Sign in to use AI search" or silently fall back
   to keyword search — open question §9.Q1.
3. On success: apply `mappedParams` to the search URL as query parameters,
   navigate to the results page, show chips.
4. On `fallbackToKeyword: true`: navigate with `q=<rawQuery>` only, show a
   "Could not fully interpret" notice.
5. On 403 quota: show upgrade prompt.

### 5.5 Prompt for intent extraction

The route handler calls `aiService.extractIntent({ query, locale })`. The
system prompt (stored in `ai_prompt_versions`, with in-code fallback in
`src/engine/default-prompts.ts`) instructs the model to:

- Extract search intent slots into the `SearchIntentEntities` shape.
- Prefer not extracting a slot over guessing when uncertain.
- Populate `confidence` accurately based on how well the query maps.
- Always populate `rawQuery` with the original input.
- Respond with `kind: 'search'`.

Specific prompt wording is a product decision (open question §9.Q8).

## 6. Data

### 6.1 New database tables

None. All persistence needs are met by SPEC-173 tables:

- `ai_usage`: every `extractIntent` call is metered.
- `ai_request_log`: every call is logged (PII-scrubbed for telemetry).
- `ai_prompt_versions`: admin manages the `search` system prompt.

### 6.2 NL search query history (open question)

Whether to persist search queries + extracted intents for analytics (e.g. to
understand what users search for and improve prompt/slot coverage) is **open
question §9.Q9**. V1 minimal path: no persistence beyond `ai_usage` + `ai_request_log`.

## 7. Acceptance Criteria (Preliminary BDD)

- **AC-1 (auth required)** — *Given* an unauthenticated request to
  `POST /api/v1/protected/ai/search-intent`, *then* the response is 401.
- **AC-2 (structured output)** — *Given* an authenticated user with
  `ai_search` entitlement and query *"cabaña para 4 personas con pileta"*,
  *then* the response contains `mappedParams` with at least `minGuests=4`
  and `hasPool=true` (or equivalent amenity mapping), and `confidence > 0`.
- **AC-3 (fallback)** — *Given* a query with `confidence < threshold`, *then*
  `fallbackToKeyword: true` is in the response, and the frontend falls back
  to keyword search using `rawQuery`.
- **AC-4 (quota)** — *Given* a tourist-free user at 30/month limit, *when*
  they call the endpoint, *then* 403 LIMIT_REACHED with upgrade hint.
- **AC-5 (no hallucinated filters)** — *Given* a model that returns a slot
  name not in `SearchIntentEntitiesSchema`, *then* that slot is silently
  dropped and does not appear in `mappedParams`.
- **AC-6 (moderation)** — *Given* a query containing content that triggers
  moderation, *then* 422 MODERATION_BLOCKED before any model inference.
- **AC-7 (chips)** — *Given* a response with `mappedParams`, *when* the user
  sees the results page, *then* each extracted filter is displayed as a
  removable chip.
- **AC-8 (chip removal)** — *Given* a visible chip (e.g. "Has pool"), *when*
  the user removes it, *then* `hasPool` is removed from the active filters
  and results are re-fetched without it.
- **AC-9 (locale)** — *Given* a query in Portuguese with `locale: 'pt'`,
  *then* the extraction operates correctly (slot values may be in Portuguese
  but map to the same typed params).

## 8. Testing Strategy

### Unit tests

- `SearchIntentEntitiesSchema`: happy path with all slots; partial slots;
  extra unknown slots stripped; invalid types rejected.
- `mapIntentToSearchParams`: each slot maps to the correct
  `AccommodationSearchParams` field; whitelist enforcement drops unknown
  slots; location priority (destinationId > city > geo).
- `AiSearchIntentRequestSchema`: query too long rejected; empty query
  rejected; valid locale accepted.

### Integration tests (`apps/api/test/integration/ai/`)

- Authenticated user with `ai_search` entitlement: intent is extracted and
  `mappedParams` returned.
- Unauthenticated request: 401.
- Tourist-free user at quota: 403 LIMIT_REACHED.
- Moderation-blocked query: 422.
- `billingLoadFailed=true` path: 503.
- Low-confidence response (stub returns confidence < threshold): `fallbackToKeyword: true`.

### Frontend component tests (`apps/web`)

- `NlSearchInput` submits the correct request body on enter/button click.
- Chips render from `mappedParams` keys.
- Chip removal updates active params and triggers re-fetch.
- 403 quota response shows upgrade prompt (not a page crash).
- `fallbackToKeyword: true` shows fallback notice and navigates with `q=`.

### Coverage requirement

Minimum 90% on new code paths. 100% on `mapIntentToSearchParams` (critical
correctness path).

## 9. Open Questions (blocking before implementation)

### Q1 — Anonymous UX: gate vs. graceful degradation (TOP PRIORITY)

**Question**: SPEC-173 §5.7 forbids anonymous AI. The public search box on
`apps/web` is available to anonymous users. When an anonymous user interacts
with the NL search:

Option A — **Hard gate**: show the NL input only to authenticated users;
anonymous users see the classic filter UI only. No degradation needed.

Option B — **Graceful degradation**: the NL input is visible to all; when
submitted by an anonymous user, the frontend silently falls back to passing
`rawQuery` as the keyword `q` parameter (no API call, no AI used). The user
sees keyword results.

Option C — **Auth prompt**: the NL input is visible to all; when an anonymous
user submits, show a "Sign in to use AI search" modal/prompt.

**Impact**: drives where the NL entry point is rendered and how the frontend
handles the 401 from the protected endpoint.

**Why not decided here**: affects product flow and user experience. Must be
decided by the owner.

### Q2 — Where does the NL search input live?

**Question**: Where on `apps/web` should the NL search entry point appear?

Option A — **Replace/augment the existing main search bar** (home page and
search page) with a toggle between "classic" and "AI" mode.

Option B — **Add a new "AI Search" input below/above the classic filters** on
the search page only.

Option C — **Add a floating AI button** that opens an overlay input.

**Impact**: drives component integration with the existing web app search
page (which uses Astro + React islands).

### Q3 — Is the NL search triggered on every keystroke or only on submit?

**Question**: Should extraction happen on submit (button click or Enter) only,
or also with a short debounce as the user types? The latter requires careful
quota management (each keystroke could be a quota call).

**Recommendation** (to be confirmed): submit-only in V1. Typeahead is a V2
feature if desired.

**Impact**: frontend event handling; quota consumption rate.

### Q4 — Which intent slots are worth extracting beyond the obvious set?

**Question**: The draft `SearchIntentEntitiesSchema` in §5.2 covers the
obvious slots. Are there other dimensions users commonly express in NL that
map to existing search params? For example:

- "quiet" → no direct filter, but could map to `type: 'rural'` or low
  `maxGuests`?
- "near the beach" → needs `city` or geo. How does the model know the
  coordinates of "the beach" in Concepcion del Uruguay?
- "romantic" → `minGuests: 1, maxGuests: 2`?

**Impact**: drives slot coverage in `SearchIntentEntitiesSchema` and the
system prompt.

### Q5 — Confidence threshold for keyword fallback

**Question**: At what `confidence` value should the API set
`fallbackToKeyword: true`? Suggested values: 0.3, 0.5, 0.7.

**Impact**: determines how aggressively the system falls back. Too low: bad
queries get poor slot extraction served as filters. Too high: most queries
fall back and the feature adds no value.

### Q6 — Maximum query length

**Question**: What is the maximum character length for the NL query input?
The model's context is not a concern for a short query; the main constraint
is preventing abuse and keeping latency low.

**Suggested starting point**: 500 characters. To be confirmed.

**Impact**: drives the `.max(N)` constraint on `AiSearchIntentRequestSchema`.

### Q7 — Specific amenity UUID resolution from NL?

**Question**: A user might say "with a barbecue" or "with air conditioning".
These map to specific amenity UUIDs in the DB, not to the four boolean
shortcuts (`hasPool`, `hasWifi`, `allowsPets`, `hasParking`). Resolving "air
conditioning" to an amenity UUID requires a lookup step (amenity DB query by
name/slug).

Should V1 support this? If yes, the route handler needs a DB lookup before
mapping. If no, only the four boolean shortcuts are amenity-mappable.

**Impact**: significant if yes (DB read added to the route handler; name
normalization challenges). Recommended: No for V1.

### Q8 — Default system prompt wording

**Question**: What should the mandatory in-code default system prompt say for
`search` intent extraction? The prompt must instruct the model to extract
only from the defined slot list and signal low confidence honestly.

**Impact**: quality of intent extraction. Needs product approval.

### Q9 — Persist NL query + extracted intent for analytics?

**Question**: Should the NL query and its extracted intent be stored in a
dedicated table for product analytics (e.g., "which queries fail to extract?",
"what do users search for most?")?

**Impact**: if yes, adds a `ai_search_queries` table and a write on every
extraction. V1 minimal path: no persistence beyond `ai_usage` (which records
the call count and cost) + `ai_request_log` (which records PII-scrubbed
metadata).

### Q10 — Analytics events for PostHog

**Question**: What PostHog events should be emitted? At minimum:

- `ai_search_intent_extracted` with `{ confidence, slotsExtracted, fallback }`.
- `ai_search_chip_removed` with `{ chipKey }`.

Should the search results page fire a separate `ai_search_results_viewed` event?

**Impact**: instrumentation scope. Should be decided before implementation so
tests cover the right paths.

## 10. Risks

### R-1 — Hallucinated filter dimensions

**Probability**: High
**Impact**: Medium
**Description**: LLMs may return slot names that do not exist in
`AccommodationSearchHttpSchema`. Passing these to the existing search endpoint
would cause validation errors.

**Mitigation**: The whitelist enforcement in `mapIntentToSearchParams` (§5.3)
silently drops any slot not in the defined schema. The output is always
validated against `SearchIntentEntitiesSchema` before mapping. Tests cover
unknown-slot dropping.

### R-2 — Low-confidence extraction causes worse results than keyword search

**Probability**: Medium
**Impact**: Medium
**Description**: For vague queries (e.g., "something nice") the model may
extract unhelpful or conflicting slots with low confidence. Applying those
filters to the search would return fewer results than a keyword search would.

**Mitigation**: Confidence threshold fallback (§9.Q5). The frontend
`fallbackToKeyword: true` flag lets the UI degrade gracefully.

### R-3 — Location mapping for local place names

**Probability**: High
**Impact**: Medium
**Description**: A user saying "cerca del río Uruguay" expects geo-coordinates
or a `destinationId` for Concepción del Uruguay. The model does not have the
DB's destination IDs and may not know the coordinates of local landmarks.

**Mitigation**: The model can extract `city: 'Concepción del Uruguay'` or
`city: 'río Uruguay'` as a text string, which can be passed as a keyword
fallback or handled by the existing `city` filter. Full geo-resolution of
local place names is a V2 enhancement (requires Nominatim or a local
destination lookup step).

### R-4 — Quota depletion on tourist-free plan

**Probability**: Medium
**Impact**: Low
**Description**: Tourist-free users have 30 NL searches/month. A user who
relies heavily on NL search could exhaust this quickly.

**Mitigation**: The 403 LIMIT_REACHED response carries an upgrade hint. The
UI should show the remaining count (if the auth context exposes it). This is
a quota design decision, not a bug.

### R-5 — Latency budget for a search UX context

**Probability**: Medium
**Impact**: High
**Description**: Unlike text improvement (where a 2-second wait is tolerable),
search users expect near-instant results. An intent extraction call adding
1–3 seconds latency before the results load may feel unacceptable.

**Mitigation**: (a) Use a fast, cheap model for `search` (per the SPEC-173
§8 Q5 tiered default strategy). (b) Show a loading state with the raw query
executing as keyword fallback in the background, then overlay the AI-filtered
results when ready. (c) Cache extracted intents for identical queries per
user (open question §9.Q11 — not listed above but worth noting).

## 11. Dependencies

### Internal (upstream, must exist before implementation)

- SPEC-173 (completed) — all foundation exports used in §5.1 are shipped.
- `AccommodationSearchHttpSchema` and `AccommodationSearchParams` from
  `@repo/schemas` — these define the target parameter space for the mapper.
  No changes to these schemas are needed.
- `AiIntentSchema` from `packages/schemas/src/entities/ai/ai-intent.schema.ts`
  — extended by `SearchIntentSchema`.
- `entitlementMiddleware()` already mounted on the protected router (existing
  pattern in `apps/api`).

### External packages

No new external packages expected.

## 12. Migration and Rollback

### Database migrations

None (no new tables for V1 minimal path; see §9.Q9 for optional analytics
table).

### Rollback

New route + new frontend component + no schema migrations. Rollback:
delete/revert the route file and remove the frontend component. No DB
cleanup needed in V1.

## 13. Technical Debt

### Known trade-offs

- No amenity UUID resolution (§9.Q7): users saying "with AC" cannot be
  served with specific amenity filtering. Only the 4 boolean shortcuts are
  mappable. This is a pragmatic V1 boundary.
- No persistent search analytics (§9.Q9): intent quality cannot be measured
  from aggregate data without explicit instrumentation. PostHog events (§9.Q10)
  partially address this but do not store the raw slot data.
- No location geo-resolution for local place names (R-3): queries about
  specific local landmarks fall back to city-name string matching.

### Future improvements

- Amenity UUID resolution via a lookup step (V2).
- Conversational search refinement (hand off to Child spec C — chat).
- Semantic ranking boost with embeddings (pgvector, V2 per SPEC-173 §11).
- Cached intent extraction for identical queries (reduces quota consumption).
- Analytics table for NL search queries (§9.Q9).

## Key Learnings

1. `extractIntent` is backed by `generateObject` (not `streamText`) — the
   response is a single buffered JSON object, not a stream. The route uses
   `createProtectedRoute`, not `createProtectedStreamingRoute`.
2. The SPEC-173 §5.7 matrix gives tourist-free users 30 NL searches/month —
   the feature IS available to all authenticated plans including tourists.
   The tension with the public anonymous search box is the spec's top open
   question (§9.Q1), not a quota issue.
3. `AiIntentSchema` is deliberately generic (kind: string, entities: Record).
   Child specs extend it via `.extend({ kind: z.literal(...), entities: z.object({...}) })`.
   This spec defines `SearchIntentSchema` as that extension.
4. `AccommodationSearchHttpSchema` is the authoritative filter dimension list
   for the mapper whitelist — not the older deprecated `HttpAccommodationSearchSchema`.
   The HTTP schema includes `hasPool`, `hasWifi`, `allowsPets`, `hasParking`
   boolean shortcuts, making amenity extraction feasible without UUID lookups
   for the four main cases.
5. The mapping layer must be a pure function (zero DB, zero AI calls) and must
   have 100% test coverage — it is the correctness gate between model output
   and the existing search infrastructure.
