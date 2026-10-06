/**
 * @file billing/fetch-checkout-config.ts
 * @description Runtime helper for fetching read-only checkout-behavior flags
 * from the public API endpoint (`GET /api/v1/public/billing/checkout-config`).
 *
 * Introduced as a review fix on HOS-937 step 2: the payer-email confirm
 * dialog (`PayerEmailConfirmDialog`) only has an effect on the own-preapproval
 * checkout path, gated server-side (api-only) by
 * `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`. With the flag on, all four
 * checkouts (accommodation monthly/annual, gastronomy/experience, partner) create their
 * own `POST /preapproval` and bind `payer_email` server-side (HOS-937 step
 * 4); with it off (the default — production today) every path falls back to
 * MercadoPago's hosted share-link checkout, which silently discards
 * `payer_email`, so the dialog would be pure friction with zero effect. The
 * web app has no way to read an api-only env var directly, so it asks the
 * API instead — this keeps the flag single-sourced (no second `PUBLIC_*`
 * copy to drift out of sync across two Coolify apps).
 *
 * Field renamed from `ownPreapprovalMonthlyEnabled` to `ownPreapprovalEnabled`
 * (same PR that widened the gate in `PlanPurchaseButton`) once step 4
 * extended the underlying flag to all four checkouts — see
 * `getCheckoutConfig.ts`'s docblock for the full history.
 *
 * Fails CLOSED on any error (network, non-OK status, unexpected shape): the
 * dialog stays hidden, which matches the flag's own dark-by-default posture
 * and never adds friction the API didn't actually ask for.
 *
 * `newPaidSignupsFrozen` (admin-paused self-service signups) is parsed on its
 * own and falls back to `false` — the buttons keep rendering. That is safe:
 * the flag is a UX hint, and every checkout route refuses with
 * `NEW_PAID_SIGNUPS_FROZEN` server-side regardless, which the buttons already
 * translate into the same "paused" copy.
 */

import { getApiUrl } from '@/lib/env';

/**
 * Result of `fetchCheckoutConfig`. Always resolves — never throws — so
 * callers can use a safe default without a try/catch at the call site.
 */
export interface CheckoutConfig {
    /**
     * Whether the own-preapproval checkout path (HOS-937) is active. Drives
     * whether `PlanPurchaseButton` shows the payer-email confirm dialog
     * before a checkout.
     */
    readonly ownPreapprovalEnabled: boolean;
    /**
     * Whether an admin paused new self-service paid signups (billing
     * settings). When `true`, the checkout CTAs for a NEW plan, an owner
     * gastronomy/experience checkout and an add-on purchase render a "paused" notice
     * instead. Existing subscribers' actions (plan change, etc.) are untouched.
     */
    readonly newPaidSignupsFrozen: boolean;
}

/** Safe fallback — matches the API's own dark-by-default flag values. */
const FAIL_CLOSED_CONFIG: CheckoutConfig = {
    ownPreapprovalEnabled: false,
    newPaidSignupsFrozen: false
};

/**
 * Fetch public checkout-behavior flags from the API at runtime (SSR).
 *
 * Used by the SSR pricing pages' shared components (`PricingCardsGrid.astro`,
 * `PlanComparisonTable.astro`) so `PlanPurchaseButton` can gate the
 * payer-email confirm dialog on the actual server-side flag state instead of
 * showing it unconditionally.
 *
 * @returns The resolved config, or the fail-closed default
 *   (`ownPreapprovalEnabled: false`, `newPaidSignupsFrozen: false`) on any
 *   network/parse error or non-OK response — the same behavior as both flags
 *   being off.
 */
export async function fetchCheckoutConfig(): Promise<CheckoutConfig> {
    try {
        // HOS-1352: transitional until V2 (HOS-1356), see PR — public checkout-config endpoint no longer exists.
        const response = await fetch(`${getApiUrl()}/api/v1/public/billing/checkout-config`, {
            headers: { Accept: 'application/json' }
            // No credentials needed — this is a public, unauthenticated endpoint.
        });

        if (!response.ok) {
            return FAIL_CLOSED_CONFIG;
        }

        const body: unknown = await response.json();
        const data = (
            body as {
                data?: { ownPreapprovalEnabled?: unknown; newPaidSignupsFrozen?: unknown };
            } | null
        )?.data;

        if (typeof data?.ownPreapprovalEnabled !== 'boolean') {
            return FAIL_CLOSED_CONFIG;
        }

        return {
            ownPreapprovalEnabled: data.ownPreapprovalEnabled,
            // Strict `=== true`: an older API without the field, or a malformed
            // value, reads as "not frozen".
            newPaidSignupsFrozen: data.newPaidSignupsFrozen === true
        };
    } catch {
        return FAIL_CLOSED_CONFIG;
    }
}
