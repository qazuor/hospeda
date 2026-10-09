/**
 * Type definitions for the trial-start transition (T1, AC:V4:4 and AC:V4:5).
 *
 * Split from `trial-start.ts` so the business logic file stays under 400
 * lines while keeping every type public for consumers like PB1.
 */
import type { TrialStatusEnum, Vertical, VerticalActivationEvent } from '@repo/schemas';
import type { PlanVersionSummaryRow as _PVS } from '../plan-catalog/catalog-reader';

type PlanVersionSummaryRow = _PVS;

export type { PlanVersionSummaryRow };

/* ------------------------------------------------------------------ */
/* Input                                                              */
/* ------------------------------------------------------------------ */

/**
 * The input the T1 transition receives. The pseudonym is already computed
 * by the caller (V6.1 / V8a) — this package never sees a raw mailbox.
 */
export interface TrialStartInput {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly event: VerticalActivationEvent;
    readonly emailPseudonym: string;
}

/**
 * Every reason the start attempt was denied, and only those.
 *
 * Ordered by the guard chain in `evaluateTrialStart`; the first failing
 * guard wins and the rest are never evaluated.
 */
export type TrialStartDeniedReason =
    | 'EVENT_NOT_DECLARED_BY_VERTICAL'
    | 'TRIAL_DAYS_NOT_POSITIVE'
    | 'ALREADY_COVERED'
    | 'NO_SELLABLE_CURRENT_VERSION'
    | 'USER_ALREADY_HAS_TRIAL_ROW'
    | 'EMAIL_PSEUDONYM_ALREADY_USED';

/* ------------------------------------------------------------------ */
/* Reader port (read-only; consumed by PB1 without lock)              */
/* ------------------------------------------------------------------ */

/**
 * Read-only port that `evaluateTrialStart` uses (and `PB1` consumes via
 * the same interface) to check the preconditions of T1.
 */
export interface TrialStartReader {
    /**
     * The activation event the vertical declares, or `null` when none.
     */
    findActivationEvent(args: {
        readonly vertical: Vertical;
    }): Promise<VerticalActivationEvent | null>;

    /**
     * The trial plan of the vertical: its id and version, and how many days
     * the trial grants. Returns `null` only when the catalog has no trial
     * plan at all (a catalog corruption scenario).
     */
    findTrialPlan(args: { readonly vertical: Vertical }): Promise<{
        readonly planId: string;
        readonly planVersionId: string;
        readonly trialDays: number;
    } | null>;

    /**
     * Every sellable and current version of a vertical, ordered by rank
     * (ascending). The trial-start uses `versions[0]` for limits and
     * `versions[versions.length - 1]` for entitlements (V/10 §2).
     */
    findSellableCurrentVersions(args: {
        readonly vertical: Vertical;
    }): Promise<readonly PlanVersionSummaryRow[]>;

    /**
     * A trial row for this user in this vertical, or `null` when none.
     * The returned shape needs only an `id` to prove existence.
     */
    findTrialOfUser(args: {
        readonly userId: string;
        readonly vertical: Vertical;
    }): Promise<{ readonly id: string } | null>;

    /**
     * A trial row sharing the same email pseudonym and vertical, or `null`.
     * Carries the owning `userId` so the caller can tell "my own" from
     * "someone else's" (the UNIQUE violation source).
     */
    findTrialByPseudonym(args: {
        readonly emailPseudonym: string;
        readonly vertical: Vertical;
    }): Promise<{ readonly userId: string } | null>;
}

/* ------------------------------------------------------------------ */
/* New trial row (the row `insertTrial` writes)                       */
/* ------------------------------------------------------------------ */

/**
 * A fully-formed trial row, ready to be inserted.
 *
 * The floor references are REFERENCES to plan-version ids (DEC-TRIAL-002),
 * never copies of values.
 */
export interface NewTrialRow {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly status: TrialStatusEnum.TRIAL_ACTIVE;
    readonly trialPlanId: string;
    readonly floorEntitlementsVersionId: string;
    readonly floorLimitsVersionId: string;
    readonly floorTrialPlanVersionId: string;
    readonly startedAt: Date;
    readonly endsAt: Date;
    readonly emailPseudonym: string;
    readonly deadlinesVersion: number;
}

