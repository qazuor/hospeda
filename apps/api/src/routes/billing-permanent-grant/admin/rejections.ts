import { ServiceErrorCode } from '@repo/schemas';
import {
    PERMANENT_GRANT_REJECTIONS,
    type PermanentGrantRejection,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../../utils/response-helpers.js';

type RejectionAnswer = {
    readonly status: 403 | 404 | 409 | 422;
    readonly code: ServiceErrorCode;
};

const UNPROCESSABLE: RejectionAnswer = {
    status: 422,
    code: ServiceErrorCode.VALIDATION_ERROR
};
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };

/** Every service rejection has an explicit HTTP contract; new reasons fail typecheck. */
export const REJECTION_ANSWERS: Readonly<Record<PermanentGrantRejection, RejectionAnswer>> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    PERMANENT_GRANT_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    PERMANENT_GRANT_NOT_LIVE: UNPROCESSABLE,
    PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED: CONFLICT,
    PERMANENT_GRANT_ALREADY_LIVE: CONFLICT,
    PERMANENT_GRANT_REFERENCE_NOT_FOUND: UNPROCESSABLE,
    INVALID_PERMANENT_GRANT_INPUT: UNPROCESSABLE
};

/** Translate only a typed permanent-grant rejection; unknown failures must reach the error handler. */
export function answerRejection(input: { readonly error: unknown; readonly ctx: Context }) {
    const { error, ctx } = input;
    if (
        !(error instanceof ServiceError) ||
        !PERMANENT_GRANT_REJECTIONS.includes(error.reason as never)
    )
        throw error;
    const answer = REJECTION_ANSWERS[error.reason as PermanentGrantRejection];
    return createErrorResponse(
        { code: answer.code, message: error.message, reason: error.reason },
        ctx,
        answer.status
    );
}
