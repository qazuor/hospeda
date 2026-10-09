/**
 * Postgres-backed adapter for the T1 trial-start ports.
 *
 * This is test-only support code: production never imports it, and
 * `packages/verticals/src` has no database dependency (G14 / G15).
 *
 * Implements:
 * - `TrialStartReader` (five read methods over Drizzle queries)
 * - `TrialStartUnitOfWork` (advisory lock + transaction)
 * - `TrialStartTransaction` (extends reader with insert + campaign)
 */

import type { DrizzleClient } from '@repo/db';
import { plans, planVersions, trials, verticals } from '@repo/db';
import type { VerticalActivationEvent } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import type {
    NewTrialRow,
    PlanVersionSummaryRow,
    TrialStartReader,
    TrialStartTransaction,
    TrialStartUnitOfWork
} from '../../../src/trial/trial-start-types';

/* ------------------------------------------------------------------ */
/* Stats container (mutable during tests, immutable reference returned) */
/* ------------------------------------------------------------------ */

interface AdapterStatsInternal {
    uniqueConflicts: number;
    campaigns: Array<{
        userId: string;
        vertical: string;
        endsAt: Date;
        deadlinesVersion: number;
        milestones: readonly Date[];
    }>;
}

/** Publicly visible stats (read-only interface to the caller). */
interface AdapterStats {
    readonly uniqueConflicts: number;
    readonly campaigns: ReadonlyArray<{
        readonly userId: string;
        readonly vertical: string;
        readonly endsAt: Date;
        readonly deadlinesVersion: number;
        readonly milestones: readonly Date[];
    }>;
}

/* ------------------------------------------------------------------ */
/* readerOf: builds a TrialStartReader from any Drizzle query handle   */
/* ------------------------------------------------------------------ */

function readerOf(handle: DrizzleClient): TrialStartReader {
    return {
        async findActivationEvent({ vertical }: { readonly vertical: string }) {
            const [row] = await handle
                .select({ activationEvent: verticals.activationEvent })
                .from(verticals)
                .where(eq(verticals.id, vertical))
                .limit(1);
            return (row?.activationEvent ?? null) as VerticalActivationEvent | null;
        },

        async findTrialPlan({ vertical }: { readonly vertical: string }) {
            const [row] = await handle
                .select({
                    planId: plans.id,
                    planVersionId: planVersions.id,
                    trialDays: planVersions.trialDays
                })
                .from(planVersions)
                .innerJoin(plans, eq(planVersions.planId, plans.id))
                .where(
                    sql`${plans.vertical} = ${vertical} AND ${plans.role} = 'trial' AND ${planVersions.current} = true`
                )
                .limit(1);
            if (!row) return null;
            return {
                planId: row.planId,
                planVersionId: row.planVersionId,
                trialDays: row.trialDays
            };
        },

        async findSellableCurrentVersions({ vertical }: { readonly vertical: string }) {
            const rows = await handle
                .select({
                    id: planVersions.id,
                    planId: planVersions.planId,
                    vertical: planVersions.vertical,
                    rank: planVersions.rank,
                    sellable: planVersions.sellable,
                    current: planVersions.current
                })
                .from(planVersions)
                .where(
                    sql`${planVersions.vertical} = ${vertical} AND ${planVersions.sellable} = true AND ${planVersions.current} = true`
                )
                .orderBy(planVersions.rank)
                .limit(100);
            return rows as unknown as readonly PlanVersionSummaryRow[];
        },

        async findTrialOfUser({
            userId,
            vertical
        }: {
            readonly userId: string;
            readonly vertical: string;
        }) {
            const [row] = await handle
                .select({ id: trials.id })
                .from(trials)
                .where(sql`${trials.userId} = ${userId} AND ${trials.vertical} = ${vertical}`)
                .limit(1);
            return row ?? null;
        },

        async findTrialByPseudonym({
            emailPseudonym,
            vertical
        }: {
            readonly emailPseudonym: string;
            readonly vertical: string;
        }) {
            const [row] = await handle
                .select({ userId: trials.userId })
                .from(trials)
                .where(
                    sql`${trials.emailPseudonym} = ${emailPseudonym} AND ${trials.vertical} = ${vertical}`
                )
                .limit(1);
            return row ?? null;
        }
    };
}

