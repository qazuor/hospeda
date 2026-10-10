/**
 * The T1 transition: PRE_TRIAL → TRIAL_ACTIVE.
 *
 * Two exports that the rest of the system uses:
 * - `evaluateTrialStart` — read-only, used by PB1 to decide whether to proceed.
 * - `startTrial` — takes the lock, writes the row, schedules the campaign,
 *   and emits the post-commit coverage notice.
 *
 * This file never imports `@repo/db`, `drizzle-orm`, `pg`, `@repo/payments`,
 * nor anything from `bootstrap-billing-answers` (G13 / G14 guards).
 */

import type {
    BillingForVerticals,
    Clock,
    CoverageChangedEvent
} from '@repo/billing-verticals-contract';
import { CoverageArgsSchema } from '@repo/billing-verticals-contract';
import { TRIAL_PLAN_ROLE, TrialStatusEnum, VERTICAL_ACTIVATION_EVENT_VALUES } from '@repo/schemas';
import { CatalogVersionNotFoundError } from '../plan-catalog/errors';
import { computePreExpiryMilestones, TRIAL_DEADLINES_VERSION } from './trial-deadlines';
import {
    type InsertTrialResult,
    InvalidTrialStartInputError,
    type NewTrialRow,
    type PlanVersionSummaryRow,
    type StartTrialResult,
    type TrialStartDecision,
    type TrialStartDeniedReason,
    type TrialStartInput,
    type TrialStartReader,
    type TrialStartTransaction,
    type TrialStartUnitOfWork
} from './trial-start-types';

/** Re-export types from the types file for barrel exports. */
export type {
    InsertTrialResult,
    NewTrialRow,
    PlanVersionSummaryRow,
    StartTrialResult,
    TrialStartDecision,
    TrialStartDeniedReason,
    TrialStartInput,
    TrialStartReader,
    TrialStartTransaction,
    TrialStartUnitOfWork
};
/** Re-export for consumers. */
export { InvalidTrialStartInputError };

/* ------------------------------------------------------------------ */
/* Input validation (internal, no-export)                              */
/* ------------------------------------------------------------------ */

/**
 * Validates the four fields of a T1 input.
 *
 * Throws `InvalidTrialStartInputError` on the first failure.
 * The error message never includes the offending value.
 */
function assertValidInput(input: TrialStartInput): void {
    // userId
    if (CoverageArgsSchema.safeParse({ userId: input.userId, vertical: input.vertical }).error) {
        throw new InvalidTrialStartInputError({
            field: 'userId',
            message: 'userId is invalid'
        });
    }

    // vertical is already validated inside CoverageArgsSchema (same call)

    // event
    if (!VERTICAL_ACTIVATION_EVENT_VALUES.includes(input.event)) {
        throw new InvalidTrialStartInputError({
            field: 'event',
            message: 'event is not a declared activation event'
        });
    }

    // emailPseudonym: 64 lowercase hex characters (SHA-256 digest)
    if (!/^[0-9a-f]{64}$/.test(input.emailPseudonym)) {
        throw new InvalidTrialStartInputError({
            field: 'emailPseudonym',
            message: 'emailPseudonym must be a 64-character hex string'
        });
    }
}

/* ------------------------------------------------------------------ */
/* evaluateTrialStart — read-only (PB1 consumes)                       */
/* ------------------------------------------------------------------ */

/**
 * Evaluates whether T1 may fire for this input.
 *
 * Does NOT write anything and does NOT take a lock.
 * Returns the plan references if yes, or the first failing reason.
 *
 * Guards are evaluated in this exact order (first failing guard wins):
 * 1. vertical declares the activation event matching `input.event`
 * 2. trial plan exists and has days > 0
 * 3. `billing.coverage` says the user is NOT covered
 * 4. at least one sellable current version exists
 * 5. the user has no trial row in this vertical
 * 6. no other trial row shares the same pseudonym
 */
