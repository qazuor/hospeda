/**
 * @file lift-reasons.ts
 * Closed client mirror of the refusals for administrative action 7 (S15).
 *
 * @module lift-reasons
 */

import type { TranslationKey } from '@repo/i18n';
import { isApiError } from '@/lib/errors';

/** Reasons documented for action 7 in `apps/api/docs/error-contract.md`. */
export const KNOWN_LIFT_REASONS = [
    'MARK_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'MARK_ALREADY_LIFTED',
    'MARK_VERSION_CONFLICT',
    'MARK_HAS_UNRESOLVED_PAYMENTS',
    'MARK_PAYMENT_NOT_HUNG'
] as const;

/** A refusal reason the lift panel has translated copy for. */
export type KnownLiftReason = (typeof KNOWN_LIFT_REASONS)[number];

/** Translation key for each known refusal reason. */
export const LIFT_REASON_KEYS: Readonly<Record<KnownLiftReason, TranslationKey>> = {
    MARK_NOT_FOUND: 'admin-billing.reconciliationMarks.lift.reasons.MARK_NOT_FOUND',
    ADMINISTRATIVE_ACTION_FORBIDDEN:
        'admin-billing.reconciliationMarks.lift.reasons.ADMINISTRATIVE_ACTION_FORBIDDEN',
    MARK_ALREADY_LIFTED: 'admin-billing.reconciliationMarks.lift.reasons.MARK_ALREADY_LIFTED',
    MARK_VERSION_CONFLICT: 'admin-billing.reconciliationMarks.lift.reasons.MARK_VERSION_CONFLICT',
    MARK_HAS_UNRESOLVED_PAYMENTS:
        'admin-billing.reconciliationMarks.lift.reasons.MARK_HAS_UNRESOLVED_PAYMENTS',
    MARK_PAYMENT_NOT_HUNG: 'admin-billing.reconciliationMarks.lift.reasons.MARK_PAYMENT_NOT_HUNG'
};

/**
 * Reads a known action 7 refusal from an API error.
 *
 * @param input - The thrown error.
 * @returns The known reason, or `null` for unknown and non-API errors.
 */
export function readLiftReason({ error }: { readonly error: unknown }): KnownLiftReason | null {
    if (!isApiError(error)) return null;
    const reason = (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason;
    return typeof reason === 'string' && (KNOWN_LIFT_REASONS as readonly string[]).includes(reason)
        ? (reason as KnownLiftReason)
        : null;
}
