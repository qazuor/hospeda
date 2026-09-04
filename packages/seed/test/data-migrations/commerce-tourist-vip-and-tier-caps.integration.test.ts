/**
 * @fileoverview
 * Integration tests for `0094-hos-975-commerce-tourist-vip-and-tier-caps.ts`.
 *
 * Runs against the REAL worktree PostgreSQL database using the rollback
 * isolation idiom this directory established: every test opens a
 * `db.transaction()`, builds the migration's `ctx` with the transaction-scoped
 * client, runs setup + `up()` + assertions inside it, then throws a sentinel
 * `RollbackSignal` so the shared worktree database is never actually mutated.
 *
 * ## Why this migration in particular needs a test
 *
 * It is the ONLY path by which HOS-975's two deltas reach staging and
 * production — `ensureCommercePlan` inserts only, so the baseline edit in
 * `plans.config.ts` reaches a fresh `db:fresh` and nothing else. A migration
 * that is never executed is a promise, and this carril has already shipped one
 * that ran in 18ms, reported `ok` and moved zero rows (HOS-433).
 *
 * The five cases below are the five decisions the migration makes, one test
 * each — not five variations of the happy path:
 *
 * 1. it applies the delta to a row in the state every environment is in today;
 * 2. it is idempotent, because the runner may re-run it;
 * 3. it does NOT overwrite a cap an operator moved (limit values are a
 *    `'commercial'` field: the database wins), while still applying the rest;
 * 4. it is a clean NO-OP on a database with no commerce plans at all;
 * 5. it CREATES a missing lookup row rather than leaving a dangling grant.
 *
 * Case 4 was added after CI caught it: this was the only one of the 94
 * migrations that threw against the schema-but-no-seed database
 * `cli-data-migrate.integration.test.ts` runs the whole ledger against.
 *
 * Case 3 is the one worth writing carefully. The migration deliberately
 * breaks `0093`'s "write only when the key is absent" rule — it has to, because
 * the cap key is already present at `1` on all six rows and "only when absent"
 * would move nothing. Scoping the overwrite to the seeded value is what keeps
 * that exception narrow, and this test is what proves the scope holds.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    billingEntitlements,
    billingPlans,
    eq,
    getDb,
    inArray,
    initializeDb,
    resetDb
} from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as touristVipAndCaps from '../../src/data-migrations/0094-hos-975-commerce-tourist-vip-and-tier-caps.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Sentinel thrown to force a rollback without surfacing as a real failure. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

/** Stub actor — this migration only uses `ctx.db`. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos975-commerce-tourist-vip',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * A sample of the 15 keys, not the whole list.
 *
 * Asserting all 15 here would just restate the migration's own constant back to
 * itself. These three are picked because each one would fail differently:
 * `save_favorites` is the plainest tourist key, `vip_support` is the one the
 * audit flagged as costing real money, and `can_contact_whatsapp_display` is
 * the one that also appears in the H1 matrix at `TIER: basic` — i.e. the key
 * most likely to be granted twice by a future edit.
 */
const SAMPLE_VIP_KEYS = ['save_favorites', 'vip_support', 'can_contact_whatsapp_display'] as const;

/**
 * All 15, needed only to guarantee the lookup rows exist before each test.
 *
 * This list is a PRECONDITION helper, not an assertion — the assertions use
 * `SAMPLE_VIP_KEYS`. Restating the migration's own constant as an expectation
 * would make the test agree with the code by construction.
 */
const ALL_VIP_KEYS = [
    'save_favorites',
    'write_reviews',
    'read_reviews',
    'price_alerts',
    'exclusive_deals',
    'vip_support',
    'vip_visibility_access',
    'vip_promotions_access',
    'can_compare_accommodations',
    'can_attach_review_photos',
    'can_view_search_history',
    'can_view_recommendations',
    'can_contact_whatsapp_display',
    'can_contact_whatsapp_direct',
    'can_use_collections'
] as const;

/** The cap key/value pair this suite drives, and the tier that owns it. */
const PRO_PLAN_NAME = 'gastronomy-pro';
const CAP_KEY = 'max_gastronomies';
const SEEDED_CAP = 1;
const RAISED_CAP = 3;

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
 * Ensures every tourist-VIP lookup row the migration checks for exists.
 *
 * The migration CREATES a missing row itself, so this helper is not what makes
 * it work — it is what keeps the other assertions honest. Without it, a
 * database seeded from a narrower baseline would have the migration report
 * `entitlementsCreated: 14` in tests that are about caps and grants, and the
 * one test that IS about creating a row would prove nothing, since it could no
 * longer isolate the single row it deletes. Inserted inside the transaction, so
 * the rollback removes whatever this added.
 *
 * @param tx - Transaction-scoped client.
 */
