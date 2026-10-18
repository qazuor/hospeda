/** @file cancellation-reasons.ts — closed client copy maps for action 8. */

import type { TranslationKey } from '@repo/i18n';
import type {
    AdminSubscriptionCancellationPreviewResponse,
    AdminSubscriptionCancellationResponse
} from '@repo/schemas';
import { isApiError } from '@/lib/errors';

export const KNOWN_CANCELLATION_REASONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'CANCELLATION_FORBIDDEN',
    'CANCELLATION_NOT_PRINCIPAL',
    'CANCELLATION_STATE_NOT_ALLOWED',
    'CANCELLATION_ORIGIN_CHANGED'
] as const;
export type KnownCancellationReason = (typeof KNOWN_CANCELLATION_REASONS)[number];

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
export const CANCELLATION_NOTICE_KEYS: Readonly<
    Record<'CANCELLATION_ORIGIN_CHANGED', TranslationKey>
> = {
    CANCELLATION_ORIGIN_CHANGED:
        'admin-billing.subscriptionCancellation.notice.CANCELLATION_ORIGIN_CHANGED'
};

export type CancellationOrigin = AdminSubscriptionCancellationPreviewResponse['origin'];
export const CANCELLATION_ORIGIN_KEYS: Readonly<Record<CancellationOrigin, TranslationKey>> = {
    ACTIVE: 'admin-billing.subscriptionCancellation.origin.ACTIVE',
    GRACE_PERIOD: 'admin-billing.subscriptionCancellation.origin.GRACE_PERIOD',
    SUSPENDED: 'admin-billing.subscriptionCancellation.origin.SUSPENDED',
    CANCEL_SCHEDULED: 'admin-billing.subscriptionCancellation.origin.CANCEL_SCHEDULED'
};
export type ConfirmableCancellationOrigin = Exclude<CancellationOrigin, 'CANCEL_SCHEDULED'>;
export const CANCELLATION_CONFIRM_KEYS: Readonly<
    Record<ConfirmableCancellationOrigin, TranslationKey>
> = {
    ACTIVE: 'admin-billing.subscriptionCancellation.confirm.ACTIVE',
    GRACE_PERIOD: 'admin-billing.subscriptionCancellation.confirm.GRACE_PERIOD',
    SUSPENDED: 'admin-billing.subscriptionCancellation.confirm.SUSPENDED'
};

export type CancellationOutcome = AdminSubscriptionCancellationResponse['outcome'];
export const CANCELLATION_OUTCOME_KEYS: Readonly<Record<CancellationOutcome, TranslationKey>> = {
    SCHEDULED: 'admin-billing.subscriptionCancellation.result.SCHEDULED',
    ALREADY_SCHEDULED: 'admin-billing.subscriptionCancellation.result.ALREADY_SCHEDULED',
    CANCELLED: 'admin-billing.subscriptionCancellation.result.CANCELLED',
    ALREADY_CANCELLED: 'admin-billing.subscriptionCancellation.result.ALREADY_CANCELLED'
};
export type CancellationCancelCall = NonNullable<
    AdminSubscriptionCancellationResponse['cancelCall']
>;
export const CANCELLATION_CANCEL_CALL_KEYS: Readonly<
    Record<CancellationCancelCall, TranslationKey>
> = {
    SENT: 'admin-billing.subscriptionCancellation.cancelCall.SENT',
    NOT_NEEDED: 'admin-billing.subscriptionCancellation.cancelCall.NOT_NEEDED',
    NOTICE_PENDING: 'admin-billing.subscriptionCancellation.cancelCall.NOTICE_PENDING',
    FAILED: 'admin-billing.subscriptionCancellation.cancelCall.FAILED',
    NOT_APPLICABLE: 'admin-billing.subscriptionCancellation.cancelCall.NOT_APPLICABLE'
};
export type CancellationEscalated = NonNullable<AdminSubscriptionCancellationResponse['escalated']>;
export const CANCELLATION_ESCALATED_KEYS: Readonly<Record<CancellationEscalated, TranslationKey>> =
    {
        NO_RECIPIENT: 'admin-billing.subscriptionCancellation.escalated.NO_RECIPIENT',
        DELIVERY_EXHAUSTED: 'admin-billing.subscriptionCancellation.escalated.DELIVERY_EXHAUSTED'
    };
export type CancellationAddonWhenOff =
    AdminSubscriptionCancellationPreviewResponse['addons'][number]['whenOff'];
export const CANCELLATION_ADDON_WHEN_OFF_KEYS: Readonly<
    Record<CancellationAddonWhenOff, TranslationKey>
> = {
    CHARGE_CUT_TODAY: 'admin-billing.subscriptionCancellation.addons.CHARGE_CUT_TODAY',
    AT_SERVICE_END: 'admin-billing.subscriptionCancellation.addons.AT_SERVICE_END',
    TODAY: 'admin-billing.subscriptionCancellation.addons.TODAY'
};
export type CancellationCycle =
    AdminSubscriptionCancellationPreviewResponse['addons'][number]['cycle'];
export const CANCELLATION_CYCLE_KEYS: Readonly<Record<CancellationCycle, TranslationKey>> = {
    monthly: 'admin-billing.subscriptionCancellation.cycle.monthly',
    quarterly: 'admin-billing.subscriptionCancellation.cycle.quarterly',
    semiannual: 'admin-billing.subscriptionCancellation.cycle.semiannual',
    annual: 'admin-billing.subscriptionCancellation.cycle.annual'
};

export function isKnownCancellationReason(reason: string): reason is KnownCancellationReason {
    return (KNOWN_CANCELLATION_REASONS as readonly string[]).includes(reason);
}

export function readCancellationReason({ error }: { readonly error: unknown }): string | null {
    if (!isApiError(error)) return null;
    const reason = (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason;
    return typeof reason === 'string' && reason.length > 0 ? reason : null;
}