/* ------------------------------------------------------------------ */
/* createTrialStartAdapter — public entry point                        */
/* ------------------------------------------------------------------ */

export function createTrialStartAdapter(args: {
    readonly db: DrizzleClient;
    readonly beforeInsert?: (row: NewTrialRow) => Promise<void>;
    readonly failOnSchedule?: boolean;
}): {
    readonly unitOfWork: TrialStartUnitOfWork;
    readonly reader: TrialStartReader;
    readonly stats: AdapterStats;
} {
    const internalStats: AdapterStatsInternal = { uniqueConflicts: 0, campaigns: [] };

    // Reader: read-only, works on any Drizzle handle (db or tx)
    const reader: TrialStartReader = readerOf(args.db);

    /** Build a transactional port from a Drizzle transaction handle. */
    function buildTransaction(tx: DrizzleClient): TrialStartTransaction {
        return {
            ...readerOf(tx),

            async insertTrial({ row }: { readonly row: NewTrialRow }) {
                // Allow the test harness to inspect or mutate the row before insert
                await args.beforeInsert?.(row);

                const result = await tx
                    .insert(trials)
                    .values({
                        userId: row.userId,
                        vertical: row.vertical,
                        status: row.status,
                        trialPlanId: row.trialPlanId,
                        floorEntitlementsVersionId: row.floorEntitlementsVersionId,
                        floorLimitsVersionId: row.floorLimitsVersionId,
                        floorTrialPlanVersionId: row.floorTrialPlanVersionId,
                        startedAt: row.startedAt,
                        endsAt: row.endsAt,
                        emailPseudonym: row.emailPseudonym,
                        deadlinesVersion: row.deadlinesVersion
                    })
                    .onConflictDoNothing()
                    .returning({ id: trials.id });

                if (result.length > 0) {
                    return { inserted: true };
                }

                // Conflict: re-read to determine which UNIQUE fired
                internalStats.uniqueConflicts += 1;

                const byUser = await tx
                    .select({ id: trials.id })
                    .from(trials)
                    .where(
                        sql`${trials.userId} = ${row.userId} AND ${trials.vertical} = ${row.vertical}`
                    )
                    .limit(1);

                if (byUser.length > 0) {
                    return { inserted: false, conflict: 'USER_VERTICAL' };
                }

                return { inserted: false, conflict: 'EMAIL_PSEUDONYM' };
            },

            async scheduleExpiryCampaign(campaignArgs: {
                readonly userId: string;
                readonly vertical: string;
                readonly endsAt: Date;
                readonly deadlinesVersion: number;
                readonly milestones: readonly Date[];
            }) {
                if (args.failOnSchedule) {
                    throw new Error('campaign scheduling failed on purpose');
                }
                internalStats.campaigns.push(campaignArgs);
            }
        };
    }

    const unitOfWork: TrialStartUnitOfWork = {
        async runLocked<T>(
            lockArgs: { readonly userId: string; readonly vertical: string },
            work: (tx: TrialStartTransaction) => Promise<T>
        ): Promise<T> {
            // Take the advisory lock (xact scope: released at transaction end)
            await args.db.execute(
                sql`SELECT pg_advisory_xact_lock(hashtextextended(${`trial-start:${lockArgs.userId}:${lockArgs.vertical}`}, 0))`
            );

            // Run work inside a transaction (savepoint if db is already a tx)
            return args.db.transaction(async (tx) => {
                const txPort = buildTransaction(tx);
                return work(txPort);
            });
        }
    };

    // Freeze the stats reference
    const stats: AdapterStats = Object.freeze({
        get uniqueConflicts() {
            return internalStats.uniqueConflicts;
        },
        get campaigns() {
            return internalStats.campaigns;
        }
    });

    return { unitOfWork, reader, stats };
}
