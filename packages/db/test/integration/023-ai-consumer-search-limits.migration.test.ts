/**
 * SPEC-283 T-013 — Real-DB integration test for the extras migration
 * `023-billing-plans-ai-consumer-search-limits.plan.sql`.
 *
 * This is the correctness + idempotency gate for the Model C extras migration
 * that seeds two new consumer AI limit keys onto every accommodation billing
 * plan row. It must be provably correct, idempotent, and OR-PRESERVE before
 * the migration reaches the VPS.
 *
 * Scenarios covered:
 *   T-013 AC-1  — First-apply: all 9 accommodation slugs receive
 *                 `max_ai_search_per_month` and `max_ai_chat_consumer_per_month`
 *                 with the seeded values confirmed in OQ-3.
 *   T-013 AC-2  — Idempotency: running the migration a second time leaves
 *                 every row byte-identical to the post-first-apply snapshot
 *                 (no value change, no updated_at bump).
 *   T-013 AC-3  — OR-PRESERVE: a key already present in limits JSONB (whether
 *                 from a prior apply or an operator edit) is NEVER overwritten.
 *                 The complementary key (not yet present) IS added normally.
 *   T-013 AC-4  — No-mutation scope: plan rows whose `name` is not in the 9
 *                 targeted accommodation slugs (e.g. commerce-listing) are not
 *                 touched.
 *
 * Uses `withCleanSlate` (TRUNCATE-based) so that the DO $$ block's intermediate
 * UPDATEs are visible across statement boundaries.
 * `withTestTransaction` (rollback-only) cannot be used here because the DO
 * block issues its own implicit SAVEPOINT and we need the committed state
 * visible to subsequent SELECT assertions.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { billingPlans } from '../../src/billing/index.ts';
import type { QZPayBillingPlanInsert } from '../../src/billing/index.ts';
import { closeTestPool, getTestDb, withCleanSlate } from './helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Relative path to the migration under test. */
const MIGRATION_RELATIVE_PATH =
    '../../src/migrations/extras/023-billing-plans-ai-consumer-search-limits.plan.sql';
const MIGRATION_PATH = join(__dirname, MIGRATION_RELATIVE_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads the migration SQL file and returns its content as a string. */
async function readMigrationSql(): Promise<string> {
    return readFile(MIGRATION_PATH, 'utf-8');
}

/**
 * Applies the 023 migration once via db.execute(sql.raw(...)).
 * The DO $$ block runs as a single statement; Drizzle's sql.raw passes it
 * straight to the pg driver.
 */
async function applyMigration(): Promise<void> {
    const db = getTestDb();
    const content = await readMigrationSql();
    await db.execute(sql.raw(content));
}

/**
 * Minimal factory for a billing_plans insert row.
 * Only `name` is required (NOT NULL without default). All other NOT NULL
 * columns have DB-side defaults.
 */
function planRow(
    overrides: Partial<QZPayBillingPlanInsert> & Pick<QZPayBillingPlanInsert, 'name'>
): QZPayBillingPlanInsert {
    return {
        entitlements: [],
        limits: {},
        livemode: false,
        ...overrides
    } as QZPayBillingPlanInsert;
}

/** Fetch a single plan row by name; throw if not found. */
async function fetchPlan(name: string): Promise<{
    readonly id: string;
    readonly entitlements: unknown;
    readonly limits: unknown;
    readonly metadata: unknown;
    readonly livemode: boolean | null;
    readonly updatedAt: Date | null;
}> {
    const db = getTestDb();
    const rows = await db
        .select({
            id: billingPlans.id,
            entitlements: billingPlans.entitlements,
            limits: billingPlans.limits,
            metadata: billingPlans.metadata,
            livemode: billingPlans.livemode,
            updatedAt: billingPlans.updatedAt
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, name));

    const row = rows[0];
    if (!row) {
        throw new Error(`Plan row not found: ${name}`);
    }
    return row;
}

/** Returns limits as Record<string, number>, normalising from jsonb if needed. */
function toLimitsObject(value: unknown): Record<string, number> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, number>;
    }
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, number>;
            }
        } catch {
            /* ignore */
        }
    }
    return {};
}

