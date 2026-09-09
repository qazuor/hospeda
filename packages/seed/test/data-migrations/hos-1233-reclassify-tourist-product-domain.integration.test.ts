/**
 * @fileoverview
 * Integration tests for `0103-hos-1233-reclassify-tourist-product-domain.ts` —
 * the data-migration that corrects the tourist rows whose `product_domain`
 * says `accommodation` because nothing ever wrote the column.
 *
 * Runs against the REAL worktree PostgreSQL database, using the
 * transaction-rollback isolation idiom the sibling billing data-migration
 * suites established: every test opens a `db.transaction()`, does ALL
 * setup/assertions inside it, and unconditionally throws a sentinel at the end
 * so the transaction always rolls back.
 *
 * ## Why the negative test is not optional
 *
 * A migration that reclassified EVERY row to `tourist` would pass the
 * "reclassifies the tourist rows" test AND the idempotency test — it is
 * idempotent too. The only assertion that separates a correct migration from
 * that one is the accommodation row that must come out untouched, which is why
 * every case below seeds one alongside the tourist fixtures.
 *
 * @module test/data-migrations/hos-1233-reclassify-tourist-product-domain.integration
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    billingCustomers,
    billingPlans,
    billingSubscriptions,
    eq,
    getDb,
    initializeDb,
    resetDb
} from '@repo/db';
import { ProductDomainEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as reclassify from '../../src/data-migrations/0103-hos-1233-reclassify-tourist-product-domain.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as the sibling billing data-migration suites:
// HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

/** Stub actor — this migration only uses `ctx.db`, so a minimal stub suffices. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos1233',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
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

const TOURIST_SLUGS = ['tourist-free', 'tourist-vip'] as const;
/** The control row. Must come out of every run exactly as it went in. */
const ACCOMMODATION_SLUG = 'owner-basico';

/**
 * Forces a plan row to a given domain, creating it if the seeded catalog does
 * not carry it. Returns the row id so subscriptions can point at it.
 *
 * Everything happens inside the caller's rollback transaction.
 */
async function ensurePlan(tx: DrizzleClient, slug: string, domain: string): Promise<string> {
    const existing = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const found = existing[0];
    if (found) {
        await tx
            .update(billingPlans)
            .set({ productDomain: domain })
            .where(eq(billingPlans.id, found.id));
        return found.id;
    }

    const inserted = await tx
        .insert(billingPlans)
        .values({
            name: slug,
            description: `Test fixture plan for ${slug}`,
            active: true,
            entitlements: [],
            limits: {},
            livemode: true,
            displayName: slug,
            monthlyPriceArs: 500000,
            annualPriceArs: 5000000,
            productDomain: domain,
            metadata: { slug }
        })
        .returning({ id: billingPlans.id });

    const row = inserted[0];
    if (!row) {
        throw new Error(`Failed to materialise fixture plan "${slug}"`);
    }
    return row.id;
}

/** Reads back a plan's stored domain. */
async function readPlanDomain(tx: DrizzleClient, slug: string): Promise<string | null> {
    const rows = await tx
        .select({ productDomain: billingPlans.productDomain })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);
    return rows[0]?.productDomain ?? null;
}

/** A customer to hang the fixture subscriptions off. */
async function ensureCustomer(tx: DrizzleClient): Promise<string> {
    const inserted = await tx
        .insert(billingCustomers)
        .values({
            externalId: 'hos1233-fixture-customer',
            email: 'hos1233-fixture@local.test',
            livemode: true
        })
        .returning({ id: billingCustomers.id });

    const row = inserted[0];
    if (!row) {
        throw new Error('Failed to materialise fixture customer');
    }
    return row.id;
}

/**
 * Creates a subscription on `planId` carrying `domain`.
 *
 * `status` is a parameter so a test can prove the migration does NOT filter by
 * it: a cancelled tourist subscription still has to be reclassified, because
 * `hasAnyPriorSubscription` reads prior subscriptions regardless of status.
 */
async function insertSubscription(
    tx: DrizzleClient,
    input: { customerId: string; planId: string; domain: string; status: string }
): Promise<string> {
    const now = new Date();
    const inserted = await tx
        .insert(billingSubscriptions)
        .values({
            customerId: input.customerId,
            planId: input.planId,
            status: input.status,
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            productDomain: input.domain,
            livemode: true
        })
        .returning({ id: billingSubscriptions.id });

    const row = inserted[0];
    if (!row) {
        throw new Error('Failed to materialise fixture subscription');
    }
    return row.id;
}

async function readSubscriptionDomain(tx: DrizzleClient, id: string): Promise<string | null> {
    const rows = await tx
        .select({ productDomain: billingSubscriptions.productDomain })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, id))
        .limit(1);
    return rows[0]?.productDomain ?? null;
}

