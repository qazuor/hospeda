/**
 * Admin API route for subscription active promo effect.
 *
 * Exposes the promo code effect currently active on a subscription so the
 * admin UI can display discount kind, remaining cycles, exhausted state, etc.
 *
 * `promoEffectRemainingCycles` (billing_subscriptions) and `effectKind` /
 * `valueKind` / `durationCycles` / `extraDays` (billing_promo_codes) are typed
 * Drizzle columns as of `@qazuor/qzpay-drizzle` 1.11.0 (HOS-73) — read via a
 * typed LEFT JOIN (HOS-75 T-022), not raw SQL.
 *
 * Routes:
 * - GET /api/v1/admin/billing/subscriptions/:id/promo-effect
 *
 * @module routes/billing/admin/subscription-promo-effect
 */

import { billingPromoCodes, billingSubscriptions, eq, getDb } from '@repo/db';
import { PermissionEnum, SubscriptionPromoEffectResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { SubscriptionPromoEffectParamSchema } from '../../../schemas/subscription-promo-effect.schema.js';
import type { AppBindings } from '../../../types.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

/**
 * Row shape returned by the typed LEFT JOIN query.
 */
interface PromoEffectRow {
    /** billing_subscriptions.promo_code_id — native QZPay column */
    promoCodeId: string | null;
    /** billing_subscriptions.promo_effect_remaining_cycles — typed Drizzle column (HOS-73) */
    promoEffectRemainingCycles: number | null;
    /** billing_promo_codes.code — native QZPay column */
    code: string | null;
    /** billing_promo_codes.effect_kind — typed Drizzle column (HOS-73) */
    effectKind: string | null;
    /** billing_promo_codes.value_kind — typed Drizzle column (HOS-73) */
    valueKind: string | null;
    /** billing_promo_codes.value — native QZPay column */
    value: number | null;
    /** billing_promo_codes.duration_cycles — typed Drizzle column (HOS-73) */
    durationCycles: number | null;
    /** billing_promo_codes.extra_days — typed Drizzle column (HOS-73) */
    extraDays: number | null;
}

/**
 * Handler for fetching the active promo effect on a subscription.
 * Extracted for testing purposes.
 *
 * Performs a single round-trip: reads billing_subscriptions by id (status,
 * promo_code_id, promo_effect_remaining_cycles) and LEFT JOINs
 * billing_promo_codes to get effect_kind / value_kind / value / duration_cycles /
 * extra_days. Returns 404 via HTTPException if the subscription does not exist.
 * (trialEnd is sourced frontend-side from the subscription object, not here.)
 *
 * @param _c - Hono context (unused by handler logic; DB read via getDb())
 * @param params - Path parameters containing the subscription UUID
 * @returns Promo effect shape for the subscription
 */
export const getSubscriptionPromoEffectHandler = async (
    _c: Context<AppBindings>,
    params: Record<string, unknown>
): Promise<{
    hasPromo: boolean;
    promoCodeId: string | null;
    code: string | null;
    effectKind: 'discount' | 'trial_extension' | 'comp' | null;
    valueKind: 'percentage' | 'fixed' | null;
    value: number | null;
    durationCycles: number | null;
    remainingCycles: number | null;
    extraDays: number | null;
    exhausted: boolean;
}> => {
    // No SubscriptionService method exists that surfaces these columns for a
    // single admin diagnostic read; a direct typed Drizzle query is the
    // approved pattern here (same shared columns as payment-logic.ts and
    // dunning.job.ts, via a LEFT JOIN instead of the single-row helper since
    // this needs the joined promo code's effect columns too).
    const db = getDb();

    const { id: subscriptionId } = params as { id: string };

    try {
        const rows: PromoEffectRow[] = await db
            .select({
                promoCodeId: billingSubscriptions.promoCodeId,
                promoEffectRemainingCycles: billingSubscriptions.promoEffectRemainingCycles,
                code: billingPromoCodes.code,
                effectKind: billingPromoCodes.effectKind,
                valueKind: billingPromoCodes.valueKind,
                value: billingPromoCodes.value,
                durationCycles: billingPromoCodes.durationCycles,
                extraDays: billingPromoCodes.extraDays
            })
            .from(billingSubscriptions)
            .leftJoin(billingPromoCodes, eq(billingPromoCodes.id, billingSubscriptions.promoCodeId))
            .where(eq(billingSubscriptions.id, subscriptionId))
            .limit(1);

        // No rows → subscription does not exist
        if (rows.length === 0) {
            throw new HTTPException(404, {
                message: `Subscription '${subscriptionId}' not found`
            });
        }

        // rows.length === 0 is handled above; rows[0] is guaranteed present here
        const row = rows[0] as PromoEffectRow;

        const hasPromo = row.promoCodeId !== null;

        if (!hasPromo) {
            return {
                hasPromo: false,
                promoCodeId: null,
                code: null,
                effectKind: null,
                valueKind: null,
                value: null,
                durationCycles: null,
                remainingCycles: null,
                extraDays: null,
                exhausted: false
            };
        }

        // Coerce effectKind to the typed enum values
        const effectKindRaw = row.effectKind;
        const effectKind: 'discount' | 'trial_extension' | 'comp' | null =
            effectKindRaw === 'discount' ||
            effectKindRaw === 'trial_extension' ||
            effectKindRaw === 'comp'
                ? effectKindRaw
                : null;

        // Coerce valueKind to the typed enum values
        const valueKindRaw = row.valueKind;
        const valueKind: 'percentage' | 'fixed' | null =
            valueKindRaw === 'percentage' || valueKindRaw === 'fixed' ? valueKindRaw : null;

        const remainingCycles =
            row.promoEffectRemainingCycles === undefined ? null : row.promoEffectRemainingCycles;

        // A discount effect is exhausted when remainingCycles has been counted
        // down to exactly 0 (null means forever — not exhausted).
        const exhausted = effectKind === 'discount' && remainingCycles === 0;

        apiLogger.debug(
            {
                subscriptionId,
                promoCodeId: row.promoCodeId,
                effectKind,
                remainingCycles,
                exhausted
            },
            'Admin retrieved subscription promo effect via API'
        );

        return {
            hasPromo: true,
            promoCodeId: row.promoCodeId,
            code: row.code ?? null,
            effectKind,
            valueKind,
            value: row.value === undefined ? null : row.value,
            durationCycles: row.durationCycles === undefined ? null : row.durationCycles,
            remainingCycles,
            extraDays: row.extraDays === undefined ? null : row.extraDays,
            exhausted
        };
    } catch (error) {
        // Re-throw HTTPException (404) directly — do not swallow it
        if (error instanceof HTTPException) {
            throw error;
        }

        apiLogger.error(
            {
                subscriptionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            'Admin failed to retrieve subscription promo effect via API'
        );

        throw new HTTPException(500, {
            message: 'Failed to retrieve subscription promo effect'
        });
    }
};

/**
 * GET /api/v1/admin/billing/subscriptions/:id/promo-effect
 * Returns the active promo effect for a subscription (admin only).
 *
 * Permission: BILLING_READ_ALL (same as the sibling events route).
 * Returns 404 when the subscription does not exist.
 */
export const subscriptionPromoEffectRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/promo-effect',
    summary: 'Get active promo effect for a subscription',
    description:
        'Returns the promo code effect currently applied to a subscription, including effect kind, value, remaining cycles, and exhausted state.',
    tags: ['Billing', 'Subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: SubscriptionPromoEffectParamSchema.shape,
    responseSchema: SubscriptionPromoEffectResponseSchema,
    handler: getSubscriptionPromoEffectHandler
});