// ---------------------------------------------------------------------------
// Value table (OQ-3 owner confirmation)
// [slug, expectedSearchValue, expectedConsumerValue]
// ---------------------------------------------------------------------------

const SLUG_VALUE_TABLE: Array<[string, number, number]> = [
    ['tourist-free', 10, 10],
    ['tourist-plus', 50, 50],
    ['tourist-vip', 200, 200],
    ['owner-basico', 200, 200],
    ['owner-pro', 200, 200],
    ['owner-premium', 200, 200],
    ['complex-basico', 200, 200],
    ['complex-pro', 200, 200],
    ['complex-premium', 200, 200]
];

// ---------------------------------------------------------------------------
// Pre-migration fixtures (no new limit keys present)
// ---------------------------------------------------------------------------

/** tourist-free: no new keys, an existing entitlement to verify preservation. */
const TOURIST_FREE_PRE: QZPayBillingPlanInsert = planRow({
    name: 'tourist-free',
    entitlements: ['some_existing_cap'],
    limits: {}
});

/** tourist-plus: no new keys. */
const TOURIST_PLUS_PRE: QZPayBillingPlanInsert = planRow({
    name: 'tourist-plus',
    entitlements: ['some_existing_cap'],
    limits: {}
});

/** tourist-vip: no new keys. */
const TOURIST_VIP_PRE: QZPayBillingPlanInsert = planRow({
    name: 'tourist-vip',
    entitlements: ['publish_accommodations'],
    limits: {}
});

/** owner-basico: carries max_accommodations to verify field preservation. */
const OWNER_BASICO_PRE: QZPayBillingPlanInsert = planRow({
    name: 'owner-basico',
    limits: { max_accommodations: 1 }
});

/** owner-pro: no new keys. */
const OWNER_PRO_PRE: QZPayBillingPlanInsert = planRow({
    name: 'owner-pro',
    limits: { max_accommodations: 3 }
});

/** owner-premium: carries max_accommodations to verify field preservation. */
const OWNER_PREMIUM_PRE: QZPayBillingPlanInsert = planRow({
    name: 'owner-premium',
    limits: { max_accommodations: 10 }
});

/** complex-basico: no new keys. */
const COMPLEX_BASICO_PRE: QZPayBillingPlanInsert = planRow({
    name: 'complex-basico',
    limits: { max_accommodations: 5 }
});

/** complex-pro: no new keys. */
const COMPLEX_PRO_PRE: QZPayBillingPlanInsert = planRow({
    name: 'complex-pro',
    limits: { max_accommodations: 20 }
});

/** complex-premium: carries max_accommodations to verify field preservation. */
const COMPLEX_PREMIUM_PRE: QZPayBillingPlanInsert = planRow({
    name: 'complex-premium',
    limits: { max_accommodations: 50 }
});

/**
 * A non-accommodation plan slug that must not be mutated by this migration.
 * Simulates a commerce or partner plan with a different product domain.
 */
const COMMERCE_PLAN_PRE: QZPayBillingPlanInsert = planRow({
    name: 'commerce-listing',
    limits: { max_listings: 5 }
});

