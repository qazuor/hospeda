import { type Clock, CoverageArgsSchema } from '@repo/billing-verticals-contract';
import { TrialStatusEnum, type Vertical } from '@repo/schemas';
import { computeRecoveryMilestones, TRIAL_DEADLINES_VERSION } from './trial-deadlines';
import type {
    TrialAfterCommit,
    TrialExpiryScanner,
    TrialMachineUnitOfWork,
    TrialPostCommitNotices
} from './trial-machine-types';
import { InvalidTrialMachineInputError } from './trial-machine-types';
import { runAfterCommit } from './trial-post-commit';

/** T3 outcome and independent post-commit notice results. */
export type TrialExpiryResult =
    | { readonly expired: true; readonly notices: TrialPostCommitNotices }
    | { readonly expired: false; readonly reason: 'NO_TRIAL_ROW' | 'NOT_ACTIVE' | 'NOT_DUE' };

/** Expires a due trial after rereading its end date inside the machine lock. */
export async function expireTrial(args: {
    readonly unitOfWork: TrialMachineUnitOfWork;
    readonly clock: Clock;
    readonly afterCommit: TrialAfterCommit;
    readonly input: { readonly userId: string; readonly vertical: Vertical };
}): Promise<TrialExpiryResult> {
    const { userId, vertical } = args.input;
    if (!CoverageArgsSchema.safeParse({ userId, vertical }).success) {
        throw new InvalidTrialMachineInputError({ field: 'userId' });
    }
    const decision = await args.unitOfWork.runLocked({ userId, vertical }, async (tx) => {
        const trial = await tx.findTrialForUpdate({ userId, vertical });
        if (trial === null) return { expired: false, reason: 'NO_TRIAL_ROW' } as const;
        if (trial.status !== TrialStatusEnum.TRIAL_ACTIVE) {
            return { expired: false, reason: 'NOT_ACTIVE' } as const;
        }
        const now = args.clock.now();
        if (trial.endsAt === null || trial.endsAt > now) {
            return { expired: false, reason: 'NOT_DUE' } as const;
        }
        await tx.markExpired({ trialId: trial.id, deadlinesVersion: TRIAL_DEADLINES_VERSION });
        await tx.scheduleRecoveryCampaign({
            userId,
            vertical,
            expiredAt: trial.endsAt,
            deadlinesVersion: TRIAL_DEADLINES_VERSION,
            milestones: computeRecoveryMilestones({ expiredAt: trial.endsAt })
        });
        return { expired: true } as const;
    });
    if (!decision.expired) return decision;
    const notices = await runAfterCommit({
        afterCommit: args.afterCommit,
        userId,
        vertical,
        change: 'REMOVED'
    });
    return { expired: true, notices };
}

/** Processes one unlocked due-trial batch, isolating row failures. */
export async function expireDueTrials(args: {
    readonly scanner: TrialExpiryScanner;
    readonly unitOfWork: TrialMachineUnitOfWork;
    readonly clock: Clock;
    readonly afterCommit: TrialAfterCommit;
    readonly batchSize: number;
}): Promise<{ readonly expired: number; readonly skipped: number; readonly failed: number }> {
    if (!Number.isInteger(args.batchSize) || args.batchSize < 1) {
        throw new InvalidTrialMachineInputError({ field: 'batchSize' });
    }
    const due = await args.scanner.findDueTrials({ now: args.clock.now(), limit: args.batchSize });
    let expired = 0;
    let skipped = 0;
    let failed = 0;
    for (const input of due) {
        try {
            const result = await expireTrial({
                unitOfWork: args.unitOfWork,
                clock: args.clock,
                afterCommit: args.afterCommit,
                input
            });
            if (result.expired) expired++;
            else skipped++;
        } catch {
            failed++;
        }
    }
    return { expired, skipped, failed };
}
