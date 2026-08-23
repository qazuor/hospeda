/**
 * @fileoverview
 * Regression test for HOS-749: `assertNoUnclassifiedReferrers` built its
 * `= ANY(...)` list by interpolating a bare JS array into a Drizzle `sql`
 * template:
 *
 * ```ts
 * = ANY(${[...targetIds]}::text[])
 * ```
 *
 * Drizzle expands a bare array into a COMMA-SEPARATED PLACEHOLDER LIST, so that
 * renders as `($1, $2, $3)::text[]` — a row constructor, which Postgres rejects
 * outright:
 *
 *     ERROR:  cannot cast type record to text[]
 *
 * The trap is that it only misfires with **two or more** ids: with exactly one,
 * `($1)::text[]` is a parenthesised scalar cast and the query runs fine. Every
 * fixture had at most one target, so this guard passed everywhere — and then
 * aborted the entire production seed-migration run on `0068`'s seven real
 * subscriptions, taking the whole batch down with it (the runner stops at the
 * first failure, HOS-25 G-5).
 *
 * Two things must hold, and the second matters as much as the first:
 *
 *  1. The query must PARSE with 2+ ids.
 *  2. The `ANY` must actually MATCH beyond the first element. A guard that
 *     parses but silently matches nothing is WORSE than one that throws — it
 *     turns a protective assertion into a no-op and lets a destructive billing
 *     cleanup run unguarded.
 *
 * Hence a real database rather than a stubbed `ctx.db`: a mocked `db.execute()`
 * cannot reproduce a Postgres parse error, and the sibling mocked unit test
 * (`0068-hos-749-prod-billing-cleanup.test.ts`) is exactly why this reached
 * production undetected.
 *
 * Rollback-isolated: every test runs inside a `db.transaction()` that is always
 * rolled back via a sentinel throw. Nothing persists after this file runs.
 *
 * @module test/data-migrations/billing-cleanup-guards.integration
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    billingCustomers,
    billingSubscriptions,
    type DrizzleClient,
    getDb,
    initializeDb,
    resetDb,
    sql
} from '@repo/db';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    assertNoUnclassifiedReferrers,
    BillingCleanupAbort
} from '../../src/data-migrations/helpers/billingCleanupGuards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) {
            return;
        }
        throw error;
    }
}

/** Inserts a minimal `billing_customers` row, returning its id. */
async function insertCustomer(tx: DrizzleClient, externalId: string): Promise<string> {
    const inserted = await tx
        .insert(billingCustomers)
        .values({
            externalId,
            email: `${externalId}@billing-test.local`,
            livemode: false
        } as typeof billingCustomers.$inferInsert)
        .returning({ id: billingCustomers.id });
    const row = inserted[0];
    if (!row) {
        throw new Error('Insert of test billing customer returned no row');
    }
    return row.id;
}

/** Inserts a minimal `billing_subscriptions` row, returning its id. */
async function insertSubscription(tx: DrizzleClient, customerId: string): Promise<string> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const inserted = await tx
        .insert(billingSubscriptions)
        .values({
            customerId,
            planId: 'zzqa-hos749-plan',
            status: 'active',
            billingInterval: 'month',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            livemode: false
        } as typeof billingSubscriptions.$inferInsert)
        .returning({ id: billingSubscriptions.id });
    const row = inserted[0];
    if (!row) {
        throw new Error('Insert of test billing subscription returned no row');
    }
    return row.id;
}

/**
 * Inserts a `billing_plan_price_change_notices` row pointing at `subscriptionId`,
 * building the `billing_plans → billing_prices → billing_plan_price_changes`
 * chain it requires.
 *
 * Raw SQL rather than Drizzle inserts: these four tables are not all exported as
 * typed tables from `@repo/db`, and the test only needs FK-valid rows, not
 * type-level fidelity.
 *
 * `billing_plan_price_change_notices` is the exact table production hit — it is
 * listed in neither `BILLING_CLEANUP_SOFT_DELETE_ORDER` nor
 * `RETAINED_REFERENCING_TABLES`, so it is precisely the "unclassified referrer"
 * this guard exists to catch.
 */
