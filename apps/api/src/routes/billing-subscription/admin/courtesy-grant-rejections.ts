import { ServiceErrorCode } from '@repo/schemas';
import type { TemporaryCourtesyRefusalReason } from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../../utils/response-helpers';
import { answerPauseRejection } from '../pause-rejections';

type Answer = { readonly status: 409 | 422; readonly code: string };
const INVALID: Answer = { status: 422, code: ServiceErrorCode.VALIDATION_ERROR };
const CONFLICT: Answer = { status: 409, code: 'CONFLICT' };

/** Exhaustive mapping of S9 and S34 courtesy refusal reasons. */
export const COURTESY_GRANT_REJECTIONS: Readonly<Record<TemporaryCourtesyRefusalReason, Answer>> = {
    NOT_PRINCIPAL: INVALID,
    NOT_MONTHLY: INVALID,
    MONTHS_INVALID: INVALID,
    SUBSCRIPTION_PAUSED: CONFLICT,
    NOT_ELIGIBLE: CONFLICT,
    LIVE_GRANT_ANCHOR: CONFLICT,
    NO_PROVIDER_LINK: INVALID
};

/** Answer one typed courtesy refusal. */
export function answerCourtesyGrantRefusal(input: {
    readonly reason: TemporaryCourtesyRefusalReason;
    readonly ctx: Context;
}): Response {
    const mapped = COURTESY_GRANT_REJECTIONS[input.reason];
    return createErrorResponse(
        {
            code: mapped.code,
            message: input.reason,
            reason: input.reason,
            details: { reason: input.reason }
        },
        input.ctx,
        mapped.status
    );
}

/** Report an unconfirmed provider pause without a mutation audit. */
export function answerCourtesyGrantNotApplied(ctx: Context): Response {
    const reason = 'COURTESY_NOT_APPLIED';
    return createErrorResponse(
        { code: 'CONFLICT', message: reason, reason, details: { reason } },
        ctx,
        409
    );
}

/** Delegate provider and shared administrative failures to the pause contract. */
export function answerCourtesyGrantError(input: {
    readonly error: unknown;
    readonly ctx: Context;
}): Response {
    return answerPauseRejection(input);
}
