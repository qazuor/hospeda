/**
 * HOS-39 T-003 — Real-DB integration test for the backfill UPDATE in
 * `0045_add_plan_typed_attribute_columns_backfill.sql`.
 *
 * The typed columns (`display_name`/`monthly_price_ars`/`annual_price_ars`)
 * are added by migration 0044 (HOS-73, qzpay-drizzle 1.11.0 promotion) with
 * blank/zero placeholder defaults ('' / 0 / null) — that migration does not
 * backfill real values. This test exercises 0045's UPDATE statement in
 * isolation (extracted from the migration file, stripping its leading SQL
 * comment block) against fixture rows that simulate the pre-backfill state
 * — a row inserted without the typed columns explicitly set, which lands on
 * the DB defaults exactly as a real pre-migration row would have.
 *
 * Scenarios covered:
 *   - displayName/monthlyPriceArs/annualPriceArs backfilled from metadata
 *     when present (the common case for every plan seeded to date).
 *   - monthlyPriceArs/annualPriceArs fall back to the operational
 *     `billing_prices.unitAmount` when the metadata mirror is absent.
 *   - monthlyPriceArs falls back to 0 (never NULL) when neither metadata
 *     nor a billing_prices row exists.
 *   - annualPriceArs stays NULL when the plan has no annual price at all.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { billingPlans, billingPrices } from '../../src/billing/index.ts';
import type { QZPayBillingPlanInsert } from '../../src/billing/index.ts';
import { closeTestPool, getTestDb, withCleanSlate } from './helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATION_PATH = join(
    __dirname,
    '../../src/migrations/0045_add_plan_typed_attribute_columns_backfill.sql'
);

/** Reads the migration file and returns only its backfill UPDATE statement. */
async function readBackfillStatement(): Promise<string> {
    const content = await readFile(MIGRATION_PATH, 'utf-8');
    const statements = content.split('--> statement-breakpoint');
    const updateStatement = statements
        .map((s) => s.replace(/^(\s*--[^\n]*\n)+/, ''))
        .find((s) => s.trim().toUpperCase().startsWith('UPDATE'));
    if (!updateStatement) {
        throw new Error('Backfill UPDATE statement not found in migration 0045');
    }
    return updateStatement;
}

/** Runs the migration's backfill UPDATE statement against the current DB state. */
async function applyBackfill(): Promise<void> {
    const db = getTestDb();
    const statement = await readBackfillStatement();
    await db.execute(sql.raw(statement));
}

/**
 * Minimal factory for a billing_plans insert row that omits the typed
 * columns entirely — landing on the DB defaults ('' / 0 / null), exactly
 * simulating a row as it existed right after the ADD COLUMN statements
 * ran and before the backfill UPDATE.
 */
function preBackfillPlanRow(
    overrides: Partial<QZPayBillingPlanInsert> & Pick<QZPayBillingPlanInsert, 'name'>
): QZPayBillingPlanInsert {
    return {
        entitlements: [],
        limits: {},
        livemode: false,
        ...overrides
    } as QZPayBillingPlanInsert;
}

/** Fetch a single plan's typed columns by name; throw if not found. */
async function fetchTypedColumns(name: string): Promise<{
    readonly displayName: string;
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number | null;
}> {
    const db = getTestDb();
    const rows = await db
        .select({
            displayName: billingPlans.displayName,
            monthlyPriceArs: billingPlans.monthlyPriceArs,
            annualPriceArs: billingPlans.annualPriceArs
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, name));

    const row = rows[0];
    if (!row) {
        throw new Error(`Plan row not found: ${name}`);
    }
    return row;
}

afterAll(async () => {
    await closeTestPool();
});

describe('HOS-39 T-003 — 0045_add_plan_typed_attribute_columns_backfill.sql backfill (real PostgreSQL)', () => {
    it('migration file exists and contains the expected UPDATE statement', async () => {
        const statement = await readBackfillStatement();
        expect(statement).toMatch(/billing_plans/i);
        expect(statement).toMatch(/display_name/i);
    });

    it('backfills displayName/monthlyPriceArs/annualPriceArs from metadata when present', async () => {
        await withCleanSlate(async () => {
            const db = getTestDb();
            await db.insert(billingPlans).values(
                preBackfillPlanRow({
                    name: 'owner-basico',
                    metadata: {
                        displayName: 'Básico',
                        monthlyPriceArs: 500000,
                        annualPriceArs: 5000000
                    }
                })
            );

            await applyBackfill();

            const row = await fetchTypedColumns('owner-basico');
            expect(row.displayName).toBe('Básico');
            expect(row.monthlyPriceArs).toBe(500000);
            expect(row.annualPriceArs).toBe(5000000);
        });
    });

    it('falls back to billing_prices.unitAmount when the metadata mirror is absent', async () => {
        await withCleanSlate(async () => {
            const db = getTestDb();
            const [plan] = await db
                .insert(billingPlans)
                .values(preBackfillPlanRow({ name: 'owner-premium', metadata: {} }))
                .returning();
            if (!plan) throw new Error('plan insert returned no row');

            await db.insert(billingPrices).values([
                {
                    planId: plan.id,
                    currency: 'ARS',
                    unitAmount: 750000,
                    billingInterval: 'month',
                    intervalCount: 1,
                    active: true,
                    livemode: false
                },
                {
                    planId: plan.id,
                    currency: 'ARS',
                    unitAmount: 7500000,
                    billingInterval: 'year',
                    intervalCount: 1,
                    active: true,
                    livemode: false
                }
            ]);

            await applyBackfill();

            const row = await fetchTypedColumns('owner-premium');
            expect(row.monthlyPriceArs).toBe(750000);
            expect(row.annualPriceArs).toBe(7500000);
        });
    });

    it('falls back to 0 for monthlyPriceArs when neither metadata nor billing_prices has a value', async () => {
        await withCleanSlate(async () => {
            const db = getTestDb();
            await db
                .insert(billingPlans)
                .values(preBackfillPlanRow({ name: 'no-price-plan', metadata: {} }));

            await applyBackfill();

            const row = await fetchTypedColumns('no-price-plan');
            expect(row.monthlyPriceArs).toBe(0);
        });
    });

    it('leaves annualPriceArs NULL when the plan has no annual price at all', async () => {
        await withCleanSlate(async () => {
            const db = getTestDb();
            await db.insert(billingPlans).values(
                preBackfillPlanRow({
                    name: 'tourist-free',
                    metadata: { displayName: 'Free', monthlyPriceArs: 0 }
                })
            );

            await applyBackfill();

            const row = await fetchTypedColumns('tourist-free');
            expect(row.annualPriceArs).toBeNull();
        });
    });

    it('falls back to plan.name for displayName when metadata.displayName is absent', async () => {
        await withCleanSlate(async () => {
            const db = getTestDb();
            await db
                .insert(billingPlans)
                .values(preBackfillPlanRow({ name: 'no-display-name', metadata: {} }));

            await applyBackfill();

            const row = await fetchTypedColumns('no-display-name');
            expect(row.displayName).toBe('no-display-name');
        });
    });
});