async function ensureVipLookupRows(tx: DrizzleClient): Promise<void> {
    for (const key of ALL_VIP_KEYS) {
        const existing = await tx
            .select({ id: billingEntitlements.id })
            .from(billingEntitlements)
            .where(eq(billingEntitlements.key, key))
            .limit(1);

        if (existing.length === 0) {
            await tx
                .insert(billingEntitlements)
                .values({ key, name: key, description: `Test fixture row for ${key}` });
        }
    }
}

/**
 * Drives one commerce plan row to the pre-migration state every environment is
 * in today: the seeded cap, its own AI-chat quota, and no tourist-VIP key of
 * either kind.
 *
 * Creates the row when absent rather than demanding a pre-seeded database —
 * the same choice `raise-commerce-listing-price-to-15000.integration.test.ts`
 * makes, and for the same reason: a worktree database is cloned from a template
 * that may predate these plans, and a test that only runs on a freshly seeded
 * database is a test that quietly stops running. It is also an explicit RESET
 * rather than "assume the row is untouched", because the migration may already
 * have been applied here by a previous `db:seed:migrate`.
 *
 * @param tx - Transaction-scoped client.
 * @param planName - The plan row's `name` column.
 * @param cap - The listing cap to leave the row at.
 * @returns The row's id.
 */
async function resetPlanToPreMigrationState(
    tx: DrizzleClient,
    planName: string,
    cap: number
): Promise<string> {
    // Only the vertical's own trio — the shape every commerce row had before
    // HOS-975 D-A.
    const preMigrationEntitlements = [
        'edit_gastronomy_info',
        'publish_gastronomy',
        'view_basic_stats'
    ];
    const preMigrationLimits = { [CAP_KEY]: cap, max_ai_chat_gastronomy_per_month: 0 };

    const rows = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, planName))
        .limit(1);

    const row = rows[0];
    if (row) {
        await tx
            .update(billingPlans)
            .set({ entitlements: preMigrationEntitlements, limits: preMigrationLimits })
            .where(eq(billingPlans.id, row.id));
        return row.id;
    }

    const inserted = await tx
        .insert(billingPlans)
        .values({
            name: planName,
            description: 'Test fixture row for HOS-975 migration tests.',
            active: true,
            entitlements: preMigrationEntitlements,
            limits: preMigrationLimits,
            livemode: true,
            displayName: planName,
            monthlyPriceArs: 6_500_000,
            annualPriceArs: null
        })
        .returning({ id: billingPlans.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(`Insert of test-fixture plan "${planName}" returned no row`);
    }
    return insertedRow.id;
}

/**
 * Reads one plan row's two JSON columns back.
 *
 * @param tx - Transaction-scoped client.
 * @param planId - The row id.
 * @returns Its entitlements array and limits object.
 */
async function readPlan(
    tx: DrizzleClient,
    planId: string
): Promise<{ entitlements: string[]; limits: Record<string, number> }> {
    const rows = await tx
        .select({ entitlements: billingPlans.entitlements, limits: billingPlans.limits })
        .from(billingPlans)
        .where(eq(billingPlans.id, planId))
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new Error(`Plan row ${planId} vanished mid-test`);
    }

    return {
        entitlements: Array.isArray(row.entitlements) ? (row.entitlements as string[]) : [],
        limits:
            row.limits && typeof row.limits === 'object'
                ? (row.limits as Record<string, number>)
                : {}
    };
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