/* ------------------------------------------------------------------ */
/* Write port (inside the lock)                                       */
/* ------------------------------------------------------------------ */

/**
 * Result of an insert attempt that uses `ON CONFLICT DO NOTHING`.
 *
 * The caller (startTrial) maps the conflict back to a `TrialStartDeniedReason`.
 */
export type InsertTrialResult =
    | { readonly inserted: true }
    | { readonly inserted: false; readonly conflict: 'USER_VERTICAL' | 'EMAIL_PSEUDONYM' };

/**
 * Transactional port: read + write, confined to one database transaction.
 *
 * Extends the reader so `evaluateTrialStart` can re-read inside the lock
 * without a second I/O pass.
 */
export interface TrialStartTransaction extends TrialStartReader {
    /**
     * Inserts the trial row. Returns `false` when the UNIQUE constraint
     * fires (the row already exists in that range).
     */
    insertTrial(args: { row: NewTrialRow }): Promise<InsertTrialResult>;

    /**
     * Schedules the pre-expiry campaign for this trial. The campaign
     * consists of milestones (10, 5, 2, 0 days before expiry); the actual
     * enqueue (outbox) is V4.6 — this port is filled by the test double
     * in V4.2 and by the DB adapter in V4.3.
     */
    scheduleExpiryCampaign(args: {
        readonly userId: string;
        readonly vertical: Vertical;
        readonly endsAt: Date;
        readonly deadlinesVersion: number;
        readonly milestones: readonly Date[];
    }): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Unit-of-work port                                                  */
/* ------------------------------------------------------------------ */

/**
 * Opens a transaction, takes the advisory lock for this `user + vertical`,
 * runs `work` with read and write access within that transaction, commits
 * (resolving `work`'s promise), and only then returns.
 *
 * If `work` throws, the transaction is rolled back and the error is
 * re-thrown.
 *
 * This is the lock that INV:6 requires — the same lock PB1 uses for
 * listing publication.
 */
export interface TrialStartUnitOfWork {
    runLocked<T>(
        args: { readonly userId: string; readonly vertical: Vertical },
        work: (tx: TrialStartTransaction) => Promise<T>
    ): Promise<T>;
}

/* ------------------------------------------------------------------ */
/* Decision (read-only evaluation for PB1)                            */
/* ------------------------------------------------------------------ */

/**
 * The result of `evaluateTrialStart`: whether the transition is allowed
 * and, if so, the plan references that T1 would write.
 *
 * PB1 calls this without a lock to decide whether to proceed; the
 * actual `startTrial` re-evaluates inside the lock.
 */
export type TrialStartDecision =
    | {
          readonly starts: true;
          readonly plan: {
              readonly trialPlanId: string;
              readonly trialPlanVersionId: string;
              readonly entitlementsVersionId: string;
              readonly limitsVersionId: string;
              readonly trialDays: number;
          };
      }
    | {
          readonly starts: false;
          readonly reason: TrialStartDeniedReason;
      };

/* ------------------------------------------------------------------ */
/* Full start result (write + post-commit notice)                     */
/* ------------------------------------------------------------------ */

/**
 * The full result of `startTrial`: whether the trial row was written
 * and whether the post-commit coverage notice was emitted.
 *
 * `coverageNotice` is `FAILED` only when the trial was written but the
 * notice failed — the trial row stays (the reconciler covers).
 */
export type StartTrialResult =
    | {
          readonly started: true;
          readonly trial: NewTrialRow;
          readonly coverageNotice: 'EMITTED' | 'FAILED';
      }
    | {
          readonly started: false;
          readonly reason: TrialStartDeniedReason;
      };

/**
 * An input validation error: one of the four fields failed.
 *
 * The message never includes the offending value to avoid leaking mailboxes.
 */
export class InvalidTrialStartInputError extends Error {
    readonly field: 'userId' | 'vertical' | 'event' | 'emailPseudonym';

    constructor(args: {
        readonly field: 'userId' | 'vertical' | 'event' | 'emailPseudonym';
        readonly message: string;
    }) {
        super(args.message);
        this.name = 'InvalidTrialStartInputError';
        this.field = args.field;
    }
}
