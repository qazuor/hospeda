/**
 * Admin API route for subscription active promo effect.
 *
 * Exposes the promo code effect currently active on a subscription so the
 * admin UI can display discount kind, remaining cycles, exhausted state, etc.
 *
 * The extras-carril columns (promo_effect_remaining_cycles on
 * billing_subscriptions; effect_kind, value_kind, value, duration_cycles,
 * extra_days on billing_promo_codes) are NOT visible to Drizzle because those
 * tables are owned by @qazuor/qzpay-drizzle. Raw SQL via the `sql` template is
 * the approved pattern (see payment-logic.ts ~line 320 and dunning.job.ts ~line 62).
 *
 * Routes:
 * - GET /api/v1/admin/billing/subscriptions/:id/promo-effect
 *
 * @module routes/billing/admin/subscription-promo-effect
 */

import { getDb } from '@repo/db';
import { PermissionEnum, SubscriptionPromoEffectResponseSchema } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { SubscriptionPromoEffectParamSchema } from '../../../schemas/subscription-promo-effect.schema.js';
import type { AppBindings } from '../../../types.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

/**
 * Raw DB row returned by the LEFT JOIN query.
 * Includes extras-carril columns that are not visible to Drizzle.
 */
interface PromoEffectRow {
    /** billing_subscriptions.promo_code_id — native QZPay column */
    promo_code_id: string | null;
    /** billing_subscriptions.promo_effect_remaining_cycles — extras/019 */
    promo_effect_remaining_cycles: number | null;
    /** billing_promo_codes.code — native QZPay column */
    code: string | null;
    /** billing_promo_codes.effect_kind — extras/018 */
    effect_kind: string | null;
    /** billing_promo_codes.value_kind — extras/018 */
    value_kind: string | null;
    /** billing_promo_codes.value — native QZPay column */
    value: number | null;
    /** billing_promo_codes.duration_cycles — extras/018 */
    duration_cycles: number | null;
    /** billing_promo_codes.extra_days — extras/018 */
    extra_days: number | null;
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
    // No SubscriptionService method exists that surfaces the extras-carril columns.
    // This is a read-only admin diagnostic endpoint; direct DB access via raw SQL
    // is the approved pattern for extras-carril data (same as payment-logic.ts and dunning.job.ts).
    const db = getDb();

    const { id: subscriptionId } = params as { id: string };

    try {
        const result = await db.execute(
            sql`SELECT
                    bs.promo_code_id,
                    bs.promo_effect_remaining_cycles,
                    pc.code,
                    pc.effect_kind,
                    pc.value_kind,
                    pc.value,
                    pc.duration_cycles,
                    pc.extra_days
                FROM billing_subscriptions bs
                LEFT JOIN billing_promo_codes pc
                    ON pc.id = bs.promo_code_id
                WHERE bs.id = ${subscriptionId}
                LIMIT 1`
        );

        // DRIZZLE-LIMITATION: db.execute(sql`...`).rows is typed as
        // Record<string, unknown>[] (raw SQL over extras-carril columns not in
        // the Drizzle schema); narrow it to the known projected row shape.
        const rows = result.rows as unknown as PromoEffectRow[];

        // No rows → subscription does not exist
        if (rows.length === 0) {
            throw new HTTPException(404, {
                message: `Subscription '${subscriptionId}' not found`
            });
        }

        // rows.length === 0 is handled above; rows[0] is guaranteed present here
        const row = rows[0] as PromoEffectRow;

        const hasPromo = row.promo_code_id !== null;

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

        // Coerce effect_kind to the typed enum values
        const effectKindRaw = row.effect_kind;
        const effectKind: 'discount' | 'trial_extension' | 'comp' | null =
            effectKindRaw === 'discount' ||
            effectKindRaw === 'trial_extension' ||
            effectKindRaw === 'comp'
                ? effectKindRaw
                : null;

        // Coerce value_kind to the typed enum values
        const valueKindRaw = row.value_kind;
        const valueKind: 'percentage' | 'fixed' | null =
            valueKindRaw === 'percentage' || valueKindRaw === 'fixed' ? valueKindRaw : null;

        const remainingCycles =
            row.promo_effect_remaining_cycles !== undefined
                ? row.promo_effect_remaining_cycles
                : null;

        // A discount effect is exhausted when remainingCycles has been counted
        // down to exactly 0 (null means forever — not exhausted).
        const exhausted = effectKind === 'discount' && remainingCycles === 0;

        apiLogger.debug(
            {
                subscriptionId,
                promoCodeId: row.promo_code_id,
                effectKind,
                remainingCycles,
                exhausted
            },
            'Admin retrieved subscription promo effect via API'
        );

        return {
            hasPromo: true,
            promoCodeId: row.promo_code_id,
            code: row.code ?? null,
            effectKind,
            valueKind,
            value: row.value !== undefined ? row.value : null,
            durationCycles: row.duration_cycles !== undefined ? row.duration_cycles : null,
            remainingCycles,
            extraDays: row.extra_days !== undefined ? row.extra_days : null,
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
        'Returns the promo code effect currently applied to a subscription, including effect kind, value, remaining cycles, and exhausted state. Reads extras-carril columns via raw SQL.',
    tags: ['Billing', 'Subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: SubscriptionPromoEffectParamSchema.shape,
    responseSchema: SubscriptionPromoEffectResponseSchema,
    handler: getSubscriptionPromoEffectHandler
});
