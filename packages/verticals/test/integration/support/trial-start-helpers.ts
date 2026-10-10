/**
 * Shared helpers for integration tests in the trial-start domain.
 *
 * These functions query the database directly (not the code under test)
 * to seed users, read plan data, or inspect trial rows.
 */
import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { plans, planVersions, trials, users } from '@repo/db';
import type { TrialStatusEnum } from '@repo/schemas';
import { and, eq, sql } from 'drizzle-orm';
import type { BootstrapCoverageReader } from '../../../src/coverage/trial-and-base-sources';

/* ------------------------------------------------------------------ */
/* Seed helpers                                                        */
/* ------------------------------------------------------------------ */

/** Creates a user and returns it. */
export async function seedUser(db: DrizzleClient) {
    const [user] = await db
        .insert(users)
        .values({
            email: `trial-${randomUUID()}@example.com`,
            displayName: 'Trial User'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('User insert failed');
    return user;
}

/**
 * Returns { planId, versionId, trialDays } for the trial plan of a vertical.
 */
export async function trialPlanOf(
    db: DrizzleClient,
    vertical: string
): Promise<{ planId: string; versionId: string; trialDays: number }> {
    const [row] = await db
        .select({
            planId: plans.id,
            versionId: planVersions.id,
            trialDays: planVersions.trialDays
        })
        .from(planVersions)
        .innerJoin(plans, eq(planVersions.planId, plans.id))
        .where(
            sql`${plans.vertical} = ${vertical} AND ${plans.role} = 'trial' AND ${planVersions.current} = true`
        )
        .limit(1);
    if (!row) throw new Error(`No trial plan for ${vertical}`);
    return row;
}

/**
 * Returns sellable current version ids ordered by rank ascending.
 */
export async function sellableCurrentIds(db: DrizzleClient, vertical: string): Promise<string[]> {
    const rows = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(
            sql`${planVersions.vertical} = ${vertical} AND ${planVersions.sellable} = true AND ${planVersions.current} = true`
        )
        .orderBy(planVersions.rank);
    return rows.map((r) => r.id);
}

/* ------------------------------------------------------------------ */
/* Query helpers (read-only, use a separate connection)                */
/* ------------------------------------------------------------------ */

/** Query a trial row by userId using a raw pool (another connection). */
export async function trialRowOf(
    pool: import('pg').Pool,
    userId: string,
    vertical: string
): Promise<Record<string, unknown> | undefined> {
    // Use raw SQL to get snake_case column names (matching the DB schema)
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM trial WHERE user_id = $1 AND vertical = $2',
            [userId, vertical]
        );
        if (result.rows.length === 0) return undefined;
        return result.rows[0] as Record<string, unknown>;
    } finally {
        client.release();
    }
}

/** Query the canje_de_trial count for a user. */
export async function canjeCountOf(pool: import('pg').Pool, userId: string): Promise<number> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT count(*) FROM canje_de_trial WHERE user_id = $1',
            [userId]
        );
        return Number(result.rows[0].count);
    } finally {
        client.release();
    }
}

/* ------------------------------------------------------------------ */
/* BootstrapCoverageReader factory                                      */
/* ------------------------------------------------------------------ */

/** Creates a BootstrapCoverageReader from a Drizzle handle. */
export function bootstrapReaderOf(db: DrizzleClient): BootstrapCoverageReader {
    return {
        async findTrial({ userId, vertical }) {
            const [row] = await db
                .select()
                .from(trials)
                .where(and(eq(trials.userId, userId), eq(trials.vertical, vertical)))
                .limit(1);
            if (!row) return null;
            return {
                userId: row.userId,
                vertical: row.vertical,
                trialPlanId: row.trialPlanId,
                status: row.status as TrialStatusEnum,
                startedAt: row.startedAt,
                endsAt: row.endsAt,
                floor:
                    row.floorEntitlementsVersionId &&
                    row.floorLimitsVersionId &&
                    row.floorTrialPlanVersionId
                        ? {
                              entitlementsVersionId: row.floorEntitlementsVersionId,
                              limitsVersionId: row.floorLimitsVersionId,
                              trialPlanVersionId: row.floorTrialPlanVersionId
                          }
                        : null
            };
        },
        async findAccountCreatedAt({ userId }) {
            const [row] = await db
                .select({ createdAt: users.createdAt })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);
            if (!row) throw new Error(`Account ${userId} does not exist`);
            return row.createdAt;
        },
        async findCurrentVersionByRole({ vertical, role }) {
            const [row] = await db
                .select({
                    id: planVersions.id,
                    planId: planVersions.planId,
                    vertical: planVersions.vertical,
                    rank: planVersions.rank,
                    sellable: planVersions.sellable,
                    current: planVersions.current
                })
                .from(planVersions)
                .innerJoin(plans, eq(planVersions.planId, plans.id))
                .where(
                    and(
                        eq(plans.vertical, vertical),
                        eq(plans.role, role),
                        eq(planVersions.current, true)
                    )
                )
                .limit(1);
            return row ?? null;
        }
    };
}

/* ------------------------------------------------------------------ */
/* Rollback helper                                                     */
/* ------------------------------------------------------------------ */

class Rollback extends Error {}

/**
 * Wraps a DB operation in a transaction that always rolls back,
 * keeping the test database clean after each test.
 */
export async function inRollback(
    db: DrizzleClient,
    fn: (tx: DrizzleClient) => Promise<void>
): Promise<void> {
    try {
        await db.transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new Rollback('rollback');
        });
    } catch (error) {
        if (!(error instanceof Rollback)) throw error;
    }
}
