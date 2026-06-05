/**
 * Runtime type guards for billing enum keys.
 *
 * Provides narrowing helpers that replace `as EntitlementKey` / `as LimitKey`
 * casts on externally-sourced strings (QZPay API responses, DB JSONB fields,
 * Zod `string[]` plan responses). Each guard validates against the actual
 * enum values at runtime, so unknown strings are rejected rather than
 * silently trusted.
 *
 * @module types/guards
 */

import { EntitlementKey } from './entitlement.types.js';
import { LimitKey } from './plan.types.js';

/** Pre-computed set of valid EntitlementKey string values for O(1) lookup. */
const ENTITLEMENT_KEY_SET: ReadonlySet<string> = new Set(Object.values(EntitlementKey));

/** Pre-computed set of valid LimitKey string values for O(1) lookup. */
const LIMIT_KEY_SET: ReadonlySet<string> = new Set(Object.values(LimitKey));

/**
 * Type guard — narrows `value` to {@link EntitlementKey}.
 *
 * Returns `true` when `value` is a non-empty string that matches one of the
 * defined {@link EntitlementKey} enum values. Use this instead of `as EntitlementKey`
 * wherever the string originates from an external source (API response, DB
 * column, Zod `z.array(z.string())`).
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a valid {@link EntitlementKey}.
 *
 * @example
 * ```ts
 * const raw: string[] = plan.entitlements ?? [];
 * const typed: EntitlementKey[] = raw.filter(isEntitlementKey);
 * ```
 */
export function isEntitlementKey(value: unknown): value is EntitlementKey {
    return typeof value === 'string' && ENTITLEMENT_KEY_SET.has(value);
}

/**
 * Type guard — narrows `value` to {@link LimitKey}.
 *
 * Returns `true` when `value` is a non-empty string that matches one of the
 * defined {@link LimitKey} enum values. Use this instead of `as LimitKey`
 * wherever the string originates from an external source (API response, DB
 * column, `Object.entries()` over a `Record<string, number>`).
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a valid {@link LimitKey}.
 *
 * @example
 * ```ts
 * for (const [key, value] of Object.entries(plan.limits ?? {})) {
 *     if (isLimitKey(key)) {
 *         limits.set(key, value);
 *     }
 * }
 * ```
 */
export function isLimitKey(value: unknown): value is LimitKey {
    return typeof value === 'string' && LIMIT_KEY_SET.has(value);
}