async function insertUnclassifiedReferrer(
    tx: DrizzleClient,
    subscriptionId: string
): Promise<void> {
    const plan = await tx.execute<{ id: string }>(sql`
        INSERT INTO billing_plans (name) VALUES ('HOS-749 guard fixture plan') RETURNING id
    `);
    const planId = plan.rows[0]?.id;
    if (!planId) {
        throw new Error('Insert of fixture billing_plans row returned no id');
    }

    const price = await tx.execute<{ id: string }>(sql`
        INSERT INTO billing_prices (plan_id, currency, unit_amount, billing_interval)
        VALUES (${planId}, 'ARS', 1000, 'month')
        RETURNING id
    `);
    const priceId = price.rows[0]?.id;
    if (!priceId) {
        throw new Error('Insert of fixture billing_prices row returned no id');
    }

    const change = await tx.execute<{ id: string }>(sql`
        INSERT INTO billing_plan_price_changes
            (plan_id, price_id, billing_interval, old_amount, new_amount, direction, effective_at)
        VALUES (${planId}, ${priceId}, 'month', 1000, 2000, 'increase', now())
        RETURNING id
    `);
    const changeId = change.rows[0]?.id;
    if (!changeId) {
        throw new Error('Insert of fixture billing_plan_price_changes row returned no id');
    }

    await tx.execute(sql`
        INSERT INTO billing_plan_price_change_notices (price_change_id, subscription_id)
        VALUES (${changeId}, ${subscriptionId})
    `);
}

describe('HOS-749: assertNoUnclassifiedReferrers binds its id list as one array parameter', () => {
    beforeAll(async () => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set — is the integration global-setup wired?'
            );
        }

        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('does not blow up on TWO OR MORE ids — the exact shape that aborted the production run', async () => {
        await withRollback(async (tx) => {
            const customerId = await insertCustomer(tx, 'hos749-guard-a');
            const subscriptionOne = await insertSubscription(tx, customerId);
            const subscriptionTwo = await insertSubscription(tx, customerId);

            // Before the fix this rejects with the Postgres parse error
            // `cannot cast type record to text[]`, because the two ids render as
            // a row constructor `($1, $2)::text[]`.
            await expect(
                assertNoUnclassifiedReferrers({
                    db: tx,
                    customerIds: [customerId],
                    subscriptionIds: [subscriptionOne, subscriptionTwo]
                })
            ).resolves.toBeUndefined();
        });
    });

    it('still MATCHES a referrer sitting at the SECOND position — a guard that matches nothing is a no-op', async () => {
        await withRollback(async (tx) => {
            const customerId = await insertCustomer(tx, 'hos749-guard-b');
            const subscriptionOne = await insertSubscription(tx, customerId);
            const subscriptionTwo = await insertSubscription(tx, customerId);
            // Deliberately hung off the SECOND id: a fix that parsed but only
            // ever compared against the first element would pass the test above
            // and silently disarm the guard here.
            await insertUnclassifiedReferrer(tx, subscriptionTwo);

            await expect(
                assertNoUnclassifiedReferrers({
                    db: tx,
                    customerIds: [customerId],
                    subscriptionIds: [subscriptionOne, subscriptionTwo]
                })
            ).rejects.toThrow(BillingCleanupAbort);
        });
    });

    it('names the offending table in the abort, so the operator knows what to classify', async () => {
        await withRollback(async (tx) => {
            const customerId = await insertCustomer(tx, 'hos749-guard-c');
            const subscriptionOne = await insertSubscription(tx, customerId);
            const subscriptionTwo = await insertSubscription(tx, customerId);
            await insertUnclassifiedReferrer(tx, subscriptionTwo);

            await expect(
                assertNoUnclassifiedReferrers({
                    db: tx,
                    customerIds: [customerId],
                    subscriptionIds: [subscriptionOne, subscriptionTwo]
                })
            ).rejects.toThrow(/billing_plan_price_change_notices/);
        });
    });

    it('keeps working with exactly ONE id — the case that always passed and hid the bug', async () => {
        await withRollback(async (tx) => {
            const customerId = await insertCustomer(tx, 'hos749-guard-d');
            const subscriptionOne = await insertSubscription(tx, customerId);

            await expect(
                assertNoUnclassifiedReferrers({
                    db: tx,
                    customerIds: [customerId],
                    subscriptionIds: [subscriptionOne]
                })
            ).resolves.toBeUndefined();
        });
    });
});
