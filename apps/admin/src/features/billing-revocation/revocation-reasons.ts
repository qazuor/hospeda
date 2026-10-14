/**
 * @file revocation-reasons.ts
 * The reasons administrative action 8 with reason revocation (S36, HOS-1678)
 * can be refused with, and the copy the panel shows for each one.
 *
 * The panel cannot import `REVOKE_SUBSCRIPTION_REJECTIONS` (it lives in
 * `@repo/service-core`, server only), so the twelve `reason` values of the
 * API's error contract are mirrored here as a closed tuple. Every map below is
 * an exhaustive `Record`: a reason added to the tuple without its copy breaks
 * the typecheck. A reason the API sends that is NOT in the tuple is shown as
 * an unknown refusal with its code (H8), never as something confirmable.
 *
 * @module revocation-reasons
 */

import type { TranslationKey } from '@repo/i18n';
import type { SubscriptionRevocationCancelCall, SubscriptionRevocationOrigin } from '@repo/schemas';
import { isApiError } from '@/lib/errors';

/**
 * Every `reason` the revocation preview and act answer a refusal with
 * (`apps/api/docs/error-contract.md`, «Action 8 revocation rejections»).
 */
export const KNOWN_REVOCATION_REASONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REVOCATION_NOT_PRINCIPAL',
    'REVOCATION_STATE_NOT_ALLOWED',
    'REVOCATION_NO_CREDITED_PAYMENT',
    'REVOCATION_WINDOW_CLOSED',
    'REVOCATION_AMOUNT_UNAVAILABLE',
    'REVOCATION_PAYMENT_CHANGED',
    'REVOCATION_STATE_CHANGED',
    'PAYMENT_NOT_REFUNDABLE',
    'REFUND_EXCEEDS_BALANCE',
    'REFUND_AMOUNT_INVALID'
] as const;

/** One refusal reason of the revocation the panel has copy for. */
export type KnownRevocationReason = (typeof KNOWN_REVOCATION_REASONS)[number];

/**
 * The 409s of the act that mean "something changed since the preview": the
 * screen says so and reads the preview again, without retrying.
 */
export const REVOCATION_NOTICE_REASONS = [
    'REVOCATION_PAYMENT_CHANGED',
    'REVOCATION_STATE_CHANGED'
] as const;

/** A refusal of the act the screen answers with a notice and a fresh preview. */
export type RevocationNoticeReason = (typeof REVOCATION_NOTICE_REASONS)[number];

/** Copy of each refusal when the preview (or a re-read) answers it. */
export const REVOCATION_REASON_KEYS: Readonly<Record<KnownRevocationReason, TranslationKey>> = {
    SUBSCRIPTION_NOT_FOUND: 'admin-billing.subscriptionRevocation.blocked.SUBSCRIPTION_NOT_FOUND',
    ADMINISTRATIVE_ACTION_FORBIDDEN:
        'admin-billing.subscriptionRevocation.blocked.ADMINISTRATIVE_ACTION_FORBIDDEN',
    REVOCATION_NOT_PRINCIPAL:
        'admin-billing.subscriptionRevocation.blocked.REVOCATION_NOT_PRINCIPAL',
    REVOCATION_STATE_NOT_ALLOWED:
        'admin-billing.subscriptionRevocation.blocked.REVOCATION_STATE_NOT_ALLOWED',
    REVOCATION_NO_CREDITED_PAYMENT:
        'admin-billing.subscriptionRevocation.blocked.REVOCATION_NO_CREDITED_PAYMENT',
    REVOCATION_WINDOW_CLOSED:
        'admin-billing.subscriptionRevocation.blocked.REVOCATION_WINDOW_CLOSED',
    REVOCATION_AMOUNT_UNAVAILABLE:
        'admin-billing.subscriptionRevocation.blocked.REVOCATION_AMOUNT_UNAVAILABLE',
    REVOCATION_PAYMENT_CHANGED:
        'admin-billing.subscriptionRevocation.blocked.REVOCATION_PAYMENT_CHANGED',
    REVOCATION_STATE_CHANGED:
        'admin-billing.subscriptionRevocation.blocked.REVOCATION_STATE_CHANGED',
    PAYMENT_NOT_REFUNDABLE: 'admin-billing.subscriptionRevocation.blocked.PAYMENT_NOT_REFUNDABLE',
    REFUND_EXCEEDS_BALANCE: 'admin-billing.subscriptionRevocation.blocked.REFUND_EXCEEDS_BALANCE',
    REFUND_AMOUNT_INVALID: 'admin-billing.subscriptionRevocation.blocked.REFUND_AMOUNT_INVALID'
};

