---
id: SPEC-173
slug: ai-core
title: AI Foundation Package (provider-agnostic @repo/ai-core)
status: in-progress
owner: qazuor
created: 2026-05-29
designResolvedAt: 2026-06-04
relatedSpecs:
  - SPEC-143  # billing testing / test-user matrix (role x plan) — usage enforcement plugs here
  - SPEC-145  # billing entitlements & limits enforcement — AI quotas reuse this
  - SPEC-152  # plans/limits/entitlements editable — AI entitlement keys live here
  - SPEC-154  # admin config-driven IA — admin AI-settings page slots into this
  - SPEC-164  # admin billing super-only — AI_SETTINGS_MANAGE follows the same super-only pattern
childSpecs:
  - "(pending) AI Feature — HOST text improvement"
  - "(pending) AI Feature — Natural-language search"
  - "(pending) AI Feature — Accommodation chat (tourist)"
  - "(pending) AI Feature — Admin tech-support assistant"
tags:
  - ai
  - foundation
  - package
  - provider-agnostic
  - infrastructure
---

# SPEC-173 — AI Foundation Package (`@repo/ai-core`)

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every single case —
> without exception — if a change or decision is not *extremely* clear-cut, if there is even
> the slightest ambiguity, or if there is more than one viable option, **STOP and consult the
> owner (qazuor)**. Do not decide autonomously. See §12.

## 1. Summary

Introduce a **provider-agnostic AI capability** to Hospeda as a single shared package,
`@repo/ai-core`, consumed **only** by `apps/api` (never by `apps/web` or `apps/admin`
directly). This spec covers **only the foundation** — the engine, the provider abstraction,
the admin-managed configuration, the secrets vault, usage metering + enforcement, cost
controls, the streaming primitive, the safety layer, and the storage tables. The four V1
user-facing features (text improvement, natural-language search, accommodation chat, admin
tech-support) are **child specs** that consume this foundation and are out of scope here (§4, §11).

This is a **green-field area**: as of 2026-05-29 there is zero AI/LLM code, no pgvector, and
no SSE/streaming pattern anywhere in the monorepo.

## 2. Context & motivation

### 2.1 What exists today (verified 2026-05-29)

- **No AI/LLM code**: grep across `packages/` and `apps/` for `openai`, `anthropic`,
  `embedding`, `ai-sdk`, `completion`, `gpt`, `claude` returns zero production matches.
- **No vector infra**: no `pgvector`, no vector columns in `packages/db`.
- **No streaming**: no SSE / `text/event-stream` in `apps/api` (Hono). Responses are JSON-only
  via `ResponseFactory`.
- **`@repo/db` is centralized**: tables live in `packages/db/src/schemas/*`, migrations are
  centralized (Drizzle Kit), all consumers call `getDb()` (module-level singleton).
- **`@repo/notifications`** already exists and is the canonical way to send alerts.
- **Entitlements** (SPEC-143/145/152) are designed: `ENTITLEMENT_DEFINITIONS`,
  `EntitlementKey`/`LimitKey` enums, and `entitlementMiddleware()` loading into context.
  Enforcement is wired but not yet broadly applied — AI quotas plug into this exact system.
- **Sentry + PostHog** are integrated and are the canonical observability sinks.

### 2.2 Why a dedicated package

Single source of truth for all AI logic; keeps `apps/api` routes thin (project convention);
lets us swap providers without touching API/admin/web code; isolates the AI surface for
testing, cost control, and security review.

## 3. Goals / Non-goals

### Goals

1. A `@repo/ai-core` package exposing a **stable, provider-agnostic API** for AI operations
   (text generation, streaming generation, structured output, intent extraction, moderation,
   embeddings interface stub).
2. **Provider independence**: switching or adding a provider requires **zero code changes** in
   `apps/api`, `apps/admin`, `apps/web` — only configuration.
3. **Multiple providers** configurable, with **fallback + per-feature routing** (V1).
4. **Admin-managed configuration** of the whole AI surface by a SUPER_ADMIN (providers on/off,
   models, params, prompts, feature flags, quotas).
