/**
 * @fileoverview
 * Integration tests for `0194-hos-2196-partner-card-payment-method` (HOS-2196).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom. A Partner plan
 * version that only accepts card becomes card + manual; another vertical keeps its methods; a
 * second run changes nothing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { eq, getDb, initializeDb, plans, planVersions, resetDb } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0194-hos-2196-partner-card-payment-method.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    try {
        await getDb().transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    const actor: Actor = {
        id: crypto.randomUUID(),
        roles: [RoleEnum.SUPER_ADMIN],
        permissions: []
    };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

async function insertVersion(tx: DrizzleClient, vertical: 'partner' | 'accommodation') {
    const [plan] = await tx
        .insert(plans)
        .values({ vertical, slug: `zzz-test-hos2196-${crypto.randomUUID()}`, name: 'HOS-2196' })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Failed to insert plan');
    const [version] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 100000000) + 1300000000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Failed to insert version');
    return version.id;
}

async function methodsOf(tx: DrizzleClient, id: string) {
    const [row] = await tx
        .select({ methods: planVersions.paymentMethods })
        .from(planVersions)
        .where(eq(planVersions.id, id));
    return row?.methods;
}

describe('HOS-2196: 0194-hos-2196-partner-card-payment-method (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error('HOSPEDA_DATABASE_URL is not set in this worktree');
        }
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('makes a Partner version accept card and manual, leaves other verticals card-only, and is idempotent', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const partner = await insertVersion(tx, 'partner');
            const accommodation = await insertVersion(tx, 'accommodation');
            expect(await methodsOf(tx, partner)).toEqual(['CARD']);
            // Act
            await migration.up(buildCtx(tx));
            const second = await migration.up(buildCtx(tx));
            // Assert
            expect(await methodsOf(tx, partner)).toEqual(['CARD', 'MANUAL']);
            expect(await methodsOf(tx, accommodation)).toEqual(['CARD']);
            expect(second.counts?.updated).toBe(0);
        });
    });
});
