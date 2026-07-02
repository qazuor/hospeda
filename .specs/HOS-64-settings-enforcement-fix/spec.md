---
title: Social Posts — Settings Enforcement Fix
linear: HOS-64
statusSource: linear
created: 2026-07-02
type: fix
areas:
  - content
  - api
---

# Social Posts — Settings Enforcement Fix

> Sub-spec of [HOS-13](https://linear.app/hospeda-beta/issue/HOS-13) (Social Posts
> Module Overhaul), split "297a" per the discovery phase. See
> `.specs/HOS-13-social-posts-module-overhaul/spec.md` OQ-2/G-1 for the full audit
> that produced this scope.

## 1. Summary

The discovery audit for HOS-13 found the original premise wrong: all 7 seeded
`social_settings` rows ARE read at runtime. The real gap is narrower — one genuine
server-side enforcement bug, plus an open scope question about which never-modeled
config knobs are worth exposing as settings.

## 2. Problem

`max_hashtags_instagram/facebook/x` settings are read and surfaced to the GPT as
advisory text via `/api/v1/ai/social/catalog`, but nothing enforces them
server-side. An operator changing the setting changes only what the LLM is told,
not what the API accepts — a draft with more hashtags than the configured max is
still ingested without error.

Separately, `MAX_RETRY_COUNT` (3), `MAKE_WEBHOOK_TIMEOUT_MS` (40_000),
`DOWNLOAD_TIMEOUT_MS` (15_000), `SOCIAL_ASSETS_FOLDER`, and the dispatch cron
cadence (`*/5 * * * *`) are hard-coded constants with no corresponding
`social_settings` row — this isn't broken plumbing, it's config that was never
modeled as operator-configurable.

## 3. Goals

- G-1: Add server-side validation in `social-draft-ingestion.service.ts` (or the
  relevant route) that rejects/truncates a draft's hashtag count against the
  `max_hashtags_<platform>` setting for each target platform.
- G-2: Decide, with the owner, which of the hard-coded constants (retry count,
  webhook timeout, image download timeout, Cloudinary folder, cron cadence) should
  be promoted to `social_settings` rows. Not all of them necessarily should be —
  some may be intentionally fixed operational parameters.
- G-3 (architecture note, decide during implementation): `make_webhook_url` is
  stored as a DB-backed secret in `social_settings`, while the sibling credential
  `HOSPEDA_MAKE_API_KEY` lives in an env var. Confirm whether to leave this
  asymmetry (it may be intentional — the service's own JSDoc says "NEVER read env
  inside service-core") or align the two.

## 4. Non-goals

- NG-1: Building new UI for settings management — the CRUD admin page
  (`social/settings/`) already exists and is unaffected.
- NG-2: Migrating any settings currently read correctly (webhook URL, timezone,
  campaign/batch default slugs) — those already work end-to-end.

## 5. Current baseline

- `packages/service-core/src/services/social/social-setting.service.ts` —
  permission-gated CRUD (`SOCIAL_SETTINGS_MANAGE`), used only by admin routes.
- Raw `socialSettingModel` reads happen in `social-publish-dispatch.service.ts` and
  `apps/api/src/routes/ai/social/catalog.ts` (no-actor contexts: cron/system/API-key).
- `packages/seed/src/required/socialAutomation.seed.ts:300-351` seeds exactly 7
  `social_settings` rows; all 7 are read somewhere.
- Hashtag count validation gap: confirmed via repo-wide grep for
  `maxHashtags`/`max_hashtags` — zero hits outside `catalog.ts`.

## 6. Proposed design

Add a validation step in the draft ingestion path: for each target platform on an
incoming draft, look up `max_hashtags_<platform>` from `social_settings` (reuse the
existing raw-model read pattern already used by `catalog.ts`, since ingestion also
runs in a no-actor GPT/API-key context) and reject or truncate hashtags beyond that
count, returning a clear validation error to the GPT caller.

For G-2/G-3, this is an implementation-time owner conversation, not a pre-decided
design — do not silently wire all 5 knobs into `social_settings` without asking
which ones the owner actually wants exposed.

## 7. Data model / contracts

No schema changes expected for G-1 (uses existing `social_settings` rows). If G-2
promotes any hard-coded constant to a setting, that's an additive
`social_settings` seed row — no migration needed (key-value table).

## 8. UX / UI behavior

None for G-1 (backend-only validation). If G-2 adds new setting keys, they appear
automatically in the existing settings admin CRUD UI (generic key-value editor).

## 9. Acceptance criteria

- AC-1: Submitting a draft with hashtags exceeding the configured
  `max_hashtags_<platform>` for any target platform is rejected (or truncated —
  decide during design) with a clear error, not silently accepted.
- AC-2: A regression test reproduces the current bug (over-limit hashtags
  currently accepted) before the fix, per this repo's bug-fix testing convention.
- AC-3: Owner has explicitly confirmed which (if any) of the 5 hard-coded knobs
  from G-2 are promoted to settings; undecided knobs are documented as
  intentionally-fixed, not left ambiguous.

## 10. Risks

- R-1: If G-2 promotes the retry count or webhook timeout to a runtime setting, a
  misconfigured value could degrade dispatch reliability — validate bounds
  (e.g. min/max retry count) if these become editable.

## 11. Open questions

- None outstanding — G-2's specific knob list is an implementation-time
  conversation with the owner, not a blocking design question.

## 12. Implementation notes

Reuse the raw-model settings read pattern already established in
`catalog.ts`/`social-publish-dispatch.service.ts` (no-actor context) rather than
`SocialSettingService` (permission-gated, admin-only) for any new enforcement
code in the ingestion path.

## 13. Linear

Canonical tracking:
HOS-64
