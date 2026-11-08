import { ServiceErrorCode } from '@repo/schemas';
import {
    ADDON_VERSION_PUBLICATION_REJECTIONS,
    type AddonVersionPublicationRejection,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../../utils/response-helpers.js';

type RejectionAnswer = {
    readonly status: 400 | 403 | 404 | 409;
    readonly code: ServiceErrorCode;
};

const BAD_INPUT: RejectionAnswer = { status: 400, code: ServiceErrorCode.VALIDATION_ERROR };
const CONFLICT: RejectionAnswer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };
const MISSING: RejectionAnswer = { status: 404, code: ServiceErrorCode.NOT_FOUND };

/** Exhaustive HTTP contract for the action 20 service reasons. */
export const ADDON_VERSION_PUBLICATION_REJECTION_ANSWERS: Readonly<
    Record<AddonVersionPublicationRejection, RejectionAnswer>
> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    ADDON_PRODUCT_NOT_FOUND: MISSING,
    ADDON_VERSION_NOT_FOUND: MISSING,
    ADDON_VERSION_OF_ANOTHER_ADDON: CONFLICT,
    ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND: BAD_INPUT,
    ADDON_PRICE_BELOW_PROVIDER_MINIMUM: BAD_INPUT,
    ADDON_PRICE_ABOVE_PROVIDER_MAXIMUM: BAD_INPUT,
    ADDON_PRODUCT_HAS_LIVE_INSTANCES: CONFLICT,
    ADDON_PRODUCT_CHANGED_SINCE_PREVIEW: CONFLICT,
    ADDON_PRODUCT_UNCHANGED: BAD_INPUT,
    INVALID_ADDON_VERSION_PUBLICATION_INPUT: BAD_INPUT
};

/** Answer an owned action 20 rejection and rethrow unrelated failures. */
export function answerAddonVersionPublicationRejection(input: {
    readonly error: unknown;
    readonly ctx: Context;
}) {
    const { error, ctx } = input;
    if (
        !(error instanceof ServiceError) ||
        !ADDON_VERSION_PUBLICATION_REJECTIONS.includes(error.reason as never)
    ) {
        throw error;
    }
    const answer =
        ADDON_VERSION_PUBLICATION_REJECTION_ANSWERS[
            error.reason as AddonVersionPublicationRejection
        ];
    return createErrorResponse(
        { code: answer.code, message: error.message, reason: error.reason },
        ctx,
        answer.status
    );
}
