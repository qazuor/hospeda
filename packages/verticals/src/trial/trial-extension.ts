import {
    type Clock,
    CoverageArgsSchema,
    ExtendTrialArgsSchema,
    ExtendTrialResponseSchema,
    UserIdSchema,
    type VerticalsForBilling
} from '@repo/billing-verticals-contract';
import { TrialStatusEnum, type Vertical } from '@repo/schemas';
import { computePreExpiryMilestones, TRIAL_DEADLINES_VERSION } from './trial-deadlines';
import type {
    TrialAfterCommit,
    TrialMachineUnitOfWork,
    TrialPostCommitNotices
} from './trial-machine-types';
import { InvalidTrialMachineInputError } from './trial-machine-types';
import { runAfterCommit } from './trial-post-commit';

const DAY_MS = 86_400_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The first three reasons match SIMULATED_EXTEND_TRIAL_REJECTIONS. */
export const TRIAL_EXTENSION_REJECTIONS = {
    noTrial: 'NO_TRIAL',
    trialEnded: 'TRIAL_ENDED',
    ceilingReached: 'CEILING_REACHED',
    redemptionKeyConflict: 'REDEMPTION_KEY_CONFLICT'
} as const;

/** Creates the billing contract's redemption-backed T4 operation. */
export function createExtendTrial(args: {
    readonly unitOfWork: TrialMachineUnitOfWork;
    readonly clock: Clock;
    readonly afterCommit: TrialAfterCommit;
}): { readonly extendTrial: VerticalsForBilling['extendTrial'] } {
    const extendTrial: VerticalsForBilling['extendTrial'] = async (input) => {
        const parsed = ExtendTrialArgsSchema.safeParse(input);
        if (!parsed.success) {
            const field = parsed.error.issues[0]?.path[0];
            throw new InvalidTrialMachineInputError({
                field:
                    field === 'vertical' || field === 'days' || field === 'redemptionKey'
                        ? field
                        : 'userId'
            });
        }
        const { userId, vertical, days, redemptionKey } = parsed.data;
        if (!UUID_PATTERN.test(userId)) {
            throw new InvalidTrialMachineInputError({ field: 'userId' });
        }
        const decision = await args.unitOfWork.runLocked({ userId, vertical }, async (tx) => {
            const redemptionDecision = async () => {
                const existing = await tx.findRedemption({ redemptionKey });
                if (existing === null) return null;
                return existing.userId === userId && existing.vertical === vertical
                    ? ({ outcome: 'ACCEPTED', moved: false } as const)
                    : ({
                          outcome: 'REJECTED',
                          reason: TRIAL_EXTENSION_REJECTIONS.redemptionKeyConflict,
                          moved: false
                      } as const);
            };
            const prior = await redemptionDecision();
            if (prior !== null) return prior;
            const trial = await tx.findTrialForUpdate({ userId, vertical });
            if (trial === null) {
                return {
                    outcome: 'REJECTED',
                    reason: TRIAL_EXTENSION_REJECTIONS.noTrial,
                    moved: false
                } as const;
            }
            const now = args.clock.now();
            if (
                trial.status !== TrialStatusEnum.TRIAL_ACTIVE ||
                trial.endsAt === null ||
                trial.endsAt <= now
            ) {
                return {
                    outcome: 'REJECTED',
                    reason: TRIAL_EXTENSION_REJECTIONS.trialEnded,
                    moved: false
                } as const;
            }
            if (trial.startedAt === null) throw new Error('Active trial has no start date');
            const deadlinesVersion = trial.deadlinesVersion ?? TRIAL_DEADLINES_VERSION;
            const accumulatedDays = (trial.endsAt.getTime() - trial.startedAt.getTime()) / DAY_MS;
            const ceiling = await tx.findTrialCeilingDays({ vertical, deadlinesVersion });
            if (accumulatedDays + days > ceiling) {
                return {
                    outcome: 'REJECTED',
                    reason: TRIAL_EXTENSION_REJECTIONS.ceilingReached,
                    moved: false
                } as const;
            }
            const inserted = await tx.insertRedemption({
                userId,
                vertical,
                redemptionKey,
                appliedDays: days,
                appliedAt: now
            });
            if (!inserted.inserted) {
                const winner = await redemptionDecision();
                if (winner === null) throw new Error('Redemption conflict without a winner');
                return winner;
            }
            const endsAt = new Date(trial.endsAt.getTime() + days * DAY_MS);
            await tx.moveEndsAt({ trialId: trial.id, endsAt });
            await tx.scheduleExpiryCampaign({
                userId,
                vertical,
                endsAt,
                deadlinesVersion,
                milestones: computePreExpiryMilestones({ endsAt })
            });
            return { outcome: 'ACCEPTED', moved: true } as const;
        });
        if (decision.moved) {
            await runAfterCommit({
                afterCommit: args.afterCommit,
                userId,
                vertical,
                change: 'CHANGED'
            });
        }
        const response =
            decision.outcome === 'REJECTED'
                ? { outcome: decision.outcome, reason: decision.reason }
                : { outcome: decision.outcome };
        return ExtendTrialResponseSchema.parse(response);
    };
    return { extendTrial };
}

