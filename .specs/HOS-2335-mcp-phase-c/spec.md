---
title: MCP phase C — owner assistant improvements (links, wizards, reviews, summary, providers, help, plan)
linear: HOS-2335
statusSource: linear
created: 2026-11-17
type: feature
parent: HOS-2184
children:
  - HOS-2326
  - HOS-2327
  - HOS-2328
  - HOS-2329
  - HOS-2330
  - HOS-2331
  - HOS-2332
  - HOS-2333
areas:
  - api
  - web
  - content
  - billing
smokeLabels:
  - status-needs-smoke-staging
---

# MCP phase C — owner assistant improvements

## 1. Summary

The owner smoked HOS-2184 phase A on staging on 2026-11-17 and asked for eight
improvements. They share one design, so they ship under this spec:

| Child | What | Kind | Ships |
|---|---|---|---|
| HOS-2326 | A portal link on every refusal | cross-cutting | now (plan links: phase B) |
| HOS-2327 | Amenities and features by category | read + write | now |
| HOS-2328 | Plan and subscription | read | after HOS-2066 (§6.3, OQ-5) |
| HOS-2329 | Create a listing step by step | read + write | now |
| HOS-2330 | Read the reviews of my listings | read | now |
| HOS-2331 | Owner summary | read | listings now, subscription after HOS-2328 |
| HOS-2332 | Provider search and benefit usages | read + write | now |
| HOS-2333 | Client help ("how do I do X") | read | now |

The design is defined once in §5: portal links, the step pattern, aggregate
reads and the help source. §6 has one section per child.

## 2. Problem

Phase A works, but the smoke showed four gaps.

- A refusal says "do it in Hospeda" and gives no link.
- The amenities list is flat and is replaced as a whole, so editing one
  category risks wiping the others.
