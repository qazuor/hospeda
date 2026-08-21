/**
 * @fileoverview
 * Regression test for HOS-712: `0059-purge-test-and-commerce-example` used to
 * delete `billing_customers` before its RESTRICT/NO ACTION children, on the
 * false assumption ("Deleting the customer CASCADEs its subscriptions") that
 * the delete cascaded. It does not — `billing_subscriptions.customer_id`,
 * `billing_addon_purchases.customer_id`, `billing_dunning_attempts.customer_id`,
 * `billing_invoices.customer_id`, and `billing_payments.customer_id` are all
 * `ON DELETE restrict`; `billing_payments.subscription_id` is `ON DELETE no
 * action`, which Postgres enforces identically. Deleting the customer (or a
 * subscription with an unresolved payment still hanging off it) first aborts
 * the whole seed-migration run the moment a purged customer still has a live
 * row somewhere in that chain — exactly what production measured on
 * 2026-08-20: three gastronomy-owner accounts via `billing_subscriptions`,
 * and `qazuor+r1host@gmail.com` via a real `succeeded` $18,000 ARS
 * `billing_payments` row hanging off its subscription. Per owner decision
 * (2026-08-20, HOS-712), that payment row IS purged along with the rest of
 * the account — the local mirror of the charge is lost, the charge itself
 * still exists in MercadoPago.
 *
 * A real database rather than a stubbed `ctx.db`, for the same reason as
 * `fkGuard.integration.test.ts` and `staff-email-domain-to-com-ar.integration.test.ts`:
 * the whole risk surface here IS the database's FK enforcement. A mocked
 * `db.delete()` chain (as the sibling `0059-purge-test-and-commerce-example.test.ts`
 * uses) can never violate a real constraint, so it can never catch this bug —
 * which is exactly how it reached production undetected.
 *
 * Runs against the REAL worktree-isolated PostgreSQL database via
 * `apps/api/.env.local`'s `HOSPEDA_DATABASE_URL` (same convention as the two
 * files above), using the rollback-isolation idiom: every test opens a
 * `db.transaction()`, does setup + `up()` + assertions inside it, then throws
 * a sentinel to roll the whole thing back. Nothing persists after this file
 * runs.
 *
 * @module test/data-migrations/0059-hos712-billing-restrict-fk-order
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    billingAddonPurchases,
    billingCustomers,
    billingDunningAttempts,
    billingInvoices,
    billingPayments,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    initializeDb,
    resetDb,
    users
} from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0059-purge-test-and-commerce-example.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/**
 * One of the literal emails `0059` purges — a real SPEC-143 commerce fixture,
 * the exact family of account production hit (HOS-712 confirmed
 * `gastro-owner-{julieta,rodrigo,valentina}@local.test`).
 */
const PRIMARY_EMAIL = 'gastro-owner-julieta@local.test';
/** A second purged account, used by the "every RESTRICT child" test. */
const SECONDARY_EMAIL = 'gastro-owner-rodrigo@local.test';
/**
 * The literal purged account production actually found holding a
 * `billing_payments` row (HOS-712): a real `succeeded` $18,000 ARS payment
 * hanging off one of its subscriptions.
 */
const PAYMENT_EMAIL = 'qazuor+r1host@gmail.com';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos712-0059-fk-order',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
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

/** Builds the migration ctx against a transaction-scoped client. */
function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    return { db: tx, actor: STUB_ACTOR } as unknown as SeedMigrationCtx;
}

/** Inserts one user by email, returning its id. */
async function insertUser(tx: DrizzleClient, email: string): Promise<string> {
    const inserted = await tx.insert(users).values({ email }).returning({ id: users.id });
    const row = inserted[0];
    if (!row) {
        throw new Error(`Insert of test user ${email} returned no row`);
    }
    return row.id;
}

/** Inserts a minimal `billing_customers` row, returning its id. */
async function insertBillingCustomer(tx: DrizzleClient, externalId: string): Promise<string> {
    const inserted = await tx
        .insert(billingCustomers)
        .values({
            externalId,
            email: `${externalId}@billing-test.local`,
            livemode: false
        } as typeof billingCustomers.$inferInsert)
        .returning({ id: billingCustomers.id });
    const row = inserted[0];
    if (!row) {
        throw new Error(
            `Insert of test billing customer for externalId=${externalId} returned no row`
        );
    }
    return row.id;
}

