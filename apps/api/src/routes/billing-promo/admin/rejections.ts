import { ServiceErrorCode } from '@repo/schemas';
import {
    PROMO_CODE_ADMIN_REJECTIONS,
    type PromoCodeAdminRejection,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../../utils/response-helpers';

type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };
const UNPROCESSABLE: RejectionAnswer = {
    status: 422,
    code: ServiceErrorCode.VALIDATION_ERROR
};

/** Every ACC_21 service rejection has an explicit HTTP contract. */
export const PROMO_CODE_REJECTION_ANSWERS: Readonly<
    Record<PromoCodeAdminRejection, RejectionAnswer>
> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    PROMO_CODE_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    PROMO_CODE_ALREADY_EXISTS: CONFLICT,
    PROMO_CODE_ALREADY_CLOSED: CONFLICT,
    INVALID_PROMO_CODE_INPUT: UNPROCESSABLE
};

/** Translate a typed ACC_21 rejection; unexpected errors continue to the API handler. */
export function answerPromoCodeRejection(input: {
    readonly error: unknown;
    readonly ctx: Context;
}) {
    const { error, ctx } = input;
    if (
        !(error instanceof ServiceError) ||
        !PROMO_CODE_ADMIN_REJECTIONS.includes(error.reason as never)
    ) {
        throw error;
    }
    const answer = PROMO_CODE_REJECTION_ANSWERS[error.reason as PromoCodeAdminRejection];
    return createErrorResponse(
        { code: answer.code, message: error.message, reason: error.reason },
        ctx,
        answer.status
    );
}
