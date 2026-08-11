/**
 * @fileoverview
 * Integration tests for `0053-hos-301-lanzamiento50-expiry.ts` (HOS-301 D1).
 *
 * Modeled on `hos-301-deactivate-tourist-plus.integration.test.ts` (closest
 * sibling in shape: a single guarded `UPDATE` on one column, gated on
 * `IS NULL`) and `hos-301-reprice-owner-plans.integration.test.ts`: runs
 * against the REAL PostgreSQL database the `packages/seed` integration
 * `globalSetup` provisions (`hospeda_seed_integration_test`), using the same
 * rollback-isolation idiom established by
 * `test-daily-plan-min-amount.integration.test.ts`. Every test opens a
 * `db.transaction()`, drives the `billing_promo_codes` row for the code(s) it
 * cares about to a known starting state, runs `up()`, asserts, then
 * unconditionally throws a sentinel `RollbackSignal` so nothing this suite
 * writes survives past the test that wrote it.
 *
 * `globalSetup` seeds `billing_promo_codes` from `DEFAULT_PROMO_CODES` —
 * current branch state already has `LANZAMIENTO_50_CODE.expiresAt` set to
 * this same migration's target instant (this same PR's baseline edit to
 * `packages/billing/src/config/promo-codes.config.ts`), so the row may
 * already carry the expiry before any test runs. Every test that wants to
 * observe a `NULL` → set conversion must first drive `expires_at` back to
 * `NULL` itself, exactly like the sibling 0052 suite has to re-drive
 * `active` back to `true`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { billingPromoCodes, type DrizzleClient, eq, getDb, initializeDb, resetDb } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as lanzamiento50Expiry from '../../src/data-migrations/0053-hos-301-lanzamiento50-expiry.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as the sibling billing data-migration
// integration tests: HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
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
    id: 'actor-stub-hos301-lanzamiento50-expiry',
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

/**
 * The exact target instant this migration sets: end of 2026-12-31 in
 * Argentina (UTC-3), expressed in UTC. Kept as a local literal (not imported
 * from the migration module, which does not export it) so the test verifies
 * the actual stored value independently, the same way the sibling reprice
 * suite hardcodes its own old/new price grid rather than importing it.
 */
const EXPECTED_EXPIRES_AT = new Date('2027-01-01T02:59:59.999Z');

/** A distinct, unrelated instant used to simulate an operator-set expiry. */
const OPERATOR_SET_EXPIRES_AT = new Date('2026-06-01T00:00:00.000Z');

/**
 * Ensures a `billing_promo_codes` row exists for `code` at exactly
 * `expiresAt`, updating it in place if the row already exists (as it will
 * for `LANZAMIENTO50`/`BIENVENIDO30`, seeded by `globalSetup`) or inserting a
 * minimal fixture row otherwise. Returns the row id.
 */
