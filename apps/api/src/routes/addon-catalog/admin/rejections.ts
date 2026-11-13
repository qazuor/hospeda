import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../../utils/response-helpers.js';

const answers = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    ADDON_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    INVALID_ADDON_CREATION_INPUT: { status: 400, code: ServiceErrorCode.VALIDATION_ERROR },
    INVALID_ADDON_VERSION_CREATION_INPUT: { status: 400, code: ServiceErrorCode.VALIDATION_ERROR },
    ADDON_CATALOG_KEY_INVALID: { status: 400, code: ServiceErrorCode.VALIDATION_ERROR },
    ADDON_VERSION_DUPLICATE_KEY: { status: 409, code: ServiceErrorCode.ALREADY_EXISTS },
    ADDON_ALREADY_EXISTS: { status: 409, code: ServiceErrorCode.ALREADY_EXISTS }
} as const;

/** Translate action 20 creation rejections to the published HTTP error contract. */
export function answerAddonCatalogRejection(input: {
    readonly error: unknown;
    readonly ctx: Context;
}) {
    const { error, ctx } = input;
    if (!(error instanceof ServiceError) || !(error.reason && error.reason in answers)) {
        throw error;
    }
    const answer = answers[error.reason as keyof typeof answers];
    return createErrorResponse(
        { code: answer.code, message: error.message, reason: error.reason },
        ctx,
        answer.status
    );
}
