/**
 * @fileoverview
 * Integration tests for `0071-hos-818-commerce-sellable-tier-basico.ts`.
 *
 * Runs against the real PostgreSQL database provisioned for `@repo/seed`'s
 * integration suite, with every test inside a transaction that is
 * unconditionally rolled back.
 *
 * A mocked DB cannot prove what matters here. The migration's sellability gate
 * is an emergent property of THREE queries whose `WHERE` clauses have to
 * disagree in exactly the right way — the promotion's OR-PRESERVE guard, the
 * price lookup, and the retirement. A stub would only replay whatever the test
 * author assumed about them, which is the assumption under test.
 *
 * The anchor case is the gap this file exists for: a `*-basico` sitting at
 * `active = false` with a NON-ZERO `monthly_price_ars` (an operator who priced
 * it from the admin editor without enabling it) falls between the promotion's
 * guard (which requires the price to still be 0) and the price step (which only
 * serves active plans). Retiring its premium anyway would leave that vertical
 * with NO sellable plan, surfacing only as `NO_MONTHLY_PRICE` on a real buyer's
 * first attempt — the commerce checkout has no `PLAN_DISABLED` guard to catch it
 * earlier.
 *
 * ## Why this file seeds its own plan rows
 *
 * The integration `globalSetup` seeds `ALL_PLANS` only, and the commerce
 * catalogues are deliberately EXCLUDED from that list (they are isolated by
 * `product_domain`, not by the plan list). So the four rows this migration
 * targets do not exist in the ephemeral database, and it also never seeds
 * `billing_prices`, which is precisely what the sellability gate turns on.
 * Every test therefore materializes its own fixture inside the rolled-back
 * transaction instead of assuming a seeded row.
 *
 * @module test/data-migrations/0071-hos-818-commerce-sellable-tier-basico.integration
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    and,
    billingPlans,
    billingPrices,
    type DrizzleClient,
    eq,
    getDb,
    initializeDb,
    resetDb
} from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0071-hos-818-commerce-sellable-tier-basico.js';
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
    id: 'actor-stub-hos-818-commerce-sellable-tier-basico',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

const GASTRONOMY_BASICO = 'gastronomy-basico';
const GASTRONOMY_PREMIUM = 'gastronomy-premium';
const EXPERIENCE_BASICO = 'experience-basico';
const EXPERIENCE_PREMIUM = 'experience-premium';

const SELLABLE_PRICE_ARS = 1_500_000;

interface Vertical {
    readonly basico: string;
    readonly premium: string;
    readonly domain: string;
}

const GASTRONOMY: Vertical = {
    basico: GASTRONOMY_BASICO,
    premium: GASTRONOMY_PREMIUM,
    domain: 'gastronomy'
};
const EXPERIENCE: Vertical = {
    basico: EXPERIENCE_BASICO,
    premium: EXPERIENCE_PREMIUM,
    domain: 'experience'
};

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

interface PlanRow {
    readonly id: string;
    readonly name: string;
    readonly active: boolean;
    readonly monthlyPriceArs: number | null;
}

async function readPlan(tx: DrizzleClient, slug: string): Promise<PlanRow> {
    const rows = await tx
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            active: billingPlans.active,
            monthlyPriceArs: billingPlans.monthlyPriceArs
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new Error(
            `Expected a billing_plans row named "${slug}" — the arrange step should have created it.`
        );
    }
    return row;
}

/**
 * Materialize (or force) one commerce plan row into a known starting state.
 *
 * Upsert-by-name rather than a plain insert: the ephemeral integration DB has
 * no commerce plans at all, while a developer pointing this suite at a seeded
 * database does. Both must reach the same starting state.
 */
