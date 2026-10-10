import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import type { TrialStatusEnum, Vertical } from '@repo/schemas';
import type { TrialStartTransaction } from './trial-start-types';

/** Persisted fields needed by the trial machine. */
export interface TrialMachineRow {
    readonly id: string;
    readonly userId: string;
    readonly vertical: Vertical;
    readonly status: TrialStatusEnum;
    readonly startedAt: Date | null;
    readonly endsAt: Date | null;
    readonly deadlinesVersion: number | null;
}

/** Campaigns maintained by trial transitions. */
export type TrialCampaignKind = 'PRE_EXPIRY' | 'RECOVERY';

/** Transactional trial machine operations under the shared lock. */
export interface TrialMachineTransaction
    extends Pick<TrialStartTransaction, 'scheduleExpiryCampaign'> {
    findTrialForUpdate(args: {
        readonly userId: string;
        readonly vertical: Vertical;
    }): Promise<TrialMachineRow | null>;
    markConverted(args: { readonly trialId: string }): Promise<void>;
    markExpired(args: {
        readonly trialId: string;
        readonly deadlinesVersion: number;
    }): Promise<void>;
    moveEndsAt(args: { readonly trialId: string; readonly endsAt: Date }): Promise<void>;
    scheduleRecoveryCampaign(args: {
        readonly userId: string;
        readonly vertical: Vertical;
        readonly expiredAt: Date;
        readonly deadlinesVersion: number;
        readonly milestones: readonly Date[];
    }): Promise<void>;
    cancelCampaign(args: {
        readonly userId: string;
        readonly vertical: Vertical;
        readonly campaign: TrialCampaignKind;
    }): Promise<void>;
    findRedemption(args: {
        readonly redemptionKey: string;
    }): Promise<{ readonly userId: string; readonly vertical: Vertical } | null>;
    insertRedemption(args: {
        readonly userId: string;
        readonly vertical: Vertical;
        readonly redemptionKey: string;
        readonly appliedDays: number;
        readonly appliedAt: Date;
    }): Promise<{ readonly inserted: boolean }>;
    findTrialCeilingDays(args: {
        readonly vertical: Vertical;
        readonly deadlinesVersion: number;
    }): Promise<number>;
    recordAdminExtension(args: {
        readonly trialId: string;
        readonly userId: string;
        readonly vertical: Vertical;
        readonly actorId: string;
        readonly reason: string;
        readonly days: number;
        readonly previousEndsAt: Date;
        readonly endsAt: Date;
        readonly occurredAt: Date;
    }): Promise<void>;
}

/**
 * Opens a transaction, takes the lock from `trialMachineLockKey` for this
 * `user + vertical`, runs `work`, commits before resolving, and returns.
 * If `work` throws, the transaction rolls back and rethrows the error.
 */
export interface TrialMachineUnitOfWork {
    runLocked<T>(
        args: { readonly userId: string; readonly vertical: Vertical },
        work: (tx: TrialMachineTransaction) => Promise<T>
    ): Promise<T>;
}

/** Unlocked scan of active trials with `ends_at <= now`. */
export interface TrialExpiryScanner {
    findDueTrials(args: {
        readonly now: Date;
        readonly limit: number;
    }): Promise<readonly { readonly userId: string; readonly vertical: Vertical }[]>;
}

/** Post-commit side effects for a successful trial transition. */
export interface TrialAfterCommit {
    emitCoverageChanged(event: CoverageChangedEvent): Promise<void>;
    invalidateUser(args: { readonly userId: string }): Promise<void>;
}

/** Independent outcomes of the two post-commit side effects. */
export interface TrialPostCommitNotices {
    readonly coverageNotice: 'EMITTED' | 'FAILED';
    readonly cacheInvalidation: 'DONE' | 'FAILED';
}

/** Validation failure without echoing the rejected input. */
export class InvalidTrialMachineInputError extends Error {
    readonly field:
        | 'userId'
        | 'vertical'
        | 'days'
        | 'reason'
        | 'actorId'
        | 'redemptionKey'
        | 'batchSize';

    constructor(args: { readonly field: InvalidTrialMachineInputError['field'] }) {
        super(`${args.field} is invalid`);
        this.name = 'InvalidTrialMachineInputError';
        this.field = args.field;
    }
}
