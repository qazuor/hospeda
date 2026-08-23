/**
 * @fileoverview
 * Integration tests for `0069-hos-733-advanced-stats-premium-only.ts`.
 *
 * Runs against the real PostgreSQL database provisioned for `@repo/seed`'s
 * integration suite, but every test executes inside a transaction that is
 * unconditionally rolled back. That gives this file two things a mocked DB
 * cannot prove:
 *
 * 1. `array_remove(entitlements, 'view_advanced_stats')` removes ONLY that
 *    element and preserves the rest of the array as-is.
 * 2. The migration's `WHERE` scope is narrow enough that another plan row that
 *    still grants the entitlement (`owner-premium`) survives untouched.
 *
 * The second property is the mutation-test anchor: widening the `WHERE` to
 * match every plan would strip `owner-premium` too, and this suite must turn
 * red immediately.
 *
 * @module test/data-migrations/0069-hos-733-advanced-stats-premium-only.integration
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { billingPlans, type DrizzleClient, eq, getDb, initializeDb, resetDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0069-hos-733-advanced-stats-premium-only.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos-733-advanced-stats-premium-only',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

const OWNER_PRO_SLUG = 'owner-pro';
const OWNER_PREMIUM_SLUG = 'owner-premium';
const ADVANCED_STATS_ENTITLEMENT = 'view_advanced_stats';

interface PlanRow {
    readonly name: string;
    readonly entitlements: string[];
}

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

async function readPlan(tx: DrizzleClient, slug: string): Promise<PlanRow> {
    const rows = await tx
        .select({
            name: billingPlans.name,
            entitlements: billingPlans.entitlements
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new Error(
            `Test fixture assumption broken: no billing_plans row named "${slug}" — is the required seed applied to this database?`
        );
    }

    return {
        name: row.name,
        entitlements: (row.entitlements ?? []) as string[]
    };
}

async function appendEntitlement(
    tx: DrizzleClient,
    slug: string,
    entitlement: string
): Promise<void> {
    await tx.execute(sql`
        UPDATE billing_plans
        SET    entitlements = array_append(entitlements, ${entitlement})
        WHERE  name = ${slug}
          AND  NOT (${entitlement} = ANY(entitlements))
    `);
}

async function stripEntitlement(
    tx: DrizzleClient,
    slug: string,
    entitlement: string
): Promise<void> {
    await tx.execute(sql`
        UPDATE billing_plans
        SET    entitlements = array_remove(entitlements, ${entitlement})
        WHERE  name = ${slug}
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

describe('0069-hos-733-advanced-stats-premium-only', () => {
    it('removes only view_advanced_stats from owner-pro and preserves the rest of the entitlements array', async () => {
        await withRollback(async (tx) => {
            await appendEntitlement(tx, OWNER_PRO_SLUG, ADVANCED_STATS_ENTITLEMENT);

            const before = await readPlan(tx, OWNER_PRO_SLUG);
            expect(before.entitlements).toContain(ADVANCED_STATS_ENTITLEMENT);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await migration.up(ctx);

            const after = await readPlan(tx, OWNER_PRO_SLUG);

            expect(result.counts).toEqual({ planRowsUpdated: 1 });
            expect(result.summary).toContain(OWNER_PRO_SLUG);
            expect(after.entitlements).toEqual(
                before.entitlements.filter(
                    (entitlement) => entitlement !== ADVANCED_STATS_ENTITLEMENT
                )
            );
            expect(after.entitlements).not.toContain(ADVANCED_STATS_ENTITLEMENT);
        });
    });

    it('is idempotent when owner-pro already lacks view_advanced_stats', async () => {
        await withRollback(async (tx) => {
            await stripEntitlement(tx, OWNER_PRO_SLUG, ADVANCED_STATS_ENTITLEMENT);

            const before = await readPlan(tx, OWNER_PRO_SLUG);
            expect(before.entitlements).not.toContain(ADVANCED_STATS_ENTITLEMENT);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await migration.up(ctx);

            const after = await readPlan(tx, OWNER_PRO_SLUG);

            expect(result.counts).toEqual({ planRowsUpdated: 0 });
            expect(result.summary).toContain('nothing to update');
            expect(after.entitlements).toEqual(before.entitlements);
        });
    });

    it('does not touch other plans that still grant view_advanced_stats', async () => {
        await withRollback(async (tx) => {
            await appendEntitlement(tx, OWNER_PRO_SLUG, ADVANCED_STATS_ENTITLEMENT);
            await appendEntitlement(tx, OWNER_PREMIUM_SLUG, ADVANCED_STATS_ENTITLEMENT);

            const beforePremium = await readPlan(tx, OWNER_PREMIUM_SLUG);
            expect(beforePremium.entitlements).toContain(ADVANCED_STATS_ENTITLEMENT);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await migration.up(ctx);

            const afterPremium = await readPlan(tx, OWNER_PREMIUM_SLUG);
            const afterPro = await readPlan(tx, OWNER_PRO_SLUG);

            expect(result.counts).toEqual({ planRowsUpdated: 1 });
            expect(afterPremium.entitlements).toEqual(beforePremium.entitlements);
            expect(afterPremium.entitlements).toContain(ADVANCED_STATS_ENTITLEMENT);
            expect(afterPro.entitlements).not.toContain(ADVANCED_STATS_ENTITLEMENT);
        });
    });

    it('is declared non-destructive and belongs to the required group', () => {
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.group).toBe('required');
    });
});
