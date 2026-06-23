/**
 * Promo Code Apply Route (SPEC-262 T-008)
 *
 * POST /api/v1/protected/billing/promo-codes/apply
 *
 * Branches the response by `effect.kind` read from the DB:
 * - `discount`: backward-compat shape (`discountAmount`, `finalAmount`) — AC-4.3.
 *   When `subscriptionId` is supplied, the discount is applied through the
 *   fail-closed T-007 seam (MP amount mutation first, redeem only on success).
 * - `trial_extension`: returns `extraDays` + projected `trialEnd`.
 * - `comp`: returns comp indication (`comp: true`, `finalAmount: 0`).
 *
 * Ownership guard (AC-6.2): `customerId` must be the caller's own billing
 * customer unless the caller has `ACCESS_API_ADMIN`.
 *
 * @module routes/billing/promo-codes.apply
 */

import { ApplyPromoCodeSchema, PermissionEnum, PromoEffectKindEnum } from '@repo/schemas';
import { PromoCodeService, assertSubscriptionOwnership } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { applyMultiCycleDiscountToExistingSubscription } from '../../services/promo-discount-apply.service.js';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger';
import { createProtectedRoute } from '../../utils/route-factory';

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

/**
 * Response shape for the /apply endpoint.
 *
 * All three effect kinds share the base fields (`id`, `promoCode`, `effectKind`,
 * `originalAmount`, `discountAmount`, `finalAmount`, `amount`). Effect-specific
 * fields (`extraDays`, `trialEnd`, `comp`) are present only for the relevant kind.
 */
const ApplyResponseSchema = z.object({
    /** Billing customer ID (AC-4.3: unchanged from original shape) */
    id: z.string(),
    /** Applied promo code string (AC-4.3: unchanged from original shape) */
    promoCode: z.string().nullable(),
    /** Effect kind discriminant: 'discount' | 'trial_extension' | 'comp' */
    effectKind: z.string(),
    /** Original amount before discount, in centavos */
    originalAmount: z.number(),
    /** Discount amount applied, in centavos (0 for non-discount effects) */
    discountAmount: z.number(),
    /** Final amount after discount, in centavos */
    finalAmount: z.number(),
    /** Backward-compat alias for `finalAmount` (AC-4.3) */
    amount: z.number(),
    /**
     * Extra calendar days added to the trial period.
     * Present only when `effectKind === 'trial_extension'`.
     */
    extraDays: z.number().optional(),
    /**
     * ISO 8601 projected trial-end date after the extension.
     * Present only when `effectKind === 'trial_extension'`.
     */
    trialEnd: z.string().datetime().optional(),
    /**
     * True when the subscription is permanently complimentary (never billed).
     * Present only when `effectKind === 'comp'`.
     */
    comp: z.boolean().optional()
});

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

/**
 * Apply promo code to checkout (authenticated)
 *
 * POST /api/v1/protected/billing/promo-codes/apply
 *
 * Branches by `effect.kind` from the DB. For `discount` effects on an existing
 * subscription with a live MercadoPago preapproval, routes through the T-007
 * fail-closed seam (`applyMultiCycleDiscountToExistingSubscription`): MP amount
 * mutation executes first; the code is only redeemed on MP success.
 */