/**
 * The world as it stands in the live databases before this migration: both
 * tourist plans and their subscriptions claiming `accommodation`, alongside a
 * genuine accommodation plan and subscription that must not be touched.
 */
async function seedMisfiledWorld(tx: DrizzleClient) {
    const customerId = await ensureCustomer(tx);

    const touristPlanIds: string[] = [];
    for (const slug of TOURIST_SLUGS) {
        touristPlanIds.push(await ensurePlan(tx, slug, ProductDomainEnum.ACCOMMODATION));
    }
    const accommodationPlanId = await ensurePlan(
        tx,
        ACCOMMODATION_SLUG,
        ProductDomainEnum.ACCOMMODATION
    );

    const activeTouristSubId = await insertSubscription(tx, {
        customerId,
        planId: touristPlanIds[0] as string,
        domain: ProductDomainEnum.ACCOMMODATION,
        status: 'active'
    });
    // Cancelled on purpose: a dead tourist row is still read by
    // `hasAnyPriorSubscription`, so it has to be corrected too.
    const cancelledTouristSubId = await insertSubscription(tx, {
        customerId,
        planId: touristPlanIds[1] as string,
        domain: ProductDomainEnum.ACCOMMODATION,
        status: 'cancelled'
    });
    const accommodationSubId = await insertSubscription(tx, {
        customerId,
        planId: accommodationPlanId,
        domain: ProductDomainEnum.ACCOMMODATION,
        status: 'active'
    });

    return { activeTouristSubId, cancelledTouristSubId, accommodationSubId };
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

describe('0103-hos-1233-reclassify-tourist-product-domain', () => {
    it('reclassifies both tourist plan rows and their subscriptions', async () => {
        await withRollback(async (tx) => {
            const ids = await seedMisfiledWorld(tx);
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const result = await reclassify.up(ctx);

            expect(result.counts?.plansReclassified).toBe(2);
            expect(result.counts?.subscriptionsReclassified).toBe(2);

            for (const slug of TOURIST_SLUGS) {
                expect(await readPlanDomain(tx, slug)).toBe(ProductDomainEnum.TOURIST);
            }
            expect(await readSubscriptionDomain(tx, ids.activeTouristSubId)).toBe(
                ProductDomainEnum.TOURIST
            );
            expect(await readSubscriptionDomain(tx, ids.cancelledTouristSubId)).toBe(
                ProductDomainEnum.TOURIST
            );
        });
    });

    it('leaves the accommodation plan and its subscription untouched', async () => {
        // The assertion that separates this migration from one that rewrites
        // everything to `tourist` — which would satisfy every other test here,
        // idempotency included.
        await withRollback(async (tx) => {
            const ids = await seedMisfiledWorld(tx);
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            await reclassify.up(ctx);

            expect(await readPlanDomain(tx, ACCOMMODATION_SLUG)).toBe(
                ProductDomainEnum.ACCOMMODATION
            );
            expect(await readSubscriptionDomain(tx, ids.accommodationSubId)).toBe(
                ProductDomainEnum.ACCOMMODATION
            );
        });
    });

    it('is idempotent: a second run changes nothing', async () => {
        await withRollback(async (tx) => {
            await seedMisfiledWorld(tx);
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await reclassify.up(ctx);
            expect(first.counts?.plansReclassified).toBe(2);
            expect(first.counts?.subscriptionsReclassified).toBe(2);

            const second = await reclassify.up(ctx);
            // Zero, not "still correct": a statement without the `<> target`
            // guard would rewrite the same rows forever and report 2 again,
            // which is idempotent in outcome and wrong in behaviour.
            expect(second.counts?.plansReclassified).toBe(0);
            expect(second.counts?.subscriptionsReclassified).toBe(0);

            for (const slug of TOURIST_SLUGS) {
                expect(await readPlanDomain(tx, slug)).toBe(ProductDomainEnum.TOURIST);
            }
        });
    });

    it('never writes anything but the tourist domain', async () => {
        // A nulled column would be the one value that looks fixed and is not:
        // `subscriptionMatchesDomain` reads `null` as accommodation.
        await withRollback(async (tx) => {
            const ids = await seedMisfiledWorld(tx);
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            await reclassify.up(ctx);

            for (const slug of [...TOURIST_SLUGS, ACCOMMODATION_SLUG]) {
                expect(await readPlanDomain(tx, slug)).not.toBeNull();
            }
            for (const id of Object.values(ids)) {
                expect(await readSubscriptionDomain(tx, id)).not.toBeNull();
            }
        });
    });

    it('declares the columns whose absence would make it silently meaningless', () => {
        // HOS-433: without this, a database that dropped the column would see
        // the migration move zero rows, report success, and be ledgered
        // applied forever.
        const required = reclassify.meta.requiresColumns.map((c) => `${c.table}.${c.column}`);

        expect(required).toContain('billing_plans.product_domain');
        expect(required).toContain('billing_subscriptions.product_domain');
    });
});
