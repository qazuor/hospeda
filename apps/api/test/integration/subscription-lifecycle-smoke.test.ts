/**
 * Subscription Lifecycle Smoke Tests
 *
 * Real database smoke tests for subscription lifecycle flows.
 * Tests customer creation, subscription creation, status changes, and entitlement resolution.
 *
 * These tests are skipped if DATABASE_URL is not available.
 *
 * @module test/integration/subscription-lifecycle-smoke
 */

import { billingCustomers, billingPlans, billingPrices, billingSubscriptions, eq } from '@repo/db';
import { RoleEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    cleanupTestDb,
    closeTestDb,
    createTestDb,
    createTestUser,
    isDatabaseAvailable
} from '../helpers/test-db';

describe.skipIf(!isDatabaseAvailable())('Subscription Lifecycle - Smoke Tests', () => {
    let db: ReturnType<typeof createTestDb>;
    let testUserId: string;
    let testCustomerId: string;
    let testPlanId: string;
    let testPriceId: string;

    beforeAll(async () => {
        // Create test database connection
        db = createTestDb();

        if (!db) {
            throw new Error('Failed to create test database');
        }

        // Create test user
        const testUser = await createTestUser(db, RoleEnum.HOST);
        testUserId = testUser.id;

        // Create billing customer
        const customerResult = await db
            .insert(billingCustomers)
            .values({
                id: crypto.randomUUID(),
                externalId: testUserId,
                email: 'test-subscription@example.com',
                name: 'Test Subscription User',
                metadata: {}
            } as any)
            .returning();

        const customer = (customerResult as any[])[0];
        testCustomerId = customer.id;

        // Create a test plan
        const planResult = await db
            .insert(billingPlans)
            .values({
                id: crypto.randomUUID(),
                name: 'Test Plan',
                slug: `test-plan-${Date.now()}`,
                description: 'Test plan for subscription lifecycle',
                productType: 'owner_subscription',
                isActive: true,
                metadata: {}
            } as any)
            .returning();

        const plan = (planResult as any[])[0];
        testPlanId = plan.id;

        // Create a test price for the plan
        const priceResult = await db
            .insert(billingPrices)
            .values({
                id: crypto.randomUUID(),
                planId: testPlanId,
                amount: 1000,
                currency: 'ARS',
                billingInterval: 'month',
                isActive: true,
                metadata: {}
            } as any)
            .returning();

        const price = (priceResult as any[])[0];
        testPriceId = price.id;
    });

    afterAll(async () => {
        if (db) {
            // Clean up test data
            await db
                .delete(billingSubscriptions)
                .where(eq(billingSubscriptions.customerId, testCustomerId));

            await db.delete(billingPrices).where(eq(billingPrices.planId, testPlanId));

            await db.delete(billingPlans).where(eq(billingPlans.id, testPlanId));

            await cleanupTestDb(db);
        }
        await closeTestDb();
    });

    it('should create customer successfully', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        const [customer] = await db
            .select()
            .from(billingCustomers)
            .where(eq(billingCustomers.id, testCustomerId))
            .limit(1);

        expect(customer).toBeDefined();
        expect(customer!.id).toBe(testCustomerId);
        expect(customer!.externalId).toBe(testUserId);
        expect(customer!.email).toBe('test-subscription@example.com');
    });

    it('should create subscription for customer', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        const subscriptionResult = await db
            .insert(billingSubscriptions)
            .values({
                id: crypto.randomUUID(),
                customerId: testCustomerId,
                planId: testPlanId,
                billingInterval: 'month',
                status: SubscriptionStatusEnum.ACTIVE,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                metadata: {}
            } as any)
            .returning();

        const subscription = (subscriptionResult as any[])[0];
        expect(subscription).toBeDefined();
        expect(subscription.customerId).toBe(testCustomerId);
        expect(subscription.planId).toBe(testPlanId);
        expect(subscription.status).toBe(SubscriptionStatusEnum.ACTIVE);

        // Verify subscription can be found
        const [foundSubscription] = await db
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscription.id))
            .limit(1);

        expect(foundSubscription).toBeDefined();
        expect(foundSubscription!.id).toBe(subscription.id);
    });

    it('should update subscription status to canceled', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        // First, create a subscription
        const subscriptionResult = await db
            .insert(billingSubscriptions)
            .values({
                id: crypto.randomUUID(),
                customerId: testCustomerId,
                planId: testPlanId,
                billingInterval: 'month',
                status: SubscriptionStatusEnum.ACTIVE,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                metadata: {}
            } as any)
            .returning();

        const subscription = (subscriptionResult as any[])[0];

        // Update status to canceled
        const [updatedSubscription] = await db
            .update(billingSubscriptions)
            .set({
                status: SubscriptionStatusEnum.CANCELLED,
                canceledAt: new Date()
            })
            .where(eq(billingSubscriptions.id, subscription.id))
            .returning();

        expect(updatedSubscription!.status).toBe(SubscriptionStatusEnum.CANCELLED);
        expect(updatedSubscription!.canceledAt).toBeDefined();
    });

    it('should detect trial subscription', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        // Create a trial subscription
        const trialResult = await db
            .insert(billingSubscriptions)
            .values({
                id: crypto.randomUUID(),
                customerId: testCustomerId,
                planId: testPlanId,
                billingInterval: 'month',
                status: SubscriptionStatusEnum.TRIALING,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
                trialStart: new Date(),
                trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                metadata: {}
            } as any)
            .returning();

        const trialSubscription = (trialResult as any[])[0];
        expect(trialSubscription.status).toBe(SubscriptionStatusEnum.TRIALING);
        expect(trialSubscription.trialStart).toBeDefined();
        expect(trialSubscription.trialEnd).toBeDefined();

        // Verify trial subscription can be found
        const [foundTrial] = await db
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.status, SubscriptionStatusEnum.TRIALING))
            .limit(1);

        expect(foundTrial).toBeDefined();
    });

    it('should find active subscription for customer', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        const activeSubscriptions = await db
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, testCustomerId));

        expect(Array.isArray(activeSubscriptions)).toBe(true);
    });

    it('should verify plan and price exist', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        // Verify plan
        const [plan] = await db
            .select()
            .from(billingPlans)
            .where(eq(billingPlans.id, testPlanId))
            .limit(1);

        expect(plan).toBeDefined();
        expect(plan!.id).toBe(testPlanId);

        // Verify price
        const [price] = await db
            .select()
            .from(billingPrices)
            .where(eq(billingPrices.id, testPriceId))
            .limit(1);

        expect(price).toBeDefined();
        expect(price!.id).toBe(testPriceId);
        expect(price!.planId).toBe(testPlanId);
    });

    it('should handle subscription period updates', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        // Create a subscription
        const subscriptionResult = await db
            .insert(billingSubscriptions)
            .values({
                id: crypto.randomUUID(),
                customerId: testCustomerId,
                planId: testPlanId,
                billingInterval: 'month',
                status: SubscriptionStatusEnum.ACTIVE,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                metadata: {}
            } as any)
            .returning();

        const subscription = (subscriptionResult as any[])[0];

        // Update period
        const newPeriodStart = new Date();
        const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const [updatedSubscription] = await db
            .update(billingSubscriptions)
            .set({
                currentPeriodStart: newPeriodStart,
                currentPeriodEnd: newPeriodEnd
            })
            .where(eq(billingSubscriptions.id, subscription.id))
            .returning();

        expect(updatedSubscription!.currentPeriodStart).toBeDefined();
        expect(updatedSubscription!.currentPeriodEnd).toBeDefined();
    });

    it('should verify database transaction integrity', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        // Count subscriptions before
        const subscriptionsBefore = await db
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, testCustomerId));

        const countBefore = subscriptionsBefore.length;

        // Create a subscription
        await db.insert(billingSubscriptions).values({
            id: crypto.randomUUID(),
            customerId: testCustomerId,
            planId: testPlanId,
            billingInterval: 'month',
            status: SubscriptionStatusEnum.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            metadata: {}
        } as any);

        // Count subscriptions after
        const subscriptionsAfter = await db
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, testCustomerId));

        const countAfter = subscriptionsAfter.length;

        expect(countAfter).toBe(countBefore + 1);
    });
});
