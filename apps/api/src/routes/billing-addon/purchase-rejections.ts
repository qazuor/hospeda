import { trans } from '@repo/i18n';
import { PaymentProviderError } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import type { PurchaseAddonRefusalReason } from '@repo/service-core';
import type { Context } from 'hono';
import { createErrorResponse } from '../../utils/response-helpers';
import { resolveReturnUrlLocale } from '../../utils/return-url-locale';

type AddonPurchaseCopyKey =
    | 'oneTimePaymentRequired'
    | 'recurringPaymentNotAccepted'
    | 'payerEmailRequired'
    | 'purchaseNotFound';

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
    ORDER_REQUEST_REUSED: { status: 409, code: 'ADDON_ORDER_REQUEST_REUSED' }
};

/** Converts a typed A1 refusal into the public error envelope. */
export function answerPurchaseRefusal(input: {
    readonly reason: PurchaseAddonRefusalReason;
    readonly ctx: Context;
}): Response {
    const answer = PURCHASE_REJECTION_ANSWERS[input.reason];
    return createErrorResponse(
        { code: answer.code, message: input.reason, reason: input.reason },
        input.ctx,
        answer.status
    );
}

/** Mirrors S1's provider rejection and transient failure contract. */
export function answerAddonProviderError(input: {
    readonly error: unknown;
    readonly ctx: Context;
}): Response {
    const { error, ctx } = input;
    if (error instanceof PaymentProviderError && error.capability === 'authorize') {
        if (error.code === 'REJECTED')
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'The payment provider rejected the payment details',
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
                    message: 'The payment provider is busy; try again in a minute',
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
