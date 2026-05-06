/**
 * @file format-expires.ts
 * @description Utility to compute the expiry status of a post or entity
 * relative to a reference timestamp. Returns a discriminated union that
 * callers use for badge rendering and expiry banners.
 */

const MS_PER_DAY = 86_400_000;
const SOON_THRESHOLD_DAYS = 7;

/**
 * Classifies an expiration date into one of three mutually exclusive states.
 *
 * @param params.expiresAt - ISO 8601 string or Date representing the expiry
 *   moment. When absent or unparseable the function returns `{ status: 'active',
 *   daysRemaining: null }`.
 * @param params.now - Reference timestamp (defaults to `Date.now()`). Injected
 *   in tests for deterministic boundary checks.
 * @returns An object with the resolved `status` and `daysRemaining` (integer
 *   number of full days remaining, or `null` when `expiresAt` is absent).
 */
export function getExpiryStatus({
    expiresAt,
    now = Date.now()
}: {
    readonly expiresAt?: string | Date | null;
    readonly now?: number;
}): {
    readonly status: 'active' | 'expiring-soon' | 'expired';
    readonly daysRemaining: number | null;
} {
    if (!expiresAt) return { status: 'active', daysRemaining: null };

    const expiresMs =
        expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();

    if (Number.isNaN(expiresMs)) return { status: 'active', daysRemaining: null };

    const diffMs = expiresMs - now;
    const daysRemaining = Math.floor(diffMs / MS_PER_DAY);

    if (diffMs <= 0) return { status: 'expired', daysRemaining };
    if (daysRemaining < SOON_THRESHOLD_DAYS) return { status: 'expiring-soon', daysRemaining };
    return { status: 'active', daysRemaining };
}