/** Inserts a minimal `billing_subscriptions` row, returning its id. */
async function insertBillingSubscription(tx: DrizzleClient, customerId: string): Promise<string> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const inserted = await tx
        .insert(billingSubscriptions)
        .values({
            customerId,
            planId: 'zzqa-hos712-plan',
            status: 'active',
            billingInterval: 'month',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            livemode: false
        } as typeof billingSubscriptions.$inferInsert)
        .returning({ id: billingSubscriptions.id });
    const row = inserted[0];
    if (!row) {
        throw new Error('Insert of test billing subscription returned no row');
    }
    return row.id;
}

/** Inserts a minimal `billing_addon_purchases` row. */
async function insertBillingAddonPurchase(tx: DrizzleClient, customerId: string): Promise<void> {
    await tx.insert(billingAddonPurchases).values({
        customerId,
        addonSlug: 'zzqa-hos712-addon'
    } as typeof billingAddonPurchases.$inferInsert);
}

/** Inserts a minimal `billing_dunning_attempts` row. */
async function insertBillingDunningAttempt(tx: DrizzleClient, customerId: string): Promise<void> {
    await tx.insert(billingDunningAttempts).values({
        customerId,
        attemptNumber: 1,
        result: 'failed'
    } as typeof billingDunningAttempts.$inferInsert);
}

/** Inserts a minimal `billing_invoices` row. */
async function insertBillingInvoice(tx: DrizzleClient, customerId: string): Promise<void> {
    await tx.insert(billingInvoices).values({
        customerId,
        number: 'zzqa-hos712-invoice-1',
        status: 'open',
        subtotal: 1000,
        total: 1000,
        currency: 'ARS'
    } as typeof billingInvoices.$inferInsert);
}

/**
 * Inserts a minimal `billing_payments` row hanging off a subscription —
 * mirrors the real production row found on `qazuor+r1host@gmail.com`
 * (HOS-712): a `succeeded` $18,000 ARS charge via MercadoPago.
 */
async function insertBillingPayment(
    tx: DrizzleClient,
    customerId: string,
    subscriptionId: string
): Promise<void> {
    await tx.insert(billingPayments).values({
        customerId,
        subscriptionId,
        // Centavos, mirroring the real $18,000 ARS production row (HOS-712).
        amount: 1_800_000,
        currency: 'ARS',
        status: 'succeeded',
        provider: 'mercadopago'
    } as typeof billingPayments.$inferInsert);
}

/** True when a `billing_customers` row with this `external_id` still exists. */
async function customerExists(tx: DrizzleClient, externalId: string): Promise<boolean> {
    const rows = await tx
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(eq(billingCustomers.externalId, externalId));
    return rows.length > 0;
}

/** True when any `billing_subscriptions` row still references this customer. */
async function subscriptionExists(tx: DrizzleClient, customerId: string): Promise<boolean> {
    const rows = await tx
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.customerId, customerId));
    return rows.length > 0;
}

/** True when any `billing_addon_purchases` row still references this customer. */
async function addonPurchaseExists(tx: DrizzleClient, customerId: string): Promise<boolean> {
    const rows = await tx
        .select({ id: billingAddonPurchases.id })
        .from(billingAddonPurchases)
        .where(eq(billingAddonPurchases.customerId, customerId));
    return rows.length > 0;
}

/** True when any `billing_dunning_attempts` row still references this customer. */
async function dunningAttemptExists(tx: DrizzleClient, customerId: string): Promise<boolean> {
    const rows = await tx
        .select({ id: billingDunningAttempts.id })
        .from(billingDunningAttempts)
        .where(eq(billingDunningAttempts.customerId, customerId));
    return rows.length > 0;
}

/** True when any `billing_invoices` row still references this customer. */
async function invoiceExists(tx: DrizzleClient, customerId: string): Promise<boolean> {
    const rows = await tx
        .select({ id: billingInvoices.id })
        .from(billingInvoices)
        .where(eq(billingInvoices.customerId, customerId));
    return rows.length > 0;
}

