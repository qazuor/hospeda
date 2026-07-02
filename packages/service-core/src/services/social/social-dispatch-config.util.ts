/**
 * Pure bounds-validation for numeric `social_settings` values consumed by the
 * publish-dispatch pipeline (HOS-64 / SPEC-297a G-2, risk item R-1).
 *
 * No DB/IO — callers resolve the raw stored string via `SocialSettingModel`
 * and pass it through {@link resolveBoundedNumericSetting}, which parses,
 * range-checks, and falls back to the hard-coded default on anything
 * missing, non-numeric, or out of bounds. This protects the cron/dispatch
 * pipeline from an operator-entered value (e.g. `max_retry_count = 0` or
 * `make_webhook_timeout_ms = 999999999`) taking down publishing.
 */

/** Input for {@link resolveBoundedNumericSetting}. */
export interface ResolveBoundedNumericSettingInput {
    /** Raw stored `social_settings.value`, or `undefined`/`null` if the row is missing. */
    rawValue: string | null | undefined;
    /** Inclusive lower bound. Values below this fall back to `fallback`. */
    min: number;
    /** Inclusive upper bound. Values above this fall back to `fallback`. */
    max: number;
    /** Value used when `rawValue` is missing, non-numeric, or out of `[min, max]`. */
    fallback: number;
}

/**
 * Parses a `social_settings` numeric value and clamps it to a safe range,
 * falling back to a hard-coded default on any invalid input.
 *
 * @param input - The raw setting value and its valid bounds/fallback.
 * @returns The parsed value if it is a finite number within `[min, max]`, otherwise `fallback`.
 */
export function resolveBoundedNumericSetting(input: ResolveBoundedNumericSettingInput): number {
    const { rawValue, min, max, fallback } = input;

    if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
        return fallback;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        return fallback;
    }

    return parsed;
}

/** `social_settings` key for the max retry count before a target is marked FAILED. */
export const MAX_RETRY_COUNT_KEY = 'max_retry_count';

/** Bounds + fallback for `max_retry_count`. See {@link resolveBoundedNumericSetting}. */
export const MAX_RETRY_COUNT_BOUNDS = { min: 1, max: 10, fallback: 3 } as const;

/** `social_settings` key for the Make.com webhook HTTP call timeout, in milliseconds. */
export const MAKE_WEBHOOK_TIMEOUT_MS_KEY = 'make_webhook_timeout_ms';

/** Bounds + fallback for `make_webhook_timeout_ms`. See {@link resolveBoundedNumericSetting}. */
export const MAKE_WEBHOOK_TIMEOUT_MS_BOUNDS = {
    min: 5_000,
    max: 120_000,
    fallback: 40_000
} as const;
