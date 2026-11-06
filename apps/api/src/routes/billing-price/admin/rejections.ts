import { ServiceErrorCode } from '@repo/schemas';
import { CYCLE_PRICE_REJECTIONS, type CyclePriceRejection, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../../utils/response-helpers.js';

type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };
const UNPROCESSABLE: RejectionAnswer = { status: 422, code: ServiceErrorCode.VALIDATION_ERROR };

/** Every ACC_19 service rejection has an explicit HTTP answer. */
export const CYCLE_PRICE_REJECTION_ANSWERS: Readonly<Record<CyclePriceRejection, RejectionAnswer>> =
    {
        ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
        PLAN_VERSION_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
        PLAN_VERSION_NOT_SELLABLE: UNPROCESSABLE,
        CYCLE_PRICE_BELOW_PROVIDER_MINIMUM: UNPROCESSABLE,
        CYCLE_PRICE_ABOVE_PROVIDER_MAXIMUM: UNPROCESSABLE,
        CYCLE_NOT_LONGER_THAN_GRACE: UNPROCESSABLE,
        PLAN_VERSION_HAS_CUSTOMERS: CONFLICT,
        CYCLE_PRICE_CHANGED_SINCE_PREVIEW: CONFLICT,
        CYCLE_PRICE_UNCHANGED: UNPROCESSABLE,
        INVALID_CYCLE_PRICE_INPUT: UNPROCESSABLE
    };

/** Translate owned ACC_19 rejections and rethrow unexpected failures. */
export function answerCyclePriceRejection(input: {
    readonly error: unknown;
    readonly ctx: Context;
}) {
    const { error, ctx } = input;
    if (
        !(error instanceof ServiceError) ||
        !CYCLE_PRICE_REJECTIONS.includes(error.reason as never)
    ) {
        throw error;
    }
    const answer = CYCLE_PRICE_REJECTION_ANSWERS[error.reason as CyclePriceRejection];
    return createErrorResponse(
        { code: answer.code, message: error.message, reason: error.reason },
        ctx,
        answer.status
    );
}
