/**
 * @fileoverview
 * Integration tests for `0050-hos-301-reprice-extra-accommodations-addon.ts` (HOS-301 D1).
 *
 * Modeled directly on `hos-301-reprice-owner-plans.integration.test.ts` (the
 * closest sibling, migration 0049) and
 * `raise-commerce-listing-price-to-15000.integration.test.ts`: runs against
 * the REAL worktree PostgreSQL database, using the same rollback-isolation
 * idiom established by `test-daily-plan-min-amount.integration.test.ts`.
 * Every test opens a `db.transaction()`, builds the migration's `ctx` with
 * the transaction-scoped client (`ctx.db = tx`), performs setup + `up()` +
 * assertions entirely inside that transaction, then unconditionally throws a
 * sentinel `RollbackSignal` so the real `billing_addons` rows in the shared
 * worktree database are never actually mutated by this suite.
 *
 * Because `extra-accommodations-5` is a `required`-group row that may already
 * exist on a given worktree/CI database (and, since this same branch's PR
 * also edited `addons.config.ts` to the NEW HOS-301 amount, a fresh
 * `db:fresh-dev` seed would insert it ALREADY at the new price), every test
 * explicitly drives the add-on row to a known starting state (old-placeholder,
 * already-converged, operator-overridden, or absent) inside its own
 * transaction rather than assuming any particular state.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { billingAddons, type DrizzleClient, eq, getDb, initializeDb, resetDb } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as repriceExtraAccommodationsAddon from '../../src/data-migrations/0050-hos-301-reprice-extra-accommodations-addon.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as raise-commerce-listing-price-to-15000.integration.test.ts:
// HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
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
    id: 'actor-stub-hos301-reprice-extra-accommodations-addon',
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

/** The `metadata.slug` this migration targets. */
const TARGET_SLUG = 'extra-accommodations-5';

/** The pre-D1 monthly price, in ARS centavos, this migration replaces. */
const OLD_PRICE_ARS = 1000000;

/** The D1-confirmed monthly price, in ARS centavos. */
const NEW_PRICE_ARS = 1300000;

/**
 * Inputs for {@link ensureAddonFixture}: the add-on's display `name`, stable
 * `metadata.slug`, and `unitAmount`, so a test can shape both the display
 * name and the identifier the migration actually matches on independently.
 */
interface AddonFixtureInput {
    readonly name: string;
    readonly slug: string;
    readonly unitAmount: number;
}

/**
 * Ensures a `billing_addons` row exists at `unitAmount` for the given
 * `(name, slug)` pair, updating it in place if a row with that `name` already
 * exists or inserting a fresh one otherwise. Returns the row id.
 *
 * Column layout mirrors `billingAddons.seed.ts`'s `ensureAddon()`, matching
 * what `addon-catalog.mapper.ts` expects to read back.
 */
