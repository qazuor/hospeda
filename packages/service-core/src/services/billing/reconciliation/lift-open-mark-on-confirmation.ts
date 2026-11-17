import {
    type DrizzleClient,
    type ReconciliationMarkReason,
    reconciliationMarkModel,
    SYSTEM_USER_ID
} from '@repo/db';
import { ServiceError } from '../../../types';
import { liftReconciliationMark } from './lift-reconciliation-mark.service.js';

/** Outcome of trying to lift the open mark of one reason after a transition is confirmed. */
export type LiftOpenMarkOnConfirmationOutcome = 'LIFTED' | 'NONE' | 'SKIPPED_UNRESOLVED_PAYMENTS';

/** Input for an in-transaction lift of the open mark of one subscription reason. */
export interface LiftOpenMarkOnConfirmationInput {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly reason: ReconciliationMarkReason;
    readonly now: Date;
}

/** S15 lift reasons this helper turns into a non-error outcome. */
const BENIGN_LIFT_REASONS = new Set([
    'MARK_NOT_FOUND',
    'MARK_ALREADY_LIFTED',
    'MARK_VERSION_CONFLICT'
]);

/**
 * Lifts the open reconciliation mark of one subscription and reason inside the caller's transaction.
 *
 * The lift goes through S15 as the system actor, at the version read in the same transaction, and
 * only when no unresolved payment is still attached to it (the S15 rule keeps a mark with hung
 * payments open). A missing mark, a version conflict or a concurrent lift are not errors: the
 * transition that confirms the subject still stands, so those outcomes are reported as `NONE`.
 *
 * @param input Open transaction, subscription, reason and confirmation instant.
 * @returns `LIFTED` when this call lifted the mark, `SKIPPED_UNRESOLVED_PAYMENTS` when the S15
 * guard kept it open, `NONE` when there was nothing to lift or it was already lifted.
 */
export async function liftOpenMarkOnConfirmation(
    input: LiftOpenMarkOnConfirmationInput
): Promise<{ readonly outcome: LiftOpenMarkOnConfirmationOutcome }> {
    const mark = await reconciliationMarkModel.findOpen({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
        reason: input.reason,
        tx: input.tx
    });
    if (!mark) return { outcome: 'NONE' };
    try {
        await liftReconciliationMark(
            {
                markId: mark.id,
                expectedVersion: mark.version,
                liftedBy: SYSTEM_USER_ID,
                tx: input.tx
            },
            { clock: { now: () => input.now } }
        );
        return { outcome: 'LIFTED' };
    } catch (error) {
        if (!(error instanceof ServiceError) || !error.reason) throw error;
        if (error.reason === 'MARK_HAS_UNRESOLVED_PAYMENTS')
            return { outcome: 'SKIPPED_UNRESOLVED_PAYMENTS' };
        if (BENIGN_LIFT_REASONS.has(error.reason)) return { outcome: 'NONE' };
        throw error;
    }
}
