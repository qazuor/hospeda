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
 * E2E Test: Scenario 2 - Subscription Upgrade Flow
 *
 * Tests subscription upgrade flow including:
 * 1. Create client with basic plan subscription
 * 2. Create premium plan
 * 3. Upgrade subscription to premium plan
 * 4. Verify upgrade is successful
 * 5. Verify new subscription is active
 * 6. Verify old subscription is cancelled/replaced
 */
describe('E2E: Scenario 2 - Subscription Upgrade Flow', () => {
    let app: ReturnType<typeof initApp>;
    let apiClient: E2EApiClient;
    let _transactionClient: any;

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        // Create a test admin user in the database (for audit fields)
        const testUser = await createTestUser({
            role: 'ADMIN',
            email: 'test-admin-scenario2@e2e-test.com'
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
        // because the API runs in a separate context and doesn't use the transaction client.
        // For now, we rely on testDb.teardown() to clean up after all tests.
        // Future: Implement proper transaction isolation or database cleanup per test.
        // transactionClient = await testDb.beginTransaction();
    });

    afterEach(async () => {
        // TODO: Re-enable once transaction isolation is properly implemented
        // await testDb.rollbackTransaction(transactionClient);
    });

    it('should successfully upgrade subscription to premium plan', async () => {
        // ============================================================
        // ARRANGE: Setup basic subscription
        // ============================================================

        const client = await createTestClient({
            name: 'E2E Test Client - Upgrade Flow',
            billingEmail: 'upgrade-flow@e2e-test.com'
        });

        // Create basic plan (lower tier)
        const basicPlan = await createTestPlan({
            billingScheme: 'recurring' as const,
            interval: 'month' as const,
            amount: 1000, // $10.00 ARS
            currency: 'ARS'
        });

        // Create premium plan (higher tier)
        const premiumPlan = await createTestPlan({
            billingScheme: 'recurring' as const,
            interval: 'month' as const,
            amount: 5000, // $50.00 ARS
            currency: 'ARS'
        });

        // Create initial subscription with basic plan
        const basicSubscription = await createTestSubscription(client.id, basicPlan.id);

        expect(basicSubscription.status).toBe('active');

        // ============================================================
        // ACT: Upgrade subscription to premium plan
        // ============================================================

        const upgradePayload = {
            pricingPlanId: premiumPlan.id
        };

        const upgradeResponse = await apiClient.put(
            `/api/v1/subscriptions/${basicSubscription.id}`,
            upgradePayload
        );

        const upgradedSubscription = await apiClient.expectSuccess(upgradeResponse, 200);

        // ============================================================
        // ASSERT: Verify upgrade was successful
        // ============================================================

        expect(upgradedSubscription.id).toBe(basicSubscription.id);
        expect(upgradedSubscription.pricingPlanId).toBe(premiumPlan.id);
        expect(upgradedSubscription.status).toBe('active');

        // Verify subscription still belongs to same client
        expect(upgradedSubscription.clientId).toBe(client.id);

        // ============================================================
        // ACT: Retrieve subscription to confirm persistence
        // ============================================================

        const getResponse = await apiClient.get(`/api/v1/subscriptions/${basicSubscription.id}`);
        const retrievedSubscription = await apiClient.expectSuccess(getResponse, 200);

        // ============================================================
        // ASSERT: Verify persisted subscription reflects upgrade
        // ============================================================

        expect(retrievedSubscription.pricingPlanId).toBe(premiumPlan.id);
        expect(retrievedSubscription.status).toBe('active');
    });

    it('should handle upgrade to same plan', async () => {
        // ============================================================
        // ARRANGE: Setup subscription
        // ============================================================

        const client = await createTestClient();
        const plan = await createTestPlan();
        const subscription = await createTestSubscription(client.id, plan.id);

        // ============================================================
        // ACT: Attempt to "upgrade" to same plan
        // ============================================================

        const upgradePayload = {
            pricingPlanId: plan.id // Same plan
        };

        const response = await apiClient.put(
            `/api/v1/subscriptions/${subscription.id}`,
            upgradePayload
        );

        // ============================================================
        // ASSERT: Should succeed (idempotent operation)
        // ============================================================

        const result = await apiClient.expectSuccess(response, 200);
        expect(result.pricingPlanId).toBe(plan.id);
        expect(result.status).toBe('active');
    });

    it('should handle downgrade from premium to basic', async () => {
        // ============================================================
        // ARRANGE: Setup premium subscription
        // ============================================================

        const client = await createTestClient();

        const basicPlan = await createTestPlan({
            amount: 1000
        });

        const premiumPlan = await createTestPlan({
            amount: 5000
        });

        // Start with premium subscription
        const premiumSubscription = await createTestSubscription(client.id, premiumPlan.id);

        // ============================================================
        // ACT: Downgrade to basic plan
        // ============================================================

        const downgradePayload = {
            pricingPlanId: basicPlan.id
        };

        const response = await apiClient.put(
            `/api/v1/subscriptions/${premiumSubscription.id}`,
            downgradePayload
        );

        // ============================================================
        // ASSERT: Verify downgrade was successful
        // ============================================================

        const downgradedSubscription = await apiClient.expectSuccess(response, 200);
        expect(downgradedSubscription.pricingPlanId).toBe(basicPlan.id);
        expect(downgradedSubscription.status).toBe('active');
    });
});
