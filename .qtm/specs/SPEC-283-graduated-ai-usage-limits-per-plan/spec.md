---
specId: SPEC-283
title: Graduated Per-Plan AI Usage Limits
type: feat
complexity: high
status: in-progress
parentSpec: SPEC-211
created: 2026-06-26
tags: [ai, billing, entitlements, monetization]
---

# SPEC-283 — Graduated Per-Plan AI Usage Limits

> Follow-up to **SPEC-211** (AI Monetization Model, shipped + completed).
> This spec deliberately **revises** two of SPEC-211's metering decisions.

## 1. Summary

SPEC-211 established the current AI gating, shipped to production:

- **`ai_search`** is a free, platform-funded, **authenticated-only** feature with
  **no per-plan quota**. It is governed only by a per-user/IP rate-limit + a
  global USD ceiling. `createAiQuotaMiddleware('search')` is **intentionally
  absent** (SPEC-211 §7.7).
- **`ai_chat`** is **owner-governed and owner-metered**: the listing OWNER pays,
  and the entitlement gate + monthly quota resolve against the **owner**, not the
  consuming tourist. `createAiQuotaMiddleware('chat')` was **removed** from the
  chat route (SPEC-211 Phase 1); only a per-tourist/IP anti-abuse rate-limit
  remains.

This spec turns AI usage into a **graduated, per-plan monetization lever**: each
plan tier grants the **consuming user** a different monthly AI quota, so AI
becomes a reason to upgrade. It **reverts SPEC-211 G-2 and G-4 on the metering
axis** while **keeping SPEC-211's governance model** intact (who may use, who pays
the chat capability, the auth gate, and the per-listing fallback copy).

This is the **billing + runtime** half of a two-part effort. The **advertising**
half ships in **SPEC-282** (plan comparison table), which advertises AI as
available (binary, honest to the current 211 model). Once SPEC-283 ships, the
comparison table is updated to show the graduated per-tier AI numbers.

## 2. Context — what changes vs SPEC-211

### 2.1 What STAYS (211 governance, unchanged)

- `ai_chat` capability stays **owner-paid / owner-governed**: a tourist only gets a
  working chat on a listing whose owner's plan grants `AI_CHAT`. The "AI chat not
  available for this accommodation" fallback copy (SPEC-211 §7.4) stays.
- `ai_search` stays **authenticated-only**; anonymous users see the affordance and
  get a login prompt.
- Per-user/IP **anti-abuse rate-limits** stay on both routes.
- The global + per-feature **USD ceiling** backstop stays.
- **Model C** (capability config-wins / commercial DB-wins) stays the propagation
  mechanism.

### 2.2 What CHANGES (this spec)

- **`ai_search`** — re-introduce a per-plan monthly quota
  (`MAX_AI_SEARCH_PER_MONTH`) graduated by the **consuming user's** plan. Re-add
  `createAiQuotaMiddleware('search')` to the search route, keyed on the requesting
  user. *(Reverts SPEC-211 G-4 / §7.7.)*
- **`ai_chat`** — add a **consumer-side** monthly quota graduated by the consuming
  user's plan, **on top of** the existing owner-side gate + meter. *(Reverts
  SPEC-211 G-2's "tourist quota removed" decision.)*

### 2.3 The two-sided chat model (the subtle part)

After this spec a chat call passes only if **BOTH** hold:

1. **Owner side (cost ownership — unchanged):** the listing owner's plan grants
   `AI_CHAT` **and** the owner's monthly `MAX_AI_CHAT_PER_MONTH` is not exhausted.
   Metered against the owner.
2. **Consumer side (tier lever — new):** the requesting user is allowed to consume
   chat **and** their own monthly consumer quota is not exhausted. Metered against
   the consumer.

The two failure modes need **distinct** user-facing copy:

- Owner-side block → *"AI chat is not available for this accommodation"* (211 copy).
- Consumer-side limit → *"You reached your monthly AI chat limit — upgrade for more"* (new).

## 3. Goals

- **G-1** `ai_search` becomes a graduated per-plan quota; re-add the search quota
  middleware keyed on the requesting user.
- **G-2** `ai_chat` gains a **consumer-side** graduated quota in addition to owner
  metering; dual gate with distinct error copy.
- **G-3** Propagate the new entitlement/limit-key presence to live plans via a
  single **Model C extras migration**; numeric values stay DB-editable (commercial
  layer). No real `-1` on any AI quota (keep the 211 cost guardrail).
- **G-4** Update the **SPEC-282** comparison table + cards to show graduated
  per-tier AI numbers (replacing the binary "available" rows).
- **G-5** **Amend the SPEC-211 doc** to record the reversal of G-2/G-4 with
  rationale, so the two specs do not read as contradictory.

## 4. Non-Goals

- No new AI feature, provider, or prompt change (`@repo/ai-core` untouched beyond
  metering keys).
- No change to `ai_text_improve` / `ai_translate` / `ai_accommodation_import` —
  already owner-graduated and out of scope.
- `ai_support` stays out (separate addon — SPEC-211 Phase 4 / "próximamente").
- No new payment-processor flow; AI cost stays bundled into plans.
- No change to the global USD-ceiling backstop.

## 5. Target configuration (values are OPEN QUESTIONS)

