/**
 * Loader for the DB-configured AI model rate overrides (HOS-2096).
 *
 * `recordAiUsage` accepts `rateOverrides` sourced from `ai_settings.modelRates`
 * (hybrid in-code default + optional DB override), but no call site passed
 * them, so a rate configured in the admin settings had no effect on the cost
 * recorded in `ai_usage`.
 *
 * The blob is read through `resolveConfig()`, which is backed by an in-memory
 * TTL cache, so calling this on every metered request does not add a DB
 * round-trip in steady state.
 *
 * @module utils/ai-rate-overrides
 */

import { resolveConfig } from '@repo/ai-core';
import type { AiModelRate } from '@repo/schemas';
import { apiLogger } from './logger';

/**
 * Returns the `ai_settings.modelRates` overrides, or `undefined` when none are
 * configured or the settings cannot be read.
 *
 * Never throws: metering runs after the AI work was delivered, and a settings
 * read failure must degrade to the in-code `MODEL_RATES` defaults rather than
 * fail the request.
 *
 * @returns Per-model rates keyed by model id, or `undefined`.
 */
export async function loadModelRateOverrides(): Promise<
    Readonly<Record<string, AiModelRate>> | undefined
> {
    try {
        const config = await resolveConfig();
        return config.modelRates;
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'ai-usage: could not read ai_settings.modelRates; falling back to in-code MODEL_RATES'
        );
        return undefined;
    }
}
