/**
 * Integration test suite index for `@repo/ai-core` (SPEC-173).
 *
 * Vitest discovers test files automatically via `test/**\/*.test.ts` glob
 * configured in `vitest.config.ts`. This file documents the integration suite
 * structure and serves as a navigation reference — it does NOT register files
 * manually (that would conflict with Vitest's discovery).
 *
 * ## Suite layout
 *
 * | File                    | AC  | Coverage |
 * |-------------------------|-----|----------|
 * | `engine.test.ts`        | AC-1 | `generateText`/`streamText` response shape, provider-order fallback (Anthropic → OpenAI), `maxTokens` override, stream event ordering, soft-fail on empty context |
 * | `entitlements.test.ts`  | AC-2 | Usage ceiling → `AiCeilingHitError`, hard-stop before provider, refund-on-error status semantics, limits-per-plan matrix via `calculateCostMicroUsd`, `>=` ceiling boundary |
 * | `app-context.test.ts`   | AC-4 | `recordEvent` fires correct event shapes (`success`, `fallback`, `exhausted`, `kill_switch`), stable `engineCode` strings, event ordering in fallback chain, no-op when sink absent |
 * | `models.test.ts`        | AC-5 | `AiProviderIdSchema` ↔ adapter registry, `AiFeatureSchema` V1 set, cost estimates ±5% of reference (3 spot-checks), fallback model routing, `MODEL_RATES` pricing invariants |
 *
 * @module test/integration
 */
