# HOS-65: Social Posts — Publishing Engine Extension

## Progress: 0/28 tasks (0%)

**Average Complexity:** 2.18/3 (max)
**Critical Path:** T-003 -> T-004 -> T-011 -> T-012 -> T-018 -> T-023 (5 steps; tied with T-003 -> T-004 -> T-005 -> T-006 -> T-019 -> T-027)
**Parallel Tracks:** 8 independent starting points at Level 0

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Add LINKEDIN and TIKTOK to SocialPlatformEnum
  - Add 2 enum members + JSDoc + fix stale schema comment
  - Blocked by: none
  - Blocks: T-002, T-009, T-010

- [ ] **T-002** (complexity: 2) - Generate Drizzle migration for social_platform_enum ADD VALUE
  - ALTER TYPE ADD VALUE, same pattern as 0033/0043 permission_enum migrations
  - Blocked by: T-001
  - Blocks: T-009, T-010, T-028

- [ ] **T-003** (complexity: 3) - Create social_post_target_media link table schema
  - Many-to-many link table (targetId x mediaId + position), NOT a column on social_post_media
  - Blocked by: none
  - Blocks: T-004

- [ ] **T-004** (complexity: 2) - Generate Drizzle migration for social_post_target_media table
  - CREATE TABLE + composite unique index + per-FK indexes (additive, new table)
  - Blocked by: T-003
  - Blocks: T-005, T-011

- [ ] **T-005** (complexity: 3) - Write fan-out backfill script for social_post_target_media
  - INSERT...SELECT...JOIN fanning each existing media row out to every target on its post
  - Blocked by: T-004
  - Blocks: T-006

- [ ] **T-006** (complexity: 1) - Run and verify the social_post_target_media backfill on local/staging data
  - Run db:migrate, verify row counts + idempotency of ON CONFLICT DO NOTHING
  - Blocked by: T-005
  - Blocks: T-019

- [ ] **T-007** (complexity: 2) - Add GptVideoPayloadSchema for video ingestion
  - Mirrors GptImagePayloadSchema, public_url mode only
  - Blocked by: none
  - Blocks: T-008, T-013

- [ ] **T-008** (complexity: 2) - Extend SocialDraftTargetSchema with optional per-target assets field
  - Additive-only; legacy root `image` field stays as fallback
  - Blocked by: T-007
  - Blocks: T-014

### Core Phase

- [ ] **T-009** (complexity: 1) - Seed social_platforms rows for LinkedIn and TikTok
  - Blocked by: T-001, T-002
  - Blocks: T-028

- [ ] **T-010** (complexity: 2) - Seed social_platform_formats rows for LinkedIn and TikTok
  - LinkedIn TEXT_POST+VIDEO_POST, TikTok VIDEO_POST; fixes stale "13 rows" doc comment
  - Blocked by: T-001, T-002
  - Blocks: T-024, T-028

- [ ] **T-011** (complexity: 2) - Link processed images to their target via social_post_target_media
  - After creating the social_post_media row, insert a social_post_target_media link row
  - Blocked by: T-004
  - Blocks: T-012, T-013

- [ ] **T-012** (complexity: 3) - Add processImages N-asset method to SocialImagePipelineService
  - CAROUSEL support: sequential positions on media row + link row, per-asset graceful failure
  - Blocked by: T-011
  - Blocks: T-018

- [ ] **T-013** (complexity: 3) - Add processVideo method to SocialImagePipelineService
  - VIDEO_POST support: mediaType=VIDEO, persists durationSeconds, creates link row
  - Blocked by: T-011, T-007
  - Blocks: T-018, T-021

- [ ] **T-014** (complexity: 2) - Add resolveTargetAssets pure helper
  - Resolves a target's own assets vs legacy-image fallback vs empty (TEXT_POST)
  - Blocked by: T-008
  - Blocks: T-018

