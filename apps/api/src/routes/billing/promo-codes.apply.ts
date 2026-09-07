/**
 * Promo Code Apply Route (SPEC-262 T-008)
 *
 * POST /api/v1/protected/billing/promo-codes/apply
 *
 * Branches the response by `effect.kind` read from the DB:
 * - `discount`: backward-compat shape (`discountAmount`, `finalAmount`) — AC-4.3.
 *   When `subscriptionId` is supplied, the discount is applied through the
 *   fail-closed T-007 seam (MP amount mutation first, redeem only on success).
 * - `trial_extension`: pushes `trial_end` on the caller's running trial through
 *   `applyTrialExtensionToRunningTrial` and returns `extraDays` + the `trialEnd`
 *   that is now PERSISTED on the row (HOS-1012 T-039). Before T-039 this branch
 *   burnt the code via `applyPromoCode` and answered a `trialEnd` projected from
 *   `new Date()` that was never written anywhere.
 * - `comp`: REFUSED, for every caller — see below.
 *
 * Ownership guard (AC-6.2): `customerId` must be the caller's own billing
 * customer unless the caller has `ACCESS_API_ADMIN`.
 *
 * Comp gate (HOS-1195 / HOS-1171): the ownership guard only ever protected
 * OTHER people's subscriptions, so a signed-in user could redeem a `comp` code
 * against their own and walk away with a permanently free subscription. A
 * complimentary subscription is an admin action now
 * (`POST /admin/billing/subscriptions/grant-comp`), never a redemption, so
 * `comp` is refused here unspent. `discount` and `trial_extension` are
 * untouched: both are ordinary self-service redemptions.
 *
 * @module routes/billing/promo-codes.apply
 */

