# @repo/ai-core

Provider-agnostic AI infrastructure for the Hospeda platform. Provides a routing
engine, capability facades, usage metering in integer micro-USD, safety guards,
versioned prompt resolution, and streaming primitives — all decoupled from any
specific LLM vendor.

Only `apps/api` consumes this package. Never import it directly in `apps/web` or
`apps/admin`.

See [ADR-031](../../docs/decisions/ADR-031-ai-core-foundation-architecture.md) for
the authoritative design record.

---

## Quick start

### In apps/api (production)

The canonical entry point is `createConfiguredAiService()` from
`apps/api/src/services/ai-service.factory.ts`. It decrypts vault credentials,
wires cost-ceiling checks, and returns a fully configured `AiService`:

```ts
import { createConfiguredAiService } from '../services/ai-service.factory.js';

const aiService = await createConfiguredAiService();
const result = await aiService.generateText({
  feature: 'text_improve',
  prompt: 'Fix the grammar in this listing description.',
});
console.log(result.text);
```

### In tests (StubProvider)

Use `createAiService` directly with `StubProvider` for deterministic, zero-network
tests:

```ts
import { createAiService, StubProvider } from '@repo/ai-core';

const aiService = createAiService({
  getProvider: () => new StubProvider(),
});

const result = await aiService.generateText({
  feature: 'text_improve',
  prompt: 'hello',
});
// result.text === '[stub:text_improve] hello'
```

---

## Capabilities

| Method | Return type | Description |
|---|---|---|
| `generateText(request)` | `Promise<GenerateTextResponse>` | Buffered text generation from a prompt or message history |
| `streamText(request)` | `Promise<{ stream, meta }>` | Streaming text generation; `stream` is `AsyncIterable<StreamTextChunk>`, `meta` resolves after drain |
| `generateObject(request, schema)` | `Promise<{ object: T } & GenerateObjectResponseMeta>` | Structured output validated against a caller-supplied Zod schema |
| `extractIntent(request)` | `Promise<AiIntent>` | Parses a natural-language query into a structured intent envelope |
| `moderate(request)` | `Promise<ModerateResponse>` | Evaluates text for content policy violations; bypasses feature routing |
| `embed(request)` | `Promise<EmbedOutput>` | V2 stub only — always throws `NotImplementedError` in V1 |

All `locale` fields are optional. When omitted the service fills in `defaultLocale`
(defaults to `'es'`, the Argentina market default).

### streamText consumer contract

`streamText` returns `{ stream, meta }`. Consumers **must drain `stream` before
`meta` resolves**. Pre-stream engine errors (kill-switch, ceiling, exhaustion) map
to HTTP status codes at the `apps/api` route layer:

| Engine error | HTTP |
|---|---|
| `MODERATION_BLOCKED` | 422 |
| `FEATURE_DISABLED` / `CEILING_HIT` / `NO_ENABLED_PROVIDER` | 503 |
| `ENGINE_EXHAUSTED` (all providers failed) | 502 |

If output moderation flags content after the stream is drained, the async
generator throws `AiModerationBlockedError` as the last item. The SSE consumer
must catch this and emit an `error` event so the client can discard the
already-shown content.

---

## Safety

Three independent protection layers apply in order before any provider is called:

| Layer | Mechanism | Scope |
|---|---|---|
| Burst control | `createSlidingWindowPerUserRateLimit()` (Redis + in-memory fallback) | Per-user + per-IP |
| Monthly quota | `entitlementMiddleware()` + 5-min cache | Per-plan, per-feature |
| Cost ceiling + kill-switch | `checkCostCeiling()` + admin kill-switch | Global + per-feature USD ceiling |

Additional safety at the engine chokepoint:

- **Injection guard** (`guardPromptInjection`): syntactic sanitisation and detection
  of override phrases in English and Spanish. Detection-only policy — the guard
  reports `{ flagged, severity, matches }` but never censors semantic content. The
  caller decides the enforcement policy.
- **PII scrubber** (`scrubPii`): redacts email, phone (including Argentine formats),
  and payment cards (Luhn-validated) from data before it reaches Sentry/PostHog.
  The database stores conversations verbatim (AC-11 contract).
- **Content moderation** (`moderate`): runs at the engine level on both input and
  output for `generateText`/`generateObject`; input-only for `extractIntent`.
  Policy is **fail-open** — a moderation outage emits a telemetry event but does
  not take down the AI layer.
- **Streaming moderation**: output is moderated at stream drain. A violation raises
  `AiModerationBlockedError` from within the async generator after the last token.

---

## Configuration

