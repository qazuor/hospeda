/**
 * Addon Lifecycle Service
 *
 * Provides strict QZPay revocation logic for addon purchases during subscription
 * cancellation.
 *
 * Unlike the resilient `removeAddonEntitlements()` in
 * `addon-entitlement.service.ts` (which swallows QZPay errors as warnings),
 * this service treats ALL QZPay revocation failures as FATAL — they propagate
 * upward so the caller can abort the cancellation or surface the error.
 *
 * Features:
 * - Strict entitlement revocation (throws on failure, no silent fallthrough)
 * - Strict limit removal (throws on failure, no silent fallthrough)
 * - Best-effort revocation for retired/removed addons (both channels, warnings only)
 * - Structured logging via apiLogger
 *
 * @module services/addon-lifecycle
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { AddonDefinition } from '@repo/billing';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { apiLogger } from '../utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * The type classification of an addon purchase, derived from its definition.
 *
 * - `'entitlement'`: the addon grants a boolean feature flag via `grantsEntitlement`
 * - `'limit'`: the addon increases a numeric limit via `affectsLimitKey`
 * - `'unknown'`: the addon definition was not found (retired/removed), so the type
 *    cannot be determined; both revocation channels are attempted as a best effort
 */
export type AddonType = 'entitlement' | 'limit' | 'unknown';

/**
 * Result of a single addon revocation attempt during subscription cancellation.
 */
export interface RevocationResult {
    /** The `billing_addon_purchases.id` that was processed. */
    purchaseId: string;
    /** The slug identifying the addon product. */
    addonSlug: string;
    /** Addon type as derived from the definition (or `'unknown'` if definition is missing). */
    addonType: AddonType;
    /** Whether the revocation succeeded or failed. */
    outcome: 'success' | 'failed';
    /**
     * Human-readable error message.
     * Only present when `outcome` is `'failed'`.
     */
    error?: string;
}

/**
 * Input for `revokeAddonForSubscriptionCancellation`.
 */
