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

- G-2: Add new platform(s) (owner-prioritized, e.g. LinkedIn first) via the
  Make.com-scenario-per-platform mechanism (OQ-1 decided). Each new platform needs:
  a `SocialPlatformEnum` code change, a Drizzle structural migration (`ALTER TYPE
  ... ADD VALUE` — this is a real Postgres enum, not a pure DB-row operation), new
  `social_platforms` rows, new `social_platform_formats` rows per supported format,
  and the Make.com scenario itself (external, not code).
- G-3: Multi-format publishing end-to-end for `TEXT_POST`/`VIDEO_POST`/`CAROUSEL`/
  `STORY` — verify/extend `buildMakePayload()` and the image/media pipeline for
  each format's media requirements (video upload constraints, carousel multi-asset
  handling, story-specific fields).
- G-8 (API side): platform multi-select fan-out — when a post targets N platforms,
  create N `social_post_targets` rows on save. No schema change needed —
  `captionOverride`/`hashtagsOverrideText`/`footerOverride` already exist per-target
  (shipped SPEC-254) for optional per-platform customization.

## 4. Non-goals

- NG-1: Third-party aggregator (Ayrshare/Buffer) or native per-platform API
  integration — OQ-1 decided on the Make.com-scenario approach; those alternatives
  are explicitly out of scope unless revisited in a future spec.
- NG-2: Composer UI for multi-select and per-platform caption editing — that UI
  work lives in SPEC-297c (HOS-66), this spec is the API/data-model side only.
- NG-3: Newsletter unification — out of scope (see SPEC-297c for the downsized
  hub-link goal).

## 5. Current baseline

- `packages/service-core/src/services/social/social-publish-dispatch.service.ts` —
  already fully platform-agnostic: no `if (platform === ...)` branching in
  eligibility, payload build, HTTP dispatch, retry/cascade, or recurrence logic.
- `SocialPlatformEnum` (`packages/schemas/src/enums/social-platform.enum.ts`) —
  hardcoded 3-value TS enum backing a real Postgres `pgEnum` (`social_platform_enum`)
  used by `social_platforms` and `social_platform_formats`.
- `social_post_targets.captionOverride`/`hashtagsOverrideText`/`footerOverride` —
  nullable per-target override columns already exist; null means "inherit from
  parent post."
- No prior evaluation of Ayrshare/Buffer/Publer or native platform APIs exists
  anywhere in the repo — clean-slate decision, already made (OQ-1 = Make.com).

## 6. Proposed design

**Platform addition**: extend `SocialPlatformEnum`, generate the structural
migration (`db:generate`/`db:migrate`), seed new `social_platforms`/
`social_platform_formats` rows (via SPEC-295's versioned data-migration carril once
available, per HOS-13 Section 9 — otherwise a one-off extras SQL file in the
interim), configure the Make.com scenario externally.

**Multi-format**: audit `buildMakePayload()` and
`social-image-pipeline.service.ts` per new format's media constraints (video
duration/size limits, carousel asset count, story aspect ratio) and extend as
needed — this is a per-format verification pass, not a rewrite, since the
dispatch/payload layer is already generic.

**Multi-select fan-out**: extend whatever API endpoint creates `social_posts` to
accept an array of `platformFormatId`s and create one `social_post_targets` row per
entry, all defaulting to inherit-from-parent (`captionOverride: null`, etc.).

## 7. Data model / contracts

- Migration: `ALTER TYPE social_platform_enum ADD VALUE '<NEW_PLATFORM>'` per new
  platform (Carril 1, Drizzle-generated).
- New `social_platforms` / `social_platform_formats` rows per platform+format
  combination — data migration, not structural.
- Draft/post creation endpoint contract: accepts `platformFormatIds: string[]`
  (was likely a single ID before — confirm during design) for fan-out.

## 8. UX / UI behavior

None directly (API/data-model spec) — composer UI consuming this is SPEC-297c.

## 9. Acceptance criteria

- AC-1: At least one new platform (owner-prioritized) is selectable end-to-end:
  DB row exists, `social_platform_formats` configured, dispatch successfully
  publishes via its Make.com scenario in a staging smoke test.
- AC-2: At least one non-photo format (owner-prioritized, e.g. `VIDEO_POST` or
  `CAROUSEL`) publishes end-to-end via the existing dispatch pipeline.
- AC-3: Creating a post with N `platformFormatId`s produces exactly N
  `social_post_targets` rows, each independently trackable through the pipeline
  (e.g. one can be `PUBLISHED` while another is `FAILED`).

## 10. Risks

- R-1 (from HOS-13 R-2): platform strategy was a product/cost decision, now
  resolved (Make.com scenarios) — no longer open, but implementation should
  confirm Make.com's app library actually has a mature connector for the chosen
  platform (e.g. LinkedIn) before committing scenario-build time.
- R-2: multi-format media constraints (video size/duration, carousel asset limits)
  are platform-specific and may require per-platform Cloudinary transform presets
  not yet configured.

## 11. Open questions

- None blocking — platform prioritization (which platform first: LinkedIn vs.
  TikTok) is an implementation-time owner input, not a spec-blocking decision.

## 12. Implementation notes

Follow the two-carril migration discipline (`packages/db/CLAUDE.md`): the enum
value addition is Carril 1 (structural), any seed data for new platform/format
rows should go through SPEC-295's versioned data-migration mechanism once
available (see HOS-13 Section 9 relationship note).

## 13. Linear

Canonical tracking:
HOS-65
