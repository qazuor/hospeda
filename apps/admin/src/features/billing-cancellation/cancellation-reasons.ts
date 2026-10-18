/** @file cancellation-reasons.ts — closed client copy maps for action 8. */

import type { TranslationKey } from '@repo/i18n';
import type {
    AdminSubscriptionCancellationPreviewResponse,
    AdminSubscriptionCancellationResponse
} from '@repo/schemas';
import { isApiError } from '@/lib/errors';

/** Cancellation refusal reasons that the admin screen can explain explicitly. */
export const KNOWN_CANCELLATION_REASONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'CANCELLATION_FORBIDDEN',
    'CANCELLATION_NOT_PRINCIPAL',
    'CANCELLATION_STATE_NOT_ALLOWED',
    'CANCELLATION_ORIGIN_CHANGED'
] as const;
/** A refusal reason with a dedicated translation in the cancellation screen. */
export type KnownCancellationReason = (typeof KNOWN_CANCELLATION_REASONS)[number];

/** Translation keys for known refusals other than the origin-change notice. */
export const CANCELLATION_REASON_KEYS: Readonly<
    Record<Exclude<KnownCancellationReason, 'CANCELLATION_ORIGIN_CHANGED'>, TranslationKey>
> = {
    SUBSCRIPTION_NOT_FOUND: 'admin-billing.subscriptionCancellation.blocked.SUBSCRIPTION_NOT_FOUND',
    ADMINISTRATIVE_ACTION_FORBIDDEN:
        'admin-billing.subscriptionCancellation.blocked.ADMINISTRATIVE_ACTION_FORBIDDEN',
    CANCELLATION_FORBIDDEN: 'admin-billing.subscriptionCancellation.blocked.CANCELLATION_FORBIDDEN',
    CANCELLATION_NOT_PRINCIPAL:
        'admin-billing.subscriptionCancellation.blocked.CANCELLATION_NOT_PRINCIPAL',
    CANCELLATION_STATE_NOT_ALLOWED:
        'admin-billing.subscriptionCancellation.blocked.CANCELLATION_STATE_NOT_ALLOWED'
};
/** Translation keys for transient notices returned by the cancellation API. */
export const CANCELLATION_NOTICE_KEYS: Readonly<
    Record<'CANCELLATION_ORIGIN_CHANGED', TranslationKey>
> = {
    CANCELLATION_ORIGIN_CHANGED:
        'admin-billing.subscriptionCancellation.notice.CANCELLATION_ORIGIN_CHANGED'
};

/** Subscription states from which the admin cancellation preview can be opened. */
export type CancellationOrigin = AdminSubscriptionCancellationPreviewResponse['origin'];
/** Translation keys for the subscription state shown in the preview. */
export const CANCELLATION_ORIGIN_KEYS: Readonly<Record<CancellationOrigin, TranslationKey>> = {
    ACTIVE: 'admin-billing.subscriptionCancellation.origin.ACTIVE',
    GRACE_PERIOD: 'admin-billing.subscriptionCancellation.origin.GRACE_PERIOD',
    SUSPENDED: 'admin-billing.subscriptionCancellation.origin.SUSPENDED',
    CANCEL_SCHEDULED: 'admin-billing.subscriptionCancellation.origin.CANCEL_SCHEDULED'
};
/** Origins from which an admin can confirm a new cancellation. */
export type ConfirmableCancellationOrigin = Exclude<CancellationOrigin, 'CANCEL_SCHEDULED'>;
/** Confirmation copy keys for origins where cancellation is still actionable. */
export const CANCELLATION_CONFIRM_KEYS: Readonly<
    Record<ConfirmableCancellationOrigin, TranslationKey>
> = {
    ACTIVE: 'admin-billing.subscriptionCancellation.confirm.ACTIVE',
    GRACE_PERIOD: 'admin-billing.subscriptionCancellation.confirm.GRACE_PERIOD',
    SUSPENDED: 'admin-billing.subscriptionCancellation.confirm.SUSPENDED'
};

