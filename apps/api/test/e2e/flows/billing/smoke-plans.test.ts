/**
 * Phase 0 infrastructure smoke test (SPEC-143 T-143-08).
 *
 * Verifies that every helper produced by T-143-01..07 actually works end-to-end
 * against the test database before any Phase 1 flow lands. If anything here
 * fails, the infra is broken and Phase 1 work should stop until it is fixed.
 *
 * Tests run sequentially per the vitest.config.e2e.ts singleFork setting so
 * the singleton `testDb` lifecycle behaves correctly.
 *
 * @module test/e2e/flows/billing/smoke-plans
 */

import { randomUUID } from 'node:crypto';
import { billingCustomers, billingPlans, billingPrices, eq } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import {
    providerResponseFixtures,
    signWebhookPayload,
    webhookEventFixtures
} from '../../helpers/billing-fixtures.js';
import { MpStubUnconfiguredError, createMpStubAdapter } from '../../helpers/mp-stub.js';
import { seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

describe('SPEC-143 Phase 0 — billing infrastructure smoke', () => {
    beforeAll(async () => {
        await testDb.setup();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('T-143-04 / seedBillingTestPlans creates baseline plans with monthly + annual prices', async () => {
        await testDb.withRollback(async (tx) => {
            const seed = await seedBillingTestPlans(tx);

            expect(seed.cheap.name).toBe('Test Cheap Plan');
            expect(seed.expensive.name).toBe('Test Expensive Plan');
            expect(seed.cheap.planId).toMatch(/^[0-9a-f-]{36}$/);
            expect(seed.cheap.monthlyPriceId).toMatch(/^[0-9a-f-]{36}$/);
            expect(seed.cheap.annualPriceId).toMatch(/^[0-9a-f-]{36}$/);

            const cheapPrices = await tx
                .select({
                    interval: billingPrices.billingInterval,
                    amount: billingPrices.unitAmount,
                    currency: billingPrices.currency
                })
                .from(billingPrices)
                .where(eq(billingPrices.planId, seed.cheap.planId));

            expect(cheapPrices).toHaveLength(2);
            const monthly = cheapPrices.find((p) => p.interval === 'month');
            const annual = cheapPrices.find((p) => p.interval === 'year');
            expect(monthly?.amount).toBe(100_000);
            expect(annual?.amount).toBe(1_000_000);
            expect(monthly?.currency).toBe('ARS');
        });
    });

    it('T-143-04 / seedBillingTestPlans is idempotent across two calls', async () => {
        await testDb.withRollback(async (tx) => {
            const first = await seedBillingTestPlans(tx);
            const second = await seedBillingTestPlans(tx);

            expect(second.cheap.planId).toBe(first.cheap.planId);
            expect(second.cheap.monthlyPriceId).toBe(first.cheap.monthlyPriceId);
            expect(second.expensive.annualPriceId).toBe(first.expensive.annualPriceId);

            // Confirm no duplicate plan rows were inserted.
            const cheapRows = await tx
                .select({ id: billingPlans.id })
                .from(billingPlans)
                .where(eq(billingPlans.name, 'Test Cheap Plan'));
            expect(cheapRows).toHaveLength(1);
        });
    });

    it('T-143-07 / createTestBillingCustomer + createTestSubscription chain works', async () => {
        await testDb.withRollback(async (tx) => {
            const seed = await seedBillingTestPlans(tx);
            const externalId = randomUUID();

            const customer = await createTestBillingCustomer(
                { externalId, email: 'smoke-chain@example.com' },
                tx
            );
            expect(customer.email).toBe('smoke-chain@example.com');
            expect(customer.segment).toBe('individual');
            expect(customer.customerId).toMatch(/^[0-9a-f-]{36}$/);

            const sub = await createTestSubscription(
                {
                    customerId: customer.customerId,
                    planId: seed.cheap.planId,
                    billingInterval: 'month'
                },
                tx
            );
            expect(sub.status).toBe('active');
            expect(sub.planId).toBe(seed.cheap.planId);
            expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(
                sub.currentPeriodStart.getTime()
            );
        });
    });

    it('T-143-05 / mp-stub throws MpStubUnconfiguredError when no response set', async () => {
        const stub = createMpStubAdapter();

        await expect(stub.adapter.checkout.create({} as never)).rejects.toBeInstanceOf(
            MpStubUnconfiguredError
        );
    });

    it('T-143-05 / mp-stub returns canned checkout response after setSuccess + records the call', async () => {
        const stub = createMpStubAdapter();
        const checkout = providerResponseFixtures.checkout({ id: 'chk_smoke_123' });
        stub.config.setSuccess('checkout.create', checkout);

        const result = await stub.adapter.checkout.create({} as never);

        expect(result).toEqual(checkout);
        const calls = stub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });

    it('T-143-05 / mp-stub setError throws with status + code on subscriptions.retrieve', async () => {
        const stub = createMpStubAdapter();
        stub.config.setError('subscriptions.retrieve', 429, 'rate limited', 'RATE_LIMITED');

        try {
            await stub.adapter.subscriptions.retrieve('preapproval_123');
            expect.unreachable('expected error');
        } catch (error) {
            const err = error as Error & { status?: number; code?: string };
            expect(err.status).toBe(429);
            expect(err.code).toBe('RATE_LIMITED');
            expect(err.message).toBe('rate limited');
        }
    });

    it('T-143-05 / mp-stub adapter exposes provider field + all 6 sub-adapters', async () => {
        const stub = createMpStubAdapter();
        expect(stub.adapter.provider).toBe('mercadopago');
        // Sanity that all expected sub-adapters exist (they are objects with methods).
        expect(typeof stub.adapter.checkout.create).toBe('function');
        expect(typeof stub.adapter.customers.create).toBe('function');
        expect(typeof stub.adapter.payments.create).toBe('function');
        expect(typeof stub.adapter.subscriptions.create).toBe('function');
        expect(typeof stub.adapter.prices.create).toBe('function');
        expect(typeof stub.adapter.webhooks.verifySignature).toBe('function');
    });

    it('T-143-06 / webhookEventFixtures + signWebhookPayload produce a valid signature header', async () => {
        const event = webhookEventFixtures.paymentUpdated({ paymentId: '12345' });
        expect(event.type).toBe('payment');
        expect(event.action).toBe('payment.updated');
        expect(event.data.id).toBe('12345');

        const body = JSON.stringify(event);
        const headers = signWebhookPayload({ body });

        expect(headers['x-signature']).toMatch(/^ts=\d+,v1=[0-9a-f]{64}$/);
        expect(headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('T-143-07 / withRollback rolls back: data inserted inside does NOT persist', async () => {
        const externalId = randomUUID();

        await testDb.withRollback(async (tx) => {
            await createTestBillingCustomer(
                { externalId, email: 'should-be-rolled-back@example.com' },
                tx
            );
            // Sanity: the row IS visible inside the transaction.
            const insideRows = await tx
                .select({ id: billingCustomers.id })
                .from(billingCustomers)
                .where(eq(billingCustomers.externalId, externalId));
            expect(insideRows).toHaveLength(1);
        });

        // Outside the rollback the row must not exist.
        const outsideRows = await testDb
            .getDb()
            .select({ id: billingCustomers.id })
            .from(billingCustomers)
            .where(eq(billingCustomers.externalId, externalId));
        expect(outsideRows).toHaveLength(0);
    });
});
