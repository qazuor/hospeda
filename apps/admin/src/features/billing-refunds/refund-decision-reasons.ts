/**
 * @file refund-decision-reasons.ts
 * Closed client mirror of the refusals of administrative action 13 (confirm and decline).
 *
 * @module refund-decision-reasons
 */

import type { TranslationKey } from '@repo/i18n';
import type { RefundConfirmationOutcome } from '@repo/schemas';
import { isApiError } from '@/lib/errors';

/** Typed reasons the confirm and decline routes answer, documented in `apps/api/docs/error-contract.md`. */
export const KNOWN_REFUND_DECISION_REASONS = [
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_OPEN',
    'REFUND_STATE_CHANGED',
    'PAYMENT_NOT_REFUNDABLE',
    'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE',
    'RETAINED_PAYMENT_SUCCESSION_OPEN',
    'REFUND_EXCEEDS_BALANCE',
    'REFUND_PAST_PROVIDER_WINDOW',
    'REFUND_PROVIDER_ID_ALREADY_RECORDED',
    'REFUND_HAS_PROVIDER_CALLS',
    'REFUND_CLOSES_HELD_CHARGE'
] as const;

/** A refusal reason the proposed-refund screen has translated copy for. */
export type KnownRefundDecisionReason = (typeof KNOWN_REFUND_DECISION_REASONS)[number];

const BASE = 'admin-billing.proposedRefunds.rejections';

/** Translation key for each known refusal reason. */
export const REFUND_DECISION_REASON_KEYS: Readonly<
    Record<KnownRefundDecisionReason, TranslationKey>
> = {
    REFUND_NOT_FOUND: `${BASE}.REFUND_NOT_FOUND`,
    REFUND_SOURCE_NOT_FOUND: `${BASE}.REFUND_SOURCE_NOT_FOUND`,
    ADMINISTRATIVE_ACTION_FORBIDDEN: `${BASE}.ADMINISTRATIVE_ACTION_FORBIDDEN`,
    REFUND_NOT_OPEN: `${BASE}.REFUND_NOT_OPEN`,
    REFUND_STATE_CHANGED: `${BASE}.REFUND_STATE_CHANGED`,
    PAYMENT_NOT_REFUNDABLE: `${BASE}.PAYMENT_NOT_REFUNDABLE`,
    REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE: `${BASE}.REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE`,
    RETAINED_PAYMENT_SUCCESSION_OPEN: `${BASE}.RETAINED_PAYMENT_SUCCESSION_OPEN`,
    REFUND_EXCEEDS_BALANCE: `${BASE}.REFUND_EXCEEDS_BALANCE`,
    REFUND_PAST_PROVIDER_WINDOW: `${BASE}.REFUND_PAST_PROVIDER_WINDOW`,
    REFUND_PROVIDER_ID_ALREADY_RECORDED: `${BASE}.REFUND_PROVIDER_ID_ALREADY_RECORDED`,
    REFUND_HAS_PROVIDER_CALLS: `${BASE}.REFUND_HAS_PROVIDER_CALLS`,
    REFUND_CLOSES_HELD_CHARGE: `${BASE}.REFUND_CLOSES_HELD_CHARGE`
};

/** Translation key for each outcome of a confirmation the provider did not settle outright. */
export const CONFIRM_OUTCOME_KEYS: Readonly<Record<RefundConfirmationOutcome, TranslationKey>> = {
    SENT: 'admin-billing.proposedRefunds.confirm.outcomes.SENT',
    AWAITING_PROVIDER_ANSWER:
        'admin-billing.proposedRefunds.confirm.outcomes.AWAITING_PROVIDER_ANSWER',
    NOT_ACCEPTED_KEPT_CONFIRMED:
        'admin-billing.proposedRefunds.confirm.outcomes.NOT_ACCEPTED_KEPT_CONFIRMED',
    PROVIDER_REJECTED_KEPT_CONFIRMED:
        'admin-billing.proposedRefunds.confirm.outcomes.PROVIDER_REJECTED_KEPT_CONFIRMED',
    PROVIDER_REJECTED_FAILED:
        'admin-billing.proposedRefunds.confirm.outcomes.PROVIDER_REJECTED_FAILED',
    ORDER_REFUND_HELD: 'admin-billing.proposedRefunds.confirm.outcomes.ORDER_REFUND_HELD',
    PROVIDER_KEY_CONFLICT: 'admin-billing.proposedRefunds.confirm.outcomes.PROVIDER_KEY_CONFLICT',
    ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED:
        'admin-billing.proposedRefunds.confirm.outcomes.ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED',
    CHARGED_BACK: 'admin-billing.proposedRefunds.confirm.outcomes.CHARGED_BACK'
};

/**
 * Reads the typed reason of an action 13 refusal.
 *
 * @param input - The thrown error.
 * @returns The known reason, or `null` for unknown and non-API errors.
 */
export function readRefundDecisionReason({
    error
}: {
    readonly error: unknown;
}): KnownRefundDecisionReason | null {
    if (!isApiError(error)) return null;
    const reason = (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason;
    return typeof reason === 'string' &&
        (KNOWN_REFUND_DECISION_REASONS as readonly string[]).includes(reason)
        ? (reason as KnownRefundDecisionReason)
        : null;
}

/**
 * Maps an action 13 error to the translated message to show.
 *
 * @param input - The thrown error.
 * @returns The message key: its reason, a server-error message, or the generic one.
 */
export function refundDecisionErrorKey({ error }: { readonly error: unknown }): TranslationKey {
    const reason = readRefundDecisionReason({ error });
    if (reason) return REFUND_DECISION_REASON_KEYS[reason];
    return isApiError(error) && error.status >= 500
        ? 'admin-billing.proposedRefunds.serverError'
        : 'admin-billing.proposedRefunds.genericError';
}