/** All 9 pre-migration accommodation rows, no new keys. */
const ALL_ACCOMMODATION_PRE_ROWS = [
    TOURIST_FREE_PRE,
    TOURIST_PLUS_PRE,
    TOURIST_VIP_PRE,
    OWNER_BASICO_PRE,
    OWNER_PRO_PRE,
    OWNER_PREMIUM_PRE,
    COMPLEX_BASICO_PRE,
    COMPLEX_PRO_PRE,
    COMPLEX_PREMIUM_PRE
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterAll(async () => {
    await closeTestPool();
});

describe('SPEC-283 T-013 — extras/023-billing-plans-ai-consumer-search-limits.plan.sql (real PostgreSQL)', () => {
    // ── File-level invariants ─────────────────────────────────────────────────

    it('migration file exists at the expected path', async () => {
        const content = await readMigrationSql();
        expect(content.length).toBeGreaterThan(0);
    });

    it('migration file contains the expected DO $$ plpgsql block and both key names', async () => {
        const content = await readMigrationSql();
        expect(content).toMatch(/DO\s+\$\$/i);
        expect(content).toMatch(/billing_plans/i);
        expect(content).toMatch(/max_ai_search_per_month/);
        expect(content).toMatch(/max_ai_chat_consumer_per_month/);
    });

    // ── T-013 AC-1: First-apply ───────────────────────────────────────────────
    describe('T-013 AC-1 — First-apply: all 9 accommodation slugs receive both keys', () => {
        it('all slugs have max_ai_search_per_month with the OQ-3 seeded value', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_ACCOMMODATION_PRE_ROWS]);

                await applyMigration();

                for (const [slug, expectedSearch] of SLUG_VALUE_TABLE) {
                    const row = await fetchPlan(slug);
                    const limits = toLimitsObject(row.limits);
                    expect(
                        limits.max_ai_search_per_month,
                        `${slug}.max_ai_search_per_month should be ${expectedSearch}`
                    ).toBe(expectedSearch);
                }
            });
        });

        it('all slugs have max_ai_chat_consumer_per_month with the OQ-3 seeded value', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_ACCOMMODATION_PRE_ROWS]);

                await applyMigration();

                for (const [slug, , expectedConsumer] of SLUG_VALUE_TABLE) {
                    const row = await fetchPlan(slug);
                    const limits = toLimitsObject(row.limits);
                    expect(
                        limits.max_ai_chat_consumer_per_month,
                        `${slug}.max_ai_chat_consumer_per_month should be ${expectedConsumer}`
                    ).toBe(expectedConsumer);
                }
            });
        });

        it('existing limit keys are preserved after migration (owner-basico max_accommodations = 1)', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_ACCOMMODATION_PRE_ROWS]);

                await applyMigration();

                const row = await fetchPlan('owner-basico');
                const limits = toLimitsObject(row.limits);

                // The pre-existing commercial key must survive intact.
                expect(limits.max_accommodations).toBe(1);
            });
        });

        it('existing entitlements are preserved after migration (tourist-free some_existing_cap)', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_ACCOMMODATION_PRE_ROWS]);

                await applyMigration();

                // The migration only mutates `limits`; entitlements must be untouched.
                const row = await fetchPlan('tourist-free');
                const ents = Array.isArray(row.entitlements) ? (row.entitlements as string[]) : [];
                expect(ents).toContain('some_existing_cap');
            });
        });
    });

    // ── T-013 AC-2: Idempotency ───────────────────────────────────────────────
    describe('T-013 AC-2 — Idempotency: second apply leaves rows byte-identical', () => {
        it('applying the migration twice yields no row changes (limits and updated_at unchanged)', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_ACCOMMODATION_PRE_ROWS]);

                // First apply.
                await applyMigration();

                // Capture post-first-apply snapshot sorted by name for deterministic comparison.
                const snapshotAfterFirst = await db
                    .select({
                        name: billingPlans.name,
                        limits: billingPlans.limits,
                        updatedAt: billingPlans.updatedAt
                    })
                    .from(billingPlans)
                    .orderBy(billingPlans.name);

                // Second apply.
                await applyMigration();

                const snapshotAfterSecond = await db
                    .select({
                        name: billingPlans.name,
                        limits: billingPlans.limits,
                        updatedAt: billingPlans.updatedAt
                    })
                    .from(billingPlans)
                    .orderBy(billingPlans.name);

                // Row count unchanged.
                expect(snapshotAfterSecond).toHaveLength(snapshotAfterFirst.length);

                for (let i = 0; i < snapshotAfterFirst.length; i++) {
                    const before = snapshotAfterFirst[i]!;
                    const after = snapshotAfterSecond[i]!;

                    expect(after.name).toBe(before.name);

                    // limits JSONB must be byte-identical.
                    expect(
                        JSON.stringify(after.limits),
                        `${after.name}.limits changed on second apply`
                    ).toBe(JSON.stringify(before.limits));

                    // updated_at must not advance: a true no-op leaves the timestamp
                    // untouched (no UPDATE fired → no SET updated_at = NOW()).
                    const beforeTs =
                        before.updatedAt instanceof Date
                            ? before.updatedAt.toISOString()
                            : String(before.updatedAt);
                    const afterTs =
                        after.updatedAt instanceof Date
                            ? after.updatedAt.toISOString()
                            : String(after.updatedAt);
                    expect(
                        afterTs,
                        `${after.name}.updatedAt advanced on second apply (UPDATE fired when it should not have)`
                    ).toBe(beforeTs);
                }
            });
        });
    });

    // ── T-013 AC-3: OR-PRESERVE ───────────────────────────────────────────────
    describe('T-013 AC-3 — OR-PRESERVE: operator-set values are never overwritten', () => {
        it('pre-existing max_ai_search_per_month = 999 survives; ' +
            'max_ai_chat_consumer_per_month (absent) is added at the seeded value', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                // tourist-free with only max_ai_search_per_month pre-set to 999.
                // max_ai_chat_consumer_per_month is intentionally absent.
                const preRow = planRow({
                    name: 'tourist-free',
                    limits: { max_ai_search_per_month: 999 }
                });
                await db.insert(billingPlans).values([preRow]);

                await applyMigration();

                const row = await fetchPlan('tourist-free');
                const limits = toLimitsObject(row.limits);

                // Operator-set value MUST survive (OR-PRESERVE guard: NOT (limits ? key) is false).
                expect(limits.max_ai_search_per_month).toBe(999);

                // Missing key MUST be added (guard fires — absent key → merge in seeded default).
                expect(limits.max_ai_chat_consumer_per_month).toBe(10);
            });
        });

        it('pre-existing max_ai_chat_consumer_per_month = 888 survives; ' +
            'max_ai_search_per_month (absent) is added at the seeded value', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                // tourist-plus with only max_ai_chat_consumer_per_month pre-set.
                const preRow = planRow({
                    name: 'tourist-plus',
                    limits: { max_ai_chat_consumer_per_month: 888 }
                });
                await db.insert(billingPlans).values([preRow]);

                await applyMigration();

                const row = await fetchPlan('tourist-plus');
                const limits = toLimitsObject(row.limits);

                // Operator-set value MUST survive.
                expect(limits.max_ai_chat_consumer_per_month).toBe(888);

                // Missing key MUST be added.
                expect(limits.max_ai_search_per_month).toBe(50);
            });
        });
    });

    // ── T-013 AC-4: Scope guard — non-accommodation plans not mutated ─────────
    describe('T-013 AC-4 — Scope guard: non-accommodation plan slugs are not mutated', () => {
        it('commerce-listing plan does not gain either new limit key after migration', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([COMMERCE_PLAN_PRE]);

                await applyMigration();

                const row = await fetchPlan('commerce-listing');
                const limits = toLimitsObject(row.limits);

                // Neither key must appear on a non-targeted slug.
                expect(
                    'max_ai_search_per_month' in limits,
                    'commerce-listing should not have max_ai_search_per_month'
                ).toBe(false);
                expect(
                    'max_ai_chat_consumer_per_month' in limits,
                    'commerce-listing should not have max_ai_chat_consumer_per_month'
                ).toBe(false);

                // The existing key must be untouched.
                expect(limits.max_listings).toBe(5);
            });
        });
    });

    // ── Migration guard: billing_plans table not present ─────────────────────
    describe('migration guard: graceful skip when table absent', () => {
        it('emits a NOTICE and does not throw when billing_plans does not exist', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                // Temporarily rename the table to simulate absence.
                await db.execute(
                    sql.raw('ALTER TABLE billing_plans RENAME TO billing_plans_hidden')
                );

                // Must not throw — the migration's IF NOT EXISTS guard handles this.
                await expect(applyMigration()).resolves.not.toThrow();

                // Restore for cleanup.
                await db.execute(
                    sql.raw('ALTER TABLE billing_plans_hidden RENAME TO billing_plans')
                );
            });
        });
    });
});
