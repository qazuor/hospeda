import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestClient,
    createTestPlan,
    createTestSubscription,
    createTestUser
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

/**
 * E2E Test: Scenario 3 - Subscription Renewal Flow
 *
 * Tests subscription renewal flow including:
 * 1. Create client with subscription (near expiration)
 * 2. Trigger renewal process
 * 3. Verify subscription is renewed
 * 4. Verify new period dates are set
 * 5. Verify subscription remains active
 */
describe('E2E: Scenario 3 - Subscription Renewal Flow', () => {
    let app: ReturnType<typeof initApp>;
    let apiClient: E2EApiClient;
    let _transactionClient: any;

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        // Create a test admin user in the database (for audit fields)
        const testUser = await createTestUser({
            role: 'ADMIN',
            email: 'test-admin-scenario3@e2e-test.com'
        });

        // Create API client with admin actor using the test user's ID
        const actor = createMockAdminActor({
            id: testUser.id
        });
        apiClient = new E2EApiClient(app, actor);
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        // TODO: Transaction-based test isolation is not currently working with E2E tests
        // transactionClient = await testDb.beginTransaction();
    });

    afterEach(async () => {
        // TODO: Re-enable once transaction isolation is properly implemented
        // await testDb.rollbackTransaction(transactionClient);
    });

    it('should successfully renew subscription for next period', async () => {
        // ============================================================
        // ARRANGE: Setup subscription near expiration
        // ============================================================

        const client = await createTestClient({
            name: 'E2E Test Client - Renewal Flow',
            billingEmail: 'renewal-flow@e2e-test.com'
        });

        const plan = await createTestPlan({
            billingScheme: 'recurring' as const,
            interval: 'month' as const,
            amount: 2000,
            currency: 'ARS'
        });

        // Create subscription that expires in 1 day
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 29); // Started 29 days ago

        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 1); // Expires tomorrow

        const subscription = await createTestSubscription(client.id, plan.id, {
            startDate,
            endDate
        });

        expect(subscription.status).toBe('active');

        const originalEndDate = new Date(subscription.endDate);

        // ============================================================
        // ACT: Renew subscription (extend period)
        // ============================================================

        // Calculate new end date (30 days from original end)
        const newEndDate = new Date(originalEndDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);

        const renewalPayload = {
            endDate: newEndDate.toISOString()
        };

        const renewResponse = await apiClient.put(
            `/api/v1/subscriptions/${subscription.id}`,
            renewalPayload
        );

        const renewedSubscription = await apiClient.expectSuccess(renewResponse, 200);

        // ============================================================
        // ASSERT: Verify subscription was renewed
        // ============================================================

        expect(renewedSubscription.id).toBe(subscription.id);
        expect(renewedSubscription.status).toBe('active');

        // Verify new end date is set
        const renewedEndDate = new Date(renewedSubscription.endDate);
        expect(renewedEndDate.getTime()).toBeGreaterThan(originalEndDate.getTime());

        // Verify subscription still belongs to same client and plan
        expect(renewedSubscription.clientId).toBe(client.id);
        expect(renewedSubscription.pricingPlanId).toBe(plan.id);
    });

    it('should handle renewal of active subscription with time remaining', async () => {
        // ============================================================
        // ARRANGE: Setup active subscription with 15 days remaining
        // ============================================================

        const client = await createTestClient();
        const plan = await createTestPlan();

        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 15); // Started 15 days ago

        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 15); // 15 days remaining

        const subscription = await createTestSubscription(client.id, plan.id, {
            startDate,
            endDate
        });

        const originalEndDate = new Date(subscription.endDate);

        // ============================================================
        // ACT: Renew early
        // ============================================================

        const newEndDate = new Date(originalEndDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);

        const renewalPayload = {
            endDate: newEndDate.toISOString()
        };

        const response = await apiClient.put(
            `/api/v1/subscriptions/${subscription.id}`,
            renewalPayload
        );

        // ============================================================
        // ASSERT: Verify early renewal was successful
        // ============================================================

        const renewedSubscription = await apiClient.expectSuccess(response, 200);
        expect(renewedSubscription.status).toBe('active');

        const renewedEndDate = new Date(renewedSubscription.endDate);
        expect(renewedEndDate.getTime()).toBeGreaterThan(originalEndDate.getTime());
    });

    it('should maintain subscription status during renewal', async () => {
        // ============================================================
        // ARRANGE: Setup subscription
        // ============================================================

        const client = await createTestClient();
        const plan = await createTestPlan();
        const subscription = await createTestSubscription(client.id, plan.id);

        const statusBeforeRenewal = subscription.status;

        // ============================================================
        // ACT: Renew subscription
        // ============================================================

        const newEndDate = new Date();
        newEndDate.setMonth(newEndDate.getMonth() + 2);

        const response = await apiClient.put(`/api/v1/subscriptions/${subscription.id}`, {
            endDate: newEndDate.toISOString()
        });

        const renewedSubscription = await apiClient.expectSuccess(response, 200);

        // ============================================================
        // ASSERT: Status should remain the same
        // ============================================================

        expect(renewedSubscription.status).toBe(statusBeforeRenewal);
    });
});