/** True when any `billing_payments` row still references this customer. */
async function paymentExists(tx: DrizzleClient, customerId: string): Promise<boolean> {
    const rows = await tx
        .select({ id: billingPayments.id })
        .from(billingPayments)
        .where(eq(billingPayments.customerId, customerId));
    return rows.length > 0;
}

describe('HOS-712: 0059-purge-test-and-commerce-example clears RESTRICT billing children first', () => {
    beforeAll(async () => {
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

    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    });

    it(
        'purges a customer with a live billing_subscriptions row without aborting on the FK ' +
            '(the exact shape measured in production for the three gastronomy owners)',
        async () => {
            await withRollback(async (tx) => {
                const userId = await insertUser(tx, PRIMARY_EMAIL);
                const customerId = await insertBillingCustomer(tx, userId);
                await insertBillingSubscription(tx, customerId);

                process.env.NODE_ENV = 'production';

                // Before the fix, this line rejects with a Postgres FK
                // violation on billing_subscriptions_customer_id_billing_customers_id_fk.
                const result = await migration.up(buildCtx(tx));

                expect((result.counts as Record<string, number>).billingCustomersDeleted).toBe(1);
                expect((result.counts as Record<string, number>).billingSubscriptionsDeleted).toBe(
                    1
                );
                expect(await customerExists(tx, userId)).toBe(false);
                expect(await subscriptionExists(tx, customerId)).toBe(false);
            });
        }
    );

    it('purges a customer holding rows in every RESTRICT billing child, not just subscriptions', async () => {
        await withRollback(async (tx) => {
            const userId = await insertUser(tx, SECONDARY_EMAIL);
            const customerId = await insertBillingCustomer(tx, userId);
            await insertBillingSubscription(tx, customerId);
            await insertBillingAddonPurchase(tx, customerId);
            await insertBillingDunningAttempt(tx, customerId);
            await insertBillingInvoice(tx, customerId);

            process.env.NODE_ENV = 'production';

            const result = await migration.up(buildCtx(tx));
            const counts = result.counts as Record<string, number>;

            expect(counts.billingCustomersDeleted).toBe(1);
            expect(counts.billingSubscriptionsDeleted).toBe(1);
            expect(counts.billingAddonPurchasesDeleted).toBe(1);
            expect(counts.billingDunningAttemptsDeleted).toBe(1);
            expect(counts.billingInvoicesDeleted).toBe(1);

            expect(await customerExists(tx, userId)).toBe(false);
            expect(await subscriptionExists(tx, customerId)).toBe(false);
            expect(await addonPurchaseExists(tx, customerId)).toBe(false);
            expect(await dunningAttemptExists(tx, customerId)).toBe(false);
            expect(await invoiceExists(tx, customerId)).toBe(false);
        });
    });

    it(
        'purges a customer whose billing_payments row hangs off a subscription without ' +
            'aborting on the no-action FK (the exact shape found on qazuor+r1host@gmail.com ' +
            'in production, HOS-712)',
        async () => {
            await withRollback(async (tx) => {
                const userId = await insertUser(tx, PAYMENT_EMAIL);
                const customerId = await insertBillingCustomer(tx, userId);
                const subscriptionId = await insertBillingSubscription(tx, customerId);
                await insertBillingPayment(tx, customerId, subscriptionId);

                process.env.NODE_ENV = 'production';

                // Before the payments fix, this line rejects with a Postgres FK
                // violation on billing_payments_subscription_id_billing_subscriptions_id_fk
                // (ON DELETE no action, enforced identically to restrict).
                const result = await migration.up(buildCtx(tx));
                const counts = result.counts as Record<string, number>;

                expect(counts.billingPaymentsDeleted).toBe(1);
                expect(counts.billingSubscriptionsDeleted).toBe(1);
                expect(counts.billingCustomersDeleted).toBe(1);

                expect(await paymentExists(tx, customerId)).toBe(false);
                expect(await subscriptionExists(tx, customerId)).toBe(false);
                expect(await customerExists(tx, userId)).toBe(false);
            });
        }
    );
});
