import { PaymentProviderError } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { type PauseRefusalReason, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../utils/response-helpers';

type PauseRouteReason =
    | PauseRefusalReason
    | 'NO_PROVIDER_LINK'
    | 'NOT_PRINCIPAL'
    | 'NOT_PAUSED'
    | 'NO_OPEN_PAUSE'
    | 'PAUSE_NOT_CUSTOMER_REQUEST'
    | 'NOT_APPLIED'
    | 'LOST_RACE'
    | 'ADMINISTRATIVE_ACTION_STATE_CHANGED'
    | 'ADMINISTRATIVE_ACTION_FORBIDDEN'
    | 'SUBSCRIPTION_NOT_FOUND';

type Answer = { readonly status: 403 | 404 | 409 | 422; readonly code: string };
const CONFLICT: Answer = { status: 409, code: 'CONFLICT' };
const INVALID: Answer = { status: 422, code: ServiceErrorCode.VALIDATION_ERROR };

/** Exhaustive HTTP mapping for the shared administrative and self-service pause operations. */
export const PAUSE_REJECTION_ANSWERS: Readonly<Record<PauseRouteReason, Answer>> = {
    NOT_PRINCIPAL: INVALID,
    NOT_ACTIVE: CONFLICT,
    MANUAL_PAYER: INVALID,
    NOT_MONTHLY: INVALID,
    PLAN_DISALLOWS_PAUSE: INVALID,
    COURTESY_IN_FORCE: CONFLICT,
    MONTHS_OUT_OF_RANGE: INVALID,
    PAUSE_COUNT_EXHAUSTED: CONFLICT,
    MONTHS_EXHAUSTED: CONFLICT,
    NO_PROVIDER_LINK: INVALID,
    NOT_PAUSED: CONFLICT,
    NO_OPEN_PAUSE: CONFLICT,
    PAUSE_NOT_CUSTOMER_REQUEST: CONFLICT,
    NOT_APPLIED: CONFLICT,
    LOST_RACE: CONFLICT,
    ADMINISTRATIVE_ACTION_STATE_CHANGED: CONFLICT,
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    SUBSCRIPTION_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND }
};

/** Reject with a stable, mapped reason. */
export function rejectPause(reason: PauseRouteReason): never {
    throw new ServiceError(ServiceErrorCode.ALREADY_EXISTS, reason, { reason }, reason);
}

/** Convert typed pause and provider failures into the API error contract. */
export function answerPauseRejection(input: {
    readonly error: unknown;
    readonly ctx: Context;
}): Response {
    const { error, ctx } = input;
    if (error instanceof ServiceError && error.reason && error.reason in PAUSE_REJECTION_ANSWERS) {
        const reason = error.reason as PauseRouteReason;
        const mapped = PAUSE_REJECTION_ANSWERS[reason];
        return createErrorResponse(
            { code: mapped.code, message: error.message, reason, details: { reason } },
            ctx,
            mapped.status
        );
    }
    if (error instanceof PaymentProviderError) {
        if (error.code === 'REJECTED')
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Payment provider rejected the request',
                    reason: 'PROVIDER_REJECTED',
                    details: { reason: 'PROVIDER_REJECTED' }
                },
                ctx,
                422
            );
        if (error.transient) {
            const { kind, retryAfterSeconds } = error.transient;
            const reason = kind === 'RATE_LIMITED' ? 'PROVIDER_BUSY' : 'PROVIDER_UNAVAILABLE';
            return createErrorResponse(
                {
                    code:
                        kind === 'RATE_LIMITED'
                            ? ServiceErrorCode.PROVIDER_RATE_LIMITED
                            : ServiceErrorCode.SERVICE_UNAVAILABLE,
                    message: 'The payment provider is busy; try again in a minute',
                    reason,
                    details: {
                        reason,
                        ...(retryAfterSeconds === undefined
                            ? {}
                            : { retryAfter: retryAfterSeconds })
                    }
                },
                ctx,
                503,
                retryAfterSeconds === undefined
                    ? undefined
                    : { 'Retry-After': String(retryAfterSeconds) }
            );
        }
    }
    throw error;
}