export async function evaluateTrialStart(args: {
    reader: TrialStartReader;
    billing: Pick<BillingForVerticals, 'coverage'>;
    input: TrialStartInput;
}): Promise<TrialStartDecision> {
    const { reader, billing, input } = args;

    // 1. Activation event
    const declaredEvent = await reader.findActivationEvent({
        vertical: input.vertical
    });
    if (declaredEvent === null || declaredEvent !== input.event) {
        return { starts: false, reason: 'EVENT_NOT_DECLARED_BY_VERTICAL' };
    }

    // 2. Trial plan
    const trialPlan = await reader.findTrialPlan({ vertical: input.vertical });
    if (trialPlan === null) {
        throw new CatalogVersionNotFoundError({
            kind: 'plan_version',
            id: `${input.vertical}:${TRIAL_PLAN_ROLE}`
        });
    }
    if (trialPlan.trialDays <= 0) {
        return { starts: false, reason: 'TRIAL_DAYS_NOT_POSITIVE' };
    }

    // 3. Not covered
    const coverage = await billing.coverage({
        userId: input.userId,
        vertical: input.vertical
    });
    if (coverage.covered) {
        return { starts: false, reason: 'ALREADY_COVERED' };
    }

    // 4. At least one sellable current version
    const sellableVersions = await reader.findSellableCurrentVersions({
        vertical: input.vertical
    });
    if (sellableVersions.length === 0) {
        return { starts: false, reason: 'NO_SELLABLE_CURRENT_VERSION' };
    }

    // 5. No trial row for this user
    const userTrial = await reader.findTrialOfUser({
        userId: input.userId,
        vertical: input.vertical
    });
    if (userTrial !== null) {
        return { starts: false, reason: 'USER_ALREADY_HAS_TRIAL_ROW' };
    }

    // 6. No trial row shares the pseudonym
    const pseudoTrial = await reader.findTrialByPseudonym({
        emailPseudonym: input.emailPseudonym,
        vertical: input.vertical
    });
    if (pseudoTrial !== null) {
        return { starts: false, reason: 'EMAIL_PSEUDONYM_ALREADY_USED' };
    }

    // All guards passed — derive the floor references.
    // entitlements = last (highest-rank) version
    // limits     = first  (lowest-rank)  version
    // biome-ignore lint/style/noNonNullAssertion: filtered to non-empty
    const firstVersion = sellableVersions[0]!;
    // biome-ignore lint/style/noNonNullAssertion: filtered to non-empty
    const lastVersion = sellableVersions[sellableVersions.length - 1]!;
    const entitlementsVersionId = lastVersion.id;
    const limitsVersionId = firstVersion.id;

    return {
        starts: true,
        plan: {
            trialPlanId: trialPlan.planId,
            trialPlanVersionId: trialPlan.planVersionId,
            entitlementsVersionId,
            limitsVersionId,
            trialDays: trialPlan.trialDays
        }
    };
}

/* ------------------------------------------------------------------ */
/* startTrial — with lock, write, campaign, post-commit notice         */
/* ------------------------------------------------------------------ */

/**
 * Runs the full T1 transition:
 * 1. Validates input
 * 2. Takes the lock (`user + vertical`) and evaluates inside it
 * 3. Inserts the trial row
 * 4. Schedules the pre-expiry campaign
 * 5. Commits (runLocked resolves)
 * 6. Emits the coverage-changed notice AFTER commit
 *
 * The coverage notice is emitted only on success, only after the commit,
 * and even if it fails the trial row stays (reconciler covers).
 */
export async function startTrial(args: {
    unitOfWork: TrialStartUnitOfWork;
    billing: Pick<BillingForVerticals, 'coverage'>;
    clock: Clock;
    emitCoverageChanged: (event: CoverageChangedEvent) => Promise<void>;
    input: TrialStartInput;
}): Promise<StartTrialResult> {
    const { unitOfWork, billing, clock, emitCoverageChanged, input } = args;

    // Validate input
    assertValidInput(input);

    // Run inside lock
    const decision = await unitOfWork.runLocked(
        { userId: input.userId, vertical: input.vertical },
        async (tx: TrialStartTransaction) => {
            // Re-evaluate inside lock (don't trust pre-lock reads)
            const outcome = await evaluateTrialStart({
                reader: tx,
                billing,
                input
            });

            if (!outcome.starts) {
                return { started: false, reason: outcome.reason } as const;
            }

            // Clock
            const startedAt = clock.now();
            const endsAt = new Date(startedAt.getTime() + outcome.plan.trialDays * 86_400_000);

            // Build the row
            const row: NewTrialRow = {
                userId: input.userId,
                vertical: input.vertical,
                status: TrialStatusEnum.TRIAL_ACTIVE,
                trialPlanId: outcome.plan.trialPlanId,
                floorEntitlementsVersionId: outcome.plan.entitlementsVersionId,
                floorLimitsVersionId: outcome.plan.limitsVersionId,
                floorTrialPlanVersionId: outcome.plan.trialPlanVersionId,
                startedAt,
                endsAt,
                emailPseudonym: input.emailPseudonym,
                deadlinesVersion: TRIAL_DEADLINES_VERSION
            };

            // Insert
            const insertResult = await tx.insertTrial({ row });

            if (!insertResult.inserted) {
                // Map conflict to reason
                const reason: TrialStartDeniedReason =
                    insertResult.conflict === 'EMAIL_PSEUDONYM'
                        ? 'EMAIL_PSEUDONYM_ALREADY_USED'
                        : 'USER_ALREADY_HAS_TRIAL_ROW';
                return { started: false, reason } as const;
            }

            // Schedule pre-expiry campaign
            const milestones = computePreExpiryMilestones({ endsAt });
            await tx.scheduleExpiryCampaign({
                userId: input.userId,
                vertical: input.vertical,
                endsAt,
                deadlinesVersion: TRIAL_DEADLINES_VERSION,
                milestones
            });

            return { started: true, row } as const;
        }
    );

    // If denied, return without emitting
    if (!decision.started) {
        return { started: false, reason: decision.reason };
    }

    // At this point, `decision` has `row`
    const trialRow = decision.row;

    // Post-commit: emit the coverage-changed notice
    let coverageNotice: 'EMITTED' | 'FAILED';
    try {
        await emitCoverageChanged({
            userId: input.userId,
            vertical: input.vertical,
            sourceType: 'TRIAL',
            change: 'CHANGED'
        });
        coverageNotice = 'EMITTED';
    } catch {
        coverageNotice = 'FAILED';
    }

    return { started: true, trial: trialRow, coverageNotice };
}
