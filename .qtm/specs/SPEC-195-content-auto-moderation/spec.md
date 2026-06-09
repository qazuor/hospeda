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

> **Status**: IN-PROGRESS. Spun off from SPEC-166 on 2026-06-04. Engine + DB-backed
> word lists + thresholds + admin surface implemented across 3 merged PRs (#1491,
> #1496, #1499) plus the completion follow-ups on `spec/SPEC-195-completion`. This
> spec touches the **internals** of `@repo/content-moderation` plus the moderation
> **decision wiring** in service-core; the package public API stays frozen by SPEC-166.

## 1. Origin

SPEC-166 introduced the `@repo/content-moderation` package with its public API in
**final shape** but a **stub engine** inside (a binary substring word-list match).
Consumers (review services, messaging) are wired against the frozen contract:

```ts
moderateText(input: { text, context? }): Promise<{ score, categories, matchedTerms }>
```

This spec replaces the stub internals with a real, swappable engine and wires the
DB-backed thresholds into the actual decision path.

## 2. Goal

Make `moderateText` produce **meaningful, graded** moderation results AND make those
results drive real `REJECTED` / `PENDING` / `APPROVED` decisions, with a word list and
thresholds that are editable from the admin panel **without a redeploy**.

Two pillars:

1. **Real scoring engine** — per-category scores (spam, sexual, violence, hate,
   harassment, other), each 0..1, plus an overall `score`, backed by the OpenAI
   Moderation API with a graceful fallback to the local DB word-list when the
   provider is unavailable.
2. **DB-backed editable word lists + thresholds** — blocked words/domains and the
   pending/reject thresholds live in DB tables, editable from the admin panel.

## 3. Resolved decisions (the 8 open questions)

The original sketch left 8 questions open. They are resolved as follows (owner-approved):

1. **Provider** → **OpenAI Moderation API as primary, with fallback to the local DB
   word-list** on outage/timeout/rate-limit. Three providers exist and are selected by
   `HOSPEDA_MODERATION_PROVIDER`: `openai` | `local` | `stub`. The **code default is
   `stub`** (kill-switch: reproduces the v1 binary blocklist, needs no API key, keeps
   dev/test green). **Production is set to `openai`** via env in Coolify.
2. **Data residency / privacy** → sending user text to the OpenAI Moderation API is
   **accepted** for production. Because the default is `stub`, no text leaves the
   platform until the provider is explicitly switched to `openai`. The OpenAI provider
   truncates input to a safe max before the request.
3. **Threshold storage** → **DB-editable**, same admin surface as the word list.
   Resolution chain per context: specific DB row → DB `default` row → code constants
   (pending 0.5 / reject 0.85).
4. **Per-context thresholds** → **yes, per context.** Reviews apply the `pending`
   threshold (they have a PENDING moderation queue). Messaging is binary hard-reject
   (no queue) and applies the `reject` threshold. The `getThresholdForContext({context})`
   helper is the single resolver.
5. **Term categories** → **category-tagged terms** (spam/sexual/violence/hate/harassment/
   other) with a `severity`/weight, feeding the `categories` shape. Consumed by the
   `local` provider.
6. **Fallback semantics** → on `openai` outage the engine falls back to the `local`
   word-list; if that also fails it returns a **degraded** result with `score 0.5`,
   which maps to **PENDING** for reviews (fail-closed, never fail-open). Degraded
   results are **not cached** (so a recovered provider is reachable immediately).
   Non-provider errors (programming bugs) are **re-thrown**, not masked as degraded.
   Degraded events are surfaced to Sentry via the engine monitoring hooks.
7. **Admin permission naming** → `MODERATION_TERM_*` and `MODERATION_THRESHOLD_*`
   (view/create/update/delete/restore/hardDelete), granted to `ADMIN` and `SUPER_ADMIN`.
8. **Backfill** → **new content only.** The existing review/message corpus is NOT
   re-moderated when the real engine ships (YAGNI). Can be revisited as a separate spec.

## 4. Architecture

- **Provider abstraction** (`engine/provider.ts`): `ModerationProvider` interface,
  typed `ProviderError` / `ProviderTimeoutError` / `ProviderRateLimitedError`.
  `isFallbackEligibleError` returns true only for `ProviderError` (transient provider
  failures) — never for arbitrary `Error`, so real bugs surface.
- **Orchestrator** (`engine/orchestrator.ts`): cache lookup (keyed by text + context)
  → primary provider → on fallback-eligible error: local fallback (openai) or degraded.
  Caches only non-degraded results.
- **Providers** (`providers/{openai,local,stub}.provider.ts`): OpenAI maps
  category_scores → the frozen shape and truncates oversized input; local reads the DB
  term corpus; stub reads the legacy env blocklist (v1 compat).
- **Thresholds** (`service-core/contentModeration/get-threshold-for-context.ts`):
  async resolver with a 60s in-memory cache and the 3-level fallback chain.
- **Decision wiring** (service-core): accommodation/destination review `_beforeCreate`
  apply the per-context `pending` threshold; conversation `message.service` blocks on
  `score >= reject || matchedTerms.length > 0` (so both openai-score and local-term
  paths work).
- **Admin surface**: `content_moderation_terms` + `content_moderation_thresholds`
  tables, models, services (BaseCrudService), admin CRUD routes (route-level
  `requiredPermissions`), and the admin UI (terms list/create/edit/view + thresholds
  editor), fully i18n'd (es/en/pt).

## 5. Delivered (by phase)

- **Data foundations** (PR #1491): enums, schemas, DB tables (migration 0009 + extras
  012 check), models, seed, role grants.
- **Engine** (PR #1496): provider abstraction, orchestrator, 3 providers, cache, admin
  health endpoint, engine init + Sentry hooks in the API.
- **Admin surface** (PR #1499): admin CRUD routes, admin UI, i18n.
- **Completion** (`spec/SPEC-195-completion`):
  - engine hardening (fallback eligibility, context-aware cache, no-cache-degraded,
    OpenAI input truncation);
  - decision-path wiring (DB thresholds into reviews + messaging; messaging by score;
    SSOT threshold constant);
  - API authz (explicit `requiredPermissions` on every route; `thresholds/resolved`
    gap closed) + partial-threshold invariant (422 instead of 500);
  - admin UI fixes (stale-defaultValues data-corruption, i18n types + strings,
    permission-gated actions, validation feedback, Shadcn Select/AlertDialog);
  - prod enablement extras migration 013 (idempotent grants + default threshold row).

## 6. Production enablement

The feature ships **dark** (provider `stub` = v1 behavior). To turn it on, see
[`docs/prod-enablement-runbook.md`](docs/prod-enablement-runbook.md).

## 7. Out of scope

- Any change to the `@repo/content-moderation` PUBLIC API (frozen by SPEC-166).
- Backfill / re-moderation of the existing corpus (decision #8).

## 8. Remaining before "done"

- Merge `spec/SPEC-195-completion` → staging (PR).
- Staging smoke with `HOSPEDA_MODERATION_PROVIDER=openai` + a real `HOSPEDA_OPENAI_API_KEY`:
  verify graded scores, fallback to local on simulated outage, messaging block by score,
  admin term/threshold edits taking effect.
- After soak, staging → main, then run the prod enablement runbook.
