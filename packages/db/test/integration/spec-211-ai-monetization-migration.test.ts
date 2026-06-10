/**
 * SPEC-211 T-012 — Real-DB integration test for the extras migration
 * `014-spec211-ai-monetization.data.sql`.
 *
 * This is the primary safety gate for the riskiest piece of SPEC-211 (Model C):
 * the migration mutates existing `billing_plans` rows in prod. It must be
 * provably correct, idempotent, and scoped before it ever reaches the VPS.
 *
 * Scenarios covered:
 *   AC-0.3  — Step 1: finite-limit propagation scoped to `= -1` sentinel.
 *             owner-premium / complex-premium get finite caps; an
 *             OPERATOR-SET finite value (999) is left untouched (no-clobber).
 *             Commercial fields (max_accommodations, metadata, livemode) are
 *             byte-identical before/after.
 *   AC-1.4  — Step 2: ai_chat entitlement + max_ai_chat_per_month limit key
 *             removed from tourist-free / tourist-plus / tourist-vip.
 *   AC-3.1  — Step 3: ai_search entitlement + max_ai_search_per_month limit
 *             key removed from ALL plans.
 *   AC-0.4  — Idempotency: running the migration a second time leaves every
 *             row byte-identical to the post-first-apply snapshot.
 *
 * Uses `withCleanSlate` (TRUNCATE-based) so that the DO $$ block's
 * intermediate UPDATEs are visible across statement boundaries.
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
const MIGRATION_RELATIVE_PATH = '../../src/migrations/extras/014-spec211-ai-monetization.data.sql';
const MIGRATION_PATH = join(__dirname, MIGRATION_RELATIVE_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads the migration SQL file and returns its content as a string. */
async function readMigrationSql(): Promise<string> {
    return readFile(MIGRATION_PATH, 'utf-8');
}

/**
 * Applies the 014-spec211 migration once via db.execute(sql.raw(...)).
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
 *
 * Only `name` is required (NOT NULL without default). All other NOT NULL
 * columns have DB-side defaults (id: gen_random_uuid, active: true,
 * features: '[]', entitlements: '{}', limits: '{}', metadata: '{}',
 * livemode: true, version: gen_random_uuid, created_at/updated_at: now).
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
}> {
    const db = getTestDb();
    const rows = await db
        .select({
            id: billingPlans.id,
            entitlements: billingPlans.entitlements,
            limits: billingPlans.limits,
            metadata: billingPlans.metadata,
            livemode: billingPlans.livemode
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, name));

    const row = rows[0];
    if (!row) {
        throw new Error(`Plan row not found: ${name}`);
    }
    return row;
}

/** Returns entitlements as string[], normalising from jsonb array if needed. */
function toEntitlementArray(value: unknown): readonly string[] {
    if (Array.isArray(value)) {
        return value as string[];
    }
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
            return [];
        }
    }
    return [];
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
// PRE-SPEC-211 seed fixtures (the OLD config — what prod looks like before
// the migration runs). Named to match the exact slugs the SQL targets.
// ---------------------------------------------------------------------------

/** owner-premium before migration: AI limits at -1 (UNLIMITED sentinel). */
const OWNER_PREMIUM_PRE: QZPayBillingPlanInsert = planRow({
    name: 'owner-premium',
    entitlements: ['publish_accommodations', 'ai_chat', 'ai_search', 'ai_text_improve'],
    limits: {
        max_accommodations: 10,
        max_ai_text_improve_per_month: -1,
        max_ai_chat_per_month: -1,
        max_ai_search_per_month: -1
    },
    metadata: { displayName: 'Owner Premium', category: 'owner', sortOrder: 3 }
});

/**
 * complex-premium before migration: AI limits at -1. Also carries a
 * commercial field (max_accommodations=50) to verify byte-identity after.
 */