5. **Encrypted secrets vault** for provider API keys, editable from admin, with audit logging.
6. **Usage metering + per-plan enforcement** for every authenticated tier; **cost ceiling +
   kill-switch + threshold alerts**.
7. **Streaming (SSE) primitive** in `apps/api` + the package, reusable by features.
8. **Safety layer**: rate-limiting, prompt-injection guard, content moderation, PII scrubbing
   for external telemetry.
9. **Full test coverage** (incl. a deterministic provider stub) and **complete documentation**.

### Non-goals (this spec)

- Any user-facing feature (text improvement, search, chat, support) — child specs (§4).
- Vector database / semantic embeddings — V2 (§11). The embeddings interface is *defined* but
  no vector storage/search is implemented.
- Advanced multi-provider routing (cost-based, ensemble, A/B) — V2 (§11).
- Async job runner (QStash) for batch/long tasks — V2 (§11). V1 is synchronous + streaming.
- Anonymous (logged-out) AI usage — **explicitly excluded** (§5.7): all AI requires login.

## 4. Scope decomposition

| Spec | Scope |
|------|-------|
| **SPEC-173 (this)** | `@repo/ai-core` foundation: engine, providers, config, vault, usage+enforcement, cost controls, streaming, safety, storage tables, tests, docs |
| Child A | HOST text improvement (title/description/etc.), multi-locale, accept/reject UX |
| Child B | Natural-language search (intent → structured query over existing DB; NO embeddings in V1) |
| Child C | Accommodation chat for tourists (login-required, RAG over accommodation data, streaming) |
| Child D | Admin tech-support assistant (RAG over Hospeda docs corpus) |

Child specs are allocated and written **after** this foundation merges.

## 5. Architecture & Design

### 5.1 Package layout (`packages/ai-core`)

```
packages/ai-core/
├── src/
│   ├── providers/        # provider adapters over the Vercel AI SDK + AiProvider interface
│   │   ├── ai-provider.interface.ts
│   │   ├── vercel-openai.adapter.ts
│   │   ├── vercel-anthropic.adapter.ts
│   │   └── stub.provider.ts          # deterministic, for tests
│   ├── engine/           # routing, fallback, retries, the public AiService
│   ├── capabilities/     # generateText, streamText, generateObject, extractIntent, moderate, embed (iface)
│   ├── config/           # config types + resolver (reads ai_settings via storage)
│   ├── usage/            # metering recorder + cost calculator + ceiling/kill-switch
│   ├── safety/           # rate-limit, prompt-injection guard, moderation hook, PII scrubber
│   ├── storage/          # ⚠️ the ONLY place that touches @repo/db (isolated coupling)
│   ├── types/            # all exported types
│   └── index.ts          # public API surface (named exports only)
└── test/
```

**RO-RO** for every function. **Named exports only.** **Max 500 lines/file.** Strict TS, no `any`.
All inputs validated with Zod (schemas authored in `@repo/schemas` per SSoT, or co-located if
package-internal — to be confirmed in design, §8 Q3).

### 5.2 Provider abstraction

