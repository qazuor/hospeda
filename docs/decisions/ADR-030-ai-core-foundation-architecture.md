# ADR-030: AI Foundation Architecture (`@repo/ai-core`)

**Status**: Accepted
**Date**: 2026-06-05
**Spec**: SPEC-173

## Context

As of 2026-05-29, the Hospeda platform had zero AI/LLM code, no SSE/streaming
pattern, and no vector infrastructure. Four product features were planned (HOST
text improvement, natural-language search, accommodation chat for tourists, admin
tech-support assistant), each requiring provider calls, usage metering, safety
controls, and admin configuration. Rather than building each feature in isolation,
a shared foundation was needed to enforce consistency and avoid duplicating the
cost, safety, and provider-plumbing logic four times.

Seven architecture questions were blocking implementation. All were resolved with
the owner on 2026-06-04 after a code-grounded exploration of the existing infra
(billing entitlements, rate-limiting middleware, the `platform_settings` JSONB
pattern, and the lack of a generic admin audit table). Three of the original draft
assumptions were corrected during that exploration and are noted below.

## Decision

### 1. Package isolation: `@repo/ai-core` never reads env or vault

The package has a hard import boundary:

| Import | Allowed in |
|--------|-----------|
| `@repo/db` | `src/storage/` ONLY |
| `ai` / `@ai-sdk/*` | `src/providers/` ONLY |
| `@repo/notifications` | NEVER — alert sending lives in `apps/api` |
| `process.env` | NEVER anywhere in the package |

Credentials arrive **by parameter** at call time. `apps/api` holds the vault
master key (`HOSPEDA_AI_VAULT_MASTER_KEY`), decrypts provider keys, and passes
plaintext credentials to `@repo/ai-core` via the factory function
`createConfiguredAiService`. This factory pre-decrypts credentials (vault decrypt
is async) and produces a fresh `AiService` instance per call — **no singleton**.
No singleton means a rotated key takes effect immediately without a restart.

A static guard test (T-036) enforces the import boundary in CI.

### 2. Provider-agnostic engine with Vercel AI SDK adapters

