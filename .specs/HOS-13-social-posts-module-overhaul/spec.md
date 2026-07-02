---
title: Social Posts Module Overhaul
linear: HOS-13
statusSource: linear
status: superseded
created: 2026-07-01
type: feature
areas:
  - web
  - content
---

# Social Posts Module Overhaul

> Migrated from `.qtm/specs/SPEC-297-social-posts-module-overhaul/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-13.
>
> **SUPERSEDED 2026-07-02.** Discovery phase (Section 7) is complete — all 9 open
> questions resolved, owner decisions made, functional design settled for the
> batch/campaign flow. This spec's deliverable (the research + split) is done.
> Implementation continues in 4 sub-specs:
>
> - [HOS-64 — Settings Enforcement Fix](https://linear.app/hospeda-beta/issue/HOS-64) (`.specs/HOS-64-settings-enforcement-fix/`)
> - [HOS-65 — Publishing Engine Extension](https://linear.app/hospeda-beta/issue/HOS-65) (`.specs/HOS-65-publishing-engine-extension/`)
> - [HOS-66 — Composer + Dashboard UX](https://linear.app/hospeda-beta/issue/HOS-66) (`.specs/HOS-66-composer-dashboard-ux/`)
> - [HOS-67 — GPT/MAKE Config Export](https://linear.app/hospeda-beta/issue/HOS-67) (`.specs/HOS-67-gpt-make-config-export/`)
>
> This document remains as the discovery record (all research findings, resolved
> OQs, and the reasoning behind the split) — do not implement directly against it.
>
> A discovery-first spec. Goals are **provisional** — they capture the full owner
> wish-list before design. The first deliverable is a research phase + owner
> alignment session, after which this spec will almost certainly be split into
> 3-4 sub-specs before any code is written.

## 1. Summary

SPEC-254 (completed 2026-06-23, in staging) delivered the core social automation
backend: GPT draft ingestion, Make.com dispatch pipeline, admin editorial UI with
state-machine approval flow, audit logging, and settings key-value store. It
supports three platforms (Instagram, Facebook, X) and eight publish formats.

This spec captures the next wave of owner requirements for the social/marketing
surface. They span multiple concerns — platform expansion, GPT/MAKE config export,
settings enforcement, multi-format publishing, batch creation UX, campaign
auto-detection, dashboard improvements, icon consistency, public web data pull,
date-range picker, and newsletter unification — and are **too large and too
interdependent to design or build as a single unit**. The first phase is pure
research + owner alignment: audit what SPEC-254 built, identify what is missing or
broken, and split the work into coherent sub-specs before implementation starts.

## 2. Problem — what the owner needs now

SPEC-254 left several gaps and introduced several rough edges:

- **Settings do not actually apply.** The `social_settings` table (key-value,
  PATCH endpoint at `/api/v1/admin/social/settings`) exists, but the service layer
  and dispatch pipeline appear to read env vars or hard-coded defaults instead of
  querying it at publish time. Root cause unconfirmed — needs investigation.
- **Only three platforms.** `SocialPlatformEnum` has `INSTAGRAM`, `FACEBOOK`, `X`.
  The owner wants more (LinkedIn, TikTok, and possibly others) but no decision has
  been made on the publishing mechanism (native APIs per platform vs. Make.com
  scenarios vs. a third-party aggregator).
- **Only photo-based formats in practice.** The dispatch payload and the GPT
  integration are biased toward image posts. Text-only threads, video, carousel
  (multi-asset), and story formats are in the schema but not end-to-end tested.
- **GPT batch creation.** Today one GPT call produces one draft. The owner wants to
  generate several drafts at once — either in a single chained call or as a batch
  endpoint, so the GPT can produce a week's worth of content in one session.
- **Campaign/batch auto-detection.** When the GPT submits a draft that looks like
  part of a campaign or batch (based on caption keywords, hashtag patterns, or
  explicit metadata), the system should offer to associate it — not require the
  operator to set it manually after the fact.
- **Marketing dashboard improvements.** The current dashboard (`/api/v1/admin/social/
  dashboard`) returns KPI counters and a quick-approval queue. The owner wants richer
  analytics: date-range filtering, per-platform breakdown, and a thumbnail column on
  the posts table.
- **Platform multi-select.** Today each post target is assigned to one
  platform-format combination. The owner wants to select multiple platforms at once
  in the composer UI and have the system fan-out targets automatically.
- **GPT and MAKE config export.** The operator must manually paste the OpenAPI schema
  and webhook URLs into ChatGPT's Action settings and Make.com's webhook config.
  SPEC-254 added `GET /api/v1/admin/social/gpt-action-schema` for the OpenAPI doc
  but there is no equivalent for Make.com's inbound payload spec, nor a single-page
  "copy this into Make" export.
- **Icon consistency.** Several social module admin components use inline SVGs or
  direct phosphor imports instead of `@repo/icons`. Needs audit.
- **Pull info from hospeda.com.ar.** The GPT currently works from a static catalog.
  The owner wants it (or the admin) to be able to pull live data from the public
  Hospeda site — accommodation listings, destination info, recent posts — to enrich
  drafts automatically.
- **Unify with newsletter.** The social posts module and the newsletter module
  (`apps/api/src/routes/user/protected/newsletter.ts`,
  `apps/admin/src/routes/_authed/newsletter/`) are completely separate today — different
  data models, different admin UIs, different audience concepts. The owner wants
  some level of unification, but the scope is undefined.

## 3. Goals (provisional — subject to change after discovery)

These goals reflect the owner's stated intent, not a committed design. Each is tagged
`[provisional]` and will be promoted to a concrete task list only after the discovery
phase and a likely spec split.

- **G-1 [provisional]** Fix settings enforcement: the dispatch pipeline, image
  pipeline, and GPT catalog endpoint must read runtime config from `social_settings`
  rows rather than env vars or in-code defaults.
- **G-2 [provisional]** Expand platform support beyond INSTAGRAM / FACEBOOK / X.
  Mechanism (native API vs. Make scenario vs. aggregator) to be decided in OQ-1.
- **G-3 [provisional]** Multi-format publishing: end-to-end support for TEXT_POST,
  VIDEO_POST, CAROUSEL, STORY (not just photo/image). Likely requires per-format
  Make.com scenarios or a per-format dispatch branch.
- **G-4 [functional design resolved, see OQ-5]** Batch draft creation from GPT:
  chained single-draft submissions in one conversation (not a bulk array endpoint),
  each optionally carrying an explicit campaign/batch name that the backend resolves
  or creates.
- **G-5 [functional design resolved, see OQ-6]** Campaign/batch auto-detection:
  explicit-declaration flow (operator names the batch, GPT fuzzy-checks for
  near-duplicates before creating) as the primary path; implicit fallback where the
  GPT reasons over the catalog's active-campaigns/batches list and proposes/asks
  when no explicit name was given. Detection logic lives in the GPT's own reasoning,
  not backend heuristics — backend exposes the active list and an idempotent
  resolve-or-create by name/slug.
- **G-6 [provisional]** Config export: a single admin page exports the GPT OpenAPI
  schema AND the Make.com payload spec + webhook configuration in a form the operator
  can paste directly, without further manual editing.
- **G-7 [provisional]** Dashboard improvements: date-range picker on dashboard KPIs,
  per-platform breakdown chart, thumbnail column on the posts list table.
- **G-8 [functional design resolved, see OQ-8]** Platform multi-select in composer:
  creating a post fans out to N target rows on save, sharing the base caption by
  default with optional per-platform override. Pure UI work — the target-level
  override columns already exist in the schema.
- **G-9 [provisional]** Icon audit + migration: replace all inline SVG / direct
  phosphor imports in social module components with `@repo/icons` references.
- **G-10 [provisional]** Pull public Hospeda data: define a safe, rate-limited path
  for the admin composer (or GPT endpoint) to query `/api/v1/public/*` for entity
  data to enrich drafts. Scope constrained to read-only public endpoints only.
- **G-11 [provisional]** Newsletter unification: determine what "unify" means
  (shared composer, shared scheduling, shared audience, or a common marketing hub
  route in the admin) and implement the agreed scope. Likely becomes its own sub-spec.

## 4. Non-Goals (provisional)

- Full marketing analytics platform (Metabase, PostHog, etc.) — Hospeda is not
  building a BI tool.
- Real-time social listening or comment reply (no inbound social API integration).
- Direct publishing without Make.com (unless OQ-1 decides to adopt a native
  per-platform API approach, which would itself become a sub-spec).
- Billing gates on social features — social is an internal operator tool, not a
  host-facing entitlement. If this changes, it needs a separate spec.
- Migrating the newsletter from its current stack to a new transport layer (scoped
  out unless OQ-5 explicitly expands it).

## 5. Current state — key files

The existing system is fully implemented and in staging. Key anchors:

### API layer (`apps/api/src/routes/social/`)

66 route files across: `admin/posts/`, `admin/batches/`, `admin/campaigns/`,
`admin/hashtags/`, `admin/hashtag-sets/`, `admin/footers/`, `admin/platform-formats/`,
`admin/audiences/`, `admin/settings/` (list + patch-by-key), `admin/publish-logs/`,
`admin/dashboard/`, `admin/gpt-action-schema.ts`, plus `ai/` routes for GPT
ingest. The social routes mount under `/api/v1/admin/social/` and `/api/v1/ai/social/`.

### Service layer (`packages/service-core/src/services/social/`)

17 service files including `social-publish-dispatch.service.ts` (Make.com HTTP
dispatch + retry + cascade), `social-setting.service.ts` (key-value CRUD),
`social-image-pipeline.service.ts` (Cloudinary upload), `social-draft-ingestion.service.ts`,
`social-campaign.service.ts`, `social-content-batch.service.ts`.

### DB layer (`packages/db/src/schemas/social/` + `models/social/`)

18 Drizzle schemas: `social_posts`, `social_post_targets`, `social_platforms`,
`social_platform_formats`, `social_settings`, `social_campaigns`,
`social_content_batches`, `social_audiences`, `social_hashtags`, `social_hashtag_sets`,
`social_post_hashtags`, `social_post_footers`, `social_post_media`, `social_assets`,
`social_publish_logs`, `social_audit_log`, `social_ai_requests`.

### Admin UI (`apps/admin/src/routes/_authed/social/`)

Sections: `posts/`, `batches/`, `campaigns/`, `catalog/`, `footers/`, `hashtags/`,
`platform-formats/`, `settings/`, `audiences/`, plus `index.tsx` (marketing hub).
Hooks: `use-social-posts.ts`, `use-social-dashboard.ts`, `use-social-catalog.ts`,
`use-social-platform-settings.ts`.

### Newsletter (separate system)

API: `apps/api/src/routes/user/protected/newsletter.ts`, cron:
`apps/api/src/cron/jobs/newsletter-close-campaigns.job.ts`, worker:
`apps/api/src/workers/newsletter-dispatch.worker.ts`.
Admin: `apps/admin/src/routes/_authed/newsletter/` (campaigns + subscribers).
Schemas: `packages/schemas/src/entities/newsletter/`,
`packages/schemas/src/enums/newsletter-*.ts`.

### Integration env vars

- `HOSPEDA_AI_SOCIAL_KEY` — GPT inbound API key.
- `HOSPEDA_OPERATOR_PIN` / `HOSPEDA_OPERATOR_PIN_HASH` — GPT draft-submission PIN.
- `HOSPEDA_MAKE_API_KEY` — outbound key to Make.com webhook dispatch.
- `HOSPEDA_MAKE_INBOUND_KEY` — inbound key from Make.com claim/result callbacks.

## 6. Open Questions (rich — most must be resolved before design)

- **OQ-1 — Publishing mechanism for new platforms. [DECIDED 2026-07-02, discovery
  Step 2]** How should TikTok, LinkedIn, and others be
  integrated? Three candidate approaches, compared against the actual codebase:
  - **(a) One Make.com scenario per platform.** `social-publish-dispatch.service.ts`
    is already fully platform-agnostic (no `if (platform === ...)` branching anywhere
    in eligibility/payload/dispatch/retry/cascade) — this option is essentially free
    on the Hospeda code side. Caveat found: `SocialPlatformEnum` is a hardcoded
    3-value TS enum backing a real Postgres `pgEnum`, so adding a platform still needs
    a code change + a structural migration (`ALTER TYPE ... ADD VALUE`) before any DB
    rows can be inserted — not a pure DB-row operation as the draft implied. Lowest
    risk, fastest for 1-2 platforms; risk grows with scenario count/cost at scale.
  - **(b) Third-party aggregator (Ayrshare/Buffer/Publer).** Would replace the
    webhook-POST dispatch mechanism with an aggregator SDK call; `makeChannelKey`
    becomes vestigial. Recurring vendor cost (rough, needs live pricing check before
    committing budget) vs. Hospeda owning zero platform-API churn. Best if onboarding
    many platforms quickly.
  - **(c) Direct native API per platform.** Slowest (OAuth2 + token refresh + app
    review per platform), highest long-term engineering ownership, zero vendor
    dependency. Reserve for a platform needing deep non-standard control.
  No prior evaluation of any aggregator or native API exists anywhere in the repo —
  this is a clean-slate decision, not a revisit.
  **DECIDED 2026-07-02 — owner picked (a): one Make.com scenario per new platform.**
  G-2 sub-specs as a schema-extension-plus-scenario effort (SPEC-297b), not a
  platform-engineering project.

- **OQ-2 — Why don't settings apply today? [RESOLVED 2026-07-02, discovery Step 1]**
  Audited `social-setting.service.ts`, `social-publish-dispatch.service.ts`,
  `social-image-pipeline.service.ts`, and `apps/api/src/routes/ai/social/catalog.ts`.
  **The original premise was false**: all 7 seeded `social_settings` rows
  (`default_timezone`, `default_campaign_slug`, `default_batch_slug`,
  `max_hashtags_instagram/facebook/x`, `make_webhook_url`) ARE read at runtime, via
  two legitimate paths — the permission-gated `SocialSettingService` (admin CRUD
  routes only) and a direct `socialSettingModel` read (dispatch/cron/GPT-catalog,
  which run without an actor). None are orphaned.
  The real gap is narrower: (1) **genuine small bug** — `max_hashtags_*` settings
  are surfaced to the GPT as advisory text but have zero server-side enforcement in
  `social-draft-ingestion.service.ts` or any route; an operator changing the setting
  changes only what the LLM is told, not what the API accepts. (2) **not a bug, new
  scope** — retry count, Make webhook timeout, image download timeout, Cloudinary
  folder, and cron cadence were never modeled as `social_settings` rows at all (no
  seed entry exists); wiring these up is new design work, not a fix. (3)
  **architecture inconsistency worth a decision**: `make_webhook_url` is stored as a
  DB-backed secret in `social_settings`, while the sibling credential
  `HOSPEDA_MAKE_API_KEY` lives in an env var — two credentials for the same
  integration, two different storage strategies.
  **Verdict: G-1 is small-to-medium, weighted small** — not the "design gap" the
  spec draft assumed.

- **OQ-3 — What does "unify with newsletter" mean? [DECIDED 2026-07-02, discovery
  Step 3]** Four candidate levels, grounded in the
  actual schemas:
  - **(a) Shared marketing hub route.** Already ~90% done: the admin "Marketing"
    sidebar (SPEC-254, `apps/admin/src/config/ia/sidebars.ts`) already groups
    `/social/*` and `/newsletter/*` nav under one section. Only a shared `/marketing`
    landing page is missing. **Effort: ~half a day, not the "two hours" originally
    guessed but still trivial.**
  - **(b) Shared audience/subscriber list.** Structurally shaky: `social_audiences`
    is a content-targeting *label* table with no contact list behind it, while
    `newsletter_subscribers` is a real GDPR/Ley 25.326-audited contact list. Social
    reach is platform-follower-based, not subscriber-based — "audience" doesn't mean
    the same thing in both domains. This needs a design answer before it's buildable,
    not just a join table.
  - **(c) Shared campaign entity (`channel: 'social'|'email'`).** `social_campaigns`
    is a lightweight folder/label with no lifecycle; `newsletter_campaigns` is a full
    send-lifecycle entity (draft/sending/sent, `sentAt`, `totalRecipients`,
    compliance-relevant, referenced by `newsletter_campaign_deliveries`). A real merge
    risks the newsletter compliance audit trail if rushed — this is weeks of work,
    not a discriminator column.
  - **(d) Full composer unification.** Short-form multi-platform + hashtags/media vs.
    long-form rich-text email are fundamentally different content shapes with
    different renderers. Weeks-to-months, a genuine UX redesign, and its risk
    compounds whatever (c) resolves to.
  Zero code coupling exists today between the social and newsletter schemas/services
  (verified via grep).
  **DECIDED 2026-07-02 — owner picked (a): shared marketing hub route only.** (b),
  (c), (d) are explicitly deferred, not scoped into any current sub-spec — they would
  need their own future spec if revisited. G-11 is downsized to "add a `/marketing`
  landing page linking social + newsletter" and folds into SPEC-297c (composer +
  dashboard UX) rather than needing SPEC-297e as a separate newsletter-unification
  spec.

- **OQ-4 — What does "export GPT/MAKE config" mean exactly? [RESOLVED 2026-07-02,
  discovery Step 4 — mockup ready, folds into SPEC-297d]** Mockup produced: a new
  admin page/section "Integration Config Export" with two panels. Panel 1 (GPT)
  wraps the existing `/api/v1/admin/social/gpt-action-schema` endpoint (today it's a
  bare API route with no admin UI — operators curl it directly). Panel 2 (Make.com,
  the actually-missing piece) shows the webhook URL (from `social_settings.
  make_webhook_url`), the outbound headers Hospeda sends (`x-make-apikey`, masked),
  and a live JSON Schema of `SocialMakePayloadSchema` / `MakeWebhookResponseSchema`
  (both already exist, untouched, in
  `packages/schemas/src/entities/social/social-make-payload.schema.ts`) — generated
  the same programmatic way as the GPT export, not a static/hand-written doc, per
  Risk R-5. Requires one new endpoint (`GET /api/v1/admin/social/
  make-webhook-schema`, ~150 LOC mirroring `gpt-action-schema.ts`) + one new admin
  page + two small components. **Small, fits inside SPEC-297d as scoped — does not
  need its own spec.**
  **Side discrepancy found (unresolved, needs owner/eng confirmation, not
  investigated further here):** `apps/api/src/routes/integrations/make/social/jobs/
  claim.ts` and `result.ts` (inbound routes gated by `HOSPEDA_MAKE_INBOUND_KEY` /
  `x-hospeda-make-key`) look like leftovers from a pre-synchronous async design —
  `social-make-payload.schema.ts`'s own doc comment says callback URLs "have been
  removed" in favor of the current synchronous `Webhook Response` round-trip. If
  these routes are dead code, the export mockup's Panel 2 must NOT mention that
  header (would mislead the operator into wiring up a dead callback); if they're a
  live legacy/fallback path, that needs explaining. Flag for SPEC-297d
  implementation, not blocking the rest of this discovery.

- **OQ-5 — Batch GPT creation: chained or array? [RESOLVED 2026-07-02, functional
  design session]** Owner's real workflow: "vamos a hacer un batch de Lanzamiento
  2026" → then iteratively "armame otra" per draft, reviewing each as it comes. This
  workflow is inherently sequential (the operator can't know all N drafts upfront),
  so **option (a), chained `POST /api/v1/ai/social/drafts` calls, is the correct fit
  — not a cost tradeoff, a UX fit.** No new batch-array endpoint needed. Each
  submission in an active-batch conversation carries an explicit campaign/batch
  reference (name or slug); see OQ-6 for resolution + creation semantics.

- **OQ-6 — Campaign/batch auto-detection heuristics. [RESOLVED 2026-07-02,
  functional design session]** Two flows, both required for v1:
  1. **Explicit declaration (primary flow).** Operator states intent in the GPT
     conversation ("vamos a hacer un batch de Lanzamiento 2026"); every subsequent
     draft submission in that session carries the batch/campaign name. Backend
     resolves by slug: match → associate; no match → create. **Fuzzy-match guard
     before creating**: the GPT must first check the existing active
     campaigns/batches list for a near-duplicate name (e.g. operator says
     "Lanzamiento 26" when "Lanzamiento 2026" already exists) and ask the operator
     to confirm "use the existing one" vs. "create a new one" — never silently
     create a likely-duplicate. This detection is done by the GPT's own reasoning
     over the list (see below), not backend string-similarity code.
  2. **Implicit fallback (no explicit declaration).** Requires the GPT catalog
     endpoint (`/api/v1/ai/social/catalog`) to expose the **list of active
     campaigns and batches** (name, slug, description, date window) — today it only
     returns a single `default_campaign_slug`/`default_batch_slug`, not the active
     list; this is new scope, not existing plumbing. The GPT reasons semantically
     over that list against the draft's content: confident match → propose it to the
     operator for confirmation; unsure → ask, offering the list as options; no match
     / operator declines → draft ships unassociated. **Matching is LLM-side
     reasoning, not backend keyword/hashtag heuristics** — the backend's job is
     limited to exposing the active list and accepting an optional
     `campaignSlug`/`batchSlug` (create-if-new, per the fuzzy-match guard above) on
     draft submission.
  Campaigns and batches remain two distinct concepts (owner confirmed) — same table
  shape today, different semantics (campaign = thematic/ongoing, e.g. "Institucional
  Hospeda"; batch = time-boxed publishing sprint, e.g. "Hospeda Launch 2026-06",
  matching the owner's "Lanzamiento 2026" scenario). No schema merge.

- **OQ-7 — "Pull from hospeda.com.ar" scope. [DECIDED 2026-07-02]** Owner picked the
  server-side option: a new endpoint that aggregates/proxies multiple public-data
  sources into one call shaped for draft enrichment, rather than having the GPT call
  `/api/v1/public/*` piecemeal via its own Action chain. Centralizes the logic of
  which public data feeds a draft in one place (SPEC-297c). Functional shape (which
  entities, what triggers the pull, how it's surfaced in the composer) still needs
  definition — technical/API design deferred to SPEC-297c's own design phase.

- **OQ-8 — Platform multi-select UX. [RESOLVED 2026-07-02, functional design
  session]** Turns out this needs zero schema work: `social_post_targets` already
  has `captionOverride`, `hashtagsOverrideText`, and `footerOverride` (nullable —
  null means "inherit the parent post's `finalCaption`/`finalHashtagsText`/footer",
  set means "override for this platform only"), shipped in SPEC-254. This is a pure
  UI feature for SPEC-297b/c: multi-selecting platforms in the composer creates N
  target rows on save, all sharing the base caption by default; the operator can
  optionally customize one platform's text via a "customize for this platform"
  affordance (same pattern as Buffer/Hootsuite), which sets that target's
  `captionOverride`. No data model change needed.

- **OQ-9 — Should this spec be split, and how? [FINALIZED 2026-07-02, pending
  Linear allocation]** With OQ-1 and OQ-3 both decided, the split collapses from
  the originally-proposed 5 sub-specs to **4**, since OQ-3(a) removes the need for a
  standalone newsletter-unification spec:
  - **SPEC-297a — Settings enforcement fix** (G-1, small): add server-side
    enforcement of `max_hashtags_*` in draft ingestion; owner decision on which of
    the never-modeled knobs (retry count, timeouts, Cloudinary folder, cron cadence)
    are worth promoting to `social_settings` rows, if any.
  - **SPEC-297b — Publishing engine extension** (G-2, G-3, G-8; OQ-1 = Make.com
    scenario per platform): new platform enum values + migration + `social_platforms`/
    `social_platform_formats` rows per new platform, multi-format publishing
    (TEXT_POST/VIDEO_POST/CAROUSEL/STORY end-to-end), platform multi-select
    (API fan-out side).
  - **SPEC-297c — Composer + dashboard UX** (G-4, G-5, G-7, G-8 UI, G-9, G-10,
    downsized G-11): batch GPT draft creation (chained calls, resolved via OQ-5),
    campaign/batch auto-detection (explicit-name + fuzzy-duplicate guard + implicit
    catalog-driven fallback, resolved via OQ-6 — needs the catalog endpoint extended
    with the active campaigns/batches list), dashboard date-range + per-platform
    breakdown + thumbnails, composer multi-select UI, icon audit, public-data pull
    (G-10, server-side aggregation endpoint per OQ-7), and the downsized newsletter
    hub landing page (OQ-3 outcome).
  - **SPEC-297d — GPT/MAKE config export** (G-6): the Integration Config Export
    admin page mocked in discovery Step 4 — new `make-webhook-schema` endpoint +
    admin page. Should also close out R-6 (remove the confirmed-dead Make.com
    callback routes) before/alongside shipping, so the export never advertises a
    dead header.
  - A separate **small NOSPEC cleanup PR** (not a sub-spec) removes the R-6 dead
    code — independent of the above, can land anytime.
  Three open questions remain genuinely open going into SPEC-297b/c implementation:
  **OQ-5** (batch GPT creation: chained vs. new batch endpoint), **OQ-6** (campaign
  auto-detection heuristics), **OQ-7** ("pull from hospeda.com.ar" scope: GPT-side
  vs. server-side). These are implementation-detail decisions for each sub-spec's own
  design phase, not blockers to allocating the sub-specs now.

## 7. First Steps — Discovery Plan

> Phase 0 is RESEARCH and OWNER ALIGNMENT. No production code changes until the
> open questions above have binding answers and this spec has been split.

### Step 1 — Settings enforcement audit (1 session)

Read `social-publish-dispatch.service.ts`, `social-image-pipeline.service.ts`,
and the GPT catalog handler. Identify every place a configurable value (timezone,
max hashtags, webhook URL, retry count) is read. For each: is it reading from
`social_settings` or from an env var or hard-coded constant? Produce a gap list.
This answers OQ-2 and sizes G-1.

### Step 2 — Platform expansion feasibility (1 session + owner sync)

Research the Make.com approach (add a new scenario per platform) vs. a third-party
aggregator (Ayrshare/Buffer API pricing, reliability, rate limits, webhook model).
Produce a concise comparison (cost, time-to-market, maintenance overhead) and
present to the owner. Owner picks OQ-1. Then sub-spec the publishing engine.

### Step 3 — Newsletter unification scoping (owner sync)

Present the four unification levels from OQ-3 to the owner with a rough
effort estimate for each. Owner picks the level. If it is level (a), fold it
into SPEC-297c. If (b)+(c)+(d), open a dedicated sub-spec.

### Step 4 — GPT/MAKE export mockup (0.5 session)

Build a paper mockup of the config-export admin page: what does the Make.com payload
spec look like, what does the copy-paste block contain, does it auto-fill the API
URL and auth header from env? Present to owner. This answers OQ-4 and makes G-6
buildable.

### Step 5 — Spec split and number allocation

After Steps 1-4, produce the sub-specs (see OQ-9). Allocate numbers via
`task-master:spec-allocation`. Update this spec's status to `superseded` or
`draft-exploration` once the sub-specs are open and approved.

## 8. Risks

- **R-1 — Scope explosion.** This is eleven goals covering four distinct engineering
  domains (backend engine, admin UX, GPT integration, newsletter). Without a split
  it is unimplementable as a unit. The split must happen before any coding.
- **R-2 — Platform strategy decision.** OQ-1 is a product and cost decision, not a
  technical one. If the owner picks a third-party aggregator (Ayrshare/Buffer) it
  likely voids the current Make.com dispatch architecture and requires a new adapter
  layer. If they pick native APIs, every new platform is a separate OAuth integration.
  Wrong choice = months of rework.
- **R-3 — Settings enforcement may be deeper than a bug fix.** If the settings table
  was never wired up (only CRUD, no consumption), G-1 may require propagating
  `social_settings` reads through 5-6 service files. If every service was already
  reading from env vars by design, the correct fix might be to MOVE the source of
  truth to env vars and remove the key-value store, not wire it up. The audit in
  Step 1 decides.
- **R-4 — Newsletter unification data model.** If OQ-3 lands at level (c) or (d),
  the newsletter and social data models must be merged or bridged. Both are non-trivial
  schemas with active prod data. Any migration requires the two-carril (structural +
  data-migration) discipline and a careful rollout.
- **R-5 — Make.com export freshness.** The GPT OpenAPI schema endpoint is programmatic
  (generated from Zod schemas) and stays in sync automatically. A Make.com payload
  spec export that is hand-written or snapshot-based can drift. The right design is
  a programmatic export of the actual `SocialMakePayload` Zod schema as a JSON Schema
  document — which also serves as live documentation.
- **R-6 — Dead inbound-callback routes [CONFIRMED 2026-07-02, discovery follow-up].**
  `apps/api/src/routes/integrations/make/social/jobs/claim.ts` and `result.ts`
  (+ `SocialPublishDispatchService.handleMakeCallbackClaim`/
  `handleMakeCallbackResult`) are **confirmed dead-in-practice legacy code**, high
  confidence. Git history: commit `c73e036ca` (2026-06-22) added them for the
  original async-callback design; two days later `7b0dba8d8`/`5130b484e`
  (2026-06-24) replaced it with the current synchronous Make.com "Webhook Response"
  round-trip and explicitly removed `callbackClaimUrl`/`callbackResultUrl` from
  `SocialMakePayloadSchema` — but the callback routes/handlers were never deleted.
  Nothing in the current dispatch path (`social-publish-dispatch.job.ts` calls only
  `dispatchTarget`/`dispatchPostNow`) constructs a URL pointing at them.
  `packages/service-core/test/services/social/full-pipeline.integration.test.ts`
  already labels these test scenarios "(legacy)" and seeds state directly via SQL
  to exercise them, confirming the team already treats them as legacy. Caveat: a
  live Make.com scenario could theoretically still be hardcoded to call these URLs
  outside of the payload-driven config — not verifiable from the repo alone, worth
  a quick check in the Make.com dashboard before removal.
  **Action: schedule a small removal PR** (routes + handlers + `HOSPEDA_MAKE_INBOUND_KEY`
  registry entry) — not urgent enough to block SPEC-297d, but should land before or
  alongside it so the config-export UI never advertises the dead header.

## 9. Relationship to existing systems

- **SPEC-254 (Social Automation Backend, completed)** — the direct predecessor. This
  spec builds on top of it. All DB schema, service, route, and admin UI files
  referenced in Section 5 were created in SPEC-254. No code from SPEC-254 is
  deprecated by this spec at draft stage.
- **SPEC-295 (Versioned Seed Data Migrations, draft)** — if platform expansion adds
  new rows to `social_platforms` or `social_platform_formats`, those rows should be
  delivered as a versioned data-migration (SPEC-295 carril) rather than a one-off
  extras SQL file, once SPEC-295 ships.
- **Newsletter system** — `packages/notifications/`, `apps/api/src/routes/user/
  protected/newsletter.ts`, `apps/admin/src/routes/_authed/newsletter/`. Potentially
  in scope for G-11 / OQ-3; not to be touched until unification scope is locked.
- **`@repo/icons`** — G-9 is a pure consumer: replace inline SVG / direct phosphor
  imports in social admin components with `@repo/icons` wrappers. No icons package
  changes required.
- **Public API (`/api/v1/public/*`)** — G-10 reads from these endpoints. No changes
  to the public API are expected; this is a consumer relationship.

## 10. Revision History

- 2026-06-27 — Initial discovery-first draft (SPEC-297 allocated). Captured owner's
  full wish-list as eleven provisional goals across four engineering domains. Anchored
  in the SPEC-254 completed codebase. Nine open questions raised (OQ-1..9); five-step
  discovery plan defined. No owner alignment or design decisions made yet — the first
  deliverable is the research phase described in Section 7. This spec is expected to
  be split into 3-5 sub-specs before implementation begins.
- 2026-07-02 — Discovery Step 1 (settings enforcement audit) complete. OQ-2 resolved:
  original premise wrong, all seeded settings are read; real gap is one small
  server-side enforcement bug (`max_hashtags_*`) plus unmodeled config knobs that are
  new scope, not bugs. G-1 sized small-to-medium. See OQ-2 above for full detail.
- 2026-07-02 — Discovery Steps 2-4 complete (research only, no code changes). OQ-1
  researched: dispatch service is already platform-agnostic, option (a) is cheapest
  but `SocialPlatformEnum` needs a code+migration change per platform (not pure DB
  rows as assumed); owner decision on (a)/(b)/(c) still pending. OQ-3 researched:
  nav-level hub unification (level a) already ~90% shipped via SPEC-254's Marketing
  sidebar; levels (b)/(c)/(d) hit real structural mismatches (audience-as-label vs.
  audience-as-contacts, campaign-as-folder vs. campaign-as-send-lifecycle); findings
  support "start with (a), defer rest" but owner confirmation still pending. OQ-4
  resolved: config-export mockup produced, small enough to fold into SPEC-297d as
  scoped, no new sub-spec needed; surfaced a possible dead-code discrepancy in
  Make.com inbound callback routes (R-6), unresolved. All four research steps of
  Section 7 are now complete; Step 5 (spec split + number allocation) is blocked on
  the owner picking OQ-1 and confirming OQ-3/OQ-9.
- 2026-07-02 — Owner decisions: OQ-1 = (a) Make.com scenario per platform. OQ-3 =
  (a) shared marketing hub route only, (b)/(c)/(d) deferred indefinitely. OQ-7 =
  (b) new server-side aggregation endpoint for public Hospeda data, not GPT-side
  direct calls. Split finalized to 4 sub-specs (297a-d), see OQ-9. R-6 confirmed as
  dead code via git-history investigation (commits `c73e036ca` then
  `7b0dba8d8`/`5130b484e`), scheduled for a small NOSPEC removal PR.
- 2026-07-02 — Functional design session resolved OQ-5 and OQ-6 together: the
  owner's real batch-creation workflow (declare batch by name in the GPT
  conversation, then iteratively request one draft at a time) is inherently
  sequential, making the chained-calls option the correct fit for G-4 (not a cost
  tradeoff). G-5 auto-detection confirmed required for v1: explicit-name resolution
  with a fuzzy-duplicate confirmation step, plus an implicit fallback where the GPT
  reasons over an active-campaigns/batches list (new catalog scope) rather than the
  backend running keyword/hashtag heuristics. Campaigns and batches confirmed as
  staying two distinct concepts despite identical table shape. OQ-8 also resolved
  in the same session: `social_post_targets.captionOverride`/
  `hashtagsOverrideText`/`footerOverride` already support per-platform
  customization (shipped SPEC-254, previously unnoticed) — multi-select is a pure
  UI feature, no schema work. All 9 open questions are now resolved; discovery
  phase (Section 7) is complete.
- 2026-07-02 — Step 5 complete. Allocated 4 sub-spec Linear issues and
  `.specs/` folders: HOS-64 (Settings Enforcement Fix), HOS-65 (Publishing Engine
  Extension), HOS-66 (Composer + Dashboard UX), HOS-67 (GPT/MAKE Config Export).
  This spec is marked `superseded` — it remains as the discovery record; all
  further implementation happens against the 4 sub-specs.
