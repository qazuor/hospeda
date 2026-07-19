/**
 * @fileoverview
 * Integration tests for the HOS-210 data migration
 * `0017-hos-210-tourist-plan-trial.ts` — the dual-write counterpart backfilling
 * the two self-service tourist plans' new 14-day card-first trial
 * (`metadata.hasTrial: true, metadata.trialDays: 14`) onto ALREADY-SEEDED
 * `billing_plans` rows (`tourist-plus`, `tourist-vip`). See the migration's own
 * JSDoc for the full OR-PRESERVE rationale.
 *
 * Runs against the REAL worktree PostgreSQL database, mirroring the
 * transaction-rollback isolation idiom established by
 * `owner-test-daily-trial.integration.test.ts` (HOS-25 T-020): every test opens
 * a `db.transaction()`, does ALL setup/assertions inside it, and unconditionally
 * throws a sentinel at the end so the transaction always rolls back — the real
 * `billing_plans` rows are back to their pre-test state the instant the test
 * function returns, regardless of outcome.
 *
 * @module test/data-migrations/hos-210-tourist-plan-trial.integration
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
import * as touristPlanTrial from '../../src/data-migrations/0017-hos-210-tourist-plan-trial.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as packages/seed/src/index.ts and the sibling
// billing data-migration integration tests: HOSPEDA_DATABASE_URL lives in
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
    id: 'actor-stub-hos210',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * Runs `fn` inside a transaction that ALWAYS rolls back, regardless of whether
 * `fn` throws. `fn` receives the transaction-scoped Drizzle client — pass it as
 * `ctx.db` when building a migration context, exactly like the real runner does.
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

const PLAN_NAMES = ['tourist-plus', 'tourist-vip'] as const;
type PlanName = (typeof PLAN_NAMES)[number];

interface TrialMetadata {
    readonly hasTrial: boolean | undefined;
    readonly trialDays: number | undefined;
}

async function readTrialMetadata(tx: DrizzleClient, planName: PlanName): Promise<TrialMetadata> {
    const rows = await tx
        .select({ metadata: billingPlans.metadata })
        .from(billingPlans)
        .where(eq(billingPlans.name, planName))
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new Error(
            `Test fixture assumption broken: no billing_plans row named "${planName}" — is the required seed (packages/seed/src/required/billingPlans.seed.ts) applied to this worktree DB?`
        );
    }
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    return {
        hasTrial: typeof metadata.hasTrial === 'boolean' ? metadata.hasTrial : undefined,
        trialDays: typeof metadata.trialDays === 'number' ? metadata.trialDays : undefined
    };
}

/**
 * Forces a plan's trial metadata to an arbitrary `hasTrial` / `trialDays` pair —
 * used to (a) simulate the pre-HOS-210 baseline default before exercising the
 * migration, and (b) simulate an operator edit made via the admin
 * `PlanDialog.tsx` for the OR-PRESERVE test.
 */
async function setTrialMetadata(
    tx: DrizzleClient,
    planName: PlanName,
    hasTrial: boolean,
    trialDays: number
): Promise<void> {
    await tx.execute(sql`
        UPDATE billing_plans
        SET    metadata = metadata || jsonb_build_object('hasTrial', ${hasTrial}::boolean, 'trialDays', ${trialDays}::int)
        WHERE  name = ${planName}
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

describe('0017-hos-210-tourist-plan-trial', () => {
    it('flips both baseline (pre-HOS-210) tourist rows to hasTrial:true, trialDays:14', async () => {
        await withRollback(async (tx) => {
            // Arrange — simulate the pre-HOS-210 baseline default this migration backfills.
            for (const name of PLAN_NAMES) {
                await setTrialMetadata(tx, name, false, 0);
                expect(await readTrialMetadata(tx, name)).toEqual({
                    hasTrial: false,
                    trialDays: 0
                });
            }

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            // Act
            const result = await touristPlanTrial.up(ctx);

            // Assert — both rows updated.
            expect(result.counts?.rowsUpdated).toBe(2);
            for (const name of PLAN_NAMES) {
                expect(await readTrialMetadata(tx, name)).toEqual({
                    hasTrial: true,
                    trialDays: 14
                });
            }
        });
    });

    it('is idempotent: running up() again once both rows read hasTrial:true updates zero rows', async () => {
        await withRollback(async (tx) => {
            for (const name of PLAN_NAMES) {
                await setTrialMetadata(tx, name, false, 0);
            }
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await touristPlanTrial.up(ctx);
            expect(first.counts?.rowsUpdated).toBe(2);

            const second = await touristPlanTrial.up(ctx);
            expect(second.counts?.rowsUpdated).toBe(0);

            for (const name of PLAN_NAMES) {
                expect(await readTrialMetadata(tx, name)).toEqual({
                    hasTrial: true,
                    trialDays: 14
                });
            }
        });
    });

    it('never overwrites an operator-edited trial config, and touches only the still-baseline row (OR-PRESERVE)', async () => {
        await withRollback(async (tx) => {
            // Arrange — both start at the old baseline.
            for (const name of PLAN_NAMES) {
                await setTrialMetadata(tx, name, false, 0);
            }
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            // Operator manually edits ONLY tourist-plus via the admin plan editor
            // (SPEC-168 PlanDialog.tsx) to a custom value; tourist-vip stays baseline.
            await setTrialMetadata(tx, 'tourist-plus', true, 7);
            expect(await readTrialMetadata(tx, 'tourist-plus')).toEqual({
                hasTrial: true,
                trialDays: 7
            });

            // Act — the migration must skip the operator-edited row and update only
            // the still-baseline one (OR-PRESERVE fires only when both fields are
            // STILL the exact old default false / 0).
            const result = await touristPlanTrial.up(ctx);

            // Assert — exactly one row updated (tourist-vip), operator edit preserved.
            expect(result.counts?.rowsUpdated).toBe(1);
            expect(await readTrialMetadata(tx, 'tourist-plus')).toEqual({
                hasTrial: true,
                trialDays: 7
            });
            expect(await readTrialMetadata(tx, 'tourist-vip')).toEqual({
                hasTrial: true,
                trialDays: 14
            });
        });
    });

    it('backfills a legacy row missing both keys entirely (COALESCE default)', async () => {
        await withRollback(async (tx) => {
            // Arrange — rows whose metadata predates either key (COALESCE branch).
            await tx.execute(sql`
                UPDATE billing_plans
                SET    metadata = metadata - 'hasTrial' - 'trialDays'
                WHERE  name IN ('tourist-plus', 'tourist-vip')
            `);
            for (const name of PLAN_NAMES) {
                expect(await readTrialMetadata(tx, name)).toEqual({
                    hasTrial: undefined,
                    trialDays: undefined
                });
            }

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            // Act
            const result = await touristPlanTrial.up(ctx);

            // Assert
            expect(result.counts?.rowsUpdated).toBe(2);
            for (const name of PLAN_NAMES) {
                expect(await readTrialMetadata(tx, name)).toEqual({
                    hasTrial: true,
                    trialDays: 14
                });
            }
        });
    });
});