Admin-managed configuration is stored in the `ai_settings` JSONB blob
(`platform_settings` table in `@repo/db`). The resolver caches the blob in memory
with a **5-minute TTL**. On every admin save, `saveConfig()` (or
`invalidateConfigCache()`) clears the cache immediately so the next call reads
fresh data (R-7 stale-read prevention).

```ts
import { resolveConfig, saveConfig, invalidateConfigCache } from '@repo/ai-core';

// Read the full settings blob (cached, TTL 5 min)
const settings = await resolveConfig();

// Save + invalidate cache atomically
await saveConfig({ settings: updatedSettings });

// Invalidate cache without writing (e.g. after a transactional write)
invalidateConfigCache();
```

The same 5-minute TTL applies to system prompts via `resolveSystemPrompt()` and
`invalidatePromptCache()`.

### Prompt resolution

System prompts are stored in `ai_prompt_versions` (one active row per feature, with
history). Each row carries two editable fields:

- **`content`** — the conversational body of the system prompt.
- **`rules`** — the guardrails / policy block, edited independently from admin
  (SPEC-214). Nullable: a `null`/blank value falls back to `DEFAULT_RULES[feature]`
  at runtime.

The admin can edit both fields at runtime; changes take effect after the TTL
expires or the cache is invalidated.

A code-level default is **mandatory** for every feature (AC-12). `content` falls
back to `DEFAULT_PROMPTS[feature]` and `rules` to `DEFAULT_RULES[feature]` — both in
`src/engine/default-prompts.ts`. The two fall back **independently**: an admin row
may override `content` while leaving `rules` null (so the default guardrails still
apply), and vice versa. `resolveSystemPrompt()` returns `{ content, rules, source }`.

**Composition.** The effective system prompt is `content` + a blank line + `rules`,
with the rules block appended **last** as the authoritative guardrail. Use the
`composeSystemPrompt()` helper — never concatenate by hand:

```ts
import { resolveSystemPrompt, composeSystemPrompt } from '@repo/ai-core';

const { content, rules } = await resolveSystemPrompt({ feature: 'text_improve' });
const systemPrompt = composeSystemPrompt({ content, rules });
// systemPrompt === `${content}\n\n${rules}` (a blank/missing rules returns content unchanged)
```

System-message injection from the caller wins over the stored prompt when both are
present.

> **`support` feature.** Its `content`/`rules` are seeded and editable from admin,
> but `support` has **no runtime API route** yet, so composition is not exercised
> for it. The field exists for forward compatibility; do not assume a live endpoint.

---

## AC-4 isolation rules

Four hard import boundaries are enforced in CI by `ac4-isolation-guard.test.ts`:

1. `@repo/db` may only be imported inside `src/storage/`.
2. `ai` and `@ai-sdk/*` may only be imported inside `src/providers/`.
3. `@repo/notifications` must never be imported anywhere in the package.
4. `process.env` must never be read anywhere in the package.

Credentials arrive by parameter at call time. `apps/api` holds
`HOSPEDA_AI_VAULT_MASTER_KEY`, decrypts provider keys with AES-256-GCM, and passes
plaintext credentials to `@repo/ai-core` via the factory. The package is
credential-free by design.

---

## Testing

### StubProvider

`StubProvider` implements `AiProvider` with zero network calls. Responses are
deterministic — same input always yields the same output:

- `generateText`: echoes the prompt as `[stub:${feature}] ${text}`.
- `streamText`: emits three fixed delta chunks derived from the echo formula, then
  resolves `meta` with fixed token counts.
- `generateObject`: attempts `schema.safeParse` on the echo string; falls back to
  `schema.parse({})` so tests can supply schemas whose empty-object parses succeed.
- `extractIntent`: returns a fixed intent with `kind: 'stub'`, confidence `0.99`,
  empty entities, and the original query as `rawQuery`.
- `moderate`: always returns `{ flagged: false, categories: {} }`.

Flagged-content tests: pass `'[stub:flagged]'` in the prompt to trigger
`AiModerationBlockedError` from the stub.

### Test conventions

- Framework: Vitest
- Pattern: AAA (Arrange, Act, Assert)
- DB calls: mock via `vi.mock('../storage/index.js')` — never hit a real DB in unit
  tests. Integration tests in `test/integration/` use `StubProvider` throughout.
- Real provider calls: never in any test. `StubProvider` is the only permitted
  provider in tests.

---

## Environment variables

This package reads **no environment variables**. The env var
`HOSPEDA_AI_VAULT_MASTER_KEY` is registered in `@repo/config` and validated in
`apps/api/src/utils/env.ts`. The vault decrypt happens in
`apps/api/src/services/ai-service.factory.ts`, outside this package.