async function ensureAddonFixture(tx: DrizzleClient, input: AddonFixtureInput): Promise<string> {
    const existing = await tx
        .select({ id: billingAddons.id })
        .from(billingAddons)
        .where(eq(billingAddons.name, input.name))
        .limit(1);

    const addonRow = existing[0];
    if (addonRow) {
        await tx
            .update(billingAddons)
            .set({
                unitAmount: input.unitAmount,
                metadata: { slug: input.slug }
            })
            .where(eq(billingAddons.id, addonRow.id));
        return addonRow.id;
    }

    const inserted = await tx
        .insert(billingAddons)
        .values({
            name: input.name,
            description: `Test fixture add-on for ${input.slug}`,
            active: true,
            unitAmount: input.unitAmount,
            currency: 'ARS',
            billingInterval: 'month',
            billingIntervalCount: 1,
            entitlements: [],
            limits: {},
            livemode: false,
            metadata: { slug: input.slug }
        })
        .returning({ id: billingAddons.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(`Insert of test-fixture add-on "${input.name}" returned no row`);
    }
    return insertedRow.id;
}

/**
 * Removes a `billing_addons` row by its display `name`, so a test can start
 * from a known "add-on does not exist" state. No-ops when absent.
 */
async function removeAddonFixture(tx: DrizzleClient, name: string): Promise<void> {
    await tx.delete(billingAddons).where(eq(billingAddons.name, name));
}

/** Reads back one `billing_addons` row's `unitAmount` by its display `name`. Returns `undefined` when absent. */
async function readAddonUnitAmount(tx: DrizzleClient, name: string): Promise<number | undefined> {
    const existing = await tx
        .select({ unitAmount: billingAddons.unitAmount })
        .from(billingAddons)
        .where(eq(billingAddons.name, name))
        .limit(1);

    return existing[0]?.unitAmount ?? undefined;
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

describe('0050-hos-301-reprice-extra-accommodations-addon', () => {
    it('raises the extra-accommodations-5 add-on from the old $10,000 ARS placeholder to $13,000 ARS', async () => {
        await withRollback(async (tx) => {
            await ensureAddonFixture(tx, {
                name: 'Extra Accommodations Pack (+5)',
                slug: TARGET_SLUG,
                unitAmount: OLD_PRICE_ARS
            });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceExtraAccommodationsAddon.up(ctx);

            expect(result.counts?.addonRowsUpdated).toBe(1);

            const unitAmount = await readAddonUnitAmount(tx, 'Extra Accommodations Pack (+5)');
            expect(unitAmount).toBe(NEW_PRICE_ARS);
        });
    });

    it('is idempotent: a second up() updates zero rows', async () => {
        await withRollback(async (tx) => {
            await ensureAddonFixture(tx, {
                name: 'Extra Accommodations Pack (+5)',
                slug: TARGET_SLUG,
                unitAmount: OLD_PRICE_ARS
            });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await repriceExtraAccommodationsAddon.up(ctx);
            expect(first.counts?.addonRowsUpdated).toBe(1);

            const second = await repriceExtraAccommodationsAddon.up(ctx);
            expect(second.counts?.addonRowsUpdated).toBe(0);

            const unitAmount = await readAddonUnitAmount(tx, 'Extra Accommodations Pack (+5)');
            expect(unitAmount).toBe(NEW_PRICE_ARS);
        });
    });

    it('preserves an operator-overridden price: up() leaves a non-placeholder value untouched', async () => {
        await withRollback(async (tx) => {
            await ensureAddonFixture(tx, {
                name: 'Extra Accommodations Pack (+5)',
                slug: TARGET_SLUG,
                unitAmount: 1100000
            });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceExtraAccommodationsAddon.up(ctx);

            expect(result.counts?.addonRowsUpdated).toBe(0);

            const unitAmount = await readAddonUnitAmount(tx, 'Extra Accommodations Pack (+5)');
            expect(unitAmount).toBe(1100000);
        });
    });

    it('is a no-op when the extra-accommodations-5 add-on does not exist yet on this environment', async () => {
        await withRollback(async (tx) => {
            await removeAddonFixture(tx, 'Extra Accommodations Pack (+5)');

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceExtraAccommodationsAddon.up(ctx);

            expect(result.counts?.addonRowsUpdated).toBe(0);
            expect(result.summary).toContain(TARGET_SLUG);
        });
    });

    it('does not touch a sibling add-on that shares the old $10,000 amount but has a different slug', async () => {
        await withRollback(async (tx) => {
            await ensureAddonFixture(tx, {
                name: 'Extra Accommodations Pack (+5)',
                slug: TARGET_SLUG,
                unitAmount: OLD_PRICE_ARS
            });
            // Sibling add-on: baseline price is 500000, but this fixture
            // deliberately sets it to the SAME 1000000 amount the target
            // migration guards on, under a DIFFERENT slug. If the migration's
            // WHERE clause only matched on `unitAmount` (not `metadata.slug`),
            // this row would be converged too — proving the slug predicate,
            // not the amount, is what selects the target row.
            await ensureAddonFixture(tx, {
                name: 'Extra Photos Pack (+20 photos)',
                slug: 'extra-photos-20',
                unitAmount: OLD_PRICE_ARS
            });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceExtraAccommodationsAddon.up(ctx);

            expect(result.counts?.addonRowsUpdated).toBe(1);

            const targetAmount = await readAddonUnitAmount(tx, 'Extra Accommodations Pack (+5)');
            expect(targetAmount).toBe(NEW_PRICE_ARS);

            const siblingAmount = await readAddonUnitAmount(tx, 'Extra Photos Pack (+20 photos)');
            expect(siblingAmount).toBe(OLD_PRICE_ARS);
        });
    });

    it('matches the row by metadata.slug, not by the display name', async () => {
        await withRollback(async (tx) => {
            // Display name diverges from the config's canonical
            // "Extra Accommodations Pack (+5)" — e.g. an operator renamed it
            // through the admin add-on catalog. The migration's WHERE clause
            // matches on `metadata->>'slug'`, not `name`, so this must still
            // converge.
            await ensureAddonFixture(tx, {
                name: 'Renamed Extra Accommodations Add-on',
                slug: TARGET_SLUG,
                unitAmount: OLD_PRICE_ARS
            });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceExtraAccommodationsAddon.up(ctx);

            expect(result.counts?.addonRowsUpdated).toBe(1);

            const unitAmount = await readAddonUnitAmount(tx, 'Renamed Extra Accommodations Add-on');
            expect(unitAmount).toBe(NEW_PRICE_ARS);
        });
    });
});