async function ensurePlan(
    tx: DrizzleClient,
    slug: string,
    state: {
        active: boolean;
        monthlyPriceArs: number;
        productDomain: string;
    }
): Promise<string> {
    const existing = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const existingId = existing[0]?.id;
    if (existingId) {
        await tx
            .update(billingPlans)
            .set({
                active: state.active,
                monthlyPriceArs: state.monthlyPriceArs,
                productDomain: state.productDomain
            })
            .where(eq(billingPlans.id, existingId));
        return existingId;
    }

    const inserted = await tx
        .insert(billingPlans)
        .values({
            name: slug,
            description: `Test fixture for ${slug} (HOS-818 integration).`,
            displayName: slug,
            active: state.active,
            entitlements: [],
            limits: {},
            livemode: false,
            monthlyPriceArs: state.monthlyPriceArs,
            productDomain: state.productDomain,
            metadata: { slug, displayName: slug }
        })
        .returning({ id: billingPlans.id });

    const insertedId = inserted[0]?.id;
    if (!insertedId) {
        throw new Error(`Insert of test plan "${slug}" returned no row`);
    }
    return insertedId;
}

/** Drop the monthly ARS price row, so "unpriced tier" is a fact and not a hope. */
async function clearMonthlyPrice(tx: DrizzleClient, planId: string): Promise<void> {
    await tx
        .delete(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planId),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, 'month'),
                eq(billingPrices.intervalCount, 1)
            )
        );
}

async function countActiveMonthlyPrices(tx: DrizzleClient, planId: string): Promise<number> {
    const rows = await tx
        .select({ id: billingPrices.id })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planId),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, 'month'),
                eq(billingPrices.intervalCount, 1),
                eq(billingPrices.active, true)
            )
        );
    return rows.length;
}

/** Put one vertical at the exact pre-HOS-818 baseline: basico off + unpriced. */
async function arrangeBaseline(tx: DrizzleClient, vertical: Vertical): Promise<void> {
    const basicoId = await ensurePlan(tx, vertical.basico, {
        active: false,
        monthlyPriceArs: 0,
        productDomain: vertical.domain
    });
    await clearMonthlyPrice(tx, basicoId);
    await ensurePlan(tx, vertical.premium, {
        active: true,
        monthlyPriceArs: SELLABLE_PRICE_ARS,
        productDomain: vertical.domain
    });
}

/**
 * Put one vertical into the state that used to fall through every net: priced
 * by an operator, but never enabled.
 */
async function arrangePricedButInactive(tx: DrizzleClient, vertical: Vertical): Promise<void> {
    const basicoId = await ensurePlan(tx, vertical.basico, {
        active: false,
        monthlyPriceArs: SELLABLE_PRICE_ARS,
        productDomain: vertical.domain
    });
    await clearMonthlyPrice(tx, basicoId);
    await ensurePlan(tx, vertical.premium, {
        active: true,
        monthlyPriceArs: SELLABLE_PRICE_ARS,
        productDomain: vertical.domain
    });
}

let pool: Pool;