export interface RevokeAddonInput {
    /** Billing customer ID (QZPay). */
    customerId: string;
    /** The addon purchase record from the DB (`billing_addon_purchases`). */
    purchase: {
        /** UUID of the addon purchase row. */
        id: string;
        /** Addon slug (e.g., `'visibility-boost-7d'`). */
        addonSlug: string;
    };
    /**
     * Resolved addon definition from `@repo/billing`.
     * Pass `undefined` if the addon was retired and no longer exists in config.
     */
    addonDef: AddonDefinition | undefined;
    /** Initialised QZPay billing instance. */
    billing: QZPayBilling;
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Revokes a single addon purchase as part of a subscription cancellation flow.
 *
 * This function applies STRICT error semantics: any QZPay revocation failure is
 * re-thrown so the caller can decide whether to abort the cancellation or skip
 * this purchase. It does NOT swallow errors as warnings the way
 * `AddonEntitlementService.removeAddonEntitlements()` does.
 *
 * ### Revocation strategy by addon type
 *
 * **Entitlement addon** (`addonDef.grantsEntitlement` is set):
 * 1. Call `billing.entitlements.revokeBySource('addon', purchase.id)`.
 *    A count of 0 is NOT an error — the entitlement may have already expired.
 * 2. If `revokeBySource` throws, try the fallback
 *    `billing.entitlements.revoke(customerId, addonDef.grantsEntitlement)`.
 * 3. If the fallback also throws, the error propagates (FATAL).
 *
 * **Limit addon** (`addonDef.affectsLimitKey` is set):
 * 1. Call `billing.limits.removeBySource('addon', purchase.id)`.
 *    A count of 0 is NOT an error.
 * 2. If `removeBySource` throws, try the fallback
 *    `billing.limits.remove(customerId, addonDef.affectsLimitKey)`.
 * 3. If the fallback also throws, the error propagates (FATAL).
 *
 * **Unknown/retired addon** (`addonDef` is `undefined`):
 * Both `entitlements.revokeBySource` and `limits.removeBySource` are called
 * (we cannot know which channel was used). Errors from these calls are NOT
 * fatal — they are logged as warnings because the addon no longer exists in
 * config and a best-effort cleanup is acceptable.
 *
 * ### What this function does NOT do
 * - It does NOT update `billing_addon_purchases.status` — that is the caller's
 *   responsibility.
 * - It does NOT modify deprecated `subscription.metadata.addonAdjustments`.
 * - It does NOT check the subscription state in QZPay.
 *
 * @param input - Customer, purchase, optional addon definition, and billing instance.
 * @returns A {@link RevocationResult} describing the outcome.
 *
 * @throws Will re-throw QZPay errors for known addon types (entitlement and limit)
 *         when both the primary call and the fallback both fail. The caller is
 *         responsible for deciding whether to abort or continue.
 *
 * @example
 * ```ts
 * const result = await revokeAddonForSubscriptionCancellation({
 *   customerId: 'cus_abc',
 *   purchase: { id: 'purch_123', addonSlug: 'visibility-boost-7d' },
 *   addonDef: getAddonBySlug('visibility-boost-7d'),
 *   billing,
 * });
 *
 * if (result.outcome === 'failed') {
 *   throw new Error(`Fatal: could not revoke addon ${result.addonSlug}: ${result.error}`);
 * }
 * ```
 */
export async function revokeAddonForSubscriptionCancellation(
    input: RevokeAddonInput
): Promise<RevocationResult> {
    const { customerId, purchase, addonDef, billing } = input;
    const { id: purchaseId, addonSlug } = purchase;

    // ── Case 1: Entitlement-type addon ──────────────────────────────────────
    if (addonDef?.grantsEntitlement) {
        const entitlementKey = addonDef.grantsEntitlement;

        try {
            const revokedCount = await billing.entitlements.revokeBySource('addon', purchaseId);

            apiLogger.debug(
                {
                    customerId,
                    addonSlug,
                    purchaseId,
                    entitlementKey,
                    revokedCount
                },
                'Revoked entitlement addon by source during subscription cancellation'
            );
        } catch (primaryError) {
            // Primary failed — attempt fallback before propagating
            apiLogger.warn(
                {
                    customerId,
                    addonSlug,
                    purchaseId,
                    entitlementKey,
                    error:
                        primaryError instanceof Error ? primaryError.message : String(primaryError)
                },
                'revokeBySource failed for entitlement addon; attempting direct revoke fallback'
            );

            // FATAL if fallback also fails — let it throw
            await billing.entitlements.revoke(customerId, entitlementKey);

            apiLogger.debug(
                {
                    customerId,
                    addonSlug,
                    purchaseId,
                    entitlementKey
                },
                'Fallback direct entitlement revoke succeeded during subscription cancellation'
            );
        }

        clearEntitlementCache(customerId);

        apiLogger.info(
            {
                customerId,
                addonSlug,
                purchaseId,
                entitlementKey,
                addonType: 'entitlement'
            },
            'Successfully revoked entitlement addon for subscription cancellation'
        );

        return {
            purchaseId,
            addonSlug,
            addonType: 'entitlement',
            outcome: 'success'
        };
    }

    // ── Case 2: Limit-type addon ─────────────────────────────────────────────
    if (addonDef?.affectsLimitKey) {
        const limitKey = addonDef.affectsLimitKey;

        try {
            const removedCount = await billing.limits.removeBySource('addon', purchaseId);

            apiLogger.debug(
                {
                    customerId,
                    addonSlug,
                    purchaseId,
                    limitKey,
                    removedCount
                },
                'Removed limit addon by source during subscription cancellation'
            );
        } catch (primaryError) {
            // Primary failed — attempt fallback before propagating
            apiLogger.warn(
                {
                    customerId,
                    addonSlug,
                    purchaseId,
                    limitKey,
                    error:
                        primaryError instanceof Error ? primaryError.message : String(primaryError)
                },
                'removeBySource failed for limit addon; attempting direct remove fallback'
            );

            // FATAL if fallback also fails — let it throw
            await billing.limits.remove(customerId, limitKey);

            apiLogger.debug(
                {
                    customerId,
                    addonSlug,
                    purchaseId,
                    limitKey
                },
                'Fallback direct limit remove succeeded during subscription cancellation'
            );
        }

        clearEntitlementCache(customerId);

        apiLogger.info(
            {
                customerId,
                addonSlug,
                purchaseId,
                limitKey,
                addonType: 'limit'
            },
            'Successfully removed limit addon for subscription cancellation'
        );

        return {
            purchaseId,
            addonSlug,
            addonType: 'limit',
            outcome: 'success'
        };
    }

    // ── Case 3: Unknown/retired addon (addonDef is undefined or has neither field) ──
    // We do not know which QZPay channel was used at grant time, so we attempt
    // both. Count = 0 on either call is not an error. QZPay errors are logged as
    // warnings (not fatal) because the addon definition no longer exists in config.
    let entitlementError: string | undefined;
    let limitError: string | undefined;

    try {
        await billing.entitlements.revokeBySource('addon', purchaseId);
    } catch (err) {
        entitlementError = err instanceof Error ? err.message : String(err);

        apiLogger.warn(
            {
                customerId,
                addonSlug,
                purchaseId,
                error: entitlementError
            },
            'entitlements.revokeBySource failed for retired addon (non-fatal, continuing)'
        );
    }

    try {
        await billing.limits.removeBySource('addon', purchaseId);
    } catch (err) {
        limitError = err instanceof Error ? err.message : String(err);

        apiLogger.warn(
            {
                customerId,
                addonSlug,
                purchaseId,
                error: limitError
            },
            'limits.removeBySource failed for retired addon (non-fatal, continuing)'
        );
    }

    clearEntitlementCache(customerId);

    apiLogger.warn(
        {
            customerId,
            addonSlug,
            purchaseId,
            entitlementChannelError: entitlementError,
            limitChannelError: limitError
        },
        `Addon definition not found for slug '${addonSlug}', revoked via both entitlement and limit sourceId channels`
    );

    return {
        purchaseId,
        addonSlug,
        addonType: 'unknown',
        outcome: 'success'
    };
}

// ─── Subscription Cancellation Cleanup (re-export) ───────────────────────────
// Implementation lives in addon-lifecycle-cancellation.service.ts (max-line policy).

export type {
    CancellationResult,
    HandleCancellationAddonsInput
} from './addon-lifecycle-cancellation.service.js';
export { handleSubscriptionCancellationAddons } from './addon-lifecycle-cancellation.service.js';

// ─── Addon Limit Recalculation (re-export) ───────────────────────────────────
// Implementation lives in addon-limit-recalculation.service.ts (max-line policy).

export type {
    RecalculateAddonLimitsInput,
    RecalculationOutcome,
    RecalculationResult
} from './addon-limit-recalculation.service.js';
export { recalculateAddonLimitsForCustomer } from './addon-limit-recalculation.service.js';

// ─── Addon Plan Change Recalculation (re-export) ─────────────────────────────
// Implementation lives in addon-plan-change.service.ts (max-line policy).

export type {
    PlanChangeDirection,
    PlanChangeRecalculationInput,
    PlanChangeRecalculationResult
} from './addon-plan-change.service.js';
export { handlePlanChangeAddonRecalculation } from './addon-plan-change.service.js';
