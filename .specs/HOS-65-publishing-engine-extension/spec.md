---
title: Social Posts — Publishing Engine Extension
linear: HOS-65
statusSource: linear
created: 2026-07-02
type: feature
areas:
  - content
  - api
  - db
---

# Social Posts — Publishing Engine Extension

> Sub-spec of [HOS-13](https://linear.app/hospeda-beta/issue/HOS-13) (Social Posts
> Module Overhaul), split "297b" per the discovery phase. See
> `.specs/HOS-13-social-posts-module-overhaul/spec.md` OQ-1/OQ-8/G-2/G-3/G-8 for
> the full research that produced this scope.

## 1. Summary

Extends the social publishing engine in three dimensions: new platforms (LinkedIn,
TikTok, etc.), multi-format publishing (beyond photo-based posts), and platform
multi-select fan-out (one post, multiple simultaneous targets).

## 2. Problem

Today `SocialPlatformEnum` supports only `INSTAGRAM`/`FACEBOOK`/`X`, and in
practice only photo-based formats are exercised end-to-end even though
`TEXT_POST`/`VIDEO_POST`/`CAROUSEL`/`STORY` exist in the schema. Composer UX only
targets one platform-format per post today.

## 3. Goals

> **Scope reframed 2026-07-04** after a baseline exploration pass (see §5) and
> owner decisions. The original G-3/G-8 framing under-scoped the real work; the
> corrected framing is below. Owner decisions: add **LinkedIn + TikTok** (both);
> AC-2 format coverage = **STORY + VIDEO_POST** (both); media model =
> **per-target** (structural migration, robust-to-future — not the "no schema
> change" the original draft assumed).

- G-2: Add **LinkedIn + TikTok** via the Make.com-scenario-per-platform mechanism
  (OQ-1 decided). Each new platform needs: a `SocialPlatformEnum` code change, a
  Drizzle structural migration (`ALTER TYPE ... ADD VALUE` — real Postgres enum,
  not a pure DB-row operation), new `social_platforms` rows, new
  `social_platform_formats` rows per supported format, and the Make.com scenario
  itself (external, not code).
- G-3 (**the core of this spec — a rewrite, not a verification pass**): make
  payload assembly **format-aware and per-target**. Today `buildMakePayload()`
  attaches media at the `social_posts` level and sends the identical `mediaUrls`
  array to every target regardless of its `publishFormat` (see §5). The work:
  - **Media per-target**: structural migration so media assets associate to
    `social_post_targets`, not the parent post — each target carries its own
    assets (owner chose the robust model over post-level filtering).
  - **Rewrite ingestion** (`social-image-pipeline.service.ts`) to handle N assets
    and video, not just a single image at `position 0`.
  - **Format-aware `buildMakePayload()`**: `TEXT_POST` → 0 media, `STORY` → 1
    vertical asset, `VIDEO_POST` → 1 video, `CAROUSEL` → N assets.
  - **Video pipeline**: Cloudinary transform presets for video
    duration/size/aspect constraints (R-2) + story-specific 9:16 fields.
  - **Wire the override columns**: `captionOverride`/`hashtagsOverrideText`/
    `footerOverride` exist per-target (SPEC-254) but are currently DEAD CODE — no
    writer, no reader. `buildMakePayload()` must read them (null = inherit).
- G-8 (API side): platform multi-select fan-out — **already implemented** in the
  baseline. `POST /api/v1/ai/social/drafts` accepts `targets: SocialDraftTargetSchema[]`
  and `SocialDraftIngestionService` already creates one `social_post_targets` row
  per target. Remaining work here is only an **AC-3 regression test** proving N
  independently-trackable targets.

## 4. Non-goals

- NG-1: Third-party aggregator (Ayrshare/Buffer) or native per-platform API
  integration — OQ-1 decided on the Make.com-scenario approach; those alternatives
  are explicitly out of scope unless revisited in a future spec.
- NG-2: Composer UI for multi-select and per-platform caption editing — that UI
  work lives in SPEC-297c (HOS-66), this spec is the API/data-model side only.
- NG-3: Newsletter unification — out of scope (see SPEC-297c for the downsized
  hub-link goal).

## 5. Current baseline

Verified by exploration pass 2026-07-04 (grep/read — no `.codegraph/` index in
this checkout despite CLAUDE.md's claim; future explorations here use grep/read).

- **Dispatch is genuinely platform-agnostic** — `social-publish-dispatch.service.ts`
  (1941 lines): zero `platform ===` / `publishFormat ===` matches. Eligibility,
  payload build, HTTP dispatch, retry/cascade, recurrence all operate on generic
  rows. Format-aware logic must live in `buildMakePayload()` / the media pipeline,
  NOT scattered through the dispatch/cascade state machine.
- `SocialPlatformEnum` (`packages/schemas/src/enums/social-platform.enum.ts:20-28`)
  — 3 values today (`INSTAGRAM`/`FACEBOOK`/`X`) backing pgEnum `social_platform_enum`
  (`packages/db/src/schemas/enums.dbschema.ts:319`), used by `social_platforms.platform`
  and `social_platform_formats.platform`.
- **G-8 fan-out already exists**: `POST /api/v1/ai/social/drafts`
  (`apps/api/src/routes/ai/social/drafts.ts`) validates `CreateSocialDraftSchema`
  → `targets: SocialDraftTargetSchema[]` (`packages/schemas/.../social-draft.http.schema.ts:212`);
  `SocialDraftIngestionService.ingestDraft` creates one `social_post_targets` row
  per valid target (`social-draft-ingestion.service.ts:539-549`). There is no
  separate admin "create post" route. Do NOT re-implement fan-out.
- **`buildMakePayload()` (`social-publish-dispatch.service.ts:717-784`) is the core
  gap**: it collects ALL `social_post_media` rows for the post (keyed by
  `socialPostId`, ordered by `position`) into a flat `mediaUrls: string[]` with NO
  per-format branching and NO per-target scoping. Two targets on one post get the
  identical media array — wrong for `TEXT_POST` (no media) and any format-specific
  asset requirement.
- **Media pipeline is single-image-only**: `social-image-pipeline.service.ts`
  ingests exactly one image at `position 0`, MIME-sniffs IMAGE/VIDEO, no
  carousel/multi-asset and no video-specific path.
- **Override columns are DEAD CODE**: `social_post_targets.captionOverride`/
  `hashtagsOverrideText`/`footerOverride` (`social_post_targets.dbschema.ts:35-40`,
  nullable) exist in schema + Zod but have zero writers/readers anywhere in
  `apps/api` or `service-core`. `buildMakePayload()` does not reference them.
- **Seed path**: `social_platforms`/`social_platform_formats` rows are seeded via
  the seed package (`packages/seed/src/required/socialAutomation.seed.ts` —
  `PLATFORMS` L135-139, `PLATFORM_FORMATS` L152-298, model-direct because
  `SocialPlatformFormatService._canCreate` throws FORBIDDEN by design), run under
  `pnpm seed --required`. New platform/format rows go here (or SPEC-295's versioned
  data-migration carril once available). Minor: seed doc comment says "13 rows",
  array is 12 — fix if touching.
- No prior evaluation of Ayrshare/Buffer/Publer or native platform APIs exists
  anywhere in the repo — clean-slate decision, already made (OQ-1 = Make.com).

## 6. Proposed design

**Platform addition (G-2)**: extend `SocialPlatformEnum` with `LINKEDIN` +
`TIKTOK`, generate the structural migration (`db:generate`/`db:migrate` →
`ALTER TYPE social_platform_enum ADD VALUE`), seed new `social_platforms` rows
(2) and `social_platform_formats` rows per supported format (LinkedIn:
`TEXT_POST`/`VIDEO_POST`; TikTok: `VIDEO_POST` — STORY is NOT offered for either,
neither platform supports it) in `socialAutomation.seed.ts`, configure the two
Make.com scenarios externally.

**Format-aware per-target payload (G-3 — core)**:

- **Media per-target migration**: associate media assets to `social_post_targets`
  instead of the parent `social_posts`. Each target owns its assets; the enum value
  additions and this association are both Carril 1 (structural).
- **Ingestion rewrite**: `social-image-pipeline.service.ts` accepts N assets and
  video (not just one image at `position 0`), placing them on the correct target.
- **`buildMakePayload()` branches on `publishFormat`**: `TEXT_POST` → 0 media,
  `STORY` → 1 vertical (9:16) asset, `VIDEO_POST` → 1 video, `CAROUSEL` → N assets;
  media is read from the target's own assets, not the whole post.
- **Wire override columns**: `buildMakePayload()` reads
  `captionOverride`/`hashtagsOverrideText`/`footerOverride` per target (null =
  inherit from parent post).
- **Video pipeline**: Cloudinary transform presets for video duration/size/aspect
  (R-2), story 9:16 fields.

**Multi-select fan-out (G-8)**: already implemented — see §5. No new endpoint work;
only an AC-3 regression test.

## 7. Data model / contracts

- Migration (Carril 1, Drizzle-generated): `ALTER TYPE social_platform_enum ADD
  VALUE 'LINKEDIN'` and `... ADD VALUE 'TIKTOK'`.
- Migration (Carril 1, structural): media↔`social_post_targets` association via a
  dedicated **`social_post_target_media` link table** (many-to-many: `targetId` ×
  `mediaId` + `position`). Chosen over an FK column so one asset can be shared by
  multiple targets (e.g. the same video on both the LinkedIn and TikTok target)
  without duplicating `social_post_media` rows. Backfill inserts one link row per
  existing post-level media, fanned out to each of that post's targets.
- New `social_platforms` (2) + `social_platform_formats` rows per platform+format —
  seed data (`socialAutomation.seed.ts`), not structural.
- Draft creation contract (`CreateSocialDraftSchema` → `targets:
  SocialDraftTargetSchema[]`): **already an array** in the baseline. May extend the
  per-target shape to carry its own asset references once media is per-target.

## 8. UX / UI behavior

None directly (API/data-model spec) — composer UI consuming this is SPEC-297c.

## 9. Acceptance criteria

- AC-1: **LinkedIn and TikTok** are each selectable end-to-end: `social_platforms`
  row exists, `social_platform_formats` configured, dispatch successfully publishes
  via each platform's Make.com scenario in a staging smoke test.
- AC-2: **STORY and VIDEO_POST** each publish end-to-end. STORY validates on
  Instagram/Facebook (the only platforms that support Stories); VIDEO_POST
  validates on LinkedIn/TikTok. Each carries the correct per-format media (STORY: 1
  vertical asset; VIDEO_POST: 1 video) and none leaks the wrong assets to a
  co-target on the same post.
- AC-3: Creating a post with N targets produces exactly N `social_post_targets`
  rows, each independently trackable (one can be `PUBLISHED` while another is
  `FAILED`) and each receiving only its own format-appropriate media.
- AC-4: A target with `captionOverride`/`hashtagsOverrideText`/`footerOverride` set
  publishes with the overridden values; a target with them null inherits from the
  parent post.

## 10. Risks

- R-1 (from HOS-13 R-2): platform strategy was a product/cost decision, now
  resolved (Make.com scenarios) — no longer open, but implementation should
  confirm Make.com's app library actually has a mature connector for the chosen
  platform (e.g. LinkedIn) before committing scenario-build time.
- R-2: multi-format media constraints (video size/duration, carousel asset limits)
  are platform-specific and may require per-platform Cloudinary transform presets
  not yet configured.

## 11. Open questions

- **Resolved 2026-07-04**: platforms = LinkedIn + TikTok (both); AC-2 formats =
  STORY + VIDEO_POST (both); media model = per-target via a dedicated
  `social_post_target_media` link table (many-to-many — one asset shareable across
  targets without row duplication).

## 12. Implementation notes

Follow the two-carril migration discipline (`packages/db/CLAUDE.md`): the enum
value addition is Carril 1 (structural), any seed data for new platform/format
rows should go through SPEC-295's versioned data-migration mechanism once
available (see HOS-13 Section 9 relationship note).

## 13. Linear

Canonical tracking:
HOS-65
