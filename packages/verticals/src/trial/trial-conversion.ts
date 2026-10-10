import {
    type BillingForVerticals,
    CoverageArgsSchema,
    type CoverageChangedEvent,
    type CoverageResponse,
    type CoverageSource,
    coverageSourceClassOf
} from '@repo/billing-verticals-contract';
import { TrialStatusEnum } from '@repo/schemas';
import type {
    TrialAfterCommit,
    TrialMachineUnitOfWork,
    TrialPostCommitNotices
} from './trial-machine-types';
import { InvalidTrialMachineInputError } from './trial-machine-types';
import { runAfterCommit } from './trial-post-commit';

/** Returns the first non-trial title that consumes an existing trial. */
export function findConvertingTitle(args: { readonly coverage: CoverageResponse }): {
    readonly source: CoverageSource | null;
} {
    return {
        source:
            args.coverage.sources.find(
                (source) =>
                    coverageSourceClassOf({ source }).sourceClass === 'TITLE' &&
                    source.type !== 'TRIAL' &&
                    (source.type !== 'SUBSCRIPTION' || source.charged === true)
            ) ?? null
    };
}

/** T2/T5 outcome and independent post-commit notice results. */
export type TrialConversionResult =
    | {
          readonly converted: true;
          readonly transition: 'T2' | 'T5';
          readonly notices: TrialPostCommitNotices;
      }
    | {
          readonly converted: false;
          readonly reason: 'NO_TRIAL_ROW' | 'ALREADY_CONVERTED' | 'NO_CONVERTING_TITLE';
      };

/** Converts an active or expired trial when coverage has a converting title. */
export async function convertTrialOnTitle(args: {
    readonly unitOfWork: TrialMachineUnitOfWork;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly afterCommit: TrialAfterCommit;
    readonly event: CoverageChangedEvent;
}): Promise<TrialConversionResult> {
    const { userId, vertical } = args.event;
    if (!CoverageArgsSchema.safeParse({ userId, vertical }).success) {
        throw new InvalidTrialMachineInputError({ field: 'userId' });
    }
    const decision = await args.unitOfWork.runLocked({ userId, vertical }, async (tx) => {
        const trial = await tx.findTrialForUpdate({ userId, vertical });
        if (trial === null) return { converted: false, reason: 'NO_TRIAL_ROW' } as const;
        if (trial.status === TrialStatusEnum.TRIAL_CONVERTED) {
            return { converted: false, reason: 'ALREADY_CONVERTED' } as const;
        }
        const coverage = await args.billing.coverage({ userId, vertical });
        if (findConvertingTitle({ coverage }).source === null) {
            return { converted: false, reason: 'NO_CONVERTING_TITLE' } as const;
        }
        const active = trial.status === TrialStatusEnum.TRIAL_ACTIVE;
        await tx.markConverted({ trialId: trial.id });
        await tx.cancelCampaign({
            userId,
            vertical,
            campaign: active ? 'PRE_EXPIRY' : 'RECOVERY'
        });
        return { converted: true, transition: active ? 'T2' : 'T5' } as const;
    });
    if (!decision.converted) return decision;
    const notices = await runAfterCommit({
        afterCommit: args.afterCommit,
        userId,
        vertical,
        change: decision.transition === 'T2' ? 'REMOVED' : 'CHANGED'
    });
    return { ...decision, notices };
}