async function ensurePromoCodeExpiresAtFixture(
    tx: DrizzleClient,
    code: string,
    expiresAt: Date | null
): Promise<string> {
    const existing = await tx
        .select({ id: billingPromoCodes.id })
        .from(billingPromoCodes)
        .where(eq(billingPromoCodes.code, code))
        .limit(1);

    const promoRow = existing[0];
    if (promoRow) {
        await tx
            .update(billingPromoCodes)
            .set({ expiresAt })
            .where(eq(billingPromoCodes.id, promoRow.id));
        return promoRow.id;
    }

    const inserted = await tx
        .insert(billingPromoCodes)
        .values({
            code,
            type: 'percentage',
            value: 50,
            config: { description: `Test fixture promo code for ${code}` },
            active: true,
            maxUses: 100,
            usedCount: 0,
            expiresAt,
            newCustomersOnly: true,
            livemode: false
        })
        .returning({ id: billingPromoCodes.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(`Insert of test-fixture promo code "${code}" returned no row`);
    }
    return insertedRow.id;
}

/** Reads back a promo code's `expiresAt` column. Returns `undefined` when the row does not exist. */
async function readPromoCodeExpiresAt(
    tx: DrizzleClient,
    code: string
): Promise<Date | null | undefined> {
    const rows = await tx
        .select({ expiresAt: billingPromoCodes.expiresAt })
        .from(billingPromoCodes)
        .where(eq(billingPromoCodes.code, code))
        .limit(1);

    return rows[0]?.expiresAt;
}

/**
 * Removes a promo code's `billing_promo_codes` row, so a test can start from
 * a known "code does not exist" state. No-ops when absent.
 */
async function removePromoCodeFixture(tx: DrizzleClient, code: string): Promise<void> {
    await tx.delete(billingPromoCodes).where(eq(billingPromoCodes.code, code));
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

describe('0053-hos-301-lanzamiento50-expiry', () => {
    it('sets expiresAt to the exact HOS-301 instant on a LANZAMIENTO50 row with no expiry', async () => {
        await withRollback(async (tx) => {
            await ensurePromoCodeExpiresAtFixture(tx, 'LANZAMIENTO50', null);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await lanzamiento50Expiry.up(ctx);

            expect(result.counts?.promoCodeRowsUpdated).toBe(1);

            const expiresAt = await readPromoCodeExpiresAt(tx, 'LANZAMIENTO50');
            expect(expiresAt).toBeInstanceOf(Date);
            expect(expiresAt?.getTime()).toBe(EXPECTED_EXPIRES_AT.getTime());
        });
    });

    it('is idempotent: a second up() updates zero rows and the expiry stays put', async () => {
        await withRollback(async (tx) => {
            await ensurePromoCodeExpiresAtFixture(tx, 'LANZAMIENTO50', null);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await lanzamiento50Expiry.up(ctx);
            expect(first.counts?.promoCodeRowsUpdated).toBe(1);

            const second = await lanzamiento50Expiry.up(ctx);
            expect(second.counts?.promoCodeRowsUpdated).toBe(0);

            const expiresAt = await readPromoCodeExpiresAt(tx, 'LANZAMIENTO50');
            expect(expiresAt?.getTime()).toBe(EXPECTED_EXPIRES_AT.getTime());
        });
    });

    it('preserves an operator-set expiry instead of overwriting it', async () => {
        await withRollback(async (tx) => {
            await ensurePromoCodeExpiresAtFixture(tx, 'LANZAMIENTO50', OPERATOR_SET_EXPIRES_AT);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await lanzamiento50Expiry.up(ctx);

            expect(result.counts?.promoCodeRowsUpdated).toBe(0);

            const expiresAt = await readPromoCodeExpiresAt(tx, 'LANZAMIENTO50');
            expect(expiresAt?.getTime()).toBe(OPERATOR_SET_EXPIRES_AT.getTime());
        });
    });

    it('is a no-op when LANZAMIENTO50 does not exist on this environment', async () => {
        await withRollback(async (tx) => {
            await removePromoCodeFixture(tx, 'LANZAMIENTO50');

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await lanzamiento50Expiry.up(ctx);

            expect(result.counts?.promoCodeRowsUpdated).toBe(0);
            expect(result.summary).toContain('LANZAMIENTO50');

            expect(await readPromoCodeExpiresAt(tx, 'LANZAMIENTO50')).toBeUndefined();
        });
    });

    it('leaves BIENVENIDO30 (and other promo codes) untouched — only LANZAMIENTO50 is targeted', async () => {
        await withRollback(async (tx) => {
            await ensurePromoCodeExpiresAtFixture(tx, 'LANZAMIENTO50', null);
            await ensurePromoCodeExpiresAtFixture(tx, 'BIENVENIDO30', null);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await lanzamiento50Expiry.up(ctx);

            expect(result.counts?.promoCodeRowsUpdated).toBe(1);

            const lanzamiento = await readPromoCodeExpiresAt(tx, 'LANZAMIENTO50');
            expect(lanzamiento?.getTime()).toBe(EXPECTED_EXPIRES_AT.getTime());

            expect(await readPromoCodeExpiresAt(tx, 'BIENVENIDO30')).toBeNull();
        });
    });
});
