/**
 * Integration tests: SPEC-262 promo-code effect migration (extras/018, 019, 020)
 *
 * Covers:
 * 1. Backfill idempotency (020 run twice → 0 rows changed on second run).
 * 2. Legacy code preservation (AC-4.1): a pre-migration row gets correct
 *    effect_kind / value_kind / duration_cycles after the 020 backfill.
 * 3. CHECK constraint violations (AC-1.2/1.3): rows that violate the 020
 *    constraints are rejected at the DB level.
 *
 * Uses `withCleanSlate` (TRUNCATE-based) because the 020 DO $$ block commits
 * its writes as part of its own implicit statement — a rollback-only
 * transaction cannot observe mid-block changes.
 *
 * Mirrors the harness from accommodation-media-backfill.integration.test.ts:
 * same imports, same connection helper, same assertion style.
 *
 * Runs via:
 *   pnpm --filter @repo/db test:integration
 * (requires a running test PostgreSQL — see packages/db/CLAUDE.md)
 *
 * Each `it` uses `it.skipIf(!DB_AVAILABLE)` following the project-wide pattern
 * (consistent with jsonb-merge.test.ts and event-destination-fk.test.ts).
 * When HOSPEDA_TEST_DATABASE_URL is absent (e.g. outside the integration runner),
 * all tests are skipped with a clear message.
 *
 * @module test/integration/promo-code-effect-migration
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { billingPromoCodes } from '../../src/billing/index.ts';
import { setDb } from '../../src/client.ts';
import { closeTestPool, getTestDb, withCleanSlate } from './helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Paths to the three extras files under test
// ---------------------------------------------------------------------------

/** Path to 018: adds effect_kind / value_kind / duration_cycles / extra_days */
const SQL_018 = join(
    __dirname,
    '../../src/migrations/extras/018-billing-promo-codes-effect-columns.column.sql'
);

/** Path to 019: adds promo_effect_remaining_cycles on billing_subscriptions */
const SQL_019 = join(
    __dirname,
    '../../src/migrations/extras/019-billing-subscriptions-promo-effect-columns.column.sql'
);

/** Path to 020: backfill + CHECK constraints */
const SQL_020 = join(
    __dirname,
    '../../src/migrations/extras/020-promo-code-effect-constraints-backfill.sql'
);

// ---------------------------------------------------------------------------
// DB availability guard.
// Pattern matches jsonb-merge.test.ts and event-destination-fk.test.ts:
//   it.skipIf(!DB_AVAILABLE)('name', async () => { ... })
// The globalSetup injects HOSPEDA_TEST_DATABASE_URL when invoked via
//   pnpm --filter @repo/db test:integration
// ---------------------------------------------------------------------------
const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Execute an arbitrary SQL file against the test DB (raw pass-through). */
async function runSqlFile(filePath: string): Promise<void> {
    const db = getTestDb();
    const content = await readFile(filePath, 'utf-8');
    await db.execute(sql.raw(content));
}

/**
 * Apply the extras 018 + 019 + 020 files in order.
 * Mirrors how `pnpm db:apply-extras` applies them (lexical order).
 * All three are idempotent, so calling this multiple times is safe.
 */
async function applyExtras(): Promise<void> {
    await runSqlFile(SQL_018);
    await runSqlFile(SQL_019);
    await runSqlFile(SQL_020);
}

/**
 * Apply only the 020 backfill + constraints file.
 * Used to test second-run idempotency independently of column addition.
 */
async function applyBackfillOnly(): Promise<void> {
    await runSqlFile(SQL_020);
}