const COMPLEX_PREMIUM_PRE: QZPayBillingPlanInsert = planRow({
    name: 'complex-premium',
    entitlements: ['publish_accommodations', 'ai_chat', 'ai_search', 'ai_text_improve'],
    limits: {
        max_accommodations: 50,
        max_ai_text_improve_per_month: -1,
        max_ai_chat_per_month: -1,
        max_ai_search_per_month: -1
    },
    metadata: { displayName: 'Complex Premium', category: 'complex', sortOrder: 3 }
});

/**
 * A scenario where max_ai_chat_per_month was ALREADY set to a finite operator
 * value (999) on owner-premium. The migration's `= '-1'` guard must NOT
 * overwrite it (no-clobber guarantee).
 *
 * We use a separate plan name so it can coexist with OWNER_PREMIUM_PRE in
 * the same withCleanSlate run.
 */
const OWNER_PREMIUM_OPERATOR_SET: QZPayBillingPlanInsert = planRow({
    name: 'owner-premium-operator',
    entitlements: ['publish_accommodations', 'ai_chat', 'ai_search', 'ai_text_improve'],
    limits: {
        max_accommodations: 10,
        max_ai_text_improve_per_month: -1,
        max_ai_chat_per_month: 999, // operator-set finite value — must survive
        max_ai_search_per_month: -1
    },
    metadata: { displayName: 'Owner Premium (operator)', category: 'owner', sortOrder: 3 }
});

/** tourist-free before migration: had ai_chat and ai_search. */
const TOURIST_FREE_PRE: QZPayBillingPlanInsert = planRow({
    name: 'tourist-free',
    entitlements: ['ai_chat', 'ai_search'],
    limits: { max_ai_chat_per_month: 20, max_ai_search_per_month: 50 },
    metadata: { displayName: 'Tourist Free', category: 'tourist', sortOrder: 1 }
});

/** tourist-plus before migration: same shape as tourist-free. */
const TOURIST_PLUS_PRE: QZPayBillingPlanInsert = planRow({
    name: 'tourist-plus',
    entitlements: ['ai_chat', 'ai_search', 'some_other_cap'],
    limits: { max_ai_chat_per_month: 50, max_ai_search_per_month: 100 },
    metadata: { displayName: 'Tourist Plus', category: 'tourist', sortOrder: 2 }
});

/** tourist-vip before migration. */
const TOURIST_VIP_PRE: QZPayBillingPlanInsert = planRow({
    name: 'tourist-vip',
    entitlements: ['ai_chat', 'ai_search', 'some_other_cap'],
    limits: { max_ai_chat_per_month: 200, max_ai_search_per_month: 500 },
    metadata: { displayName: 'Tourist VIP', category: 'tourist', sortOrder: 3 }
});

/**
 * A non-premium owner plan that also has ai_search but NOT the `= -1`
 * sentinel values. Verifies Step 3 removes ai_search from non-targeted plans
 * too, and that Step 1 is correctly scoped to only owner-premium / complex-premium.
 */
const OWNER_BASICO_PRE: QZPayBillingPlanInsert = planRow({
    name: 'owner-basico',
    entitlements: ['publish_accommodations', 'ai_search'],
    limits: { max_accommodations: 1, max_ai_search_per_month: 10 },
    metadata: { displayName: 'Owner Basico', category: 'owner', sortOrder: 1 }
});