/** Outcomes returned after the cancellation request is processed. */
export type CancellationOutcome = AdminSubscriptionCancellationResponse['outcome'];
/** Translation keys describing each cancellation outcome. */
export const CANCELLATION_OUTCOME_KEYS: Readonly<Record<CancellationOutcome, TranslationKey>> = {
    SCHEDULED: 'admin-billing.subscriptionCancellation.result.SCHEDULED',
    ALREADY_SCHEDULED: 'admin-billing.subscriptionCancellation.result.ALREADY_SCHEDULED',
    CANCELLED: 'admin-billing.subscriptionCancellation.result.CANCELLED',
    ALREADY_CANCELLED: 'admin-billing.subscriptionCancellation.result.ALREADY_CANCELLED'
};
/** Mercado Pago cancellation call statuses included in a result. */
export type CancellationCancelCall = NonNullable<
    AdminSubscriptionCancellationResponse['cancelCall']
>;
/** Translation keys for Mercado Pago cancellation call statuses. */
export const CANCELLATION_CANCEL_CALL_KEYS: Readonly<
    Record<CancellationCancelCall, TranslationKey>
> = {
    SENT: 'admin-billing.subscriptionCancellation.cancelCall.SENT',
    NOT_NEEDED: 'admin-billing.subscriptionCancellation.cancelCall.NOT_NEEDED',
    NOTICE_PENDING: 'admin-billing.subscriptionCancellation.cancelCall.NOTICE_PENDING',
    FAILED: 'admin-billing.subscriptionCancellation.cancelCall.FAILED',
    NOT_APPLICABLE: 'admin-billing.subscriptionCancellation.cancelCall.NOT_APPLICABLE'
};
/** Reasons a cancellation result may have been escalated for follow-up. */
export type CancellationEscalated = NonNullable<AdminSubscriptionCancellationResponse['escalated']>;
/** Translation keys for cancellation escalation reasons. */
export const CANCELLATION_ESCALATED_KEYS: Readonly<Record<CancellationEscalated, TranslationKey>> =
    {
        NO_RECIPIENT: 'admin-billing.subscriptionCancellation.escalated.NO_RECIPIENT',
        DELIVERY_EXHAUSTED: 'admin-billing.subscriptionCancellation.escalated.DELIVERY_EXHAUSTED'
    };
/** Preview timing categories for recurring add-ons being turned off. */
export type CancellationAddonWhenOff =
    AdminSubscriptionCancellationPreviewResponse['addons'][number]['whenOff'];
/** Translation keys describing when each recurring add-on is turned off. */
export const CANCELLATION_ADDON_WHEN_OFF_KEYS: Readonly<
    Record<CancellationAddonWhenOff, TranslationKey>
> = {
    CHARGE_CUT_TODAY: 'admin-billing.subscriptionCancellation.addons.CHARGE_CUT_TODAY',
    AT_SERVICE_END: 'admin-billing.subscriptionCancellation.addons.AT_SERVICE_END',
    TODAY: 'admin-billing.subscriptionCancellation.addons.TODAY'
};
/** Billing cycles used to describe recurring add-on prices. */
export type CancellationCycle =
    AdminSubscriptionCancellationPreviewResponse['addons'][number]['cycle'];
/** Translation keys for recurring add-on billing cycles. */
export const CANCELLATION_CYCLE_KEYS: Readonly<Record<CancellationCycle, TranslationKey>> = {
    monthly: 'admin-billing.subscriptionCancellation.cycle.monthly',
    quarterly: 'admin-billing.subscriptionCancellation.cycle.quarterly',
    semiannual: 'admin-billing.subscriptionCancellation.cycle.semiannual',
    annual: 'admin-billing.subscriptionCancellation.cycle.annual'
};

/** Checks whether an API refusal reason has a dedicated cancellation translation.
 * @param input - Object containing the reason to check.
 * @returns Whether the reason is known; narrows `reason` to `KnownCancellationReason`.
 */
export function isKnownCancellationReason(input: {
    readonly reason: string;
}): input is { readonly reason: KnownCancellationReason } {
    return (KNOWN_CANCELLATION_REASONS as readonly string[]).includes(input.reason);
}

/** Extracts a non-empty refusal reason from an API error, when present.
 * @param input - Object containing the error to inspect.
 * @returns The refusal reason, or `null` when the error has none.
 */
export function readCancellationReason({ error }: { readonly error: unknown }): string | null {
    if (!isApiError(error)) return null;
    const reason = (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason;
    return typeof reason === 'string' && reason.length > 0 ? reason : null;
}