import { ApplyPromoCodeSchema, PermissionEnum, PromoEffectKindEnum } from '@repo/schemas';
import { assertSubscriptionOwnership, PromoCodeService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../middlewares/actor';
import { getQZPayBilling } from '../../middlewares/billing';
import { applyMultiCycleDiscountToExistingSubscription } from '../../services/promo-discount-apply.service.js';
import {
    applyTrialExtensionToRunningTrial,
    NO_ACTIVE_TRIAL_ERROR_CODE
} from '../../services/promo-trial-extension-apply.service.js';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger';
import { createProtectedRoute } from '../../utils/route-factory';
import { assertPromoCodeIsNotComp } from './promo-code-effect-gate.js';

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

/**
 * Response shape for the /apply endpoint.
 *
 * Both redeemable effect kinds share the base fields (`id`, `promoCode`,
 * `effectKind`, `originalAmount`, `discountAmount`, `finalAmount`, `amount`).
 * `extraDays` and `trialEnd` are present only for `trial_extension`.
 *
 * There is no `comp` field: HOS-1171 made a complimentary subscription an admin
 * action, so this endpoint can no longer produce that outcome.
 */
const ApplyResponseSchema = z.object({
    /** Billing customer ID (AC-4.3: unchanged from original shape) */
    id: z.string(),
    /** Applied promo code string (AC-4.3: unchanged from original shape) */
    promoCode: z.string().nullable(),
    /** Effect kind discriminant: 'discount' | 'trial_extension' */
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
    trialEnd: z.string().datetime().optional()
});

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

/**
 * Handler for `POST /api/v1/protected/billing/promo-codes/apply`.
 *
 * Exported so it can be unit-tested against a mock context without going
 * through the middleware stack (same pattern as `handleCheckExpiry` in
 * `routes/billing/trial.ts`).
 *
 * Branches by `effect.kind` from the DB. For `discount` effects on an existing
 * subscription with a live MercadoPago preapproval, routes through the T-007
 * fail-closed seam (`applyMultiCycleDiscountToExistingSubscription`): MP amount
 * mutation executes first; the code is only redeemed on MP success. For
 * `trial_extension` effects it routes through
 * `applyTrialExtensionToRunningTrial` (HOS-1012 T-039), which performs the real
 * `trial_end` mutation — the `trialEnd` in the response is READ BACK from that
 * mutation, never projected.
 */
export const handleApplyPromoCode = async (
    c: Context,
    _params: Record<string, unknown>,
    body: Record<string, unknown>
) => {
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
    //
    // `customerId` is OPTIONAL since HOS-1012 T-039: a self-service caller (the
    // account page applying a trial-extension code to their own running trial)
    // does not know its billing customer UUID and has no way to look it up.
    // Omitting it means "my own customer", which is exactly what this guard
    // enforces for every non-admin caller anyway. An explicitly supplied
    // mismatching id is still a 403.
    const actorHasAdmin = actor.permissions?.includes(PermissionEnum.ACCESS_API_ADMIN) ?? false;

    if (body.customerId !== undefined && !actorHasAdmin && body.customerId !== billingCustomerId) {
        throw new HTTPException(403, { message: 'Forbidden: admin access required' });
    }

    const code = body.code as string;
    const customerId = (body.customerId as string | undefined) ?? (billingCustomerId as string);
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
            actorHasAdmin
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
    //
    // HOS-1012 T-039: the peek now runs unconditionally, because the
    // `trial_extension` seam below needs the effect kind whether or not the
    // caller named a subscription (a host applying a code from the account page
    // does not have to know which subscription row holds their trial).
    // ------------------------------------------------------------------
    const peekResult = await service.getByCode(code);
    const peekedEffectKind = peekResult.success ? peekResult.data?.effect?.kind : undefined;

    // HOS-1195 / HOS-1171 comp gate — runs BEFORE anything is redeemed, and is
    // the whole reason the peek above is unconditional. A complimentary
    // subscription is an admin action now, never a redemption, so a `comp` code
    // is refused here for EVERY caller without being spent. `discount` and
    // `trial_extension` pass through untouched: both are ordinary self-service
    // redemptions and this route is where a customer makes them. Read
    // `promo-code-effect-gate.ts` for the rest of the reasoning.
    assertPromoCodeIsNotComp({ peekResult });

    if (subscriptionId) {
        if (peekedEffectKind === PromoEffectKindEnum.DISCOUNT) {
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
                    // HOS-996: a discount that zeroes the price → 422, matching
                    // the checkout path, where INVALID_PROMO_CODE is 422
                    // everywhere it is mapped. Without this entry the seam's
                    // guard would fall through to the `?? 500` default and
                    // report a caller mistake as an internal error.
                    INVALID_PROMO_CODE: 422,
                    INTERNAL_ERROR: 500
                };
                const status = statusMap[seamResult.error.code] ?? 500;
                throw new HTTPException(status as 400 | 403 | 404 | 409 | 422 | 500, {
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
    // HOS-1012 T-039 seam path: `trial_extension` against the caller's own
    // running trial.
    //
    // This branch REPLACES the old `service.apply` handling of the effect,
    // which redeemed the code and then answered a `trialEnd` computed from
    // `new Date()` that was never written to any row. The seam performs the
    // real mutation and the response carries the `trial_end` that is now
    // PERSISTED — the two can no longer disagree.
    //
    // With no trial running, the seam returns NO_ACTIVE_TRIAL: nothing is
    // written and the code is NOT redeemed, so it stays usable once a trial
    // exists.
    //
    // FOLLOW-UP (filed, not built here): capturing the code BEFORE the trial
    // exists — at signup or at the publish step — and reading it when the trial
    // row is created, so the trial is born long instead of being extended
    // afterwards. See the module header of
    // `services/promo-trial-extension-apply.service.ts`.
    // ------------------------------------------------------------------
    if (peekedEffectKind === PromoEffectKindEnum.TRIAL_EXTENSION) {
        const extensionResult = await applyTrialExtensionToRunningTrial({
            code,
            billingCustomerId,
            actorId: actor.id,
            livemode,
            ...(subscriptionId ? { subscriptionId } : {})
        });

        if (!extensionResult.success) {
            const statusMap: Record<string, number> = {
                NOT_FOUND: 404,
                VALIDATION_ERROR: 400,
                // No trial to extend is a business-rule refusal, not malformed
                // input: 422, with a message the host can act on.
                [NO_ACTIVE_TRIAL_ERROR_CODE]: 422,
                PERMISSION_DENIED: 403,
                PROMO_CODE_MAX_USES: 409,
                PROMO_CODE_MAX_USES_PER_CUSTOMER: 409,
                PROMO_CODE_EXPIRED: 400,
                INTERNAL_ERROR: 500
            };
            const status = statusMap[extensionResult.error.code] ?? 500;
            throw new HTTPException(status as 400 | 403 | 404 | 409 | 422 | 500, {
                message: extensionResult.error.message,
                // HOS-1171: a 422's status-derived `error.code` is
                // VALIDATION_ERROR, and `translateApiErrorWithT` ranks `code`
                // above `message` — so without this the host who has no trial
                // running reads "Los datos enviados no son válidos." for a
                // request whose data was fine. Same mechanism the add-on 422s
                // use since HOS-1178: `readEntitlementCause` forwards a
                // whitelisted `cause.code` as `error.reason`, which outranks
                // `code` in that chain. Only NO_ACTIVE_TRIAL is whitelisted;
                // every other code here falls through to the generic copy.
                cause: { code: extensionResult.error.code }
            });
        }

        const originalAmount = amount ?? 0;
        return {
            id: customerId,
            promoCode: code,
            effectKind: PromoEffectKindEnum.TRIAL_EXTENSION,
            originalAmount,
            discountAmount: 0,
            finalAmount: originalAmount,
            amount: originalAmount,
            extraDays: extensionResult.data.daysAdded,
            // Read back from the mutation — this is the value on the row.
            trialEnd: extensionResult.data.newTrialEnd.toISOString()
        };
    }

    // ------------------------------------------------------------------
    // Normal service.apply path — handles:
    //   - discount (checkout-signup, no live preapproval yet)
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
            // HOS-996: `applyPromoCode` refuses a discount that takes the
            // price to zero, before it redeems anything. Same code, same
            // message and same 422 as the two paths above, so the answer does
            // not depend on which of the three the caller happened to hit.
            INVALID_PROMO_CODE: 422,
            INTERNAL_ERROR: 500
        };
        const status = statusMap[result.error?.code ?? ''] ?? 500;
        throw new HTTPException(status as 400 | 403 | 404 | 409 | 422 | 500, {
            message: result.error?.message ?? 'Unknown error applying promo code'
        });
    }

    const data = result.data;
    const effectKind = data.effectKind;

    // Only ONE response shape is reachable from here.
    //
    // There is no `trial_extension` branch (HOS-1012 T-039): that effect is
    // intercepted by the seam above and never reaches `service.apply`, so a
    // branch here could only ever produce the projected-but-unpersisted
    // `trialEnd` the seam exists to eliminate.
    //
    // And there is no `comp` branch (HOS-1171): the gate refuses that effect
    // with a 403 before any of this runs. The branch that used to sit here
    // returned `comp: true` and read as a supported outcome of this endpoint,
    // which it has not been since a complimentary subscription became an admin
    // action. It was deleted with the `comp` field of `ApplyResponseSchema`.
    //
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
};

/**
 * Apply promo code to checkout (authenticated)
 *
 * POST /api/v1/protected/billing/promo-codes/apply
 */
export const applyPromoCodeRoute = createProtectedRoute({
    method: 'post',
    path: '/apply',
    summary: 'Apply promo code',
    description:
        'Applies a promo code to a checkout session. Branches response by effect kind. Requires authentication. Complimentary (comp) codes are always refused; a non-admin caller may only redeem a trial_extension code — a discount is refused unspent (422) and stays usable at checkout.',
    tags: ['Billing - Promo Codes'],
    requestBody: ApplyPromoCodeSchema,
    responseSchema: ApplyResponseSchema,
    handler: handleApplyPromoCode
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
