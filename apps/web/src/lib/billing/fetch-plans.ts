/**
 * @file billing/fetch-plans.ts
 * @description Runtime helper for fetching active billing plans from the
 * public API endpoint. Replaces the build-time ALL_PLANS import so that
 * operator price edits are reflected without a redeploy (SPEC-168 D3, T-016).
 *
 * The public endpoint (`GET /api/v1/public/plans`) returns an array of plan
 * objects whose shape is designed to be backwards-compatible with the previous
 * ALL_PLANS config. We map the endpoint response to a type that PricingCardsGrid
 * can consume without modification.
 *
 * NOTE: `limits` in the API response is `Record<string, number>` (key → value
 * pairs). `PlanDefinition.limits` in @repo/billing is `LimitDefinition[]`
 * (array of objects with key/value/name/description). Because PricingCardsGrid
 * never reads the `limits` field directly — it only uses entitlements for the
 * feature bullets — we model `limits` as `Record<string, number>` in the local
 * type and satisfy the component Props with a compatible override type defined
 * in this module (see `PublicPlanData`).
 */

import { getApiUrl } from '@/lib/env';
import type { PlanCategory } from '@repo/billing';

/** Cache TTL in seconds set on the SSR response via `s-maxage`. */
export const PRICING_CACHE_MAX_AGE_SECONDS = 300;

/** Stale-while-revalidate window in seconds. */
export const PRICING_CACHE_SWR_SECONDS = 60;

/**
 * Shape of a single plan returned by `GET /api/v1/public/plans`.
 *
 * Mirrors the `PlanPublicSchema` defined in
 * `apps/api/src/routes/billing/public/listPlans.ts` (T-011).
 * `limits` is `Record<string, number>` in the API response (QZPay storage
 * format); `entitlements` is `string[]` (EntitlementKey values as strings).
 */
export interface PublicPlanData {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly description: string;
    readonly category: PlanCategory;
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number | null;
    readonly monthlyPriceUsdRef: number;
    readonly hasTrial: boolean;
    readonly trialDays: number;
    readonly isDefault: boolean;
    readonly sortOrder: number;
    readonly isActive: boolean;
    /** Entitlement keys as plain strings (compatible with EntitlementKey). */
    readonly entitlements: readonly string[];
    /** Limits as a key → numeric-value map (QZPay storage format). */
    readonly limits: Readonly<Record<string, number>>;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/**
 * Result of `fetchPublicPlans`. Either a successful payload or a graceful
 * error that allows the pricing page to render an empty state.
 */
export type FetchPlansResult =
    | { readonly ok: true; readonly plans: readonly PublicPlanData[] }
    | { readonly ok: false; readonly error: string };

/**
 * Fetch all active billing plans from the public API endpoint at runtime.
 *
 * Used by the SSR pricing pages (`/suscriptores/planes/` and
 * `/suscriptores/turistas/`) so that price changes made via the admin panel
 * are reflected without a site redeploy (SPEC-168 D3).
 *
 * The function never throws; network or parse errors are returned as
 * `{ ok: false, error }` so callers can degrade gracefully (empty state).
 *
 * @returns A result object with `ok: true, plans` on success, or
 *   `ok: false, error` when the API is unreachable or returns a non-OK status.
 */
export async function fetchPublicPlans(): Promise<FetchPlansResult> {
    const url = `${getApiUrl()}/api/v1/public/plans`;
    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' }
            // No credentials needed — this is a public, unauthenticated endpoint.
        });

        if (!response.ok) {
            return {
                ok: false,
                error: `Public plans endpoint returned HTTP ${response.status}`
            };
        }

        const body: unknown = await response.json();

        if (!Array.isArray(body)) {
            return { ok: false, error: 'Unexpected response shape: expected array' };
        }

        return { ok: true, plans: body as readonly PublicPlanData[] };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        return { ok: false, error: message };
    }
}

/**
 * Filter and sort a raw plan list for a given category, keeping only active
 * plans ordered by `sortOrder` ascending. Mirrors the filtering that the old
 * `ALL_PLANS`-based pages applied at build time.
 *
 * @param plans - Full plan list returned by the endpoint.
 * @param category - Target category to filter on (`owner`, `tourist`, etc.).
 * @returns Active plans for the given category, sorted by `sortOrder`.
 */
export function filterPlansByCategory(
    plans: readonly PublicPlanData[],
    category: PlanCategory
): readonly PublicPlanData[] {
    return plans
        .filter((plan) => plan.category === category && plan.isActive)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder);
}