- The engine depends on a package-owned `AiProvider` interface — **never** on the Vercel AI SDK
  types directly. Adapters wrap `ai` + `@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.
- **Rationale**: the Vercel AI SDK (MIT, free, runs on our VPS, no Vercel account/hosting needed)
  already gives provider-agnostic generation, streaming, tool-calling, structured output, and an
  embeddings interface. We wrap it so that even the SDK itself is swappable.
- **The package never reads env.** Provider credentials and config are passed **by parameter** at
  construction/call time by `apps/api` (§5.5).

### 5.3 Multi-provider strategy (V1)

- **Per-feature primary provider + fallback chain**, both configurable from admin.
  e.g. `text-improve → [anthropic, openai]`, `chat → [openai, anthropic]`.
- On primary failure (timeout, 5xx, rate-limit), the engine tries the next in the chain and
  records the fallback event (usage log + Sentry breadcrumb).
- **V2 hook**: the routing layer is designed so cost-based routing, ensemble, and A/B can be
  added without changing the public API (§11).

### 5.4 Storage model

**Decision (owner-approved tradeoff):** tables live in **`@repo/db`** (`packages/db/src/schemas/ai/`),
NOT inside the package. This means the package is **NOT portable** to another project without
rewriting its data layer — accepted consciously to stay consistent with the centralized repo
pattern. **Mitigation:** ALL DB access is isolated in `src/storage/` so the coupling is contained
to one module.

Tables (all soft-delete + timestamps per project convention):

| Table | Purpose |
|-------|---------|
| `ai_settings` | Admin-managed config: providers on/off, fallback order, per-feature model+params, feature flags, quotas. **Shape (Q7 resolved):** single JSONB `value` blob keyed by `key` (e.g. `'global'`), mirroring the blessed `platform_settings` pattern (`packages/db/src/schemas/platform/platform-settings.dbschema.ts`). Validated by a Zod schema on write; cache invalidated on write. Prompts are NOT stored here (they live in `ai_prompt_versions`). |
| `ai_provider_credentials` | Encrypted provider API keys (vault, §5.5) + metadata. |
| `ai_credential_audit` | **(Q1 resolved)** Dedicated audit trail of credential mutations: actor, action (`created`/`rotated`/`deleted`), providerId, timestamp, ip. Permanent + queryable from admin (security trail over cost-bearing secrets; the repo has NO generic admin audit table — only `billing_audit_logs` from the third-party qzpay lib and a log-based `AuditEventType`, neither suitable). |
| `ai_prompt_versions` | Versioned system prompts per feature (with `is_active` + history). |
| `ai_usage` | Per-call metering: userId, feature, provider, model, tokensIn, tokensOut, costEstimate (centavos), latencyMs, status, timestamp. |
| `ai_request_log` | Audit of every call (request metadata, PII-scrubbed) for debugging. |
| `ai_conversations` | Generic multi-turn conversation container (used by chat child spec). |
| `ai_messages` | Messages within a conversation (role, content, tokens, provider). |

> Cost is stored as **integer centavos** (project money convention).

### 5.5 Secrets vault (owner-approved: keys editable from admin)

- Keys are stored **encrypted** (AES-256-GCM) in `ai_provider_credentials`. The **master key**
  lives in `.env` (`HOSPEDA_AI_VAULT_MASTER_KEY`), read **only by `apps/api`**.
- **The package never touches the vault.** `apps/api` decrypts the key and passes the plaintext
  to `@repo/ai-core` **by parameter** at call time — this preserves the "package doesn't read
  secrets" requirement.
- **Audit log (Q1 resolved):** every create/rotate/delete of a credential records actor + timestamp
  in the **dedicated `ai_credential_audit` table** (§5.4). The repo has no reusable generic admin
  audit table, so a first-party dedicated trail is used (permanent + queryable, fit for a security
  trail over cost-bearing secrets).
- Rotation does not require redeploy.
- New env var must follow the project workflow: register in `@repo/config`, add Zod validation in
  `apps/api/src/utils/env.ts`, update `.env.example`, set in Coolify (operator action).

### 5.6 Admin configuration (new `PermissionEnum.AI_SETTINGS_MANAGE`, SUPER_ADMIN only)

Configurable from the admin panel:

1. Providers on/off + fallback order.
2. Model + params (temperature, maxTokens, etc.) **per feature**.
3. **System prompts per feature** — versioned (`ai_prompt_versions`) with a **mandatory code-level
   default fallback**: a bad/empty admin prompt must never brick a feature; the engine falls back
   to the in-code default prompt.
4. Feature flags (enable/disable each AI feature) + per-feature/per-plan quotas.

The admin UI page itself is built in `apps/admin`; the API exposes `/api/v1/admin/ai/settings*`
routes guarded by `AI_SETTINGS_MANAGE`.

### 5.7 Usage tracking + enforcement (login required for ALL AI)

**Policy (owner-approved):** every AI feature requires an authenticated user. **No anonymous AI.**
This removes the anonymous abuse vector and makes enforcement uniform.

Enforcement matrix:

| Audience | Enforcement |
|----------|-------------|
| HOST (any plan: basico/pro/…) | entitlement + per-plan limit (hard) |
| Tourist FREE (logged in) | entitlement + per-plan limit (e.g. N/month) |
| Tourist PRO / VIP (logged in) | entitlement + per-plan limit (more / unlimited) |

- AI quotas are new `EntitlementKey`/`LimitKey` entries. **(Q2 resolved)** The model is
  **per-feature quota** (unit costs differ by orders of magnitude — streaming RAG chat ≫ a one-shot
  text-improve — and §5.8 requires per-feature ceilings). Keys live in **`@repo/billing`**
  (`packages/billing/src/types/{entitlement,plan}.types.ts` + `config/{entitlements,limits}.config.ts`),
  NOT in `@repo/schemas`/SPEC-152, and follow the real repo convention: **lowercase `snake_case`**.
  - **Gates** (`EntitlementKey`, boolean — "can use?"): `ai_text_improve`, `ai_chat`, `ai_search`,
    `ai_support`.
  - **Limits** (`LimitKey`, number — "how many?"): `max_ai_text_improve_per_month`,
    `max_ai_chat_per_month`, `max_ai_search_per_month`, `max_ai_support_per_month`.
  - They reuse the existing `entitlementMiddleware()` + 5-min cache (`apps/api/src/middlewares/entitlement.ts`).
- **Per-plan seed matrix (owner-approved 2026-06-05, T-030).** These are SEED DEFAULTS — plans are
  runtime-editable from the admin panel (SPEC-168). `-1` = unlimited; `—` = gate absent (tourists
  have no own content to improve, so `ai_text_improve` is owner/complex-only):

  | Plan | ai_text_improve | ai_chat | ai_search | ai_support |
  |------|----------------|---------|-----------|------------|
  | tourist-free | — | 10 | 30 | 5 |
  | tourist-plus | — | 50 | 150 | 20 |
  | tourist-vip | — | -1 | -1 | -1 |
  | owner-basico | 20 | 20 | 50 | 10 |
  | owner-pro | 100 | 100 | 200 | 30 |
  | owner-premium | -1 | -1 | -1 | -1 |
  | complex-basico | 30 | 30 | 50 | 15 |
  | complex-pro | 150 | 150 | 200 | 40 |
  | complex-premium | -1 | -1 | -1 | -1 |

- Every call is metered into `ai_usage` regardless of tier (reporting per user / feature / month).
- Exceeding a limit returns a controlled `403` with an upgrade hint (contract aligned with the
  existing entitlement-gate convention).

### 5.8 Cost ceiling + kill-switch + alerts

- The engine tracks **accumulated spend** (global, per-feature, per-provider) against admin-set
  ceilings (e.g. `USD 200/month` global, `USD 50/month` chat).
- On crossing a ceiling: **hard stop** the affected scope (controlled error) until reset/next period.
- **Manual kill-switch** per feature/provider from admin.
- **Threshold alerts** at 50% / 80% / 100% sent to the SUPER_ADMIN via **`@repo/notifications`**.

### 5.9 Streaming primitive (SSE)

- New `apps/api` route factory `createStreamingRoute()` emitting `text/event-stream` (extends the
  existing factory pattern; `ResponseFactory` gains a streaming path).
- `@repo/ai-core` exposes `streamText(...)` returning an async iterable of tokens; the API adapts
  it to SSE. Consumed by chat (child C) and text improvement (child A).

### 5.10 Safety layer (V1)

1. **Rate-limiting** per user (and per IP as defense-in-depth) with configurable windows.
   **(Q6 resolved)** Reuse the existing `createSlidingWindowPerUserRateLimit()`
   (`apps/api/src/middlewares/rate-limit.ts`, Redis sliding-window + in-memory fallback, SPEC-079/110).
   No new counter is built. This anti-burst layer is distinct from the monthly per-plan quota (Q2)
   and the USD cost ceiling (§5.8) — three independent layers.
2. **Prompt-injection guard**: input sanitization + basic detection of override attempts.
3. **Content moderation (Q4 resolved)**: provider-agnostic — `moderate()` is a capability on the
   `AiProvider` interface (§5.2/§5.11) with an **OpenAI moderation adapter as the default first impl**
   (free), swappable like any other provider. Input/output pass through a moderation pass before
   serving/storing.
4. **PII scrubbing for external telemetry**: conversations are stored verbatim in our DB, but
   emails/phones/cards are redacted before anything is sent to Sentry/PostHog.

### 5.11 Intent extraction (foundation capability)

`extractIntent(...)` is a **reusable engine capability**, not a feature. NL search (child B) and
chat (child C) consume it. Returns a typed, validated intent object (Zod).

### 5.12 i18n

The package is **locale-aware by parameter** (`es` | `en` | `pt`); prompts instruct the model to
respond in the requested locale. Default locale `es` (Argentina market).

### 5.13 Observability

- **Sentry**: errors (provider failures, timeouts, fallbacks, ceiling trips).
- **PostHog**: usage events per feature (product analytics).
- **`@repo/notifications`**: cost-threshold alerts.
- **`ai_request_log`**: internal audit (PII-scrubbed) for debugging.

### 5.14 Testing

- Deterministic **`StubProvider`** (same idea as the MercadoPago stub) so tests never hit real
  provider APIs or spend tokens.
- AAA pattern, ≥90% coverage target, Vitest. Unit (engine/routing/fallback/cost/safety) +
  integration (config resolution, enforcement, vault round-trip with a throwaway key).

## 6. Functional Requirements

- **FR-1** `@repo/ai-core` exposes a provider-agnostic `AiService` with capabilities:
  `generateText`, `streamText`, `generateObject`, `extractIntent`, `moderate`, and an `embed`
  interface (stub in V1).
- **FR-2** Adding/swapping a provider requires only config + an adapter; **no changes** in
  `apps/api`/`apps/admin`/`apps/web` consuming code.
- **FR-3** Per-feature primary + fallback chain, configurable from admin; automatic fallback on
  failure, with the event recorded.
- **FR-4** Provider API keys are stored AES-256-GCM-encrypted; editable + rotatable from admin
  (SUPER_ADMIN); decrypted only in `apps/api` and passed to the package by parameter; every
  mutation is audit-logged.
- **FR-5** A SUPER_ADMIN can configure providers on/off + fallback order, per-feature model+params,
  versioned per-feature prompts (with code default fallback), feature flags, and per-feature/plan
  quotas — all from the admin panel, no redeploy.
- **FR-6** All AI features require an authenticated user; anonymous calls are rejected.
- **FR-7** Every AI call is metered into `ai_usage` (tokens, cost in centavos, feature, provider,
  latency, status) and reportable per user / feature / month.
- **FR-8** Per-plan quotas are enforced via the existing entitlement system; exceeding returns a
  controlled `403` with upgrade hint.
- **FR-9** Admin-set cost ceilings (global/feature/provider) hard-stop on breach; manual kill-switch
  exists; threshold alerts (50/80/100%) are sent via `@repo/notifications`.
- **FR-10** `apps/api` can stream AI responses over SSE via a reusable route factory.
- **FR-11** Safety layer applies rate-limiting, prompt-injection guard, content moderation, and PII
  scrubbing for external telemetry.
- **FR-12** A deterministic stub provider is available for tests; the suite never calls real
  provider APIs.
- **FR-13** The package is locale-aware (`es`/`en`/`pt`) by parameter.
- **FR-14** All exported functions/types/classes have comprehensive JSDoc; the package ships docs
  (README + usage guide).

## 7. Acceptance Criteria (BDD)

- **AC-1 (provider swap)** — *Given* `chat` configured with primary `openai`, *when* an admin
  changes the primary to `anthropic` from the panel, *then* subsequent chat calls use Anthropic
  with **no code change/redeploy**.
- **AC-2 (fallback)** — *Given* `text-improve` chain `[anthropic, openai]`, *when* Anthropic returns
  a 5xx/timeout, *then* the call succeeds via OpenAI and a fallback event is recorded in `ai_usage`.
- **AC-3 (vault round-trip)** — *Given* an admin saves an OpenAI key in the panel, *when* it is
  stored, *then* the DB value is ciphertext (never plaintext), *and* `apps/api` can decrypt and use
  it, *and* the create is in the audit log.
- **AC-4 (package never reads secrets/env)** — *Given* the package source, *then* there is **no**
  `process.env` access and **no** vault access in `@repo/ai-core`; credentials arrive by parameter.
  (Enforced by a test/lint check.)
- **AC-5 (login required)** — *Given* an unauthenticated request to any AI endpoint, *then* it is
  rejected (401), never served.
- **AC-6 (quota enforcement)** — *Given* a tourist-free user at their monthly AI limit, *when* they
  invoke an AI feature, *then* they get a controlled `403` with an upgrade hint, *and* the attempt
  is metered.
- **AC-7 (metering)** — *Given* a successful AI call, *then* an `ai_usage` row exists with tokens,
  cost (centavos), feature, provider, latency, status.
- **AC-8 (cost ceiling)** — *Given* a global ceiling of `USD 200/month` and accumulated spend at
  `USD 200`, *when* a new call is attempted, *then* it is hard-stopped with a controlled error,
  *and* a 100% alert was sent via `@repo/notifications`.
- **AC-9 (kill-switch)** — *Given* an admin toggles a feature kill-switch off, *then* that feature
  immediately stops serving AI.
- **AC-10 (streaming)** — *Given* a streaming-capable endpoint, *when* invoked, *then* the response
  is `text/event-stream` and tokens arrive incrementally.
- **AC-11 (PII scrub)** — *Given* a message containing an email/phone, *when* an event is sent to
  Sentry/PostHog, *then* the PII is redacted, *while* the DB conversation retains the original.
- **AC-12 (prompt fallback)** — *Given* an admin saves an empty/invalid prompt for a feature,
  *then* the engine falls back to the in-code default and the feature keeps working.
- **AC-13 (stub tests)** — *Given* the test suite, *when* it runs in CI, *then* no real provider
  API is contacted and coverage ≥ 90%.

## 8. Resolved Decisions (closed 2026-06-04 with owner qazuor; were blocking open questions)

All seven blocking questions were resolved with the owner after a code-grounded exploration of the
existing infra. The exploration corrected three wrong assumptions the original draft made (noted below).

- **Q1 — Credential audit → DEDICATED TABLE.** New first-party `ai_credential_audit` table (§5.4/§5.5).
  *Correction:* the draft assumed an "admin audit-log (SPEC-162?)" exists — it does NOT. The only DB
  audit is `billing_audit_logs` (third-party qzpay, billing-scoped) plus a log-based `AuditEventType`
  in `@repo/logger`; neither fits a permanent, queryable security trail over cost-bearing secrets.
- **Q2 — Entitlement/limit keys → PER-FEATURE, snake_case, in `@repo/billing`** (§5.7).
  Gates: `ai_text_improve`/`ai_chat`/`ai_search`/`ai_support`. Limits: `max_ai_<feature>_per_month`.
  *Correction:* the draft said keys live in "SPEC-152 / `@repo/schemas`" and proposed UPPERCASE names —
  both wrong. `EntitlementKey`/`LimitKey` live in `@repo/billing` and the convention is lowercase
  `snake_case`. Per-feature chosen over a shared credit pool because unit costs differ by orders of
  magnitude and §5.8 requires per-feature ceilings.
- **Q3 — Zod schemas → ALL in `@repo/schemas`** (strict SSoT). Accepted tradeoff: this couples
  `@repo/ai-core` to `@repo/schemas` (gives up package portability — already conceded in §5.4 since
  tables live in `@repo/db`). Consistency with the repo SSoT wins.
- **Q4 — Moderation → PROVIDER-AGNOSTIC** via `AiProvider.moderate()` with an OpenAI moderation
  adapter as the default first implementation (§5.10). Consistent with the whole agnostic design.
- **Q5 — Default models → TIERED strategy, concrete strings fixed at SEED time.** Cheap/fast models
  for simple tasks (text-improve, intent/search), better models for conversation (chat, support).
  Exact model identifiers are decided in the seed task against pricing/availability current then
  (defaults are admin-editable per §5.6, so this is a low-risk seed value, not a hard commitment).
- **Q6 — Rate-limit → REUSE `createSlidingWindowPerUserRateLimit()`** (Redis sliding-window +
  in-memory fallback, SPEC-079/110). No new counter (§5.10). Distinct from the monthly quota (Q2)
  and the USD ceiling (§5.8).
- **Q7 — `ai_settings` → JSONB BLOB** mirroring the blessed `platform_settings` pattern (§5.4).
  Config is read/written whole; the relational data (prompts, credentials, usage) already lives in
  its own normalized tables, so a blob is correct here (normalizing config would add cost with no
  integrity benefit).

## 9. Risks

- **R-1 Runaway cost** — a bug/abuse drains the provider budget. *Mitigation*: cost ceiling +
  kill-switch + alerts + per-user quotas + login requirement.
- **R-2 Secret leakage** — master key compromise exposes all provider keys. *Mitigation*: master
  key only in `.env`/Coolify, never in code/DB; vault only in `apps/api`; audit log.
- **R-3 Prompt injection** — tourist free-text manipulates the model. *Mitigation*: injection guard
  - moderation + scoped system prompts.
- **R-4 Provider API drift** — provider/SDK breaking changes. *Mitigation*: our `AiProvider`
  interface isolates adapters; SDK is wrapped.
- **R-5 Portability debt** — tables in `@repo/db` make the package non-portable (accepted). *Mitigation*:
  DB access isolated in `storage/` so a future extraction touches one module.
- **R-6 Non-deterministic tests** — LLM output varies. *Mitigation*: `StubProvider`; assert on
  contracts/shapes, not exact text.
- **R-7 Cache staleness** — admin config changes not picked up. *Mitigation*: invalidate config
  cache on write (mind the existing 300s in-memory cache gotcha seen in billing).

## 10. High-level task outline (not yet atomized)

1. Package skeleton (`@repo/ai-core`) + tsconfig/build/test wiring + public API surface.
2. `AiProvider` interface + Vercel AI SDK adapters (OpenAI, Anthropic) + `StubProvider`.
3. Engine: routing + fallback + retries + `AiService` capabilities (text/stream/object/intent/moderate/embed-iface).
4. DB tables (`packages/db/src/schemas/ai/*`) + migration + `storage/` module.
5. Secrets vault (crypto util + `apps/api` integration + audit) + env registration.
6. Admin config model (`ai_settings` + `ai_prompt_versions`) + resolver + cache invalidation.
7. Admin API routes (`/admin/ai/*`) guarded by `AI_SETTINGS_MANAGE` + new PermissionEnum + seed.
8. Usage metering recorder + cost calculator + reporting endpoints.
9. Entitlement/limit keys + enforcement integration (login-required + per-plan).
10. Cost ceiling + kill-switch + threshold alerts via `@repo/notifications`.
11. Streaming primitive: `createStreamingRoute()` + `ResponseFactory` SSE path.
12. Safety layer: rate-limit + injection guard + moderation + PII scrubber.
13. Observability wiring (Sentry + PostHog).
14. i18n locale handling.
15. Tests (unit + integration, stub provider, ≥90%).
16. Documentation (README + usage guide + ADR for the architecture + CLAUDE.md for the package).

## 11. Out of scope (V2 / child specs)

- **Features**: text improvement, NL search, accommodation chat, admin tech-support (child specs).
- **Vector DB / embeddings / semantic search** (pgvector). V1 NL search = intent → structured query
  over the existing DB. The `embed` interface is defined but unimplemented.
- **Advanced routing**: cost-based, ensemble/voting, A/B testing (the routing layer leaves the hook).
- **Async job runner** (QStash) for batch/long-running tasks (V2 analysis/reports).
- **Anonymous AI usage** (deliberately excluded; would require re-introducing IP rate-limit + ceiling
  as primary defense).
- **AI-generated bookings / analysis & reporting** (V2 product scope).

## 12. Decision protocol (mandatory for implementation)

For the entire lifecycle of this spec and its child specs:

1. **Consult on ANY ambiguity.** If a change/decision is not *extremely* clear-cut, or there is more
   than one viable option, **STOP and consult the owner (qazuor)**. Silence is not approval.
2. **No autonomous architectural/product decisions.** Present numbered options with pros/cons/impact
   and a recommendation; wait for approval.
3. The Open Questions in §8 are **blocking** for the tasks that depend on them — do not implement
   past an unresolved Q by guessing.
4. Naming not already established in the codebase (entitlement keys, permission names, table/column
   names) is **consult-first**.
