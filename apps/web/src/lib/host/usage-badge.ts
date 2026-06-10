/**
 * @file usage-badge.ts
 * @description Pure helpers for the host property-listing plan/limit awareness
 * badge. Centralises the usage API path segment and response parsing so both
 * the Astro page and unit tests share a single implementation.
 *
 * The API wraps every protected response in `{ success, data, metadata }` via
 * `createResponse` in `apps/api/src/utils/response-helpers.ts`. This module
 * reads `response.data` to unwrap that envelope — a previous inline
 * implementation read `response.maxAllowed` directly, which is always `undefined`
 * and caused the badge to never render (Bug 1 fix).
 *
 * The limit key path segment must be the lowercase *value* of
 * `LimitKey.MAX_ACCOMMODATIONS` because `z.nativeEnum(LimitKey)` accepts only
 * the enum value, not its key name. Using the imported constant (SSOT from
 * `@repo/billing`) guarantees the two stay in sync automatically (Bug 2 fix).
 */

import { LimitKey } from '@repo/billing';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

/**
 * Path segment used in `GET /api/v1/protected/billing/usage/<limitKey>`.
 *
 * This is the enum **value** (`'max_accommodations'`) of
 * `LimitKey.MAX_ACCOMMODATIONS` — the API validates the path param with
 * `z.nativeEnum(LimitKey)`, which only accepts the value, not the name.
 * Sourced directly from `@repo/billing` to avoid out-of-sync drift.
 */
export const MAX_ACCOMMODATIONS_LIMIT_KEY = LimitKey.MAX_ACCOMMODATIONS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Parsed usage data extracted from the API response.
 * All fields are guaranteed to be present when this type is returned.
 */
export interface UsageBadgeData {
    /** Number of accommodations currently published by the host. */
    readonly currentUsage: number;
    /** Maximum accommodations allowed on the host's current plan. */
    readonly maxAllowed: number;
    /**
     * Threshold indicator emitted by the API:
     * `'ok'` | `'warning'` | `'critical'` | `'exceeded'`.
     */
    readonly threshold: string;
}

// ---------------------------------------------------------------------------
// Internal guard
// ---------------------------------------------------------------------------

/**
 * Narrows an `unknown` value to a plain object with string keys.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Parse the raw JSON body from `GET /api/v1/protected/billing/usage/<key>`.
 *
 * The API wraps every protected response in `{ success, data, metadata }`.
 * This function reads `json.data` to unwrap the envelope, then validates the
 * mandatory `maxAllowed` field before returning a typed object.
 *
 * Returns `null` when:
 * - `json` is not a plain object.
 * - `json.data` is missing, `null`, or not a plain object.
 * - `json.data.maxAllowed` is missing or not a number.
 *
 * Optional fields (`currentUsage`, `threshold`) receive safe defaults:
 * `0` and `'ok'` respectively, matching the behaviour the page previously
 * expressed in its inline fallbacks.
 *
 * @param params.json - The raw value returned by `response.json()` (typed `unknown`).
 * @returns Parsed {@link UsageBadgeData} or `null` if the shape is invalid.
 *
 * @example
 * ```ts
 * const usageData = parseUsageResponse({ json: await res.json() });
 * if (usageData) {
 *   // render badge with usageData.currentUsage / usageData.maxAllowed
 * }
 * ```
 */
export function parseUsageResponse({
    json
}: {
    readonly json: unknown;
}): UsageBadgeData | null {
    if (!isRecord(json)) {
        return null;
    }

    const data = json.data;

    if (!isRecord(data)) {
        return null;
    }

    const maxAllowed = data.maxAllowed;
    if (typeof maxAllowed !== 'number') {
        return null;
    }

    const currentUsageRaw = data.currentUsage;
    const currentUsage = typeof currentUsageRaw === 'number' ? currentUsageRaw : 0;

    const thresholdRaw = data.threshold;
    const threshold = typeof thresholdRaw === 'string' ? thresholdRaw : 'ok';

    return { currentUsage, maxAllowed, threshold };
}