`@repo/ai-core` defines its own `AiProvider` interface. Adapters wrap the Vercel
AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`), making the SDK itself
swappable. A deterministic `StubProvider` is available for tests and never hits
real APIs.

The engine supports per-feature primary + fallback chains configurable from admin
(e.g. `chat → [openai, anthropic]`). On primary failure (5xx, timeout, rate-limit)
the engine tries the next provider in the chain, records a fallback event in
`ai_usage` and a Sentry breadcrumb, and returns the result. The routing layer is
designed so cost-based routing, ensemble, and A/B testing can be wired in V2
without changing the public API.

Provider selection uses a synchronous `getProvider` over a pre-decrypted
credential `Map` (the async decrypt happens once in `createConfiguredAiService`).

### 3. Cost unit: integer micro-USD; period: calendar-month UTC

AI costs are stored as **integer micro-USD** (1 micro-USD = 0.000001 USD).
Centavos (ARS, the repo's billing unit per ADR-006) round each token call to
zero, making ceilings non-functional. Micro-USD preserves sub-cent precision
while keeping the integer-arithmetic guarantee.

All period boundaries — ceilings, quota resets, usage reporting — align to
calendar-month UTC. This is consistent across the enforcement stack: rate-limit
resets, quota ledger rolls, and admin ceiling displays all use the same boundary.

### 4. Vault: AES-256-GCM with three separate columns

Provider API keys are stored in `ai_provider_credentials` encrypted with
AES-256-GCM. The derived key is `sha256(masterKey)` where `masterKey` comes from
`HOSPEDA_AI_VAULT_MASTER_KEY` (registered in `@repo/config`, validated in
`apps/api/src/utils/env.ts`, set in Coolify). The ciphertext, IV, and auth tag
are stored in **three separate columns** (not a concatenated blob) for explicit
column-level clarity.

Key rotation is an overwrite-in-place operation; no redeploy is required.

Every credential mutation (create / rotate / delete) is recorded in
`ai_credential_audit` with actor ID, action, providerId, timestamp, and IP.
This is a **dedicated first-party table**, not reuse of `billing_audit_logs`
(third-party qzpay billing-scoped) or the log-based `AuditEventType`
(neither fit a permanent, queryable security trail over cost-bearing secrets;
no generic admin audit table exists in the repo — *draft assumption corrected*).

### 5. Safety layers: three independent tiers, fail-open moderation

Three independent protection layers apply in order:

1. **Sliding-window rate limit** (anti-burst). Reuses
   `createSlidingWindowPerUserRateLimit()` from
   `apps/api/src/middlewares/rate-limit.ts` (Redis-backed + in-memory fallback,
   SPEC-079/110). Per-user and per-IP. No new counter is built.

2. **Monthly per-feature plan quotas** (billing enforcement). Via
   `entitlementMiddleware()` and the existing 5-min cache. Only successful calls
   and fallback calls consume quota; rejected calls are metered but do not count.
   Exceeding a limit returns `quota_exceeded` status and a `403` with upgrade hint.

3. **Global/per-feature USD cost ceiling + kill-switch**. Hard-stop on breach of
   any ceiling; manual per-feature/provider kill-switch from admin. Threshold
   alerts at 50% / 80% / 100% sent via `@repo/notifications` (the package itself
   does NOT send alerts — it signals to `apps/api` which calls `@repo/notifications`).

Additional safety at the engine chokepoint:

- **Prompt-injection guard**: syntactic sanitization + injection detection. Policy
  is detection-only; the guard never censors semantics. The caller decides policy.
- **Content moderation**: runs at the engine level (not in adapters) on both input
  and output for `generateText`/`generateObject`; input-only for `extractIntent`.
  Moderation is **fail-open** with a telemetry event — a moderation outage must
  not take down the AI layer.
- **PII scrubber**: email/phone/card (Luhn-validated) stripped from data before
  sending to Sentry/PostHog. The DB stores conversations verbatim (AC-11).
- **Streaming moderation**: output is moderated at stream drain; a violation
  raises a post-stream throw.

### 6. Streaming: `streamText` returning `{stream, meta}`; named SSE events

`@repo/ai-core` exposes `streamText(...)` returning `{ stream: AsyncIterable<string>, meta }`.
The `apps/api` route factory `createStreamingRoute()` adapts this to SSE
(`text/event-stream`) with named events: `token` (incremental text), `done`
(final metadata), `error` (structured error payload). Clients connect via POST
with `fetch` (POST-SSE).

Pre-stream engine errors map to HTTP status codes at the route factory:

| Engine error | HTTP |
|-------------|------|
| `MODERATION_BLOCKED` | 422 |
| `FEATURE_DISABLED` / `CEILING_HIT` / `NO_ENABLED_PROVIDER` | 503 |
| `ENGINE_EXHAUSTED` (all providers failed) | 502 |

### 7. Versioned prompts with mandatory code-level fallback

System prompts are stored in `ai_prompt_versions` (one active row per feature,
with history). Admin can edit prompts at runtime; changes take effect after the
5-min TTL cache expires (settings and prompts share the same TTL — a write
invalidates the cache).

A code-level default prompt is **mandatory** for every feature. If the active
admin prompt is missing or invalid, the engine falls back to the in-code default
and the feature continues serving. An empty/bad admin prompt must never brick a
feature (AC-12).

System-message injection from the caller wins over the stored prompt when both
are present.

### 8. Entitlement/limit keys in `@repo/billing`, per-feature, snake_case

AI quota keys live in `@repo/billing`
(`packages/billing/src/types/{entitlement,plan}.types.ts` and
`config/{entitlements,limits}.config.ts`), following the existing lowercase
`snake_case` convention. They do NOT live in `@repo/schemas` and are NOT uppercase
(*draft assumption corrected* — the original draft proposed UPPERCASE keys in
SPEC-152/`@repo/schemas`, which is wrong on both counts).

Per-feature is chosen over a shared credit pool because unit costs differ by
orders of magnitude (streaming RAG chat vs. a one-shot text-improve call) and
because §5.8 of the spec requires per-feature USD ceilings.

Gates (`EntitlementKey`): `ai_text_improve`, `ai_chat`, `ai_search`, `ai_support`.
Limits (`LimitKey`): `max_ai_text_improve_per_month`, `max_ai_chat_per_month`,
`max_ai_search_per_month`, `max_ai_support_per_month`.

These seed defaults are runtime-editable from the admin panel (SPEC-168).

## Consequences

### Positive

- A single `@repo/ai-core` package is the source of truth for all AI logic;
  `apps/api` routes stay thin; future features add adapters and call the facade.
- Swapping or adding a provider requires zero changes outside `packages/ai-core`
  (new adapter + config).
- The no-singleton, fresh-instance-per-call design means a rotated API key is
  picked up immediately — no restart, no leaked old credential.
- Three independent protection layers catch abuse at different granularities:
  burst (rate-limit), sustained overuse (monthly quota), and runaway cost
  (ceiling + kill-switch).
- Fail-open moderation ensures a moderation outage does not take down the AI
  surface entirely.
- The `StubProvider` makes the entire test suite deterministic and free to run in
  CI with zero provider API calls.

### Negative

- Tables in `@repo/db` make `@repo/ai-core` non-portable to another project.
  Accepted consciously; all DB access is isolated in `src/storage/` to contain
  the coupling.
- Micro-USD is a different unit from the rest of the billing system (centavos
  ARS). The mismatch is intentional and documented; any cross-system cost
  comparison requires an explicit unit conversion.
- The `createConfiguredAiService` factory adds an async pre-decrypt step to
  `apps/api` request handling. The overhead is small (one AES-GCM decrypt per
  credential on first build of the Map) and acceptable for the security benefit.
- Fresh-instance-per-call has a minor object-creation cost vs. a singleton.
  Negligible at expected request volumes; the correct-key-on-rotation benefit
  outweighs it.

### Neutral

- `@repo/ai-core` is coupled to `@repo/schemas` (Zod schemas live there per repo
  SSoT policy, Q3) — consistent with every other package in the monorepo.
- The `embed` capability interface is defined in V1 but unimplemented; the method
  signature is stable so child specs can reference it without waiting for pgvector.

## Alternatives Considered

### A. Single credential passed per-call (rejected)

Pass a `{ apiKey: string }` directly to every `AiService` method. Simpler
call sites, but forces callers to manage decryption, re-implement credential
selection per feature, and repeat key-lookup logic. Rejected: pushes plumbing
into every call site.

### B. Singleton `AiService` with vault polling (rejected)

One long-lived instance that polls for credential changes. Polling adds latency
and complexity; a cache-invalidation bug can serve a stale (revoked) key.
The factory-per-call pattern is simpler and correct by construction.

### C. Store AI quota keys in `@repo/schemas` with UPPERCASE names (rejected)

The spec draft proposed this. Code exploration showed `EntitlementKey`/`LimitKey`
live in `@repo/billing` and use `snake_case`. Placing AI keys elsewhere would
create a second source of truth and break the existing entitlement middleware.

### D. Shared credit pool instead of per-feature quotas (rejected)

Simpler to implement; harder to reason about cost at the feature level. The USD
ceiling logic in §5.8 requires per-feature breakdowns, and token costs differ
enough by feature that a shared pool would let one feature starve others silently.

### E. Inline moderation in each adapter (rejected)

Would require every future adapter to implement moderation. The engine-level
chokepoint guarantees consistent policy regardless of which adapter is active.

### F. Fail-closed moderation (rejected)

A moderation outage would take down all AI features simultaneously. For a
secondary safety layer (the primary being injection guard + rate-limit + auth
requirement), fail-open with telemetry is the right tradeoff.

## References

- `packages/ai-core/src/providers/ai-provider.interface.ts` — `AiProvider`
- `packages/ai-core/src/engine/` — routing, fallback, retries, `AiService`
- `packages/ai-core/src/safety/` — injection guard, moderation, PII scrubber
- `packages/ai-core/src/storage/` — isolated DB coupling
- `packages/ai-core/src/usage/` — metering recorder + cost calculator
- `packages/db/src/schemas/ai/` — `ai_settings`, `ai_provider_credentials`,
  `ai_credential_audit`, `ai_prompt_versions`, `ai_usage`, `ai_request_log`,
  `ai_conversations`, `ai_messages`
- `apps/api/src/services/ai-service.factory.ts` — `createConfiguredAiService` (vault decrypt + AiService factory)
- `packages/billing/src/types/entitlement.types.ts` — `ai_*` entitlement keys
- `packages/billing/src/types/plan.types.ts` — `max_ai_*_per_month` limit keys
- `apps/api/src/routes/ai/` — admin AI settings routes (`AI_SETTINGS_MANAGE`)
- ADR-006 — integer monetary values (centavos convention; AI uses micro-USD for precision)
- ADR-016 — billing fail-open policy (same fail-open philosophy applied to moderation)
- ADR-026 — collections limit strategy (per-feature limit pattern)
- SPEC-143 — billing test user matrix (role × plan enforcement)
- SPEC-145 — billing entitlements enforcement (AI quotas reuse this layer)
- SPEC-152 — admin-editable plan limits (AI limit keys live alongside existing ones)
- SPEC-168 — admin-editable billing plans (seed defaults are runtime-overridable)