/** Copy of the notice a 409 of the act leaves on the screen. */
export const REVOCATION_NOTICE_KEYS: Readonly<Record<RevocationNoticeReason, TranslationKey>> = {
    REVOCATION_PAYMENT_CHANGED:
        'admin-billing.subscriptionRevocation.notice.REVOCATION_PAYMENT_CHANGED',
    REVOCATION_STATE_CHANGED: 'admin-billing.subscriptionRevocation.notice.REVOCATION_STATE_CHANGED'
};

/** The label of a revocable state and, for two of them, what else the act does (H13). */
export interface RevocationOriginCopy {
    /** Label of the current state. */
    readonly label: TranslationKey;
    /** The extra line for GRACE_PERIOD and PAUSED; `null` for the others. */
    readonly extra: TranslationKey | null;
}

/** Copy of each state S36 revokes from (TRANS:B:S36, AC:B5:20). */
export const REVOCATION_ORIGIN_COPY: Readonly<
    Record<SubscriptionRevocationOrigin, RevocationOriginCopy>
> = {
    ACTIVE: { label: 'admin-billing.subscriptionRevocation.origin.ACTIVE', extra: null },
    GRACE_PERIOD: {
        label: 'admin-billing.subscriptionRevocation.origin.GRACE_PERIOD',
        extra: 'admin-billing.subscriptionRevocation.originExtra.GRACE_PERIOD'
    },
    CANCEL_SCHEDULED: {
        label: 'admin-billing.subscriptionRevocation.origin.CANCEL_SCHEDULED',
        extra: null
    },
    PAUSED: {
        label: 'admin-billing.subscriptionRevocation.origin.PAUSED',
        extra: 'admin-billing.subscriptionRevocation.originExtra.PAUSED'
    }
};

/** Copy of each outcome of the provider half of S36 (H9). */
export const REVOCATION_CANCEL_CALL_KEYS: Readonly<
    Record<SubscriptionRevocationCancelCall, TranslationKey>
> = {
    SENT: 'admin-billing.subscriptionRevocation.result.cancelCall.SENT',
    NOT_NEEDED: 'admin-billing.subscriptionRevocation.result.cancelCall.NOT_NEEDED',
    NOTICE_PENDING: 'admin-billing.subscriptionRevocation.result.cancelCall.NOTICE_PENDING',
    FAILED: 'admin-billing.subscriptionRevocation.result.cancelCall.FAILED',
    NOT_APPLICABLE: 'admin-billing.subscriptionRevocation.result.cancelCall.NOT_APPLICABLE'
};

/** Copy of each reason the before-cancel notice was escalated with (H9). */
export const REVOCATION_ESCALATED_KEYS: Readonly<
    Record<'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED', TranslationKey>
> = {
    NO_RECIPIENT: 'admin-billing.subscriptionRevocation.result.escalated.NO_RECIPIENT',
    DELIVERY_EXHAUSTED: 'admin-billing.subscriptionRevocation.result.escalated.DELIVERY_EXHAUSTED'
};

/**
 * Whether a `reason` is one the panel has copy for.
 *
 * @param reason - The `reason` of a refusal.
 * @returns `true` for one of {@link KNOWN_REVOCATION_REASONS}.
 */
export function isKnownRevocationReason(reason: string): reason is KnownRevocationReason {
    return (KNOWN_REVOCATION_REASONS as readonly string[]).includes(reason);
}

/**
 * Whether a refusal of the act means "something changed since the preview".
 *
 * @param reason - The `reason` of a refusal, or `null`.
 * @returns `true` for one of {@link REVOCATION_NOTICE_REASONS}.
 */
export function isRevocationNoticeReason(reason: string | null): reason is RevocationNoticeReason {
    return reason !== null && (REVOCATION_NOTICE_REASONS as readonly string[]).includes(reason);
}

/**
 * Reads the `reason` of an API refusal (`{ success: false, error: { reason } }`).
 *
 * @param input - The thrown error.
 * @returns The `reason`, or `null` when the error is not an `ApiError` or has none.
 */
export function readRevocationReason({ error }: { readonly error: unknown }): string | null {
    if (!isApiError(error)) return null;
    const reason = (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason;
    return typeof reason === 'string' && reason.length > 0 ? reason : null;
}
