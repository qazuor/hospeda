---
specId: SPEC-297
title: Social Posts Module Overhaul
type: feat
complexity: high
status: draft
created: 2026-06-27
tags: [social-posts, marketing, integrations, admin, newsletter, ai]
---

# SPEC-297 — Social Posts Module Overhaul

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
- **G-4 [provisional]** Batch draft creation from GPT: a single GPT call can submit
  N drafts (sequential or parallel array); the API ingests all and returns N draft
  IDs with per-draft warnings.
- **G-5 [provisional]** Campaign/batch auto-detection: the ingestion service scans
  incoming draft metadata for campaign/batch signals and, when confident, suggests
  (or auto-assigns) the association. Exact trigger TBD in OQ-2.
- **G-6 [provisional]** Config export: a single admin page exports the GPT OpenAPI
  schema AND the Make.com payload spec + webhook configuration in a form the operator
  can paste directly, without further manual editing.
- **G-7 [provisional]** Dashboard improvements: date-range picker on dashboard KPIs,
  per-platform breakdown chart, thumbnail column on the posts list table.
- **G-8 [provisional]** Platform multi-select in composer: creating a post fans out
  to multiple platforms at once; UI and API must support simultaneous target creation.
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

- **OQ-1 — Publishing mechanism for new platforms.** How should TikTok, LinkedIn,
  and others be integrated? Three candidate approaches: (a) one Make.com scenario per
  platform, adding new scenarios as platforms are onboarded; (b) a third-party
  aggregator (Buffer, Ayrshare, Publer) that abstracts platform APIs behind one
  endpoint, replacing or wrapping Make.com; (c) direct native API integration
  per platform (Meta Graph API for Instagram/Facebook, LinkedIn API, TikTok for
  Developers). Each carries radically different complexity, cost, and maintenance
  burden. **Owner decision required.** This answer determines whether G-2 is a
  one-week schema extension or a multi-month platform engineering effort.

- **OQ-2 — Why don't settings apply today?** The `social_settings` table and PATCH
  endpoint exist, but it is not confirmed whether `social-publish-dispatch.service.ts`,
  `social-image-pipeline.service.ts`, or the GPT catalog endpoint actually READ from
  that table at runtime. Investigation needed: are settings only stored, never
  consumed? Or are they consumed but a code path bypasses them? The answer determines
  whether G-1 is a bug fix (trivial) or a design gap (medium effort).

- **OQ-3 — What does "unify with newsletter" mean?** At minimum it could be a shared
  nav/marketing hub in the admin. At maximum it could be a merged data model with
  shared scheduling, shared audience segmentation, shared composer, and a unified
  campaign concept spanning both social posts and email. The former is two hours of
  routing work; the latter is a multi-spec project. The owner must draw the line.
  Candidates: (a) shared marketing hub route only (nav unification); (b) shared
  audience/subscriber list so social campaigns can target newsletter subscribers;
  (c) shared campaign entity with `channel: 'social' | 'email'`; (d) full composer
  unification. Recommendation: start with (a), defer (b)+(c)+(d) to a sub-spec.

- **OQ-4 — What does "export GPT/MAKE config" mean exactly?** The GPT OpenAPI schema
  endpoint (`/api/v1/admin/social/gpt-action-schema`) already exists. What is missing
  on the Make.com side? Is the export a downloadable JSON spec of the Make.com
  webhook payload schema? A copy-paste block with the webhook URL, expected headers,
  and payload shape? A how-to page? This needs a concrete mockup before the export
  UI is built.

- **OQ-5 — Batch GPT creation: chained or array?** Two sub-options for G-4: (a) the
  GPT calls `POST /api/v1/ai/social/drafts` N times in sequence (one call per draft,
  GPT-side chaining via Custom GPT Actions); (b) a new `POST /api/v1/ai/social/
  drafts/batch` endpoint accepts an array of drafts and returns an array of results.
  Option (a) requires no API changes but is slower and more GPT-prompt-engineering-
  heavy. Option (b) requires a new endpoint, a bulk ingestion service method, and
  transactional atomicity decisions (fail all vs. fail individual). Which does the
  owner prefer?

- **OQ-6 — Campaign/batch auto-detection heuristics.** G-5 requires the ingestion
  service to detect whether an incoming draft belongs to a campaign or batch. What
  signals are reliable? Hashtag overlap with existing campaigns? Caption keyword
  matching? An explicit `batch_hint` / `campaign_hint` field in the GPT payload?
  Or a pure UI affordance (GPT suggests, admin confirms, no automatic assignment)?
  Automatic assignment is risky if wrong; confirmation-only is safe but adds friction.

- **OQ-7 — "Pull from hospeda.com.ar" scope.** The owner wants the admin or GPT to
  query live public Hospeda data. The safest interpretation is: the GPT calls
  existing `/api/v1/public/*` endpoints (already authenticated as admin) before
  drafting. The more ambitious interpretation is a server-side web-scrape or
  structured data extract from the public web app. Which is intended? And is this
  a GPT-side feature (the GPT calls the API directly as part of its Action chain)
  or a server-side feature (a new endpoint that proxies or aggregates public data)?

- **OQ-8 — Platform multi-select UX.** G-8 asks for multi-platform selection in the
  composer. Today `social_post_targets` is one row per platform-format. Multi-select
  means the composer creates N target rows on save. Does it also need per-platform
  caption customisation (Instagram caption vs. X caption may need different lengths)?
  Or is the caption shared across all targets? This affects the data model and the
  form layout significantly.

- **OQ-9 — Should this spec be split, and how?** Recommended split (see Section 7):
  (a) SPEC-297a: Settings enforcement bug fix (G-1, small); (b) SPEC-297b: Publishing
  engine extension — new platforms, new formats, multi-select (G-2, G-3, G-8,
  depends on OQ-1); (c) SPEC-297c: Composer and dashboard UX (G-4, G-5, G-7, G-8
  UI, G-9, G-10); (d) SPEC-297d: GPT/MAKE config export (G-6, G-4); (e) SPEC-297e:
  Newsletter unification (G-11, depends on OQ-3). Owner must confirm or reshape the
  split before any implementation starts.

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