- Common questions ("how am I doing", "what did guests say", "which plumber
  gives a discount") need many calls or have no tool.
- The model guesses at how-to answers because no help source exists.

## 3. Goals

- G-1: Every refusal a tool returns carries an absolute, locale-prefixed link to
  the portal page where the owner can do it.
- G-2: Owners edit amenities and features one category at a time. An edit to one
  category never changes another.
- G-3: An owner creates a DRAFT listing in any of the three verticals from the
  chat. It goes through the same services, access checks and side effects as the
  portal. It never publishes on its own.
- G-4: Read-only reviews of the owner's listings across the three verticals.
- G-5: One call answers "how am I doing", within the client's response budget.
- G-6: Hosts search the provider directory. Both hosts and providers list their
  benefit usages and confirm or reject them in two steps, with the HOS-376 rules
  intact.
- G-7: How-to answers come from a curated help catalog maintained by Hospeda,
  each with portal links.
- G-8 (after HOS-2066): plan, status, expiry, trial days and add-ons per
  vertical, read from the catalog and the effective set.

## 4. Non-goals

- NG-1: Replying to reviews. No owner-reply model exists for listing reviews:
  `accommodation_reviews`, `venue_reviews` and `experience_reviews` have no reply
  column or table. Replies exist only for host-trade reviews.
- NG-2: Photos, prices, address and map location stay out, as in HOS-2184 NG-3.
  The create wizard links to the editor for them (but see OQ-4 for location).
- NG-3: Publishing from the create wizard. Publishing stays an explicit
  `set_listing_publication` call or a portal action.
- NG-4: Tourist help (HOS-2333 scope).
- NG-5: Changing a plan or buying an add-on from the chat. HOS-2328 is read
  only; changes are done through a portal link.
- NG-6: A server-side wizard-state store. §5.2 explains why none is needed.
- NG-7: MCP elicitation, as in HOS-2184 NG-5.

## 5. Shared design

### 5.0 Constraints carried from the phase A smoke

These hold for every tool in this spec. Each PR proves them with tests.

- **C-1: Route side effects are reproduced.** Tools call services directly, so
  HTTP middleware and route-handler side effects do NOT run. HOS-2323 found the
  missing public cache eviction in `update-listing-basic.ts`. Every new write tool
  lists the side effects of its route (middleware, router-level `app.use`,
  `void notify…()` in the handler) and reproduces each one. A test asserts each
  one. Known instances in this spec:
  - Accommodation writes: `mountAccommodationCacheInvalidation`
    (`routes/index.ts:496`), which evicts `ACCOMMODATION_CACHE_INVALIDATION_PREFIXES`.
  - Benefit usages: `notifyUsageDeclared`, `notifyUsageConfirmed` and
    `notifyUsageRejected` (`lib/host-trade-notifications`) are fired from the
    route handlers (`host-trade/protected/usages.ts:91`,
    `usage-transitions.ts:62,86`), not from the service.
  - The route factory's `listingAccess` step. It is reproduced with
    `decideListingAccess`, as phase A does.
- **C-2: Flat input schema.** Each tool publishes ONE top-level
  `type: "object"` with no `oneOf`, `anyOf` or discriminated union. Per-variant
  rules live in a `superRefine`, the pattern of `UpdateListingBasicInputSchema`.
  A test runs `buildToolInputJsonSchema` on every registered tool and fails on
  `oneOf`/`anyOf` at the top level.
- **C-3: Write tools are audited.** `isWrite: true` ⇒ `recordMcpToolCall`
  (`lib/mcp/record-tool-call.ts`), with `auditTarget`. Two-step tools set
  `auditDetails` to `{ step: 'preview' | 'commit' }`. Content length is recorded,
  never the content.
- **C-4: Same authorization as the route.** Same PermissionEnum, ownership and
  `resolveListingAccess` declaration, and the same `emailUnverifiedOperation`.
  A foreign or missing resource ⇒ the uniform not-found result (error contract).
- **C-5: Untrusted text.** Guest, reviewer and provider free text is returned
  inside `untrusted-data.ts` wrappers, and the description carries
  `UNTRUSTED_DATA_NOTICE` (HOS-2184 §6.6).
- **C-6: Thin adapters.** Every tool reuses the route's service and schemas
  (`.pick()` from `@repo/schemas`) and never re-implements them. When the route
  holds logic inline (a query or an ownership check), extract it into a shared
  helper the route and the tool both call. Never copy it.

### 5.1 Portal link builder (HOS-2326, used by every child)

**Survey.** Owner portal URLs are `/{lang}/mi-cuenta/...` on `HOSPEDA_SITE_URL`.
All path knowledge lives in `apps/web`, which `apps/api` cannot import:

| Destination | Web path | Source in `apps/web/src/lib` |
|---|---|---|
| Accommodation editor hub / section | `mi-cuenta/propiedades/{id}/editar/{slug}/` | `editor/accommodation-editor-sections.ts:185-187` |
| Venue/experience editor hub / section | `mi-cuenta/comercio/{venue\|experience}/{id}/editar/{slug}/` | `editor/listing-editor-sections.ts:94` |
| Section slugs per vertical (`datos`, `servicios`, `fotos`, `ubicacion`, `horarios`, `contacto`, `precio`, `capacidad-precio`, …) | — | `editor/listing-section-presentation.ts` (keyed by the shared `LISTING_SECTIONS` ids in `packages/schemas/src/catalog/listing-sections.ts`) |
| Owner listings | `mi-cuenta/propiedades`, `mi-cuenta/comercio` | `publish/publish-page-paths.ts:48` |
| Create | `publicar`, `publicar/comer-y-salir`, `publicar/experiencias`; `mi-cuenta/comercio/nuevo/{vertical}` | `publish/publish-page-paths.ts:34`, `listing/start-url.ts` |
| Plans / pricing | `planes/{anfitriones\|comer-y-salir\|experiencias}[/precios]` | `publish/publish-page-paths.ts:59,72` |
| Subscription / add-ons | `mi-cuenta/suscripcion`, `mi-cuenta/complementos` | pages only |
| Owner inquiries | `mi-cuenta/consultas-propietario/{conversationId}` | pages only |
| Provider directory / detail / declare | `mi-cuenta/directorio-proveedores[/{slug}[/registrar-uso]]` | pages only |
| Benefit usages / provider panel | `mi-cuenta/usos-de-beneficio`, `mi-cuenta/proveedor` | pages only |
| AI assistants | `mi-cuenta/asistentes-ia` | `routes.ts:162` (`AI_ASSISTANTS_PATH`) |
| Public listing | `/{lang}/{alojamientos\|comer-y-salir\|experiencias}/{slug}/` | API already has `buildListingPublicUrl` (`services/listing-qr-sheet/qr-sheet-content.ts:156`) |

Neither the user row nor the actor stores a locale. Links use `es`, the same
choice phase A makes for public URLs (`GET_LISTING_PUBLIC_URL_LOCALE`).

**Design.**

- `buildPortalUrl({ destination, locale = 'es', siteUrl })` returns an absolute,
  trailing-slashed URL. `destination` is a closed discriminated union (TS-only,
  never published as a schema), for example:
  - `{ kind: 'listingEditor', vertical, id, section? }`, where `section` is a
    `LISTING_SECTIONS` id;
  - `{ kind: 'ownerListings', vertical }`, `{ kind: 'createListing', vertical }`;
  - `{ kind: 'plans', vertical }`, `{ kind: 'subscription' }`, `{ kind: 'addons' }`;
  - `{ kind: 'inquiry', conversationId? }`;
  - `{ kind: 'providerDirectory', slug? }`, `{ kind: 'benefitUsages' }`,
    `{ kind: 'providerPanel' }`;
  - `{ kind: 'aiAssistants' }`.
- Where the path vocabulary lives is **OQ-1**. Either a shared module that the
  web also imports, or an API-local map with a cross-app guard test. Either way,
  a guard test resolves every destination kind to an existing
  `apps/web/src/pages/[lang]/...` file.
- **Error payload.** `ToolErrorPayload` and `ToolFailure` gain an optional
  `action?: { url: string; label: string }` and an optional `helpTopicId`.
  - `toToolFailure` keeps them.
  - `renderOutcome` (`lib/mcp/bind-tool.ts`) appends one line to the text:
    `Podés hacerlo acá: <url>`. It also adds `structuredContent.action`.
  - The text is authoritative because some clients ignore `structuredContent`
    when there is no `outputSchema`.
- **Where links are attached.** A tool-level `refusalAction({ error, input })`
  maps `(code, reason, field)` to a destination. It is declared next to
  `reasonMessages` on the `ToolDefinition`. The executor calls it on every
  failure. It returns `undefined` for transient errors (UNAVAILABLE, rate limit,
  unexpected), because no page fixes those.
- **The cases HOS-2326 lists:**
  - `update_listing_basic` foreign field: a map from field to section. `name` →
    `datos`, photos → `fotos`, `price`/`priceFrom` → `precio` or
    `capacidad-precio`, location → `ubicacion`. A field with no section links to
    the editor hub.
    - Today `.strict()` turns an unknown field into a generic `unrecognized_keys`
      issue. The refusal reads the offending key from the issue and maps it.
  - `set_listing_publication`:
    - `LISTING_INCOMPLETE` and `PUBLISH_REQUIREMENTS_MISSING_*` → the editor
      section of the first missing requirement, or the hub;
    - `LISTING_MODERATED` → the editor hub (the fix-request banner lives there);
    - `NO_COVERAGE`, `SUBSCRIPTION_REQUIRED`, `NO_CAPABILITY` and
      `LISTING_LIMIT_REACHED` → plans or subscription for the vertical;
    - `DUPLICATE_LOCATION` → the editor's `ubicacion` section.
  - `get_listing_stats` `NO_STATS_ENTITLEMENT` → plans for the vertical.
  - Phase B (HOS-2184 AC-14) "not included in your plan" → `addons` or `plans`.
  - Inquiry tools: not found or out of scope → `inquiry` (the inbox).
  - New tools in this spec declare their own mapping (§6).

### 5.2 Step-by-step pattern

Three candidates, judged against Hospeda's actual model. Every listing is born
`DRAFT` and is never public (`publicationStatus` default, HOS-1641). The portal
itself creates a draft from a minimal payload and continues in the editor.

| | P1 preview → confirm token (`reply_inquiry`) | P2 conversation-held wizard | P3 server-side draft patched per step |
|---|---|---|---|
| State | Redis, single-use, 10 min, bound to a payload hash | the model's context | the DB row |
| Proves the user saw the preview | yes | no | no |
| Survives a lost conversation | no | no | yes |
| Stops duplicate writes on model retry | yes (single use) | no | no (each retry may create) |
| Leftovers | none | none | half-filled drafts (same as the portal today) |
| New infrastructure | generalize the existing store | none | none if the draft is the listing; a table if not |
| Fit | irreversible or costly single writes | collecting inputs | multi-session editing |

**Decision proposed (OQ-2 confirms):** a hybrid with no new state store.

1. **Collect in the conversation (P2)**, guided by a read tool that returns what
   each step needs (types, destinations, field limits). Validation is
   authoritative only on the server.
2. **Commit with P1** for writes that are costly or create rows: `create_listing`,
   `confirm_benefit_usage` and `reject_benefit_usage`. The first call validates
   with the route's own schema and access step (dry run), then returns a preview
   and a `confirmationToken`. The second call, with the same payload and the
   token, writes.
3. **After the create, the draft IS the server-side state (P3 for free).**
   Optional steps (amenities by category, hours, contact) patch the new draft
   through the existing edit tools. A lost conversation leaves an ordinary draft
   the owner finishes in the portal, exactly as today.

Low-risk, idempotent edits (amenities per category, `update_listing_basic`) take
no token. Clients already ask before a write tool runs (`readOnlyHint: false`).

**Generalized confirmation store.** Today
`inquiry/confirmation-token-store.ts` binds
`(userId, clientId, conversationId, sha256(text))`. It moves to
`mcp/tools/confirmation-token-store.ts` with the binding
`(userId, clientId, tool, subjectId, sha256(canonicalJson(payload)))`. Each tool
gets its own key prefix. Behaviour is unchanged: `GETDEL`, fail closed, 600 s
TTL, and a burnt token on mismatch. `reply_inquiry` is migrated with its tests
unchanged (a regression guard). `canonicalJson` sorts keys, so a reordered
payload with the same values matches.

### 5.3 Aggregate reads within the response budget

- **Budget.** Each result is at most `MCP_RESULT_MAX_CHARS` (proposed 24 000
  serialized characters). Handler p95 is under 3 s on staging data. Both are
  constants in `mcp/tools/`, not literals in tools. The exact client limits are
  not documented (§11 U-1). The constants get tuned in the staging smoke.
- **Shape rules:**
  - aggregate in SQL or in an existing owner-wide service method, never one
    query per listing;
  - list tools are paginated with `pageSize` ≤ 20 and return `total`/`hasMore`;
  - long free text is truncated to `MCP_TEXT_EXCERPT_CHARS` (proposed 600)
    with `truncated: true`, and a `get_*` tool returns the full text;
  - a metric that is unavailable is OMITTED, never zero (HOS-2184 AC-9).
- **Guard.** A test builds the largest seeded result per aggregate tool and
  asserts its size is under the budget.
- **Owner-wide sources that already exist:**
  - `EntityViewService.getStatsForOwnListings`/`getDailySeriesForOwnListings`
    (`packages/service-core/src/services/entityView/entityView.service.ts:1133,1173`);
  - `AccommodationService.getByOwner` and the unread count of
    `routes/host/protected/dashboard.ts`;
  - `ConversationService.getHostMonthlyInquiries`/`getHostResponseRate`;
  - `resolveListingCompleteness` (`packages/schemas/src/common/listing-completeness.ts:294`);
  - the review models' sorted read used by `listing-stats-readers.ts`.

### 5.4 Help content source of truth (HOS-2333)

**Survey: what exists.**

- `apps/web/src/pages/[lang]/preguntas-frecuentes/index.astro` is a public FAQ
  with 51 questions in es/en/pt. They live under i18n `faq.categories.<cat>.items.<key>`.
  The `owners` category has 9 items: `publish`, `cost`, `commission`, `ready`,
  `manageReviews`, `featured`, `pause`, `payments`, `support`. There are also
  `partners` and `contributors` categories. Answers are prose with no portal
  links and no steps.
- The welcome tours (`apps/web/src/config/tours.ts`, SPEC-264/HOS-1856) are UI
  step anchors, not how-to articles.
- The What's New catalog (`apps/api/src/data/whats-new/whats-new.ts`) announces
  changes. It is not a help set.
- **There is no task-oriented client help with links.** HOS-2333 has to create
  one.

**Proposed design (OQ-3 picks the location and the owner):**

- A typed catalog of `OwnerHelpTopic`:
  - `id` and `audience` (`host | venue | experience | provider | any`);
  - `keywords` (es), `title` (es) and `steps` (es, ≤ 8);
  - `destinations` (each a `PortalDestination` from §5.1);
  - optional `faqKey` that points to the existing FAQ item it extends (no
    duplicated prose);
  - `reviewedAt` (ISO date).
- Seed set of about 15 topics, each covering a real portal flow:
  - photos, change plan, add-on, pause and resume, publish requirements;
  - reply inquiries, connect a calendar (accommodation), the provider directory,
    declare or confirm a benefit;
  - edit amenities, the fix request after moderation, connect or disconnect an
    AI assistant, change the email/password, delete a listing.
- **Staleness controls** (help that is never updated is worse than none):
  - a guard test fails when a destination no longer resolves (§5.1);
  - a guard test fails when a `faqKey` no longer exists in i18n;
  - a test warns (not fails) on topics with `reviewedAt` older than 180 days, in
    the `pnpm check:guards` output;
  - the PR template's checklist line: "changed a portal flow → update its help
    topic".
- **Search.** A normalized keyword match: lowercase, accents stripped, scored on
  keyword hits plus title tokens, top 3. No embeddings (start small, HOS-2333).

## 6. Per-child design

Every new tool lives under `apps/api/src/mcp/tools/<area>/` and is registered in
`registry.ts`. Descriptions are English for the model; user-facing messages are
Spanish.

### 6.1 HOS-2326 — links on every refusal

**Scope:** §5.1 applied to the 9 phase A tools and to every new tool.

**Changes:**

- `tool-definition.ts`: `ToolErrorPayload.action`, `ToolErrorPayload.helpTopicId`
  and `ToolDefinition.refusalAction`.
- `tool-errors.ts` and `run-tool.ts`: carry them through.
- `bind-tool.ts`: render them.
- The new portal-links module and its guard.

**Acceptance criteria:**

- AC-C1: Given an owner, when `update_listing_basic` gets `name` for one of their
  accommodations, then the result is `isError` and its text ends with an
  absolute `…/es/mi-cuenta/propiedades/{id}/editar/datos/` URL built from
  `HOSPEDA_SITE_URL`, with no hardcoded host.
- AC-C2: Given a listing that fails publication with `LISTING_INCOMPLETE`,
  `NO_COVERAGE`, `LISTING_LIMIT_REACHED`, `DUPLICATE_LOCATION` or
  `LISTING_MODERATED`, when `set_listing_publication` resumes it, then each
  refusal carries the destination listed in §5.1.
- AC-C3: Given any refusal with code UNAVAILABLE, RATE_LIMIT_EXCEEDED or
  unexpected, then no link is added.
- AC-C4: Given a foreign or missing listing, then the not-found result carries
  at most the owner-listings link, never the foreign id's editor URL. The link
  must not confirm that the id exists.
- AC-C5: A guard test resolves every `PortalDestination` kind to an existing page
  file under `apps/web/src/pages/[lang]/`. Renaming a page makes it fail.
- AC-C6: `structuredContent.action.url` equals the URL in the text.

### 6.2 HOS-2327 — amenities and features by category

**Survey:**

- **Both catalogs already have a category.**
  - `amenities.type` is `AmenitiesTypeEnum`, 17 values (`CLIMATE_CONTROL`,
    `CONNECTIVITY`, `KITCHEN`, `BED_AND_BATH`, `OUTDOORS`, `PARKING`, `LAUNDRY`,
    `WELLNESS`, `DINING`, …) (`packages/db/src/schemas/accommodation/amenity.dbschema.ts:27`).
  - `features.category` is `FeatureCategoryEnum`, 11 values (`LOCATION`, `VIEW`,
    `ACCESS`, `STYLE`, `AUDIENCE`, `OFFER_PROFILE`, `SUSTAINABILITY`,
    `ACTIVITIES`, `CUISINE`, `DIETARY`, `LANGUAGE`). It has been NOT NULL since
    HOS-2058 (`feature.dbschema.ts:21`).
- Category labels exist in i18n under `accommodations.amenityCategories.*` and
  `accommodations.featureCategories.*` (`packages/i18n/src/locales/es/accommodations.json:99,119`).
- Both catalogs carry `applicable_verticals`.
- `list_amenities_and_features` (`mcp/tools/listing/list-amenities-and-features.ts`)
  reads the public catalog services. Its output is flat `{id, slug, name}`.

**Tools:**

1. `get_listing_amenities` (read, `READ_OWN`).
   - Input: `{ vertical, id, kind?: 'amenity'|'feature', category?: string }`.
   - Output: `{ listing: {vertical,id,name}, groups: [{ kind, category, label, items: [{ id, slug, name, selected }] }] }`.
   - The catalog is scoped to the vertical through `applicable_verticals`, and
     empty groups are omitted. `selected` comes from the listing's current
     junction ids, read with `readOwnListingDetail`.
   - Ownership as in `get_listing`: foreign → not found.
   - `list_amenities_and_features` stays. Each entry gains `category` (an
     additive, non-breaking change).
2. `update_listing_amenities` (write).
   - Input: `{ vertical, id, kind, category, add?: uuid[], remove?: uuid[] }`.
   - Refine: at least one of `add`/`remove`; each id must exist, be in that
     `kind`+`category` and apply to the vertical. Otherwise VALIDATION_ERROR
     naming the id.
   - The server reads the current full set and computes
     `next = (current ∖ remove) ∪ add`. Ids of other categories are carried over
     untouched. The result goes through the **same** authorize + update helpers
     as `update_listing_basic` (extracted, C-6), so revalidation, junction sync
     and the HOS-2323 cache eviction run once and identically.
   - Hints: `idempotentHint: true`, `destructiveHint: false`.
   - Refusal link: the editor's `servicios` section.
   - Audit target: the listing. Details: `{ kind, category, added, removed }`
     (counts).
3. `update_listing_basic` description: point amenity edits to
   `update_listing_amenities` and keep `amenityIds`/`featureIds` for whole-set
   replacement (backward compatible).

**Wizard behaviour.** It lives in the tool descriptions, with no server state.
The model calls `get_listing_amenities`, then walks the groups in order and
shows the selected and unselected items. One `update_listing_amenities` call per
confirmed category.

**Acceptance criteria:**

- AC-C7: Given a venue, when `get_listing_amenities` is called, then only
  catalog rows whose `applicable_verticals` include `venue` appear. Rows are
  grouped by `type`/`category` with Spanish labels from i18n, and `selected`
  matches the stored junction rows.
- AC-C8: Given an accommodation with amenities in KITCHEN and PARKING, when
  `update_listing_amenities` adds one KITCHEN id and removes another, then
  PARKING amenities and all features are unchanged afterwards.
- AC-C9: Given an id from another category, or one that does not apply to the
  vertical, then VALIDATION_ERROR names that id and nothing is written.
- AC-C10: Given an accommodation, after a successful call the public
  accommodation cache is evicted (C-1, the same assertion as the HOS-2323 test).
- AC-C11: Given a foreign listing, then not found, plus the AC-C4 link rule.
- AC-C12: Every amenity `type` and feature `category` value has an es label in
  i18n. A test iterates both enums.

### 6.3 HOS-2328 — plan and subscription (read)

**Survey (corrects the issue's "blocked on the umbrella").** The HOS-1352
umbrella (`epic/HOS-1352-post-mvp`) was **merged into `staging` on 2026-11-15**
(PR #4353, merge `96756adfc4`). `routes/billing-subscription/read-mine.ts`
(`GET /api/v1/protected/billing-subscription/`, `BILLING_VIEW_OWN`,
`READ_OWN`), `routes/trial/` and `routes/plan-catalog/public/` exist on staging.
**HOS-2066 is still Backlog.** The owner rule is that HOS-2066 goes first after
the umbrella merge, so this child stays gated on HOS-2066 (OQ-5).

**Tool** `get_my_plan` (read, `READ_OWN`, requires `BILLING_VIEW_OWN` as the
route does).

- Input: `{ vertical?: 'accommodation'|'venue'|'experience'|'tourist'|'partner' }`.
- Output per vertical where the owner holds a title:
  - the plan name and version from the catalog row, never a code map (HOS-1967
    rule);
  - `status` (`SUBSCRIPTION_STATUSES` or the trial state);
  - `nextChargeAt`, `serviceEndsAt` and `graceEndsAt`;
  - `trialDaysLeft`;
  - `includes`: the entitlement and limit keys of the effective set, rendered
    with their owner-facing i18n labels;
  - the add-ons held;
  - `actionUrl` for subscription and add-ons.
- **Source.** The same reads `read-mine.ts` composes (`readOwnSubscriptions`,
  `readOwnDeferredCourtesies`), extracted into a service-level reader (C-6). The
  trial comes from the trial read route's service and `includes` from
  `packages/verticals/src/effective-set/`. Raw tables are never read in the tool.
- HOS-2184 phase B AC-16 ("stats include plan status") reuses this reader. It is
  not a separate implementation (OQ-5).

**Acceptance criteria (after HOS-2066):**

- AC-C13: Given an owner with an active accommodation subscription and a venue
  trial, then both verticals are returned with status, dates, trial days left
  and catalog-sourced includes.
- AC-C14: Changing a plan version's entitlement rows in the catalog changes
  `includes` with no code change. The test edits the catalog fixture.
- AC-C15: Given an owner with no title, the result is empty with a link to
  plans. It is not an error.

### 6.4 HOS-2329 — create a listing step by step

**Survey — what creation requires today.**

| Vertical | Route the portal uses | Service | Required input | Permission / role |
|---|---|---|---|---|
| Accommodation | `GET /protected/host-onboarding/precheck`, then `POST /protected/host-onboarding/start` | `AccommodationService.createForOnboarding` | `AccommodationCreateDraftHttpSchema` (`accommodation.http.schema.ts:420`): `name` 3-100, `summary` 10-300, `type`, `destinationId`. Optional: `description` (30-2000), `maxGuests`, `bedrooms`, `bathrooms`, `beds`, `basePrice`, `currency`, `latitude`, `longitude`, `street`, `number` | any authenticated USER; promotes to HOST in the flow |
| Accommodation (alternative) | `POST /protected/accommodations` and `/draft` | `AccommodationService.create` | same draft schema / full create | `ACCOMMODATION_CREATE` |
| Venue | `POST /protected/venues/` | `VenueService.createForOwner` | `VenueOwnerCreateInputSchema`; the web form sends `name`, `type`, `summary`, `description`, `destinationId`, `priceFrom`/`priceUnit`/`isPriceOnRequest`, `businessLines` | none (HOS-687); grants VENUE_OWNER in the same transaction |
| Experience | `POST /protected/experiences/` | `ExperienceService.createForOwner` | `ExperienceOwnerCreateInputCheckedSchema`: `name`, `type`, `summary`, `description`, `destinationId` | none; grants the owner role in the same transaction |

**Hooks and side effects:**

- `BaseListingService._beforeCreate` derives the slug from `name`.
- `publicationStatus` is always born `DRAFT`.
- Venue and experience grant the role inside the create transaction.
- All three run the factory's `listingAccess: { operation: 'CREATE' }`. For
  venues it also sets `businessLinesFromBody` and `listingSection` from the
  body (`venue/protected/create.ts:122-138`).
- Accommodation writes trigger `mountAccommodationCacheInvalidation`, which is
  harmless for a draft but reproduced (C-1).
- No create route fires a handler-level notification.

**Quota.** The create routes say "CREATE keeps drafts unlimited; PB1 counts
published listings at publication (V6.1)" (`accommodation/protected/create.ts:38,71`).
The limit is enforced at publish as `LISTING_LIMIT_REACHED`. The older header of
`host-onboarding/protected/start.ts` (BETA-197) says drafts count against
`max_accommodations`. The implementer verifies which one the code enforces
(§11 U-2) before writing AC-C19.

**Location.** It is not part of the venue/experience create payload and is
optional on the accommodation draft. `location_key` deduplication
(HOS-1810, the one-address rule) bites at publication as `DUPLICATE_LOCATION`.
`GeocodingService` exists in service-core. Whether the wizard collects location
is OQ-4.

**Tools:**

1. `get_listing_creation_guide` (read, `READ_OWN`). Input: `{ vertical }`.
   Output:
   - the ordered steps with the fields each needs;
   - each field's limits, read from the route schema (min/max) so they never
     drift;
   - the type options with Spanish labels;
   - the destinations list (id, name; public catalog, small);
   - for venues, the business lines allowed per type
     (`BUSINESS_LINE_RULES.venue.typeRules`);
   - for accommodation, the precheck result (an existing open draft to resume,
     with its editor link);
   - an informational `publishQuota` note when the owner is already at the
     published limit for the vertical. It never blocks (§11 U-2).
2. `create_listing` (write, two-step P1).
   - Input: one flat object, `{ vertical, name, type, summary, description?,
     destinationId, priceFrom?, priceUnit?, isPriceOnRequest?, businessLines?,
     maxGuests?, bedrooms?, bathrooms?, beds?, confirmationToken? }`. A
     `superRefine` validates against that vertical's route schema, with
     `.strict()` per vertical as in `update_listing_basic`.
   - **Preview call (no token):**
     - run the route's validation and its CREATE listing-access step (dry run,
       nothing written);
     - for accommodation, run the precheck;
     - return a Spanish preview of exactly what will be created, plus a token
       bound to `(user, client, 'create_listing', vertical, sha256(payload))`.
   - **Commit call (same payload + token):**
     - consume the token, then call the **same service the portal route calls**:
       accommodation via the host-onboarding path (OQ-6), venue/experience via
       `createForOwner`;
     - reproduce the side effects (C-1);
     - return `{ id, vertical, publicationStatus: 'DRAFT', editorUrl, nextSteps }`.
       `nextSteps` lists amenities (§6.2), photos (editor `fotos` link), location
       (`ubicacion` link, per OQ-4) and "publish when ready"
       (`set_listing_publication` or a portal link).
   - On a validation failure, the error names only the failed fields, so the
     model re-asks only that step (HOS-2329).
   - Hints: `destructiveHint: false`, `idempotentHint: false`. Audit target is
     the created id on commit, `auditDetails.step`.
   - Refusal links: the create page for the vertical, or the existing draft's
     editor.

**Acceptance criteria:**

- AC-C16: Given a USER with no listings, when `create_listing` is previewed and
  then committed for each vertical, then a DRAFT exists, owned by the actor,
  created by the same service as the portal route. Venue and experience grant
  the owner role; accommodation follows the host-onboarding promotion.
- AC-C17: Given a commit with a payload that differs from the preview, or a
  reused or expired token, then nothing is created and the token is burnt.
- AC-C18: Given two commits racing with the same token, then exactly one listing
  is created.
- AC-C19: The quota behaviour matches what the code enforces (U-2). The draft is
  created while the owner is at the published limit and the result says
  publishing will need a free slot. Or, if drafts count, the preview refuses
  with a link to plans.
- AC-C20: No path publishes. The created row is `DRAFT` and no trial row is
  started (the activation event `listing_published` does not fire).
- AC-C21: A validation failure on one field returns only that field's issue.
  All other inputs are untouched.
- AC-C22: For accommodation, the cache eviction runs after commit (C-1).
  For venues, the listing-access step receives `businessLines` derived from the
  body, as the route does.
- AC-C23: Preview and commit each leave one audit row with `step`.

### 6.5 HOS-2330 — read reviews

**Survey (corrects the issue).**

- `mi-cuenta/resenas` lists the reviews the user WROTE
  (`UserReviewsList.client.tsx`, `GET /protected/users/me/reviews`). **No portal
  page shows an owner the reviews received on their listings.**
- The only owner-facing review read is `get_listing_stats`. It shows the latest 3
  through `listing-stats-readers.ts`, which reads the review models with the
  public visibility (`ACTIVE` + `APPROVED`, not soft-deleted).
- Public lists use `AccommodationReviewService.listByAccommodation`,
  `VenueReviewService.listByVenue` and the experience equivalent. They are
  capped at 100, unsorted, and expose reviewer `name` + `image` only
  (`accommodation/reviews/public/list.ts`, `venue/public/getReviews.ts`).
- Reviews have `moderationState` (PENDING/APPROVED/REJECTED) and
  `moderationReason`. There is no reply field (NG-1).

**Tool** `list_reviews` (read, `READ_OWN`).

- Input: `{ vertical?, listingId?, minRating?, maxRating?, since?, page?, pageSize? }`.
  `listingId` requires `vertical`, and `pageSize` is ≤ 20.
- Output: `{ items: [{ id, listing: {vertical,id,name}, rating, title, text
  (untrusted, excerpt), createdAt, reviewer: {displayName} }], total, hasMore }`.
- Implementation:
  - extend `listing-stats-readers.ts` into a paginated, filtered owner-wide
    reader: one query per vertical, joined on the owner's listing ids, merged
    and sorted by `createdAt` desc;
  - the visibility default equals the public lists (OQ-7);
  - reviewer data equals the public projection minus `image` (OQ-8).
- A foreign `listingId` ⇒ not found. An owner with no listings gets an empty
  list.

**Acceptance criteria:**

- AC-C24: Given an owner with reviews on an accommodation, a venue and an
  experience, then `list_reviews` with no filters returns all three, newest
  first, paginated, with `total`.
- AC-C25: Filters by vertical, listing, rating range and `since` combine.
- AC-C26: PENDING, REJECTED, soft-deleted and non-ACTIVE reviews follow the OQ-7
  decision. By default they are excluded, matching public counts.
- AC-C27: Review text is wrapped as untrusted data and the description carries
  the notice (C-5).
- AC-C28: A foreign `listingId` ⇒ not found. No reviewer email, user id or image
  appears in the output.

### 6.6 HOS-2331 — owner summary

**Tool** `get_owner_summary` (read, `READ_OWN`). It is one tool and not prompt
guidance, because the alternative is N calls to `get_listing_stats`.

- Input: `{ period?: '7d'|'30d'|'90d' }`, the stats periods.
- Output:
  - `listings`: `{ [vertical]: { total, byStatus: { DRAFT, PUBLISHED, UNPUBLISHED_BY_BILLING, ARCHIVED, MODERATED } } }`.
    It comes from one grouped count per vertical, and `PURGED` is excluded.
  - `metrics`, gated exactly like `get_listing_stats` (`view_basic_stats`, and
    `view_advanced_stats` for favorites). When ungated, the block is omitted with
    `{ omitted: 'NO_STATS_ENTITLEMENT', action }` (OQ-9). It contains:
    - views from `EntityViewService.getStatsForOwnListings`;
    - accommodation inquiries and response time from `ConversationService`;
    - unanswered inquiries, from the same unread count the host dashboard uses;
    - new reviews in the period, a count from the §6.5 reader;
    - favorites (accommodation, advanced gate).
  - `attention`: `[{ kind, listing, actionUrl }]`. Kinds:
    - `unanswered_inquiries` (the inbox link);
    - `open_fix_request` (from `fix_request` open rows; editor hub);
    - `incomplete` (`resolveListingCompleteness` on drafts; first missing
      section);
    - `missing_photos` (editor `fotos`).
    It is capped at 10 entries with a `more` count.
  - `subscription`: present only after HOS-2328, built from the `get_my_plan`
    reader.
- Budget: §5.3. No per-listing service calls. Completeness runs on the rows
  already loaded.

**Acceptance criteria:**

- AC-C29: Given an owner with listings in two verticals, then the counts per
  status match `list_my_listings` totals.
- AC-C30: Given an owner without `view_basic_stats`, then `listings` and
  `attention` are returned, and `metrics` is omitted with the plans link. It is
  never zeroed.
- AC-C31: Given unanswered inquiries and an open fix request, then both appear
  in `attention`, each with the correct portal URL.
- AC-C32: Given the largest seeded owner, the serialized result is under
  `MCP_RESULT_MAX_CHARS`, and the handler issues a bounded number of queries
  independent of the listing count. A test asserts the query count.
- AC-C33 (after HOS-2328): `subscription` per vertical equals the `get_my_plan`
  output.

### 6.7 HOS-2332 — providers and benefit usages

**Survey.**

- **Directory:** `GET /protected/host-trades` →
  `HostTradeService.listForHost(actor)` (`HOST_TRADE_VIEW`). It is scoped
  server-side to the destinations of the caller's accommodations and has **no
  filter parameters**.
  - Rows carry `category` (`HostTradeCategoryEnum`), `benefit`, `benefitType`,
    `benefitValue`, `contact`, `destinationId`, `scheduleText`, `is24h` and the
    counters `confirmedUsesCount`, `reviewsCount` and `averageRating`.
  - Detail: `GET /protected/host-trades/{slug}` → `getByField(actor, 'slug', …)`.
- **Usages** (`HostTradeUsageService`):
  - host side: `listForHost({status,page,pageSize})`, `listPendingForHost` and
    `countPendingForHost`;
  - provider side: `listForProvider({hostTradeId,status,declaredBy,…})`, after
    `HostTradeService.getOwn`;
  - declare: `declareAsHost` (`POST /{slug}/usages`, `HOST_TRADE_VIEW`) and
    `declareAsProvider` (`POST /mine/usages`);
  - transitions: `confirmUsage`, `rejectUsage({note?})` and `undoRejection`
    (`usage-transitions.ts`, auth only and role-blind).
  - `confirmUsage` recalculates the aggregates in the same transaction.
- **Side effects that live in the route handlers** (C-1): `notifyUsageDeclared`,
  `notifyUsageConfirmed` and `notifyUsageRejected`.

**Tools:**

1. `search_providers` (read). Authorization: `HOST_TRADE_VIEW`, as the route
   requires.
   - Input: `{ query?, category?, destinationId?, benefitType?, page?, pageSize? }`.
   - It calls `listForHost` and filters and paginates in the tool, because the
     list is already scoped to the host's destinations and small.
     `query` matches name and benefit with normalized text.
   - Output per provider: `slug`, `name`, `category` + label, `benefit`
     (untrusted), `contact` (untrusted), the destination name, the schedule and
     the counters, plus a directory link per provider.
   - A non-host gets FORBIDDEN mapped with a link to the directory page, which
     explains the requirement.
2. `list_benefit_usages` (read).
   - Input: `{ side?: 'host'|'provider'|'both', status?, pendingMine?: boolean, page?, pageSize? }`.
   - Host rows come from `listForHost` / `listPendingForHost`. Provider rows come
     from `listForProvider` and appear only when `getOwn` finds a provider
     listing.
   - Each row: `id`, `side`, `declaredBy`, `status`, the counterpart's display
     name, the benefit, `createdAt` and `canAnswer`. `canAnswer` is computed by
     the service's own counterpart rule, never by the actor's role.
3. `confirm_benefit_usage` and `reject_benefit_usage` (write, two-step P1).
   - Input: `{ usageId, note? (reject only), confirmationToken? }`.
   - The preview reads the usage through the same service path. Foreign, own
     declaration and missing all give ONE not-found result. The preview returns
     a summary and a token bound to `(user, client, tool, usageId, sha256({note}))`.
   - The commit calls `confirmUsage`/`rejectUsage`, then fires the matching
     notification exactly as the route does.
   - The note is optional (rejecting is cheap on purpose).
4. `undo_benefit_rejection`: one step, because the action itself is the undo. It
   fires no notification, matching the route.
5. Declaring a new usage from the chat is **OQ-10**. The recommendation is to
   leave it out of this spec.

**Acceptance criteria:**

- AC-C34: `search_providers` returns exactly the rows `listForHost` returns for
  that actor, filtered by the inputs. A provider outside the host's destinations
  never appears.
- AC-C35: Using `host-provider@local.test` (host AND provider), usages from both
  sides are listed with the correct `side`. The account can answer a
  provider-declared usage on its host side and a host-declared usage on its
  provider side, and nothing else.
- AC-C36: Confirming or rejecting a usage the actor declared, a foreign usage or
  a missing id answers the same not-found, in preview AND commit. It is never
  FORBIDDEN.
- AC-C37: A commit without a valid token writes nothing. A reject commit with a
  note different from the preview is refused.
- AC-C38: A successful confirm moves `confirmedUsesCount` and fires
  `notifyUsageConfirmed`. A successful reject fires `notifyUsageRejected` with
  the note. Both are asserted (C-1).
- AC-C39: No tool in this child declares a role check. A static test asserts the
  usage tools reference no role enum. This mirrors the HOS-376 guard.

### 6.8 HOS-2333 — client help

**Tool** `get_help` (read, no ownership; `READ_OWN`).

- Input: `{ question: string (≤ 300), audience?: 'host'|'venue'|'experience'|'provider' }`.
- Output: `{ topics: [{ id, title, steps, links: [{ label, url }] }] }`, at most
  3 topics, from the §5.4 catalog and search.
- No match ⇒ an empty `topics` plus the FAQ page and support contact links, and
  the description tells the model not to improvise steps.
- Tourist-only questions return nothing tourist-specific (NG-4).
- Refusals of other tools may carry `helpTopicId` (§5.1). `get_help` also
  accepts `{ topicId }` to fetch a topic directly.

**Acceptance criteria:**

- AC-C40: "cómo subo fotos" returns the photos topic, with links to the editor
  `fotos` section of each vertical.
- AC-C41: Every topic's destinations resolve (AC-C5 guard), and every `faqKey`
  exists in i18n es.
- AC-C42: An unmatched question returns no topics and the FAQ + support links.
  The description forbids invented steps.
- AC-C43: A topic with `reviewedAt` older than 180 days is reported by the guard
  run.

## 7. Data model, contracts, configuration

- **No new tables and no migrations.** Confirmation tokens stay in Redis. Help
  is a typed catalog in code (or in i18n, per OQ-3).
- **Contract changes (additive):**
  - `ToolErrorPayload.action` and `.helpTopicId`;
  - `ToolDefinition.refusalAction`;
  - the new `structuredContent.action` in failure results;
  - `list_amenities_and_features` entries gain `category`.
- **Constants (not env):** `MCP_RESULT_MAX_CHARS`, `MCP_TEXT_EXCERPT_CHARS` and
  `CONFIRMATION_TOKEN_TTL_SECONDS` (unchanged).
- **No new env vars.** Links reuse `HOSPEDA_SITE_URL`.
- **Consent copy.** The consent screen and the "Asistentes de IA" panel list what
  a connected assistant can do (HOS-2184 §8). Add "crear borradores de
  publicaciones" and "confirmar o rechazar usos de beneficios" in es/en/pt.
- **Tool count.** It grows from 9 to about 19. Descriptions stay short and
  cross-reference each other ("take ids from …").

## 8. Phasing and PR split

Each child closes with its own PR carrying `Closes HOS-23xx`. The last PR of the
spec also carries `Closes HOS-2335`. PR titles carry `[HOS-23xx]`, and the
Linear title automation is spot-checked (CLAUDE.md).

| PR | Content | Depends on | When |
|---|---|---|---|
| PR-1 | §5.1 portal links + error-payload plumbing + guard; HOS-2326 for the 9 phase A tools | — | now |
| PR-2 | §5.2 generalized confirmation store (`reply_inquiry` migrated, tests unchanged) + §5.3 budget constants and helpers | — | now |
| PR-3 | HOS-2327 amenities by category | PR-1 | now |
| PR-4 | HOS-2330 reviews + the owner-wide review reader | PR-1 | now |
| PR-5 | HOS-2333 help catalog + `get_help` | PR-1 | now |
| PR-6 | HOS-2329 create wizard | PR-1, PR-2, PR-3 | now |
| PR-7 | HOS-2332 providers + usages | PR-1, PR-2 | now |
| PR-8 | HOS-2331 summary (no subscription block) | PR-1, PR-4 | now |
| PR-9 | HOS-2328 `get_my_plan` + HOS-2331 subscription block + plan links for HOS-2184 phase B refusals | HOS-2066 (and HOS-2184 phase B for the entitlement gate) | after HOS-2066 |

HOS-2331 closes with PR-9, not PR-8, because its subscription part is in scope.
PR-8 must not carry a magic word.

## 9. Risks

- **R-1: A route side effect is missed again (C-1).** Mitigation:
  - the C-1 list in each PR description;
  - one test per side effect;
  - the reviewer greps the route file for `void `, `notify`, `invalidate` and
    `app.use` scopes.
- **R-2: Portal paths drift from the web.** Mitigation: the AC-C5 guard, and
  the OQ-1 shared module.
- **R-3: The model rewrites `create_listing` values between preview and commit.**
  The token is bound to the payload hash. A mismatch burns the token and asks for
  a new preview (AC-C17).
- **R-4: Duplicate drafts from retries or lost conversations.** The single-use
  token stops retries. A lost conversation leaves one draft, which the precheck
  surfaces next time (accommodation). Venue and experience have no precheck
  (§11 U-3).
- **R-5: Prompt injection through reviews and provider text.** C-5. No tool acts
  on returned text.
- **R-6: Aggregate cost of the summary on large owners.** Query-count and size
  tests (AC-C32).
- **R-7: HOS-376 invariants broken by convenience.** Role-blind tools, uniform
  404 and a static guard (AC-C36, AC-C39).
- **R-8: Help content goes stale.** The §5.4 guards. The `reviewedAt` warning
  only reports; the owner decides who acts on it (OQ-3).
- **R-9: The client response budget is unknown.** Constants plus the smoke
  (§11 U-1).

## 10. Open questions for the owner

Each question has options, pros and cons, and a recommendation. None is decided
here.

**OQ-1 — Where the portal path vocabulary lives (§5.1).**

1. **A shared module in an existing package** (for example
   `packages/utils/src/portal-routes/`). The web's `listing-section-presentation.ts`
   slugs, `publish-page-paths.ts` and the editor hub paths import from it.
   - Pros: one source of truth, as the CLAUDE.md SSOT rule asks.
   - Cons: touches about 6 web files, and a web refactor rides along.
2. **An API-local map plus a cross-app guard test.**
   - Pros: no web change; small PR.
   - Cons: two copies, kept honest only by the guard.

*Recommended: 1.* The repo rule is explicit, and the guard is still added.

**OQ-2 — The step pattern (§5.2).**

1. **The hybrid**: collect in the chat, commit with a token, and the created
   draft holds later state.
2. **Pure P3**: create a draft at step 1 and patch it.
3. **Pure P2**: no token.

*Recommended: 1.* It reuses the portal's own draft model, stops duplicates, and
adds no state store. Option 2 creates drafts on abandoned chats. Option 3 lets
model retries duplicate rows.

**OQ-3 — Help catalog location and maintainer (§5.4).**

1. **A typed TS catalog in `apps/api/src/data/owner-help/`**, es only, in the
   style of whats-new.
   - Pros: simplest; guards are easy.
   - Cons: the web cannot render it without moving it later.
2. **Topic registry in a shared package, text in `@repo/i18n` (`ownerHelp.*`).**
   - Pros: a future web help page and en/pt reuse it, and the i18n parity guards
     apply.
   - Cons: more structure now (YAGNI risk).
3. **A DB table with admin editing.**
   - Pros: non-developers edit it.
   - Cons: new CRUD and migrations; overkill for about 15 topics.

*Recommended: 1 now, 2 when a web help page is planned.* The owner must also
name who keeps it updated: whoever changes a portal flow (the PR checklist), or
a periodic content owner.

**OQ-4 — Location in the create wizard.**

1. **Leave location out.** `nextSteps` links to the editor's `ubicacion` section.
   - Pros: keeps HOS-2184 NG-3, no geocoding ambiguity, and the
     `location_key`/duplicate checks stay in the portal.
   - Cons: one more portal visit before publishing.
2. **Free text → `GeocodingService` → show the match → accommodation fields
   `street`/`number`/`latitude`/`longitude`.**
   - Pros: the draft is more complete.
   - Cons: reverses NG-3; geocoding errors become wrong addresses; only
     accommodation accepts location at create.

*Recommended: 1.*

**OQ-5 — Plan tool timing and shape (HOS-2328).** The umbrella is already on
staging (PR #4353, 2026-11-15) and HOS-2066 is Backlog.

1. Wait for HOS-2066, then build `get_my_plan` as a separate tool that HOS-2184
   phase B AC-16 reuses.
2. Build now on staging data, ignoring HOS-2066.
3. Fold it into HOS-2184 phase B only, with no separate tool.

*Recommended: 1.* It follows the standing owner rule that HOS-2066 goes first
after the umbrella. A separate tool answers "what plan do I have" directly, and
the reader is shared with AC-16.

**OQ-6 — Accommodation create path.**

1. **The host-onboarding precheck + start** that the portal uses
   (`createForOnboarding`).
   - Pros: parity with the portal; a USER becomes HOST, as venue and experience
     do; resumes existing drafts.
   - Cons: the onboarding-specific semantics (BETA-197) come along.
2. **`POST /protected/accommodations` (`create`).**
   - Pros: the generic path.
   - Cons: requires `ACCOMMODATION_CREATE`, so a USER cannot start hosting from
     the chat.

*Recommended: 1.*

**OQ-7 — Which reviews an owner sees.**

1. **Only ACTIVE + APPROVED**, what the public sees.
   - Pros: no new exposure; matches `reviewsCount`.
   - Cons: the owner never learns about pending ones.
2. **Also PENDING, flagged.**
   - Pros: early warning.
   - Cons: shows unmoderated text that may be removed, and no portal page shows
     it today.
3. **APPROVED, plus a pending count with no text.**

*Recommended: 3.* It gives the useful signal without exposing unmoderated text.

**OQ-8 — Reviewer identity in `list_reviews`.**

1. The public projection minus the image (display name).
2. First name + last initial.
3. Anonymous.

*Recommended: 1.* It is already public on the listing page, so it adds no
exposure.

**OQ-9 — Gating the owner summary.**

1. Gate only the metrics block with `view_basic_stats`, as `get_listing_stats`
   does. Counts and attention items are always returned.
2. Gate the whole tool.

*Recommended: 1.* Counts and attention items are not stats. The owner can see
them in the portal without that entitlement.

**OQ-10 — Declaring a benefit usage from the chat.**

1. **Out of scope for this spec.**
   - Pros: declarations usually happen on site (QR); a chat declaration lowers
     the friction for false declarations, which only the counterpart's rejection
     catches.
   - Cons: the portal already allows it, so this is not parity.
2. **Include** `declare_benefit_usage` (two-step; host via `declareAsHost` with
   `HOST_TRADE_VIEW`, provider via `declareAsProvider`; fires
   `notifyUsageDeclared`).

*Recommended: 1.* Revisit once usage data shows demand.

**OQ-11 — Pending usages in the owner summary.** Add `pending_benefit_usages`
to `attention`.

- Pros: one more actionable item.
- Cons: it mixes the provider domain into a listings summary.

*Recommended: yes.* `countPendingForHost` is cheap.

## 11. Things this spec could not determine (implementer resolves from code or smoke)

- **U-1: The exact tool-result size and time limits of Claude connectors and
  ChatGPT apps.** They are not documented. Measure them in the staging smoke and
  tune §5.3.
- **U-2: Whether accommodation drafts count against `max_accommodations` at
  creation.** The create routes (V6.1) and the host-onboarding header (BETA-197)
  disagree. Read the `quota` step that `resolveListingAccess` runs for `CREATE`.
- **U-3: Whether venues and experiences have an equivalent of the accommodation
  precheck** (resume an open draft). None was found.
- **U-4: The exact `requiredPermissions`/`emailUnverifiedOperation` of
  `host-trade/protected/usage-transitions.ts` and `mine-usages.ts` reads.** Copy
  them verbatim (C-4).
- **U-5: Whether a persisted user locale exists elsewhere** (for example
  settings JSON). None was found in `packages/db/src/schemas/user/`. Links
  default to `es`.

## 12. Implementation notes

- **Smoke label:** `status-needs-smoke-staging`, with a real Claude + ChatGPT
  connection. PR-9 touches billing reads, so follow `docs/billing/smoke-checklist.md`
  (staging section).
- **Release:** no migrations. A seed change happens only if the help catalog
  goes to i18n (OQ-3 option 2). That is not seed data, so dual-write does not
  apply.
- **Branching:** each PR is cut from `staging` and targets `staging`.
- **HOS-2185 reuse:** keep every new tool a plain `(actor, input, context)`
  function. The confirmation store and the portal links stay transport-agnostic
  (no MCP imports outside `lib/mcp/`).
- **Tests:**
  - per tool: the authorization matrix (owner, foreign, missing, unverified
    email), the C-1 side effects, the C-2 schema shape, and the C-3 audit;
  - HOS-376: the seeded dual-role account;
  - mutation-check the central guards (foreign → not found, token binding,
    category isolation).

## 13. Linear

- **Canonical:** HOS-2335.
- **Children:** HOS-2326, HOS-2327, HOS-2328, HOS-2329, HOS-2330, HOS-2331,
  HOS-2332 and HOS-2333.
- **Parent feature:** HOS-2184.
- **Blocked on (partially):** HOS-2066 (HOS-2328 and the subscription part of
  HOS-2331).
- **Related:** HOS-1352, HOS-2323, HOS-376 and HOS-1967.
