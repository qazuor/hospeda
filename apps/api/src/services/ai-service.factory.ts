/**
 * AI Service Factory — runtime wiring for `apps/api` (SPEC-173 T-043).
 *
 * Produces a fully-configured {@link AiService} by:
 *
 * 1. **Decrypting real-provider keys** from `ai_provider_credentials` via
 *    `getDecryptedAiProviderCredential`.  A missing credential for a provider
 *    is a soft failure — that provider is simply unavailable (no error thrown
 *    during construction).
 * 2. **Building a sync `getProvider` factory** backed by a pre-decrypted
 *    `Map<AiProviderId, string>`.  The map is populated once per
 *    `createConfiguredAiService()` call.  A caller for an unconfigured real
 *    provider receives a thrown `Error`; `'stub'` always resolves to
 *    `new StubProvider()`.
 * 3. **Wiring `checkCeiling`** via `checkCostCeiling` (from `@repo/ai-core`)
 *    composed with the de-duplication alert hook from `createAiCostThresholdAlertHook`.
 * 4. **Wiring `getNow`** as `() => new Date()` — always fresh wall-clock time.
 * 5. **Wiring `recordEvent`** as a structured debug log entry (NOT usage-metering;
 *    per-call metering + Sentry are out of scope for T-043).
 *
 * ## No-cache decision (owner-approved 2026-06-05)
 *
 * `createConfiguredAiService()` ALWAYS constructs a fresh service on each call
 * (no module-level singleton, no cache).  Rationale: a fresh instance guarantees
 * the latest encrypted key from the vault is used immediately after a rotation,
 * with no stale-credential window.  A singleton + invalidation mechanism can be
 * added later if profiling demonstrates a measurable overhead (YAGNI).
 *
 * ## AC-4 compliance
 *
 * This file MUST NOT import `ai` or `@ai-sdk/*` directly.  All SDK surface is
 * accessed through the adapter classes re-exported from `@repo/ai-core`.
 *
 * @module services/ai-service.factory
 */

import {
    AnthropicAdapter,
    OpenAiAdapter,
    StubProvider,
    checkCostCeiling,
    createAiService
} from '@repo/ai-core';
import type { AiService } from '@repo/ai-core';
import type { AiProviderId } from '@repo/schemas';
import { apiLogger } from '../utils/logger.js';
import { createAiCostThresholdAlertHook } from './ai-cost-alert.service.js';
import { getDecryptedAiProviderCredential } from './ai-credential-vault.service.js';
import { createAiObservabilityRecordEvent } from './ai-observability.service.js';

// ---------------------------------------------------------------------------
// Testable seam: provider factory from a pre-built key map
// ---------------------------------------------------------------------------

/**
 * Builds the sync `getProvider` factory from a pre-decrypted key map.
 *
 * Exported as a testable seam so the adapter-mapping logic can be unit-tested
 * without touching the vault or a real database.
 *
 * Decision (owner-approved 2026-06-05): `getProvider` is SYNC.  The factory
 * pre-decrypts all available keys into a `Map` during async construction; at
 * call time `getProvider` reads the map synchronously and instantiates the
 * appropriate adapter.  This matches the `CreateAiEngineInput.getProvider`
 * contract (sync factory).
 *
 * @param keyMap - Pre-populated map of provider IDs to plaintext API keys.
 * @returns A sync provider factory matching `CreateAiEngineInput.getProvider`.
 */
export function buildGetProvider(
    keyMap: ReadonlyMap<AiProviderId, string>
): (
    id: AiProviderId
) => InstanceType<typeof OpenAiAdapter | typeof AnthropicAdapter | typeof StubProvider> {
    return (id: AiProviderId) => {
        // 'stub' always resolves — useful for testing and feature-flag fallback.
        if (id === 'stub') {
            return new StubProvider();
        }

        // Validate the provider ID before attempting a key lookup, so callers
        // receive a clear error when an unsupported provider is requested.
        if (id !== 'openai' && id !== 'anthropic') {
            throw new Error(`Unknown AI provider '${id}'. Add support to buildGetProvider.`);
        }

        const key = keyMap.get(id);

        if (key === undefined) {
            throw new Error(
                `No AI credential configured for provider '${id}'. Store a key via the admin credentials API first.`
            );
        }

        if (id === 'openai') {
            return new OpenAiAdapter({ apiKey: key });
        }

        // id === 'anthropic' — exhaustive after the check above.
        return new AnthropicAdapter({ apiKey: key });
    };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Creates a fully-configured {@link AiService} wired with:
 *
 * - Real provider adapters backed by decrypted vault credentials.
 * - `checkCostCeiling` (cost-ceiling guard, AC-8) with the de-duplication
 *   alert hook from `createAiCostThresholdAlertHook`.
 * - `getNow: () => new Date()` for deterministic ceiling time injection.
 * - A debug-level structured `recordEvent` logger.
 *
 * Missing credentials for a specific provider are silently skipped during
 * construction — the provider becomes unavailable (calling it at request
 * time throws a descriptive error).  This avoids breaking the service
 * startup when, e.g., only one of two providers is configured.
 *
 * @returns A promise that resolves to the configured {@link AiService}.
 *
 * @example
 * ```ts
 * // In apps/api route handlers (T-043):
 * const aiService = await createConfiguredAiService();
 * const result = await aiService.generateText({ feature: 'text_improve', prompt: '...' });
 * ```
 */
export async function createConfiguredAiService(): Promise<AiService> {
    // -----------------------------------------------------------------------
    // 1. Decrypt real-provider keys into a map.
    //    Failure to decrypt a single provider is non-fatal — that provider
    //    simply won't be available at call time.  NEVER log plaintext keys.
    // -----------------------------------------------------------------------
    const keyMap = new Map<AiProviderId, string>();

    for (const providerId of ['openai', 'anthropic'] as const) {
        const result = await getDecryptedAiProviderCredential({ providerId });
        if (result.data !== undefined) {
            keyMap.set(providerId, result.data.plaintextKey);
            // Log only the providerId — NEVER the key value.
            apiLogger.debug({ providerId }, 'ai-service.factory: credential loaded for provider');
        } else {
            apiLogger.debug(
                { providerId },
                'ai-service.factory: no active credential for provider (provider unavailable)'
            );
        }
    }

    // -----------------------------------------------------------------------
    // 2. Build the cost-ceiling alert hook (de-dup via billing_notification_log).
    // -----------------------------------------------------------------------
    const alertHook = createAiCostThresholdAlertHook();

    // -----------------------------------------------------------------------
    // 3. Assemble and return the configured service.
    // -----------------------------------------------------------------------
    return createAiService({
        getProvider: buildGetProvider(keyMap),

        // T-035: fan-out to structured logging, Sentry breadcrumbs/captures,
        // and PostHog analytics events. The sink is fire-and-forget and never
        // throws into the engine.
        recordEvent: createAiObservabilityRecordEvent(),

        checkCeiling: ({ feature, now }) =>
            checkCostCeiling({ feature, now, onThresholdAlert: alertHook }),

        getNow: () => new Date(),

        defaultLocale: 'es'
    });
}
