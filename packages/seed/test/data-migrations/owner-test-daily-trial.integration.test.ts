/**
 * @fileoverview
 * Integration tests for the HOS-110 data migration
 * `0006-owner-test-daily-trial.ts` — the dual-write counterpart backfilling
 * `owner-test-daily`'s new 1-day no-card trial
 * (`metadata.hasTrial: true, metadata.trialDays: 1`) onto an
 * ALREADY-SEEDED `billing_plans` row (see the migration's own JSDoc for the
 * full OR-PRESERVE rationale).
 *
 * Runs against the REAL worktree PostgreSQL database, mirroring the
 * transaction-rollback isolation idiom established by
 * `billing-plans-port.integration.test.ts` (HOS-25 T-020): every test opens
 * a `db.transaction()`, does ALL setup/assertions inside it, and
 * unconditionally throws a sentinel at the end so the transaction always
 * rolls back — the real `billing_plans` row for `owner-test-daily` is back
 * to its pre-test state the instant the test function returns, regardless
 * of outcome.
 *
 * @module test/data-migrations/owner-test-daily-trial.integration
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { billingPlans, eq, getDb, initializeDb, resetDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as ownerTestDailyTrial from '../../src/data-migrations/0006-owner-test-daily-trial.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as packages/seed/src/index.ts and
// billing-plans-port.integration.test.ts: HOSPEDA_DATABASE_URL lives in
// apps/api/.env.local, not in a (nonexistent) packages/seed env file.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Sentinel thrown at the end of every isolated test to force a rollback without surfacing as a real failure. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

/** Stub actor — this migration only uses `ctx.db`, so a minimal stub suffices. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos110-t005',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * Runs `fn` inside a transaction that ALWAYS rolls back, regardless of
 * whether `fn` throws. `fn` receives the transaction-scoped Drizzle client —
 * pass it as `ctx.db` when building a migration context, exactly like the
 * real runner does.
 */
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

const PLAN_NAME = 'owner-test-daily';

interface TrialMetadata {
    readonly hasTrial: boolean | undefined;
    readonly trialDays: number | undefined;
}

async function readTrialMetadata(tx: DrizzleClient): Promise<TrialMetadata> {
    const rows = await tx
        .select({ metadata: billingPlans.metadata })
        .from(billingPlans)
        .where(eq(billingPlans.name, PLAN_NAME))
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new Error(
            `Test fixture assumption broken: no billing_plans row named "${PLAN_NAME}" — is the required seed (packages/seed/src/required/testDailyPlan.seed.ts) applied to this worktree DB?`
        );
    }
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    return {
        hasTrial: typeof metadata.hasTrial === 'boolean' ? metadata.hasTrial : undefined,
        trialDays: typeof metadata.trialDays === 'number' ? metadata.trialDays : undefined
    };
}

/**
 * Forces `owner-test-daily`'s trial metadata to an arbitrary `hasTrial` /
 * `trialDays` pair — used to (a) simulate the pre-HOS-110 baseline default
 * before exercising the migration, and (b) simulate an operator edit made
 * via the admin `PlanDialog.tsx` for the OR-PRESERVE test.
 */
async function setTrialMetadata(
    tx: DrizzleClient,
    hasTrial: boolean,
    trialDays: number
): Promise<void> {
    await tx.execute(sql`
        UPDATE billing_plans
        SET    metadata = metadata || jsonb_build_object('hasTrial', ${hasTrial}::boolean, 'trialDays', ${trialDays}::int)
        WHERE  name = ${PLAN_NAME}
    `);
}

let pool: Pool;

beforeAll(() => {
    if (!process.env.HOSPEDA_DATABASE_URL) {
        throw new Error(
            'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
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

describe('0006-owner-test-daily-trial', () => {
    it('flips a baseline (pre-HOS-110) owner-test-daily row to hasTrial:true, trialDays:1', async () => {
        await withRollback(async (tx) => {
            // Arrange — simulate the pre-HOS-110 baseline default this migration backfills.
            await setTrialMetadata(tx, false, 0);
            const before = await readTrialMetadata(tx);
            expect(before).toEqual({ hasTrial: false, trialDays: 0 });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            // Act
            const result = await ownerTestDailyTrial.up(ctx);

            // Assert
            expect(result.counts?.rowsUpdated).toBe(1);
            const after = await readTrialMetadata(tx);
            expect(after).toEqual({ hasTrial: true, trialDays: 1 });
        });
    });

    it('is idempotent: running up() again once the row already reads hasTrial:true updates zero rows', async () => {
        await withRollback(async (tx) => {
            await setTrialMetadata(tx, false, 0);
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await ownerTestDailyTrial.up(ctx);
            expect(first.counts?.rowsUpdated).toBe(1);

            const second = await ownerTestDailyTrial.up(ctx);
            expect(second.counts?.rowsUpdated).toBe(0);

            const after = await readTrialMetadata(tx);
            expect(after).toEqual({ hasTrial: true, trialDays: 1 });
        });
    });

    it('never overwrites an operator-edited trial config (OR-PRESERVE)', async () => {
        await withRollback(async (tx) => {
            // Arrange — start from the old baseline so the first run applies.
            await setTrialMetadata(tx, false, 0);
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            await ownerTestDailyTrial.up(ctx);

            // Operator manually edits the trial config via the admin plan editor
            // (SPEC-168 PlanDialog.tsx) to a custom value — e.g. extending the
            // test trial to 3 days for a specific manual QA session.
            await setTrialMetadata(tx, true, 3);
            const afterOperatorEdit = await readTrialMetadata(tx);
            expect(afterOperatorEdit).toEqual({ hasTrial: true, trialDays: 3 });

            // Act — re-running the migration must NOT clobber the operator's edit:
            // the OR-PRESERVE guard only fires when both fields are STILL at the
            // exact old baseline default (false / 0).
            const second = await ownerTestDailyTrial.up(ctx);

            // Assert
            expect(second.counts?.rowsUpdated).toBe(0);
            const after = await readTrialMetadata(tx);
            expect(after).toEqual({ hasTrial: true, trialDays: 3 });
        });
    });

    it('backfills a legacy row missing both keys entirely (COALESCE default)', async () => {
        await withRollback(async (tx) => {
            // Arrange — a row whose metadata predates either key (COALESCE branch).
            await tx.execute(sql`
                UPDATE billing_plans
                SET    metadata = metadata - 'hasTrial' - 'trialDays'
                WHERE  name = ${PLAN_NAME}
            `);
            const before = await readTrialMetadata(tx);
            expect(before).toEqual({ hasTrial: undefined, trialDays: undefined });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            // Act
            const result = await ownerTestDailyTrial.up(ctx);

            // Assert
            expect(result.counts?.rowsUpdated).toBe(1);
            const after = await readTrialMetadata(tx);
            expect(after).toEqual({ hasTrial: true, trialDays: 1 });
        });
    });
});