/** Minimal valid promo code row using the raw QZPay `billing_promo_codes` table. */
function promoCodeFixture(
    overrides: Partial<typeof billingPromoCodes.$inferInsert> = {}
): typeof billingPromoCodes.$inferInsert {
    return {
        id: crypto.randomUUID(),
        code: `TEST-${crypto.randomUUID().slice(0, 8)}`,
        type: 'percentage',
        value: 20,
        active: true,
        maxUses: null,
        usedCount: 0,
        livemode: false,
        ...overrides
    } as typeof billingPromoCodes.$inferInsert;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
    // Wire the module-level getDb() to the ephemeral test pool (same pattern
    // as accommodation-media-backfill and spec-064 integration tests).
    if (DB_AVAILABLE) {
        setDb(getTestDb());
    }
});

afterAll(async () => {
    if (DB_AVAILABLE) {
        await closeTestPool();
    }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('020-promo-code-effect-constraints-backfill — SPEC-262 T-013', () => {
    /**
     * AC-4.1 (backfill) — a legacy percentage row (pre-migration shape) is
     * correctly populated by the 020 backfill.
     *
     * Pre-migration shape: type='percentage', value=30, effect columns absent
     * or at their DEFAULT ('discount' / NULL / NULL / NULL).
     * Post-backfill expected: effect_kind='discount', value_kind='percentage',
     * duration_cycles=1, extra_days=NULL, value=30 (unchanged).
     */
    it.skipIf(!DB_AVAILABLE)(
        'AC-4.1 legacy percentage row is backfilled correctly (effect_kind=discount, value_kind=percentage, duration_cycles=1)',
        async () => {
            await withCleanSlate(async (db) => {
                // Arrange — insert a legacy row WITHOUT setting the new columns.
                // After 018 adds the columns, effect_kind defaults to 'discount'
                // and value_kind / duration_cycles / extra_days default to NULL.
                const row = promoCodeFixture({ type: 'percentage', value: 30 });
                await db.insert(billingPromoCodes).values(row);

                // Apply all extras (018 ensures columns exist, 020 backfills).
                await applyExtras();

                // Assert — read the extras-carril columns via raw SQL (they are
                // not part of the Drizzle $inferSelect schema owned by QZPay).
                const result = await db.execute(
                    sql`SELECT effect_kind, value_kind, duration_cycles, extra_days, value
                        FROM billing_promo_codes
                        WHERE id = ${row.id}`
                );
                const r = result.rows[0] as Record<string, unknown>;

                expect(r?.effect_kind).toBe('discount');
                expect(r?.value_kind).toBe('percentage');
                expect(r?.duration_cycles).toBe(1);
                expect(r?.extra_days).toBeNull();
                expect(Number(r?.value)).toBe(30); // original value preserved
            });
        }
    );

    /**
     * AC-4.1 (backfill) — HOSPEDA_FREE (comp) is re-classified correctly.
     *
     * Pre-migration shape: type='percentage', value=100 (seeded discount).
     * Post-backfill expected: effect_kind='comp', value_kind=NULL,
     * duration_cycles=NULL, extra_days=NULL, value=100 (not reset per spec note).
     */
    it.skipIf(!DB_AVAILABLE)(
        'AC-4.1 HOSPEDA_FREE backfilled to effect_kind=comp with all params NULL',
        async () => {
            await withCleanSlate(async (db) => {
                // Arrange — insert a HOSPEDA_FREE row in legacy shape.
                const row = promoCodeFixture({
                    code: 'HOSPEDA_FREE',
                    type: 'percentage',
                    value: 100
                });
                await db.insert(billingPromoCodes).values(row);

                await applyExtras();

                const result = await db.execute(
                    sql`SELECT effect_kind, value_kind, duration_cycles, extra_days
                        FROM billing_promo_codes
                        WHERE code = 'HOSPEDA_FREE'`
                );
                const r = result.rows[0] as Record<string, unknown>;

                expect(r?.effect_kind).toBe('comp');
                expect(r?.value_kind).toBeNull();
                expect(r?.duration_cycles).toBeNull();
                expect(r?.extra_days).toBeNull();
            });
        }
    );

    /**
     * Backfill idempotency — running 020 a second time on already-backfilled
     * rows must change 0 rows (the WHERE guards in 020 prevent re-processing).
     *
     * Strategy: apply extras once (backfills the row), capture values, apply
     * 020 again, assert values are identical.
     */
    it.skipIf(!DB_AVAILABLE)(
        'backfill idempotency — second run produces 0 additional changes',
        async () => {
            await withCleanSlate(async (db) => {
                // Arrange — insert a row and run the full extras once.
                const row = promoCodeFixture({ type: 'percentage', value: 15 });
                await db.insert(billingPromoCodes).values(row);
                await applyExtras();

                // Capture after first run.
                const afterFirst = await db.execute(
                    sql`SELECT effect_kind, value_kind, duration_cycles, extra_days
                        FROM billing_promo_codes
                        WHERE id = ${row.id}`
                );
                const firstRun = afterFirst.rows[0] as Record<string, unknown>;

                // Act — run 020 again (idempotency pass).
                await applyBackfillOnly();

                // Assert — values are identical after the second run.
                const afterSecond = await db.execute(
                    sql`SELECT effect_kind, value_kind, duration_cycles, extra_days
                        FROM billing_promo_codes
                        WHERE id = ${row.id}`
                );
                const secondRun = afterSecond.rows[0] as Record<string, unknown>;

                expect(secondRun?.effect_kind).toBe(firstRun?.effect_kind);
                expect(secondRun?.value_kind).toBe(firstRun?.value_kind);
                expect(secondRun?.duration_cycles).toBe(firstRun?.duration_cycles);
                expect(secondRun?.extra_days).toBe(firstRun?.extra_days);
            });
        }
    );

    // -------------------------------------------------------------------------
    // CHECK constraint violations (AC-1.2 / AC-1.3)
    //
    // Constraints defined in 020:
    //
    // 2a. billing_promo_codes_discount_shape_chk:
    //     effect_kind='discount' → value IS NOT NULL AND value >= 0
    //     AND (COALESCE(value_kind, type) <> 'percentage' OR value <= 100)
    //
    // 2b. billing_promo_codes_trial_ext_shape_chk:
    //     effect_kind='trial_extension' → extra_days IS NOT NULL AND extra_days > 0
    //     AND value_kind IS NULL
    //
    // 2c. billing_promo_codes_comp_shape_chk:
    //     effect_kind='comp' → value_kind IS NULL AND extra_days IS NULL
    //     AND duration_cycles IS NULL
    //
    // 2d. billing_promo_codes_duration_positive_chk:
    //     duration_cycles IS NULL OR duration_cycles > 0
    //
    // 2e. billing_promo_codes_effect_kind_domain_chk:
    //     effect_kind IN ('discount', 'trial_extension', 'comp')
    //
    // 2f. billing_promo_codes_value_kind_domain_chk:
    //     value_kind IS NULL OR value_kind IN ('percentage', 'fixed')
    //
    // Violations tested:
    //   - percentage discount with value > 100 → violates 2a
    //   - comp effect with extra_days set → violates 2c
    //   - trial_extension with NULL extra_days → violates 2b
    //   - unknown effect_kind → violates 2e
    //   - duration_cycles = 0 → violates 2d
    //
    // Case NOT enforced by 020 (noted for spec accuracy):
    //   - discount with value_kind='percentage' but value=0 IS allowed (value >= 0,
    //     not value > 0; a 0% discount is a valid edge case the DB accepts).
    // -------------------------------------------------------------------------

    /**
     * AC-1.2 — percentage discount > 100 is rejected (2a).
     *
     * COALESCE(value_kind, type) = 'percentage', value = 101 > 100 → violation.
     */
    it.skipIf(!DB_AVAILABLE)(
        'CHECK constraint: percentage discount with value > 100 is rejected (AC-1.2)',
        async () => {
            await withCleanSlate(async (db) => {
                // Ensure constraints exist.
                await applyExtras();

                await expect(
                    db.execute(
                        sql`INSERT INTO billing_promo_codes
                                (id, code, type, value, active, used_count, livemode,
                                 effect_kind, value_kind, duration_cycles)
                            VALUES
                                (${crypto.randomUUID()}, ${'OVER100'}, ${'percentage'}, ${101},
                                 ${true}, ${0}, ${false}, ${'discount'}, ${'percentage'}, ${1})`
                    )
                ).rejects.toThrow();
            });
        }
    );

    /**
     * AC-1.2 — comp effect with extra_days set is rejected (2c).
     *
     * comp → extra_days IS NULL required.
     * extra_days = 7 violates billing_promo_codes_comp_shape_chk.
     */
    it.skipIf(!DB_AVAILABLE)(
        'CHECK constraint: comp effect with extra_days set is rejected (AC-1.2)',
        async () => {
            await withCleanSlate(async (db) => {
                await applyExtras();

                await expect(
                    db.execute(
                        sql`INSERT INTO billing_promo_codes
                                (id, code, type, value, active, used_count, livemode,
                                 effect_kind, value_kind, duration_cycles, extra_days)
                            VALUES
                                (${crypto.randomUUID()}, ${'COMP_BADEXTRA'}, ${'percentage'}, ${100},
                                 ${true}, ${0}, ${false}, ${'comp'}, ${null}, ${null}, ${7})`
                    )
                ).rejects.toThrow();
            });
        }
    );

    /**
     * AC-1.3 — trial_extension with NULL extra_days is rejected (2b).
     *
     * trial_extension → extra_days IS NOT NULL AND extra_days > 0.
     * extra_days = NULL violates billing_promo_codes_trial_ext_shape_chk.
     */
    it.skipIf(!DB_AVAILABLE)(
        'CHECK constraint: trial_extension with NULL extra_days is rejected (AC-1.3)',
        async () => {
            await withCleanSlate(async (db) => {
                await applyExtras();

                await expect(
                    db.execute(
                        sql`INSERT INTO billing_promo_codes
                                (id, code, type, value, active, used_count, livemode,
                                 effect_kind, value_kind, duration_cycles, extra_days)
                            VALUES
                                (${crypto.randomUUID()}, ${'TRIAL_NODAYS'}, ${'percentage'}, ${0},
                                 ${true}, ${0}, ${false}, ${'trial_extension'}, ${null}, ${null}, ${null})`
                    )
                ).rejects.toThrow();
            });
        }
    );

    /**
     * 2e — unknown effect_kind value is rejected.
     *
     * billing_promo_codes_effect_kind_domain_chk only allows
     * 'discount' | 'trial_extension' | 'comp'.
     */
    it.skipIf(!DB_AVAILABLE)(
        'CHECK constraint: unknown effect_kind is rejected (2e domain constraint)',
        async () => {
            await withCleanSlate(async (db) => {
                await applyExtras();

                await expect(
                    db.execute(
                        sql`INSERT INTO billing_promo_codes
                                (id, code, type, value, active, used_count, livemode, effect_kind)
                            VALUES
                                (${crypto.randomUUID()}, ${'BAD_KIND'}, ${'percentage'}, ${10},
                                 ${true}, ${0}, ${false}, ${'unknown_kind'})`
                    )
                ).rejects.toThrow();
            });
        }
    );

    /**
     * 2d — duration_cycles = 0 is rejected.
     *
     * billing_promo_codes_duration_positive_chk: duration_cycles IS NULL OR > 0.
     * Zero is not a valid finite cycle count.
     */
    it.skipIf(!DB_AVAILABLE)(
        'CHECK constraint: duration_cycles = 0 is rejected (2d positivity constraint)',
        async () => {
            await withCleanSlate(async (db) => {
                await applyExtras();

                await expect(
                    db.execute(
                        sql`INSERT INTO billing_promo_codes
                                (id, code, type, value, active, used_count, livemode,
                                 effect_kind, value_kind, duration_cycles)
                            VALUES
                                (${crypto.randomUUID()}, ${'ZERO_CYCLES'}, ${'percentage'}, ${10},
                                 ${true}, ${0}, ${false}, ${'discount'}, ${'percentage'}, ${0})`
                    )
                ).rejects.toThrow();
            });
        }
    );

    // -------------------------------------------------------------------------
    // Happy-path sanity tests (confirm constraints not overly restrictive)
    // -------------------------------------------------------------------------

    /** Valid discount row (percentage, value=50, cycles=3) is accepted. */
    it.skipIf(!DB_AVAILABLE)(
        'happy path: valid discount row (percentage, value=50, cycles=3) is accepted',
        async () => {
            await withCleanSlate(async (db) => {
                await applyExtras();

                const id = crypto.randomUUID();
                // Should NOT throw.
                await db.execute(
                    sql`INSERT INTO billing_promo_codes
                            (id, code, type, value, active, used_count, livemode,
                             effect_kind, value_kind, duration_cycles)
                        VALUES
                            (${id}, ${'VALID50'}, ${'percentage'}, ${50},
                             ${true}, ${0}, ${false}, ${'discount'}, ${'percentage'}, ${3})`
                );

                const result = await db.execute(
                    sql`SELECT effect_kind, value_kind, duration_cycles
                        FROM billing_promo_codes WHERE id = ${id}`
                );
                const r = result.rows[0] as Record<string, unknown>;
                expect(r?.effect_kind).toBe('discount');
                expect(r?.value_kind).toBe('percentage');
                expect(r?.duration_cycles).toBe(3);
            });
        }
    );

    /** Valid comp row (all params NULL) is accepted. */
    it.skipIf(!DB_AVAILABLE)(
        'happy path: valid comp row (all params NULL) is accepted',
        async () => {
            await withCleanSlate(async (db) => {
                await applyExtras();

                const id = crypto.randomUUID();
                await db.execute(
                    sql`INSERT INTO billing_promo_codes
                            (id, code, type, value, active, used_count, livemode,
                             effect_kind, value_kind, duration_cycles, extra_days)
                        VALUES
                            (${id}, ${'COMP_VALID'}, ${'percentage'}, ${100},
                             ${true}, ${0}, ${false}, ${'comp'}, ${null}, ${null}, ${null})`
                );

                const result = await db.execute(
                    sql`SELECT effect_kind, value_kind, duration_cycles, extra_days
                        FROM billing_promo_codes WHERE id = ${id}`
                );
                const r = result.rows[0] as Record<string, unknown>;
                expect(r?.effect_kind).toBe('comp');
                expect(r?.value_kind).toBeNull();
                expect(r?.duration_cycles).toBeNull();
                expect(r?.extra_days).toBeNull();
            });
        }
    );

    /** Valid trial_extension row (extra_days=30, value_kind=NULL) is accepted. */
    it.skipIf(!DB_AVAILABLE)(
        'happy path: valid trial_extension row (extra_days=30) is accepted',
        async () => {
            await withCleanSlate(async (db) => {
                await applyExtras();

                const id = crypto.randomUUID();
                await db.execute(
                    sql`INSERT INTO billing_promo_codes
                            (id, code, type, value, active, used_count, livemode,
                             effect_kind, value_kind, duration_cycles, extra_days)
                        VALUES
                            (${id}, ${'TRIAL_VALID'}, ${'percentage'}, ${0},
                             ${true}, ${0}, ${false}, ${'trial_extension'}, ${null}, ${null}, ${30})`
                );

                const result = await db.execute(
                    sql`SELECT effect_kind, extra_days
                        FROM billing_promo_codes WHERE id = ${id}`
                );
                const r = result.rows[0] as Record<string, unknown>;
                expect(r?.effect_kind).toBe('trial_extension');
                expect(r?.extra_days).toBe(30);
            });
        }
    );
});
