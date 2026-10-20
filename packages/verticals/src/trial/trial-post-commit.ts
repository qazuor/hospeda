import type { CoverageChange } from '@repo/billing-verticals-contract';
import type { Vertical } from '@repo/schemas';
import type { TrialAfterCommit, TrialPostCommitNotices } from './trial-machine-types';

/** Runs independent post-commit effects; failures never undo the transition. */
export async function runAfterCommit(args: {
    readonly afterCommit: TrialAfterCommit;
    readonly userId: string;
    readonly vertical: Vertical;
    readonly change: CoverageChange;
}): Promise<TrialPostCommitNotices> {
    let cacheInvalidation: TrialPostCommitNotices['cacheInvalidation'] = 'DONE';
    let coverageNotice: TrialPostCommitNotices['coverageNotice'] = 'EMITTED';
    try {
        await args.afterCommit.invalidateUser({ userId: args.userId });
    } catch {
        cacheInvalidation = 'FAILED';
    }
    try {
        await args.afterCommit.emitCoverageChanged({
            userId: args.userId,
            vertical: args.vertical,
            sourceType: 'TRIAL',
            change: args.change
        });
    } catch {
        coverageNotice = 'FAILED';
    }
    return { coverageNotice, cacheInvalidation };
}