- [ ] **T-015** (complexity: 3) - Add resolveTargetMediaUrls pure helper (format-aware media selection)
  - TEXT_POST->0, STORY->1, VIDEO_POST->1, CAROUSEL->N, + post-level fallback
  - Blocked by: none
  - Blocks: T-019

- [ ] **T-016** (complexity: 3) - Extend UploadOptions with an optional transform preset param
  - Additive, optional; zero behavior change for existing callers
  - Blocked by: none
  - Blocks: T-021

- [ ] **T-017** (complexity: 1) - Add video and story Cloudinary preset constants config util
  - Blocked by: none
  - Blocks: T-021

### Integration Phase

- [ ] **T-018** (complexity: 3) - Wire ingestion service to process assets per-target through the pipeline
  - Replaces the single processImage call with a per-target loop, each asset gets its own link row
  - Blocked by: T-012, T-013, T-014
  - Blocks: T-023, T-024, T-026

- [ ] **T-019** (complexity: 3) - Rewrite buildMakePayload media resolution to be per-target and format-aware
  - THE core gap fix — joins through social_post_target_media instead of a column filter
  - Blocked by: T-006, T-015
  - Blocks: T-023, T-024, T-026, T-027

- [ ] **T-020** (complexity: 2) - Wire caption/hashtags/footer override columns into buildMakePayload
  - Makes captionOverride/hashtagsOverrideText/footerOverride live (were dead code)
  - Blocked by: none
  - Blocks: T-025, T-027

- [ ] **T-021** (complexity: 3) - Apply video and story Cloudinary presets in the upload paths
  - Blocked by: T-016, T-017, T-013
  - Blocks: T-024

### Testing Phase

- [ ] **T-022** (complexity: 2) - Write AC-3 regression test for N independently-trackable targets
  - G-8 fan-out already implemented — this is ONLY the missing regression test
  - Blocked by: none
  - Blocks: none

- [ ] **T-023** (complexity: 3) - Integration test: STORY format end-to-end publish (AC-2 part 1)
  - Asserts a scoped social_post_target_media link row exists + no cross-target leak
  - Blocked by: T-018, T-019
  - Blocks: none

- [ ] **T-024** (complexity: 3) - Integration test: VIDEO_POST format end-to-end on LinkedIn/TikTok (AC-2 part 2)
  - Blocked by: T-018, T-019, T-021, T-010
  - Blocks: none

- [ ] **T-025** (complexity: 2) - Integration test: AC-4 override inheritance
  - Blocked by: T-020
  - Blocks: none

- [ ] **T-026** (complexity: 2) - Integration test: media isolation across co-targets on one post
  - Blocked by: T-018, T-019
  - Blocks: none

### Docs Phase

- [ ] **T-027** (complexity: 1) - Document the per-target media model and override wiring
  - Documents the link table, why it was chosen over a column, and the fan-out backfill
  - Blocked by: T-019, T-020
  - Blocks: none

- [ ] **T-028** (complexity: 1) - Configure Make.com scenarios for LinkedIn/TikTok and run AC-1 staging smoke
  - External/manual — not code. AC-1 gate.
  - Blocked by: T-002, T-009, T-010
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003, T-007, T-015, T-016, T-017, T-020, T-022
Level 1: T-002, T-004, T-008, T-025
Level 2: T-005, T-009, T-010, T-011, T-014
Level 3: T-006, T-012, T-013, T-028
Level 4: T-018, T-019, T-021
Level 5: T-023, T-024, T-026, T-027

## Suggested Start

Begin with **T-001** (complexity: 1) - it has no dependencies, is trivial, and unblocks 3 other tasks (T-002, T-009, T-010) that kick off the entire G-2 platform-expansion track.

In parallel, **T-003** (complexity: 3) can start immediately too — it opens the critical path for the G-3 media-per-target rewrite (the core of this spec, now a `social_post_target_media` link table rather than a column) and should not wait on G-2 work.