/** Outcome of the administrative T4 action. */
export type AdminTrialExtensionResult =
    | {
          readonly extended: true;
          readonly previousEndsAt: Date;
          readonly endsAt: Date;
          readonly totalDays: number;
          readonly notices: TrialPostCommitNotices;
      }
    | { readonly extended: false; readonly reason: 'NO_TRIAL' | 'TRIAL_ENDED' };

/** Extends a running trial as an audited administrator action beyond the ceiling. */
export async function extendTrialByAdmin(args: {
    readonly unitOfWork: TrialMachineUnitOfWork;
    readonly clock: Clock;
    readonly afterCommit: TrialAfterCommit;
    readonly input: {
        readonly userId: string;
        readonly vertical: Vertical;
        readonly days: number;
        readonly reason: string;
        readonly actorId: string;
    };
}): Promise<AdminTrialExtensionResult> {
    const { userId, vertical, days, reason, actorId } = args.input;
    const coverage = CoverageArgsSchema.safeParse({ userId, vertical });
    if (!coverage.success) {
        const field = coverage.error.issues[0]?.path[0];
        throw new InvalidTrialMachineInputError({
            field: field === 'vertical' ? 'vertical' : 'userId'
        });
    }
    if (!UUID_PATTERN.test(userId)) {
        throw new InvalidTrialMachineInputError({ field: 'userId' });
    }
    if (!UserIdSchema.safeParse(actorId).success || !UUID_PATTERN.test(actorId)) {
        throw new InvalidTrialMachineInputError({ field: 'actorId' });
    }
    if (!Number.isInteger(days) || days < 1) {
        throw new InvalidTrialMachineInputError({ field: 'days' });
    }
    if (typeof reason !== 'string' || reason.trim().length < 1) {
        throw new InvalidTrialMachineInputError({ field: 'reason' });
    }
    const decision = await args.unitOfWork.runLocked({ userId, vertical }, async (tx) => {
        const trial = await tx.findTrialForUpdate({ userId, vertical });
        if (trial === null) return { extended: false, reason: 'NO_TRIAL' } as const;
        const now = args.clock.now();
        if (
            trial.status !== TrialStatusEnum.TRIAL_ACTIVE ||
            trial.endsAt === null ||
            trial.endsAt <= now
        ) {
            return { extended: false, reason: 'TRIAL_ENDED' } as const;
        }
        if (trial.startedAt === null) throw new Error('Active trial has no start date');
        const previousEndsAt = trial.endsAt;
        const endsAt = new Date(previousEndsAt.getTime() + days * DAY_MS);
        await tx.moveEndsAt({ trialId: trial.id, endsAt });
        await tx.scheduleExpiryCampaign({
            userId,
            vertical,
            endsAt,
            deadlinesVersion: trial.deadlinesVersion ?? TRIAL_DEADLINES_VERSION,
            milestones: computePreExpiryMilestones({ endsAt })
        });
        await tx.recordAdminExtension({
            trialId: trial.id,
            userId,
            vertical,
            actorId,
            reason: reason.trim(),
            days,
            previousEndsAt,
            endsAt,
            occurredAt: now
        });
        return {
            extended: true,
            previousEndsAt,
            endsAt,
            totalDays: (endsAt.getTime() - trial.startedAt.getTime()) / DAY_MS
        } as const;
    });
    if (!decision.extended) return decision;
    const notices = await runAfterCommit({
        afterCommit: args.afterCommit,
        userId,
        vertical,
        change: 'CHANGED'
    });
    return { ...decision, notices };
}
