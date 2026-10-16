import {
    RedeemPromoCodeRequestSchema,
    RedeemPromoCodeResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import {
    PromoRedemptionReason,
    type PromoRedemptionReason as PromoRedemptionReasonType,
    redeemPromoCode,
    ServiceError
} from '@repo/service-core';
import { createExtendTrial } from '@repo/verticals';
import type { Context } from 'hono';
import { getActorFromContext, isGuestActor } from '../../utils/actor';
import { getClock } from '../../utils/clock';
import { getPaymentProvider } from '../../utils/payment-provider';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { getTrialMachinePorts } from '../../utils/trial/trial-machine-ports';

const errors: Record<PromoRedemptionReasonType, { code: string; status: number }> = {
    [PromoRedemptionReason.PROMO_CODE_NOT_FOUND]: { code: ServiceErrorCode.NOT_FOUND, status: 404 },
    [PromoRedemptionReason.PROMO_CODE_NOT_A_TRIAL_EXTENSION]: {
        code: ServiceErrorCode.VALIDATION_ERROR,
        status: 422
    },
    [PromoRedemptionReason.PROMO_CODE_NOT_FOR_VERTICAL]: {
        code: ServiceErrorCode.VALIDATION_ERROR,
        status: 422
    },
    [PromoRedemptionReason.PROMO_CODE_NOT_AVAILABLE]: {
        code: ServiceErrorCode.VALIDATION_ERROR,
        status: 422
    },
    [PromoRedemptionReason.PROMO_NO_ELIGIBLE_SUBSCRIPTION]: {
        code: ServiceErrorCode.VALIDATION_ERROR,
        status: 422
    },
    [PromoRedemptionReason.PROMO_NOT_OFFERED_TO_MANUAL_PAYER]: {
        code: ServiceErrorCode.VALIDATION_ERROR,
        status: 422
    },
    [PromoRedemptionReason.PROMO_CODE_ALREADY_REDEEMED]: {
        code: ServiceErrorCode.ALREADY_EXISTS,
        status: 409
    },
    [PromoRedemptionReason.PROMO_NOT_COMBINABLE]: {
        code: ServiceErrorCode.ALREADY_EXISTS,
        status: 409
    },
    [PromoRedemptionReason.PROMO_UNSUPPORTED_CURRENCY]: {
        code: ServiceErrorCode.VALIDATION_ERROR,
        status: 422
    },
    [PromoRedemptionReason.PROMO_BELOW_PROVIDER_MINIMUM]: {
        code: ServiceErrorCode.VALIDATION_ERROR,
        status: 422
    },
    [PromoRedemptionReason.PROMO_MUTATION_NOT_APPLIED]: {
        code: ServiceErrorCode.INTERNAL_ERROR,
        status: 500
    },
    [PromoRedemptionReason.NO_TRIAL]: { code: ServiceErrorCode.VALIDATION_ERROR, status: 422 },
    [PromoRedemptionReason.TRIAL_ENDED]: { code: ServiceErrorCode.VALIDATION_ERROR, status: 422 },
    [PromoRedemptionReason.CEILING_REACHED]: {
        code: ServiceErrorCode.VALIDATION_ERROR,
        status: 422
    },
    [PromoRedemptionReason.REDEMPTION_KEY_CONFLICT]: {
        code: ServiceErrorCode.ALREADY_EXISTS,
        status: 409
    }
};

function isPromoRedemptionReason(reason: string): reason is PromoRedemptionReasonType {
    return Object.hasOwn(errors, reason);
}

export const protectedRedeemPromoCodeRoute = createProtectedRoute({
    method: 'post',
    path: '/redeem',
    successStatusCode: 200,
    summary: 'Redeem a promo code',
    description: 'Applies a discount or extends the owner’s active trial.',
    tags: ['Billing subscriptions'],
    requestBody: RedeemPromoCodeRequestSchema,
    responseSchema: RedeemPromoCodeResponseSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        if (isGuestActor(actor)) {
            return createErrorResponse(
                { code: ServiceErrorCode.UNAUTHORIZED, message: 'Authentication required' },
                ctx,
                401
            );
        }
        const request = RedeemPromoCodeRequestSchema.parse(body);
        try {
            const ports = getTrialMachinePorts();
            const clock = getClock().clock;
            const result = await redeemPromoCode(
                { userId: actor.id, ...request },
                {
                    provider: getPaymentProvider(),
                    clock,
                    extendTrial: createExtendTrial({
                        unitOfWork: ports.unitOfWork,
                        clock,
                        afterCommit: ports.afterCommit
                    }).extendTrial
                }
            );
            if (result.kind === 'TRIAL_EXTENSION' && result.outcome === 'REJECTED') {
                const reason = result.reason;
                if (!isPromoRedemptionReason(reason)) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Unexpected trial extension rejection reason'
                    );
                }
                const mapped = errors[reason];
                return createErrorResponse(
                    { code: mapped.code, message: reason, reason },
                    ctx,
                    mapped.status
                );
            }
            if (result.kind === 'TRIAL_EXTENSION') {
                return { kind: result.kind, days: result.days, replay: result.replay };
            }
            return result;
        } catch (error) {
            if (
                error instanceof ServiceError &&
                error.reason &&
                isPromoRedemptionReason(error.reason)
            ) {
                const reason = error.reason;
                const mapped = errors[reason];
                return createErrorResponse(
                    { code: mapped.code, message: error.message, reason },
                    ctx,
                    mapped.status
                );
            }
            throw error;
        }
    }
});
