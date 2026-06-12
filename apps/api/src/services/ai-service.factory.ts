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
    AiProviderUnconfiguredError,
    AnthropicAdapter,
    OpenAiAdapter,
    StubProvider,
    checkCostCeiling,
    createAiService,
    resolveConfig
} from '@repo/ai-core';
import type { AiService } from '@repo/ai-core';
import { aiProviderCredentials, getDb } from '@repo/db';
import type { AiProviderId } from '@repo/schemas';
import { isNull } from 'drizzle-orm';
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
 * appropriate adapter.
 *
 * **Extensible provider support**: any provider ID NOT in `BUILTIN_PROVIDERS`
 * is treated as an OpenAI-compatible endpoint. The credential's `metadata.baseURL`
 * is forwarded to `createOpenAI({ baseURL })`. If a custom provider has no
 * `baseURL` configured, a clear error is thrown.
 *
 * @param keyMap - Pre-populated map of provider IDs to plaintext API keys.
 * @param metadataMap - Map of provider IDs to their metadata (containing optional `baseURL`).
 * @returns A sync provider factory matching `CreateAiEngineInput.getProvider`.
 */
export function buildGetProvider(
    keyMap: ReadonlyMap<AiProviderId, string>,
    metadataMap?: ReadonlyMap<AiProviderId, Record<string, unknown>>
): (
    id: AiProviderId
) => InstanceType<typeof OpenAiAdapter | typeof AnthropicAdapter | typeof StubProvider> {
    return (id: AiProviderId) => {
        // 'stub' always resolves — useful for testing and feature-flag fallback.
        if (id === 'stub') {
            return new StubProvider();
        }

        // Built-in providers: use their dedicated adapters.
        if (id === 'openai') {
            const key = keyMap.get(id);
            if (key === undefined) {
                throw new AiProviderUnconfiguredError({ providerId: id });
            }
            return new OpenAiAdapter({ apiKey: key });
        }

        if (id === 'anthropic') {
            const key = keyMap.get(id);
            if (key === undefined) {
                throw new AiProviderUnconfiguredError({ providerId: id });
            }
            return new AnthropicAdapter({ apiKey: key });
        }

        // Custom provider: use OpenAI-compatible adapter with baseURL from metadata.
        const key = keyMap.get(id);
        if (key === undefined) {
            throw new AiProviderUnconfiguredError({ providerId: id });
        }

        const metadata = metadataMap?.get(id);
        const baseURL = metadata?.baseURL;

        if (typeof baseURL !== 'string' || baseURL.length === 0) {
            throw new Error(
                `Custom provider '${id}' has no baseURL configured. Set the baseURL in the credential metadata (e.g. "http://localhost:11434/v1" for Ollama).`
            );
        }

        // createOpenAI from @ai-sdk/openai supports ANY OpenAI-compatible API
        // via the baseURL option (Ollama, LM Studio, Together, Groq, DeepSeek, etc.).
        return new OpenAiAdapter({ apiKey: key, baseURL });
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
    const metadataMap = new Map<AiProviderId, Record<string, unknown>>();

    // Load ALL active credentials (built-in + custom providers).
    const db = getDb();
    const allProviders = await db
        .select({
            providerId: aiProviderCredentials.providerId,
            metadata: aiProviderCredentials.metadata
        })
        .from(aiProviderCredentials)
        .where(isNull(aiProviderCredentials.deletedAt));

    for (const { providerId, metadata } of allProviders) {
        const result = await getDecryptedAiProviderCredential({ providerId });
        if (result.data !== undefined) {
            keyMap.set(providerId, result.data.plaintextKey);
            if (metadata && typeof metadata === 'object') {
                metadataMap.set(providerId, metadata as Record<string, unknown>);
            }
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
    // 3. Resolve the moderation provider from ai_settings (opt-in).
    //    When no admin has configured moderation (moderation field absent),
    //    moderationProviderId stays undefined and the engine skips all
    //    moderation passes. No default 'openai' — requires explicit config.
    // -----------------------------------------------------------------------
    const aiConfig = await resolveConfig();
    const moderationProviderId = aiConfig.moderation?.providerId;

    // -----------------------------------------------------------------------
    // 4. Assemble and return the configured service.
    // -----------------------------------------------------------------------
    return createAiService({
        getProvider: buildGetProvider(keyMap, metadataMap),

        // T-035: fan-out to structured logging, Sentry breadcrumbs/captures,
        // and PostHog analytics events. The sink is fire-and-forget and never
        // throws into the engine.
        recordEvent: createAiObservabilityRecordEvent(),

        checkCeiling: ({ feature, now }) =>
            checkCostCeiling({ feature, now, onThresholdAlert: alertHook }),

        getNow: () => new Date(),

        defaultLocale: 'es',

        // Opt-in: undefined when no moderation provider is configured; the
        // engine skips moderation passes entirely in that case.
        moderationProviderId
    });
}