export const applyPromoCodeRoute = createProtectedRoute({
    method: 'post',
    path: '/apply',
    summary: 'Apply promo code',
    description:
        'Applies a promo code to a checkout session. Branches response by effect kind. Requires authentication.',
    tags: ['Billing - Promo Codes'],
    requestBody: ApplyPromoCodeSchema,
    responseSchema: ApplyResponseSchema,
    handler: async (c, _params, body) => {
        const service = new PromoCodeService();
        const actor = getActorFromContext(c);
        const livemode = env.NODE_ENV === 'production';

        apiLogger.info('Applying promo code');

        // Get billing customer ID from context (AC-6.2)
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(422, {
                message: 'Billing customer not found. Please contact support.'
            });
        }

        // Ownership guard (AC-6.2): customerId must be own customer OR ACCESS_API_ADMIN.
        if (
            !actor.permissions?.includes(PermissionEnum.ACCESS_API_ADMIN) &&
            body.customerId !== billingCustomerId
        ) {
            throw new HTTPException(403, { message: 'Forbidden: admin access required' });
        }

        const code = body.code as string;
        const customerId = body.customerId as string;
        const amount = body.amount as number | undefined;
        const subscriptionId = body.subscriptionId as string | undefined;

        // ------------------------------------------------------------------
        // B1 security fix (SPEC-262): when subscriptionId is supplied, verify
        // it belongs to the caller's own billing customer BEFORE any peek or
        // mutation. This closes the cross-customer subscription mutation hole:
        // an attacker cannot pass their own customerId (clearing the ownership
        // guard above) plus a victim's subscriptionId to burn a code on or
        // flip the victim's subscription to comp/discounted.
        //
        // Admin actors (ACCESS_API_ADMIN) bypass the ownership check.
        // ------------------------------------------------------------------
        if (subscriptionId) {
            const ownershipResult = await assertSubscriptionOwnership({
                subscriptionId,
                billingCustomerId,
                actorHasAdmin: actor.permissions?.includes(PermissionEnum.ACCESS_API_ADMIN) ?? false
            });

            if (!ownershipResult.success) {
                const status = ownershipResult.error.code === 'NOT_FOUND' ? 404 : 403;
                throw new HTTPException(status as 403 | 404, {
                    message: ownershipResult.error.message
                });
            }
        }

        // ------------------------------------------------------------------
        // T-007 seam path: when subscriptionId is supplied, peek at the
        // effect kind. If the code has a `discount` effect, route through the
        // fail-closed seam which checks for a live MP preapproval internally.
        //
        // Ordering invariant (spike doc §5.6, FAIL-CLOSED):
        //   1. MP preapproval amount mutation (execute)
        //   2. Only on MP success: atomic redemption (commit)
        //
        // If the seam finds no live mp_subscription_id it returns
        // VALIDATION_ERROR — the caller should not supply subscriptionId for
        // annual subs or pre-checkout contexts.
        // ------------------------------------------------------------------
        if (subscriptionId) {
            const peekResult = await service.getByCode(code);
            if (
                peekResult.success &&
                peekResult.data?.effect?.kind === PromoEffectKindEnum.DISCOUNT
            ) {
                const billing = getQZPayBilling();
                if (!billing) {
                    throw new HTTPException(503, { message: 'Billing service unavailable' });
                }

                const seamResult = await applyMultiCycleDiscountToExistingSubscription({
                    code,
                    subscriptionId,
                    billing,
                    livemode
                });

                if (!seamResult.success) {
                    const statusMap: Record<string, number> = {
                        NOT_FOUND: 404,
                        VALIDATION_ERROR: 400,
                        PERMISSION_DENIED: 403,
                        // SF3: promo code usage limit errors → 409 Conflict
                        PROMO_CODE_MAX_USES: 409,
                        PROMO_CODE_MAX_USES_PER_CUSTOMER: 409,
                        // SF3: expired code → 400 Bad Request
                        PROMO_CODE_EXPIRED: 400,
                        INTERNAL_ERROR: 500
                    };
                    const status = statusMap[seamResult.error.code] ?? 500;
                    throw new HTTPException(status as 400 | 403 | 404 | 409 | 500, {
                        message: seamResult.error.message
                    });
                }

                // Seam success: build backward-compat discount shape (AC-4.3).
                const finalAmountCentavos = seamResult.data.discountedAmountCentavos;
                const originalCentavos = amount ?? finalAmountCentavos;
                const discountAmount = originalCentavos - finalAmountCentavos;
                return {
                    id: customerId,
                    promoCode: code,
                    effectKind: PromoEffectKindEnum.DISCOUNT,
                    originalAmount: originalCentavos,
                    discountAmount,
                    finalAmount: finalAmountCentavos,
                    amount: finalAmountCentavos
                };
            }
            // Effect is not discount (or code not found at peek) — fall through
            // to service.apply which validates and handles all effect kinds.
        }

        // ------------------------------------------------------------------
        // Normal service.apply path — handles:
        //   - discount (checkout-signup, no live preapproval yet)
        //   - trial_extension
        //   - comp
        //   - legacy codes (no typed effect)
        // ------------------------------------------------------------------
        const result = await service.apply(code, customerId, amount, {
            livemode,
            subscriptionId
        });

        if (result.success === false) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                PERMISSION_DENIED: 403,
                // SF3: promo code usage limit errors → 409 Conflict
                PROMO_CODE_MAX_USES: 409,
                PROMO_CODE_MAX_USES_PER_CUSTOMER: 409,
                // SF3: expired code → 400 Bad Request
                PROMO_CODE_EXPIRED: 400,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[result.error?.code ?? ''] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 409 | 500, {
                message: result.error?.message ?? 'Unknown error applying promo code'
            });
        }

        const data = result.data;
        const effectKind = data.effectKind;

        // Branch response shape by effect kind.
        if (effectKind === PromoEffectKindEnum.TRIAL_EXTENSION) {
            // Compute projected trial_end from extraDays (UTC arithmetic).
            const trialEndDate = new Date();
            trialEndDate.setUTCDate(trialEndDate.getUTCDate() + data.extraDays);
            return {
                id: customerId,
                promoCode: code,
                effectKind,
                originalAmount: data.originalAmount,
                discountAmount: 0,
                finalAmount: data.finalAmount,
                amount: data.finalAmount,
                extraDays: data.extraDays,
                trialEnd: trialEndDate.toISOString()
            };
        }

        if (effectKind === PromoEffectKindEnum.COMP) {
            return {
                id: customerId,
                promoCode: code,
                effectKind,
                originalAmount: data.originalAmount,
                discountAmount: 0,
                finalAmount: 0,
                amount: 0,
                comp: true
            };
        }

        // Discount path (or legacy code with no typed effect) — backward-compat
        // shape preserved exactly (AC-4.3).
        return {
            id: customerId,
            promoCode: code,
            effectKind: effectKind ?? PromoEffectKindEnum.DISCOUNT,
            originalAmount: data.originalAmount,
            discountAmount: data.discountAmount,
            finalAmount: data.finalAmount,
            amount: data.finalAmount
        };
    }
});

// ---------------------------------------------------------------------------
// Router assembly (user-facing: validate + apply)
// ---------------------------------------------------------------------------

/**
 * User-facing promo codes sub-router.
 *
 * Exports validate + apply verbs only. Mounted by
 * `apps/api/src/routes/billing/index.ts` under
 * `/api/v1/protected/billing/promo-codes`.
 *
 * The validate route lives in the main `promo-codes.ts` module; this module
 * provides the apply route only.
 */
export const applyPromoCodesRouter = createRouter();
applyPromoCodesRouter.route('/', applyPromoCodeRoute);