describe('0094-hos-975-commerce-tourist-vip-and-tier-caps', () => {
    it('grants the tourist-VIP block, writes its limits, and raises the tier cap', async () => {
        await withRollback(async (tx) => {
            await ensureVipLookupRows(tx);
            const planId = await resetPlanToPreMigrationState(tx, PRO_PLAN_NAME, SEEDED_CAP);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await touristVipAndCaps.up(ctx);

            const after = await readPlan(tx, planId);

            for (const key of SAMPLE_VIP_KEYS) {
                expect(after.entitlements).toContain(key);
            }
            // The vertical's own keys survive the union — the migration appends,
            // it never rewrites the array to its own list.
            expect(after.entitlements).toContain('edit_gastronomy_info');
            expect(after.entitlements).toContain('publish_gastronomy');

            // The limits half, which is the one that fails OPEN if skipped.
            expect(after.limits.max_ai_search_per_month).toBe(200);
            expect(after.limits.max_collections).toBe(25);
            expect(after.limits.max_favorites).toBe(-1);

            // The cap actually moved. This is the assertion that would have
            // caught a migration written to `0093`'s "only when absent" rule.
            expect(after.limits[CAP_KEY]).toBe(RAISED_CAP);

            // And the row's own AI-chat quota is untouched at its explicit zero
            // — an additive write must not clobber a neighbouring key.
            expect(after.limits.max_ai_chat_gastronomy_per_month).toBe(0);

            expect(result.summary).toContain('HOS-975');
        });
    });

    it('is idempotent — a second run changes nothing', async () => {
        await withRollback(async (tx) => {
            await ensureVipLookupRows(tx);
            const planId = await resetPlanToPreMigrationState(tx, PRO_PLAN_NAME, SEEDED_CAP);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            await touristVipAndCaps.up(ctx);
            const afterFirst = await readPlan(tx, planId);

            const second = await touristVipAndCaps.up(ctx);
            const afterSecond = await readPlan(tx, planId);

            expect(afterSecond).toEqual(afterFirst);
            // Not merely "the row is unchanged": the migration must also REPORT
            // that it changed nothing, because the summary is what an operator
            // reads to decide whether the deploy did anything.
            expect(second.summary).toContain('no change');
            // No key was granted twice by the union.
            expect(afterSecond.entitlements).toHaveLength(new Set(afterSecond.entitlements).size);
        });
    });

    it("leaves an operator's own cap alone while still applying the rest", async () => {
        await withRollback(async (tx) => {
            await ensureVipLookupRows(tx);
            // An operator raised this tier to 7 through the SPEC-168 admin
            // editor. Limit values are a 'commercial' field, so their number
            // wins over the config's — but that must not cost them the D-A
            // grant, which is a capability decision they never made.
            const OPERATOR_CAP = 7;
            const planId = await resetPlanToPreMigrationState(tx, PRO_PLAN_NAME, OPERATOR_CAP);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            await touristVipAndCaps.up(ctx);

            const after = await readPlan(tx, planId);

            expect(after.limits[CAP_KEY]).toBe(OPERATOR_CAP);
            expect(after.limits[CAP_KEY]).not.toBe(RAISED_CAP);
            // The grant and the tourist-VIP limits still landed.
            expect(after.entitlements).toContain('save_favorites');
            expect(after.limits.max_ai_search_per_month).toBe(200);
        });
    });

    it('is a clean no-op on a database with no commerce plan rows', async () => {
        // The case CI found and this suite did not have. `cli-data-migrate`
        // runs the entire ledger against a database carrying the schema and no
        // seed, where there are neither commerce plans NOR
        // `billing_entitlements` rows. With the lookup check running first,
        // this was the only one of the 94 migrations that threw there.
        //
        // Deliberately does NOT call `ensureVipLookupRows`: the point is that a
        // database missing BOTH still gets a clean pass, because a dangling
        // grant cannot exist when there is nothing to grant to.
        await withRollback(async (tx) => {
            await tx
                .delete(billingPlans)
                .where(
                    inArray(billingPlans.name, [
                        'gastronomy-basico',
                        'gastronomy-pro',
                        'gastronomy-premium',
                        'experience-basico',
                        'experience-pro',
                        'experience-premium'
                    ])
                );

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await touristVipAndCaps.up(ctx);

            expect(result.summary).toContain('no commerce plan rows');
        });
    });

    it('creates a missing lookup row rather than leaving a dangling grant', async () => {
        await withRollback(async (tx) => {
            await ensureVipLookupRows(tx);
            const planId = await resetPlanToPreMigrationState(tx, PRO_PLAN_NAME, SEEDED_CAP);

            // Remove one lookup row. A grant naming a key with no
            // `billing_entitlements` row resolves to nothing, and the failure
            // would surface as "the feature does not work" long after the
            // deploy that caused it.
            //
            // This is not a hypothetical: `cli-data-migrate.integration.test.ts`
            // builds a database with the commerce PLAN rows present and 14 of
            // these 15 lookup rows absent, because the documented run order
            // (db:migrate → db:apply-extras → db:seed:migrate) does not include
            // the required seed that fills `billing_entitlements`.
            await tx.delete(billingEntitlements).where(eq(billingEntitlements.key, 'vip_support'));

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await touristVipAndCaps.up(ctx);

            const recreated = await tx
                .select({ key: billingEntitlements.key })
                .from(billingEntitlements)
                .where(eq(billingEntitlements.key, 'vip_support'));

            expect(recreated).toHaveLength(1);
            expect(result.counts?.entitlementsCreated).toBe(1);

            // And the grant landed on the plan, which is the point of creating
            // the row at all.
            const after = await readPlan(tx, planId);
            expect(after.entitlements).toContain('vip_support');
        });
    });
});
