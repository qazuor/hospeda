/**
 * Model rate resolution and "missing rate" reporting (HOS-2096).
 *
 * A model with no rate silently costs 0 in `ai_usage.cost_estimate_micro_usd`,
 * which means the monthly dollar ceiling can never fire for it. This module
 * makes that state observable without changing any billing/quota behavior:
 *
 * - {@link resolveModelRate} is a pure lookup that reports WHERE a rate came
 *   from (`'db'` override, in-code `'code'` default, or `'missing'`).
 * - {@link reportMissingModelRate} invokes a caller-supplied hook ONCE per model
 *   per process (module-level dedupe), because every metered call of an unrated
 *   model would otherwise log the same warning.
 *
 * `@repo/ai-core` has no logger by design, so the warning itself is emitted by
 * the hook the caller injects (see `apps/api` `warnMissingModelRate`).
 *
 * @module ai-core/usage/model-rate-resolver
 */

import type { AiModelRate } from '@repo/schemas';
import { MODEL_RATES } from './model-rates.js';

/** Where a resolved rate came from. */
export type ModelRateSource = 'db' | 'code' | 'missing';

/** Input for {@link resolveModelRate}. */
export interface ResolveModelRateInput {
    /** Model identifier used as the lookup key. */
    readonly model: string;
    /** Optional per-model overrides from `ai_settings.modelRates`. */
    readonly overrides?: Readonly<Record<string, AiModelRate>>;
}

/** Result of {@link resolveModelRate}. `rate` is `undefined` iff `source === 'missing'`. */
export interface ResolveModelRateResult {
    readonly rate: AiModelRate | undefined;
    readonly source: ModelRateSource;
}

/**
 * Resolves the cost rate for a model using the same precedence as
 * `calculateCostMicroUsd`: DB override first, then the in-code default.
 *
 * @param input - {@link ResolveModelRateInput}
 * @returns The rate and its source; `{ rate: undefined, source: 'missing' }` when none exists.
 */
export function resolveModelRate(input: ResolveModelRateInput): ResolveModelRateResult {
    const { model, overrides } = input;
    const override = overrides?.[model];
    if (override !== undefined) return { rate: override, source: 'db' };
    const fallback = MODEL_RATES[model];
    if (fallback !== undefined) return { rate: fallback, source: 'code' };
    return { rate: undefined, source: 'missing' };
}

/**
 * Whether a model has a cost rate (override or in-code default).
 *
 * @param input - {@link ResolveModelRateInput}
 * @returns `true` when a rate exists.
 */
export function hasModelRate(input: ResolveModelRateInput): boolean {
    return resolveModelRate(input).source !== 'missing';
}

/** Payload delivered to {@link MissingModelRateHook}. */
export interface MissingModelRateInput {
    readonly provider: string;
    readonly model: string;
}

/**
 * Hook invoked once per unrated model per process. Must not throw; a throwing
 * hook is swallowed so metering can never break.
 */
export type MissingModelRateHook = (input: MissingModelRateInput) => void;

const warnedModels = new Set<string>();

/**
 * Calls `onMissingRate` the first time `model` is seen without a rate in this
 * process, and never again for that model (log-spam guard). Safe to call on
 * every metered call. Errors thrown by the hook are swallowed.
 *
 * @param input - Provider/model plus the optional hook.
 */
export function reportMissingModelRate(
    input: MissingModelRateInput & { readonly onMissingRate?: MissingModelRateHook }
): void {
    const { provider, model, onMissingRate } = input;
    if (onMissingRate === undefined || warnedModels.has(model)) return;
    warnedModels.add(model);
    try {
        onMissingRate({ provider, model });
    } catch {
        // Metering must never fail because of an observability hook.
    }
}

/** Clears the once-per-model memory. Test-only. */
export function resetMissingModelRateWarnings(): void {
    warnedModels.clear();
}
