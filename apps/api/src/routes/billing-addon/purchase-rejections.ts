import { trans } from '@repo/i18n';
import { PaymentProviderError } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import {
    PURCHASE_IDENTITY_BUSY_REASON,
    type PurchaseAddonRefusalReason,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../utils/response-helpers';
import { resolveReturnUrlLocale } from '../../utils/return-url-locale';

type AddonPurchaseCopyKey =
    | 'purchaseNotFound'
    | 'freeProductNotFound'
    | 'freeTargetNotFound'
    | 'freeNoTitle'
    | 'freeVersionChanged'
    | 'freeAlreadyActive'
    | 'freePendingElsewhere'
    | 'freeOrderRequestReused'
    | 'freeUnderGrant'
    | 'providerRejected'
    | 'pageRejected'
    | 'providerBusy'
    | 'providerUnavailable'
    | 'identityBusy';

/** Reads API copy in the request locale, failing if a catalog entry is missing. */
export function readAddonPurchaseCopy(ctx: Context, key: AddonPurchaseCopyKey): string {
    const message = trans[resolveReturnUrlLocale(ctx)][`billing.addonPurchaseApi.${key}`];
    if (!message) throw new Error(`Missing addon purchase copy: ${key}`);
    return message;
}

type Answer = { readonly status: 404 | 409; readonly code: string };

/** Exhaustive HTTP mapping for addon purchase refusals. */
export const PURCHASE_REJECTION_ANSWERS: Readonly<Record<PurchaseAddonRefusalReason, Answer>> = {
    PRODUCT_NOT_FOUND: { status: 404, code: 'ADDON_PRODUCT_NOT_FOUND' },
    TARGET_NOT_FOUND: { status: 404, code: 'ADDON_TARGET_NOT_FOUND' },
    NO_VALID_TITLE: { status: 409, code: 'ADDON_NO_VALID_TITLE' },
    ADDON_VERSION_NOT_CURRENT: { status: 409, code: 'ADDON_VERSION_NOT_CURRENT' },
    ALREADY_ACTIVE: { status: 409, code: 'ADDON_ALREADY_ACTIVE' },
    FREE_UNDER_GRANT: { status: 409, code: 'ADDON_FREE_UNDER_GRANT' },
    ORDER_REQUEST_REUSED: { status: 409, code: 'ADDON_ORDER_REQUEST_REUSED' },
    ORDER_REQUEST_ABANDONED: { status: 409, code: 'ADDON_ORDER_REQUEST_ABANDONED' }
};

/** Converts a typed A1 refusal into the public error envelope. */
export function answerPurchaseRefusal(input: {
    readonly reason: PurchaseAddonRefusalReason;
    readonly ctx: Context;
}): Response {
    const answer = PURCHASE_REJECTION_ANSWERS[input.reason];
    return createErrorResponse(
        {
            code: answer.code,
            message:
                input.reason === 'FREE_UNDER_GRANT'
                    ? readAddonPurchaseCopy(input.ctx, 'freeUnderGrant')
                    : input.reason,
            reason: input.reason
        },
        input.ctx,
        answer.status
    );
}

/**
 * Mirrors S1's provider rejection and transient failure contract, for the recurring checkout
 * (`authorize`) and the one-time payment page (`charge`, HOS-2179). A refused page creation
 * has already released the purchase, so the screen mints a new order id (HOS-2321).
 *
 * It also answers A1's purchase-identity wait that ran out (HOS-2518): a 503 with its own reason
 * and localized copy, never the service's English message. That request created nothing, so the
 * screen keeps its order id.
 */
export function answerAddonProviderError(input: {
    readonly error: unknown;
    readonly ctx: Context;
}): Response {
    const { error, ctx } = input;
    if (error instanceof ServiceError && error.reason === PURCHASE_IDENTITY_BUSY_REASON)
        return createErrorResponse(
            {
                code: ServiceErrorCode.SERVICE_UNAVAILABLE,
                message: readAddonPurchaseCopy(ctx, 'identityBusy'),
                reason: PURCHASE_IDENTITY_BUSY_REASON
            },
            ctx,
            503
        );
    if (
        error instanceof PaymentProviderError &&
        (error.capability === 'authorize' || error.capability === 'charge')
    ) {
        if (error.code === 'REJECTED')
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: readAddonPurchaseCopy(
                        ctx,
                        error.capability === 'charge' ? 'pageRejected' : 'providerRejected'
                    ),
                    reason: 'PROVIDER_REJECTED'
                },
                ctx,
                422
            );
        if (error.transient) {
            const { kind, retryAfterSeconds } = error.transient;
            return createErrorResponse(
                {
                    code:
                        kind === 'RATE_LIMITED'
                            ? ServiceErrorCode.PROVIDER_RATE_LIMITED
                            : ServiceErrorCode.SERVICE_UNAVAILABLE,
                    message: readAddonPurchaseCopy(
                        ctx,
                        kind === 'RATE_LIMITED' ? 'providerBusy' : 'providerUnavailable'
                    ),
                    reason: kind === 'RATE_LIMITED' ? 'PROVIDER_BUSY' : 'PROVIDER_UNAVAILABLE',
                    ...(retryAfterSeconds === undefined
                        ? {}
                        : { details: { retryAfter: retryAfterSeconds } })
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
