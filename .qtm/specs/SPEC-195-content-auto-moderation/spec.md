---
specId: SPEC-195
title: Content Auto-Moderation Engine
status: in-progress
complexity: medium
owner: qazuor
created: 2026-06-04
related:
  - SPEC-166 (review-moderation-state — origin; freezes the @repo/content-moderation public contract this spec implements)
---

# SPEC-195 — Content Auto-Moderation Engine

> **Status**: DRAFT — phase-2 stub. Spun off from SPEC-166 on 2026-06-04. Requires a full spec before implementation. This spec touches the **internals** of `@repo/content-moderation` ONLY — the public API is frozen by SPEC-166, so no consumer (reviews, messaging, future posts) changes here.

## 1. Origin

SPEC-166 introduces the `@repo/content-moderation` package with its public API in **final shape** but a **stub engine** inside (a binary substring word-list match wrapped to return a fake 0/1 score). Consumers (review services, messaging) are wired against the frozen contract:

```ts
moderateText(input: { text, context? }): Promise<{ score, categories, matchedTerms }>
```

This spec replaces the stub internals with a real engine. Because the contract does not change, the only diff is inside the package: callers stay untouched.

## 2. Goal

Make `moderateText` produce **meaningful, graded** moderation results so that the score-driven thresholds already wired in SPEC-166 begin yielding real `REJECTED` / `PENDING` / `APPROVED` decisions.

Two pillars:

1. **Real scoring engine** — per-category scores (spam, sexual, violence, hate, harassment, other), each 0..1, plus an overall `score`. Likely backed by the **OpenAI Moderation API** (free, returns exactly this shape) with a graceful fallback to the local word-list path when the provider is unavailable.
2. **DB-backed editable word lists** — move the blocked words/domains out of the env var (`HOSPEDA_MESSAGING_BLOCKED_WORDS` / `_BLOCKED_DOMAINS`) into a database table, editable from the admin panel, so a newly detected term needs **no redeploy**.

## 3. Scope sketch

A full spec must define details. Starting boundaries:

**Scoring engine**:

- Provider abstraction (interface) so the engine can be OpenAI Moderation API, a future self-hosted model, or the local word-list — selected by config, swappable.
- Map provider output → the frozen `ModerationResult` shape (`score`, `categories`, `matchedTerms`).
- Timeout + fallback: provider error/timeout → fall back to the DB word-list path; never block content creation on a provider outage.
- Caching/cost: dedupe identical text within a short window; respect provider rate limits.

**DB-backed word lists**:

- New table (e.g. `content_moderation_terms`): `term`, `kind` (word | domain), `category`, `severity/weight`, `enabled`, audit columns. Soft-delete per project convention.
- Model (BaseModel) + service (BaseCrudService) + admin CRUD endpoints + admin UI page.
- Seed migration: import the current env-var values as the initial corpus.
- Deprecate `HOSPEDA_MESSAGING_BLOCKED_WORDS` / `_BLOCKED_DOMAINS` once the DB path is live (keep a one-release fallback, then remove).

**Threshold configuration**:

- `PENDING_THRESHOLD` / `REJECT_THRESHOLD` become real, configurable (likely DB or config), per-context if needed (messaging may block at a different bar than reviews).

**Permissions**:

- A moderation-terms management permission for the admin word-list CRUD (verify naming against the entity-specific convention; add to ADMIN/SUPER_ADMIN).

## 4. Out of scope

- Any change to the `@repo/content-moderation` PUBLIC API (frozen by SPEC-166).
- Any change to review/messaging call sites (they already `await moderateText`).
- Review moderation queue / state machine (SPEC-166 owns it).

## 5. Open questions

To resolve during full spec authoring:

1. **Provider**: OpenAI Moderation API (free, hosted) vs a self-hosted classifier vs categorized-weighted word lists only? Cost/latency/data-residency tradeoff. Product + ops decision.
2. **Data residency / privacy**: is sending user text to a third-party moderation API acceptable, or must moderation stay on-prem? Affects provider choice.
3. **Threshold storage**: env/config vs DB-editable thresholds. If DB, same admin surface as the word list?
4. **Per-context thresholds**: does messaging block at the same score as review-reject, or separate bars per `context`?
5. **Term categories**: a flat list with weights, or category-tagged terms feeding `categories`?
6. **Fallback semantics**: on provider outage, fall back to DB word-list (degraded) or fail-open (treat as clean)? Default proposed: degraded word-list, never fail-open for messaging.
7. **Admin permission naming**: which entity-specific permission gates word-list CRUD?
8. **Backfill**: re-moderate the existing review/message corpus when the real engine ships, or apply only to new content?
