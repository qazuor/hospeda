import {
    type BillingForVerticals,
    CoverageArgsSchema,
    type CoverageChangedEvent
} from '@repo/billing-verticals-contract';
import { consumeTrialInTransaction, type TrialConsumeDeniedReason } from './trial-consume';
import { findConvertingTitle } from './trial-conversion';
import type {
    TrialAfterCommit,
    TrialMachineUnitOfWork,
    TrialPostCommitNotices
} from './trial-machine-types';
import { InvalidTrialMachineInputError } from './trial-machine-types';
import { runAfterCommit } from './trial-post-commit';

/** T8 outcome when the first accredited payment consumes a trial. */
export type TrialFirstPaymentResult =
    | {
          readonly consumed: true;
          readonly transition: 'T8';
          readonly notices: TrialPostCommitNotices;
      }
    | {
          readonly consumed: false;
          readonly reason:
              | 'TRIAL_ROW_EXISTS'
              | 'ACTIVATION_EVENT_NOT_EXERCISED'
              | TrialConsumeDeniedReason;
      };

/** Consumes the one-time trial row after a first payment for an exercised activation event. */
export async function consumeTrialOnFirstPayment(args: {
    readonly unitOfWork: TrialMachineUnitOfWork;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly afterCommit: TrialAfterCommit;
    readonly event: CoverageChangedEvent;
    readonly emailPseudonym: string;
}): Promise<TrialFirstPaymentResult> {
    const { userId, vertical } = args.event;
    if (!CoverageArgsSchema.safeParse({ userId, vertical }).success) {
        throw new InvalidTrialMachineInputError({ field: 'userId' });
    }
    if (!/^[0-9a-f]{64}$/.test(args.emailPseudonym)) {
        throw new InvalidTrialMachineInputError({ field: 'emailPseudonym' });
    }
    const decision = await args.unitOfWork.runLocked({ userId, vertical }, async (tx) => {
        const trial = await tx.findTrialForUpdate({ userId, vertical });
        if (trial !== null) return { consumed: false, reason: 'TRIAL_ROW_EXISTS' } as const;
        const coverage = await args.billing.coverage({ userId, vertical });
        if (findConvertingTitle({ coverage }).source === null) {
            return { consumed: false, reason: 'NO_CONVERTING_TITLE' } as const;
        }
        if (!(await tx.hasExercisedActivationEvent({ userId, vertical }))) {
            return { consumed: false, reason: 'ACTIVATION_EVENT_NOT_EXERCISED' } as const;
        }
        return consumeTrialInTransaction({
            tx,
            coverage,
            input: { userId, vertical, emailPseudonym: args.emailPseudonym, expectedEvent: null }
        });
    });
    if (!decision.consumed) return decision;
    const notices = await runAfterCommit({
        afterCommit: args.afterCommit,
        userId,
        vertical,
        change: 'REMOVED'
    });
    return { consumed: true, transition: 'T8', notices };
}