> All numeric values below are **placeholders** pending owner confirmation (OQ-3).
> Per Model C they are **commercial-layer** (DB-editable); config values are only
> the fresh-seed defaults. No real `-1` on any AI quota.

### 5.1 `MAX_AI_SEARCH_PER_MONTH` (keyed on the consuming user's plan)

| Plan | Proposed monthly search quota |
|------|-------------------------------|
| tourist-free | 10 |
| tourist-plus | 50 |
| tourist-vip | 200 |
| owner / complex | OQ-4 (inherit tourist-vip, or higher?) |

### 5.2 Consumer-side chat quota (NEW limit key — naming in OQ-2)

| Plan | Proposed monthly chat quota (consumer) |
|------|----------------------------------------|
| tourist-free | 10 |
| tourist-plus | 50 |
| tourist-vip | 200 |
| owner / complex (as consumers) | OQ-4 |

The existing **owner-side** `MAX_AI_CHAT_PER_MONTH` (20 / 100 / 1000 / 2000 /
5000 per owner/complex tier) is unchanged — it caps the owner's cost.

## 6. Technical design (high level)

- **`plans.config.ts`** — add the `ai_search` per-plan limit (auth-baseline, **no**
  entitlement gate — OQ-1 resolved); add the consumer-side chat limit key per plan.
- **New `LimitKey`** for the consumer chat quota, distinct from the owner's
  `MAX_AI_CHAT_PER_MONTH` (different actors, different counts — OQ-2). Adding a
  `LimitKey` requires matching `LIMIT_METADATA` (`limits.config.ts`) and
  `RESOURCE_NAMES` (`apps/api/src/utils/limit-check.ts`) entries — both are
  `Record<LimitKey, …>`, so a missing entry is a **compile error**. It must also
  be classified in `MODEL_C_FIELD_SPLIT` or the seed **refuses to start**.
- **`search-chat.ts`** — re-add `createAiQuotaMiddleware('search')` keyed on the
  requesting user; keep the rate-limit + USD ceiling.
- **`chat.ts`** — keep the owner gate + meter; **add** a consumer-side gate + meter
  (`getMonthlyCallCount` / `recordAiUsage` keyed by the requesting user with the
  consumer feature) before streaming; map the two distinct 403s to the two i18n
  copies.
- **Extras migration** (single Model C sync, `packages/db/src/migrations/extras/`)
  — add the new limit keys to existing plan rows (capability); leave numeric
  values to the operator (or seed a sane default per §5).
- **i18n** — new error-copy keys (es/en/pt) for the consumer-limit-reached case.
- **Tests** — config grant-matrix test, route gate tests (owner-block vs
  consumer-block paths), migration idempotency.
- **Billing staging smoke** — mandatory per project policy for AI gate changes.

## 7. Risks

- **Double-metering confusion:** a tourist blocked while the owner still has paid
  quota may feel like a bug — the copy + product intent must be explicit (OQ-5).
- **Reverting a shipped spec:** live rows already lack these keys; the extras
  migration must re-add them idempotently and existing subscribers must receive
  the new quota.
- **Cost:** graduating search re-opens per-user cost that 211 centralized under the
  USD ceiling. The ceiling stays as backstop, but per-plan caps must be set sanely.
- **Two specs in tension:** without the G-5 amendment, SPEC-211 and SPEC-283 read
  as contradictory. The amendment is mandatory, not optional.

## 8. Open Questions

Resolved by the owner on 2026-06-26 (all except OQ-3, deferred to implementation):

- **OQ-1 — RESOLVED:** `ai_search` is modelled as an **auth-baseline** feature (no
  plan entitlement); the quota middleware reads a **per-plan limit** without an
  entitlement gate. Closest to SPEC-211's "not a plan entitlement" framing.
- **OQ-2 — RESOLVED:** the consumer chat quota is a **separate `LimitKey`**
  (`MAX_AI_CHAT_CONSUMER_PER_MONTH`, exact name TBD at implementation), distinct
  from the owner's `MAX_AI_CHAT_PER_MONTH` — different actors, different counts.
- **OQ-3 — DEFERRED:** exact per-tier values for the search + consumer-chat quotas
  are confirmed **at implementation time**. The §5 numbers are placeholders.
- **OQ-4 — RESOLVED:** owners/complex (as consumers) **inherit the tourist-vip**
  AI consumer quotas (no separate higher cap) unless revisited at implementation.
- **OQ-5 — RESOLVED:** when a consumer hits their limit while the owner still has
  chat quota, **hard-block the consumer** with an upgrade prompt.
- **OQ-6 — RESOLVED:** anonymous behavior is **unchanged** — the feature is
  visible, using it triggers a login prompt.

## 9. Relationship to SPEC-282

SPEC-282 (plan comparison table) ships **first**, advertising AI as available
(binary, honest to the current 211 model). When SPEC-283 ships, the comparison
table + cards are updated to graduated per-tier AI numbers (G-4). **SPEC-282 must
not advertise per-tier AI numbers until SPEC-283 enforces them** — advertising an
unenforced limit is a correctness/honesty bug.

## 10. Revision History

- 2026-06-26 — Initial draft (allocated SPEC-283, parent SPEC-211). Split out of the
  SPEC-282 review when the owner chose "table now, graduated AI limits as a separate
  formal spec".
- 2026-06-26 — OQ-1/2/4/5/6 resolved by the owner; OQ-3 (numeric values) deferred to
  implementation.