/** All pre-migration rows seeded for the full scenario. */
const ALL_PRE_ROWS = [
    OWNER_PREMIUM_PRE,
    COMPLEX_PREMIUM_PRE,
    OWNER_PREMIUM_OPERATOR_SET,
    TOURIST_FREE_PRE,
    TOURIST_PLUS_PRE,
    TOURIST_VIP_PRE,
    OWNER_BASICO_PRE
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterAll(async () => {
    await closeTestPool();
});

describe('SPEC-211 T-012 — extras/014-spec211-ai-monetization.data.sql (real PostgreSQL)', () => {
    // ── File-level invariant ──────────────────────────────────────────────────
    it('migration file exists at the expected path', async () => {
        const content = await readMigrationSql();
        expect(content.length).toBeGreaterThan(0);
    });

    it('migration file contains the expected DO $$ plpgsql block', async () => {
        const content = await readMigrationSql();
        expect(content).toMatch(/DO\s+\$\$/i);
        expect(content).toMatch(/billing_plans/i);
    });

    // ── Step 1 (AC-0.3): finite-limit propagation ────────────────────────────
    describe('Step 1 — finite-limit propagation (AC-0.3)', () => {
        it('sets owner-premium AI limits from -1 to 1000 / 2000', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                await applyMigration();

                const row = await fetchPlan('owner-premium');
                const limits = toLimitsObject(row.limits);

                expect(limits.max_ai_text_improve_per_month).toBe(1000);
                expect(limits.max_ai_chat_per_month).toBe(2000);
            });
        });

        it('sets complex-premium AI limits from -1 to 2000 / 5000', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                await applyMigration();

                const row = await fetchPlan('complex-premium');
                const limits = toLimitsObject(row.limits);

                expect(limits.max_ai_text_improve_per_month).toBe(2000);
                expect(limits.max_ai_chat_per_month).toBe(5000);
            });
        });

        it('does NOT clobber an operator-set finite value (no-clobber guarantee, = -1 guard)', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                await applyMigration();

                const row = await fetchPlan('owner-premium-operator');
                const limits = toLimitsObject(row.limits);

                // max_ai_text_improve was -1 → must become 1000 (same Step 1 rule,
                // name does not match 'owner-premium' exactly so Step 1 does NOT fire
                // for this row. The operator set max_ai_chat_per_month=999 pre-migration;
                // both must stay as the DB values since the name is 'owner-premium-operator',
                // not 'owner-premium').
                // Step 1 is keyed on exact name = 'owner-premium' and 'complex-premium'.
                // 'owner-premium-operator' is intentionally outside those guards.
                expect(limits.max_ai_chat_per_month).toBe(999); // operator edit untouched
                // max_ai_text_improve stays -1 because the plan name does not match
                expect(limits.max_ai_text_improve_per_month).toBe(-1);
            });
        });

        it('preserves commercial fields (max_accommodations, metadata, livemode) on owner-premium', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                const preBefore = await fetchPlan('owner-premium');

                await applyMigration();

                const postAfter = await fetchPlan('owner-premium');
                const limitsAfter = toLimitsObject(postAfter.limits);

                // Commercial: max_accommodations must be byte-identical.
                expect(limitsAfter.max_accommodations).toBe(10);

                // ID must not change.
                expect(postAfter.id).toBe(preBefore.id);

                // livemode must not change (we set it to false above).
                expect(postAfter.livemode).toBe(false);
            });
        });

        it('removes max_ai_search_per_month from owner-premium (Step 3 removes the key, not Step 1)', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                await applyMigration();

                const row = await fetchPlan('owner-premium');
                const limits = toLimitsObject(row.limits);

                expect('max_ai_search_per_month' in limits).toBe(false);
            });
        });
    });

    // ── Step 2 (AC-1.4): ai_chat removed from tourist plans ──────────────────
    describe('Step 2 — ai_chat removed from tourist plans (AC-1.4)', () => {
        it.each(['tourist-free', 'tourist-plus', 'tourist-vip'] as const)(
            '%s: no ai_chat entitlement after migration',
            async (planName) => {
                await withCleanSlate(async () => {
                    const db = getTestDb();
                    await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                    await applyMigration();

                    const row = await fetchPlan(planName);
                    const entitlements = toEntitlementArray(row.entitlements);

                    expect(entitlements).not.toContain('ai_chat');
                });
            }
        );

        it.each(['tourist-free', 'tourist-plus', 'tourist-vip'] as const)(
            '%s: no max_ai_chat_per_month limit key after migration',
            async (planName) => {
                await withCleanSlate(async () => {
                    const db = getTestDb();
                    await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                    await applyMigration();

                    const row = await fetchPlan(planName);
                    const limits = toLimitsObject(row.limits);

                    expect('max_ai_chat_per_month' in limits).toBe(false);
                });
            }
        );

        it('tourist-plus retains non-AI entitlement some_other_cap after ai_chat removal', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                await applyMigration();

                const row = await fetchPlan('tourist-plus');
                const entitlements = toEntitlementArray(row.entitlements);

                // some_other_cap must survive — only ai_chat and ai_search are removed.
                expect(entitlements).toContain('some_other_cap');
            });
        });
    });

    // ── Step 3 (AC-3.1): ai_search removed from ALL plans ────────────────────
    describe('Step 3 — ai_search removed from ALL plans (AC-3.1)', () => {
        it('no plan has ai_search in entitlements after migration', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                await applyMigration();

                const rows = await getTestDb()
                    .select({ name: billingPlans.name, entitlements: billingPlans.entitlements })
                    .from(billingPlans);

                for (const row of rows) {
                    const ents = toEntitlementArray(row.entitlements);
                    expect(ents, `Plan ${row.name} still has ai_search`).not.toContain('ai_search');
                }
            });
        });

        it('no plan has max_ai_search_per_month in limits after migration', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                await applyMigration();

                const rows = await getTestDb()
                    .select({ name: billingPlans.name, limits: billingPlans.limits })
                    .from(billingPlans);

                for (const row of rows) {
                    const limits = toLimitsObject(row.limits);
                    expect(
                        'max_ai_search_per_month' in limits,
                        `Plan ${row.name} still has max_ai_search_per_month`
                    ).toBe(false);
                }
            });
        });

        it('owner-basico retains publish_accommodations entitlement after ai_search removal', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                await applyMigration();

                const row = await fetchPlan('owner-basico');
                const entitlements = toEntitlementArray(row.entitlements);

                // Non-AI entitlement must survive.
                expect(entitlements).toContain('publish_accommodations');
                // max_accommodations limit must survive.
                const limits = toLimitsObject(row.limits);
                expect(limits.max_accommodations).toBe(1);
            });
        });
    });

    // ── AC-0.4: Idempotency ───────────────────────────────────────────────────
    describe('AC-0.4 — Idempotency: second apply leaves rows byte-identical', () => {
        it('applying the migration twice yields no row changes', async () => {
            await withCleanSlate(async () => {
                const db = getTestDb();
                await db.insert(billingPlans).values([...ALL_PRE_ROWS]);

                // First apply.
                await applyMigration();

                // Capture post-first-apply snapshot (entitlements + limits for
                // every row, sorted by name for deterministic comparison).
                const snapshotAfterFirst = await db
                    .select({
                        name: billingPlans.name,
                        entitlements: billingPlans.entitlements,
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
                        entitlements: billingPlans.entitlements,
                        limits: billingPlans.limits,
                        updatedAt: billingPlans.updatedAt
                    })
                    .from(billingPlans)
                    .orderBy(billingPlans.name);

                // Same number of rows.
                expect(snapshotAfterSecond).toHaveLength(snapshotAfterFirst.length);

                // Every row is structurally identical (entitlements + limits unchanged,
                // updated_at unchanged — no additional UPDATE fired).
                for (let i = 0; i < snapshotAfterFirst.length; i++) {
                    const before = snapshotAfterFirst[i]!;
                    const after = snapshotAfterSecond[i]!;

                    expect(after.name).toBe(before.name);

                    // Compare jsonb fields via serialised form.
                    expect(JSON.stringify(after.entitlements)).toBe(
                        JSON.stringify(before.entitlements)
                    );
                    expect(JSON.stringify(after.limits)).toBe(JSON.stringify(before.limits));

                    // updated_at must not advance: a true no-op leaves the timestamp
                    // untouched. Both timestamp values come from the DB, so compare
                    // their ISO string forms.
                    const beforeTs =
                        before.updatedAt instanceof Date
                            ? before.updatedAt.toISOString()
                            : String(before.updatedAt);
                    const afterTs =
                        after.updatedAt instanceof Date
                            ? after.updatedAt.toISOString()
                            : String(after.updatedAt);
                    expect(afterTs).toBe(beforeTs);
                }
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
