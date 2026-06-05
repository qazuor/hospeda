# CLAUDE.md - AI Core Package

> **Main docs**: [README.md](./README.md)
> **Design record**: [ADR-030](../../docs/decisions/ADR-030-ai-core-foundation-architecture.md)
> **Project guidelines**: [root CLAUDE.md](../../CLAUDE.md)

Provider-agnostic AI infrastructure package consumed exclusively by `apps/api`.
Exposes an engine, capability facades, usage metering, cost ceiling, safety guards,
versioned prompt resolution, and streaming primitives. Never reads env vars or vault
secrets — credentials arrive by parameter from `apps/api`.

---

## HARD RULES — read before touching any file

These four isolation rules are enforced in CI by `ac4-isolation-guard.test.ts`.
Violating any one of them will fail the PR:

| Rule | Restriction |
|---|---|
| `@repo/db` | Only in `src/storage/`. Nowhere else. |
| `ai` / `@ai-sdk/*` | Only in `src/providers/`. Nowhere else. |
| `@repo/notifications` | NEVER — alert sending lives in `apps/api`, not here. |
| `process.env` | NEVER — no env reads anywhere in the package. |

Additional invariants that must never be broken:

- **Cost unit = integer micro-USD.** 1 micro-USD = 0.000001 USD. Never use
  centavos (the rest of the repo's billing unit per ADR-006 — centavos round each
  token call to zero, making ceilings non-functional) and never use floats.
- **Period = calendar-month UTC.** All ceiling checks, quota resets, and usage
  reports use this boundary. Do not introduce local-time boundaries.
- **Engine is the moderation chokepoint.** Moderation runs inside the engine, not
  in individual adapters. Fail-open policy: a moderation outage emits a telemetry
  event but must never take down the AI layer.
- **`streamText` returns `{ stream, meta }`.** Consumers MUST drain `stream` before
  `meta` resolves. `meta` is a `Promise` that settles only after the last chunk.
- **Prompt resolution: caller-wins injection.** When a caller supplies a system
  message, it takes precedence over the admin-stored prompt.
- **`getProvider` is synchronous.** The async vault decrypt happens once in
  `apps/api/src/services/ai-service.factory.ts`, which pre-populates a
  `Map<AiProviderId, string>`. The engine's `getProvider` factory reads from that
  map synchronously at call time.

---

## Package structure

```
src/
├── providers/        # AiProvider interface + vendor SDK adapters (OpenAI, Anthropic, Stub)
├── engine/           # Routing, kill-switch, fallback, retry, AiService facade
├── capabilities/     # Per-capability helpers (generateText, streamText, etc.)
├── config/           # ai_settings resolver + TTL cache + prompt resolver
├── usage/            # Cost calculator, ceiling check, usage recorder, reporting
├── safety/           # Injection guard, PII scrubber
├── storage/          # DB coupling (ONLY place allowed to import @repo/db)
└── types/            # Shared provider-agnostic type definitions
```

Known debt: `src/engine/engine.ts` is 897 lines (exceeds the 500-line project
limit). This is a pre-existing condition — do not make it worse. Refactoring into
sub-modules is tracked as follow-up work.

---

## Where new code goes

### New capability

1. Add a `execute<CapabilityName>.capability.ts` file in `src/capabilities/`.
2. Export it from `src/capabilities/index.ts`.
3. Add the method to the `AiEngine` interface in `src/engine/engine.ts` and to the
   `AiService` interface and `createAiService` factory in `src/engine/ai-service.ts`.
4. Export the new input/output types from `src/engine/index.ts`.

### New provider adapter

1. Add a `vercel-<vendor>.adapter.ts` file in `src/providers/` implementing
   `AiProvider`.
2. Export the adapter and its options type from `src/providers/index.ts`.
3. Handle the new `AiProviderId` in `apps/api/src/services/ai-service.factory.ts`
   (`buildGetProvider`).
4. Add the new provider ID to `AiProviderIdSchema` in `@repo/schemas`.

---

## Testing conventions

- Framework: Vitest
- Pattern: AAA (Arrange, Act, Assert)
- DB calls: always mock via `vi.mock('../storage/index.js')` — never hit a real DB
  in unit tests.
- Integration tests live in `test/integration/` and use `StubProvider` throughout.
  They never make real provider API calls.
- Real-provider calls are not permitted in any test.
- `StubProvider` is the only permitted provider in tests.
- Flagged-content tests: include `'[stub:flagged]'` in the prompt to trigger
  `AiModerationBlockedError` from the stub.
- Avoid `.only()` and hard-coded `.skip()` — CI will reject them.

---

## Common gotchas

- **Centavos round to zero.** A token cost of $0.000002 USD in centavos ARS is
  zero after conversion. Cost ceilings only work with micro-USD integers.
- **`invalidateConfigCache()` on every admin write.** `saveConfig()` does this
  automatically. If you write `ai_settings` outside `saveConfig()` (e.g. inside a
  transaction), call `invalidateConfigCache()` explicitly afterwards, or the next
  read will return stale data (R-7).
- **Same TTL for prompts and settings.** `invalidatePromptCache()` is a separate
  call; an admin save that updates both must invalidate both caches.
- **No singleton `AiService`.** `createConfiguredAiService()` in `apps/api` always
  creates a fresh instance per call. A rotated provider key is picked up
  immediately without a restart.
- **`embed` is a V2 stub.** All V1 adapters throw `NotImplementedError` from their
  `embed` method. The interface is stable so child specs can reference it now.
- **`@repo/billing` owns the entitlement keys.** AI quota gates
  (`ai_text_improve`, `ai_chat`, `ai_search`, `ai_support`) and limit keys
  (`max_ai_*_per_month`) live in `packages/billing/src/types/`. They do NOT live
  in `@repo/schemas` and are NOT uppercase.

---

## Related documentation

- [ADR-030 — AI Foundation Architecture](../../docs/decisions/ADR-030-ai-core-foundation-architecture.md)
- [SPEC-173](../../.qtm/specs/SPEC-173-ai-core/spec.md)
- [ADR-006 — Integer Monetary Values](../../docs/decisions/ADR-006-integer-monetary-values.md)
- [ADR-016 — Billing fail-open policy](../../docs/decisions/ADR-016-billing-fail-open.md)