beforeAll(() => {
    if (!process.env.HOSPEDA_DATABASE_URL) {
        throw new Error(
            'HOSPEDA_DATABASE_URL is not set — is the API local env file present in this worktree?'
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

describe('0071-hos-818-commerce-sellable-tier-basico', () => {
    it('retires the premium tier once the basic one is active and priced (happy path)', async () => {
        await withRollback(async (tx) => {
            await arrangeBaseline(tx, GASTRONOMY);
            await arrangeBaseline(tx, EXPERIENCE);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await migration.up(ctx);

            const gastronomyBasico = await readPlan(tx, GASTRONOMY_BASICO);
            const experienceBasico = await readPlan(tx, EXPERIENCE_BASICO);

            expect(gastronomyBasico.active).toBe(true);
            expect(gastronomyBasico.monthlyPriceArs).toBe(SELLABLE_PRICE_ARS);
            expect(experienceBasico.active).toBe(true);

            // The price row the seed skips while a tier is unpriced. Without it
            // the plan is active and STILL unsellable (NO_MONTHLY_PRICE).
            expect(await countActiveMonthlyPrices(tx, gastronomyBasico.id)).toBe(1);
            expect(await countActiveMonthlyPrices(tx, experienceBasico.id)).toBe(1);

            expect((await readPlan(tx, GASTRONOMY_PREMIUM)).active).toBe(false);
            expect((await readPlan(tx, EXPERIENCE_PREMIUM)).active).toBe(false);

            expect(result.counts?.verticalsBlocked).toBe(0);
        });
    });

    it('LEAVES the premium tier active when its basic counterpart is priced but never enabled', async () => {
        // The regression this file exists for. Both verticals in the gap state:
        // OR-PRESERVE declines to promote (price is no longer 0) and the price
        // step declines to serve them (plan is not active). Before the gate, the
        // retirement fired anyway and both verticals lost every sellable plan.
        await withRollback(async (tx) => {
            await arrangePricedButInactive(tx, GASTRONOMY);
            await arrangePricedButInactive(tx, EXPERIENCE);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await migration.up(ctx);

            // The operator's edit is preserved — that half was always correct.
            expect((await readPlan(tx, GASTRONOMY_BASICO)).active).toBe(false);
            expect((await readPlan(tx, EXPERIENCE_BASICO)).active).toBe(false);

            // ...and therefore the premium tier MUST still be selling.
            expect((await readPlan(tx, GASTRONOMY_PREMIUM)).active).toBe(true);
            expect((await readPlan(tx, EXPERIENCE_PREMIUM)).active).toBe(true);

            expect(result.counts?.plansRetired).toBe(0);
            expect(result.counts?.verticalsBlocked).toBe(2);

            // An operator has to be able to LEARN that a vertical was skipped:
            // the environment is half-migrated and only they can decide the fix.
            expect(result.summary).toContain(GASTRONOMY_PREMIUM);
            expect(result.summary).toContain(EXPERIENCE_PREMIUM);
            expect(result.summary).toContain('ATTENTION');
        });
    });

    it('decides per vertical: a blocked gastronomy does not hold back experience', async () => {
        // The reason the whole sequence loops per pair instead of running four
        // catalogue-wide statements.
        await withRollback(async (tx) => {
            await arrangePricedButInactive(tx, GASTRONOMY);
            await arrangeBaseline(tx, EXPERIENCE);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await migration.up(ctx);

            // Gastronomy: untouched, still selling premium.
            expect((await readPlan(tx, GASTRONOMY_BASICO)).active).toBe(false);
            expect((await readPlan(tx, GASTRONOMY_PREMIUM)).active).toBe(true);

            // Experience: fully migrated.
            const experienceBasico = await readPlan(tx, EXPERIENCE_BASICO);
            expect(experienceBasico.active).toBe(true);
            expect(await countActiveMonthlyPrices(tx, experienceBasico.id)).toBe(1);
            expect((await readPlan(tx, EXPERIENCE_PREMIUM)).active).toBe(false);

            expect(result.counts?.plansRetired).toBe(1);
            expect(result.counts?.verticalsBlocked).toBe(1);
            expect(result.summary).toContain(GASTRONOMY_PREMIUM);
            expect(result.summary).not.toContain(`${EXPERIENCE_PREMIUM}: left ACTIVE`);
        });
    });

    it('is a no-op on a second run (already retiered)', async () => {
        await withRollback(async (tx) => {
            await arrangeBaseline(tx, GASTRONOMY);
            await arrangeBaseline(tx, EXPERIENCE);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            await migration.up(ctx);
            const second = await migration.up(ctx);

            expect(second.counts?.plansPromoted).toBe(0);
            expect(second.counts?.pricesCreated).toBe(0);
            expect(second.counts?.plansRetired).toBe(0);
            // Already-migrated is not "blocked": both basico plans are active
            // and priced, so the gate passes and simply finds nothing to retire.
            expect(second.counts?.verticalsBlocked).toBe(0);
        });
    });
});
