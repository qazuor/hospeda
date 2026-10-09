/**
 * In-memory implementation of `TrialStartReader` and `TrialStartUnitOfWork`
 * for unit tests.
 *
 * All state is held in local Maps/Arrays. `runLocked` serialises concurrent
 * calls per `userId:vertical` key so the test can observe the lock's effect
 * (exactly one success, no UNIQUE conflict from race conditions).
 *
 * The log records, in order:
 * - `'insert'` when `insertTrial` is called
 * - `'schedule'` when `scheduleExpiryCampaign` is called
 * - `'commit'` when the work function completes successfully
 * - `'rollback'` when the work function throws
 */

import type { Vertical, VerticalActivationEvent } from '@repo/schemas';
import type {
    PlanVersionSummaryRow,
    TrialStartReader,
    TrialStartTransaction,
    TrialStartUnitOfWork
} from '../../src/trial/trial-start-types';

/* ------------------------------------------------------------------ */
/* Stored state                                                        */
/* ------------------------------------------------------------------ */

interface StoredTrialRow {
    readonly id: string;
    readonly userId: string;
    readonly vertical: Vertical;
    readonly status: string;
    readonly trialPlanId: string;
    readonly floorEntitlementsVersionId: string;
    readonly floorLimitsVersionId: string;
    readonly floorTrialPlanVersionId: string;
    readonly startedAt: Date;
    readonly endsAt: Date;
    readonly emailPseudonym: string;
    readonly deadlinesVersion: number;
}

interface StoredCampaign {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly endsAt: Date;
    readonly deadlinesVersion: number;
    readonly milestones: readonly Date[];
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

/**
 * Creates an empty in-memory trial-start reader and unit-of-work, and
 * returns helpers to fill the state before each test case.
 */
export function createInMemoryTrialStart() {
    const activationEvents = new Map<Vertical, VerticalActivationEvent | null>();
    const trialPlans = new Map<
        Vertical,
        {
            readonly planId: string;
            readonly planVersionId: string;
            readonly trialDays: number;
        } | null
    >();
    const sellableVersions = new Map<Vertical, PlanVersionSummaryRow[]>();
    const trialRows = new Map<string, StoredTrialRow>();
    // key = `${userId}:${vertical}`
    const campaigns: StoredCampaign[] = [];
    const log: string[] = [];

    let nextId = 1;

    const reader: TrialStartReader = {
        async findActivationEvent({ vertical }) {
            return activationEvents.get(vertical) ?? null;
        },
        async findTrialPlan({ vertical }) {
            return trialPlans.get(vertical) ?? null;
        },
        async findSellableCurrentVersions({ vertical }) {
            return sellableVersions.get(vertical) ?? [];
        },
        async findTrialOfUser({ userId, vertical }) {
            const key = `${userId}:${vertical}`;
            const row = trialRows.get(key);
            return row ?? null;
        },
        async findTrialByPseudonym({ emailPseudonym, vertical }) {
            for (const row of trialRows.values()) {
                if (row.vertical === vertical && row.emailPseudonym === emailPseudonym) {
                    return { userId: row.userId };
                }
            }
            return null;
        }
    };

    const transaction: TrialStartTransaction = {
        ...reader,
        async insertTrial({ row }) {
            log.push('insert');
            const userKey = `${row.userId}:${row.vertical}`;

            // Check UNIQUE(user_id, vertical)
            if (trialRows.has(userKey)) {
                return { inserted: false, conflict: 'USER_VERTICAL' };
            }
            // Check UNIQUE(email_pseudonym, vertical)
            for (const existing of trialRows.values()) {
                if (
                    existing.vertical === row.vertical &&
                    existing.emailPseudonym === row.emailPseudonym
                ) {
                    return { inserted: false, conflict: 'EMAIL_PSEUDONYM' };
                }
            }

            // Insert
            trialRows.set(userKey, { ...row, id: String(nextId++) });
            return { inserted: true };
        },
        async scheduleExpiryCampaign({ userId, vertical, endsAt, deadlinesVersion, milestones }) {
            log.push('schedule');
            campaigns.push({
                userId,
                vertical,
                endsAt,
                deadlinesVersion,
                milestones
            });
        }
    };

    // Simple async mutex per lock key
    const mutexes = new Map<string, Promise<true>>();

    const unitOfWork: TrialStartUnitOfWork = {
        async runLocked(args, work) {
            const key = `${args.userId}:${args.vertical}`;

            // Acquire: wait for previous work on this key (if any)
            const prev = mutexes.get(key);
            if (prev) {
                await prev;
            }

            // Signal: when we finish, allow the next acquire to proceed
            let nextResolve: () => void;
            new Promise<void>((resolve) => {
                nextResolve = resolve;
            });
            mutexes.set(
                key,
                Promise.resolve(true).then(() => {
                    nextResolve?.();
                    return true;
                })
            );

            // Execute work
            try {
                const result = await work(transaction);
                log.push('commit');
                return result;
            } catch (err) {
                log.push('rollback');
                throw err;
            }
        }
    };

    return {
        reader,
        unitOfWork,
        transaction,
        get log() {
            return [...log];
        },
        get campaigns() {
            return [...campaigns];
        },
        get trialRows() {
            return new Map(trialRows);
        },
        /** Sets the activation event declared by a vertical. */
        setActivationEvent(vertical: Vertical, event: VerticalActivationEvent | null) {
            activationEvents.set(vertical, event);
        },
        /** Sets the trial plan for a vertical. `null` = no trial plan. */
        setTrialPlan(
            vertical: Vertical,
            value: {
                readonly planId: string;
                readonly planVersionId: string;
                readonly trialDays: number;
            } | null
        ) {
            trialPlans.set(vertical, value);
        },
        /** Sets the sellable current versions for a vertical (ordered by rank ascending). */
        setSellableVersions(vertical: Vertical, versions: PlanVersionSummaryRow[]) {
            sellableVersions.set(vertical, versions);
        },
        /** Sets an existing trial row manually (for conflict simulation). */
        setTrialRow(userId: string, vertical: Vertical, row: StoredTrialRow) {
            trialRows.set(`${userId}:${vertical}`, row);
        },
        /** Resets all state. */
        reset() {
            activationEvents.clear();
            trialPlans.clear();
            sellableVersions.clear();
            trialRows.clear();
            campaigns.length = 0;
            log.length = 0;
            mutexes.clear();
        }
    };
}
