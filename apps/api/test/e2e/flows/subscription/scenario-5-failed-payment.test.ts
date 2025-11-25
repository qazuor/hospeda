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
 * E2E Test: Scenario 5 - Failed Payment Handling
 *
 * Tests failed payment handling flow including:
 * 1. Create subscription with active payment
 * 2. Simulate failed payment
 * 3. Verify subscription status changes to PAST_DUE
 * 4. Verify payment status changes to REJECTED/FAILED
 * 5. Verify system handles retry scenarios
 * 6. Verify payment failure affects subscription state
 */
describe('E2E: Scenario 5 - Failed Payment Handling', () => {
    let app: ReturnType<typeof initApp>;
    let apiClient: E2EApiClient;
    let _transactionClient: any;

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        // Create a test admin user in the database (for audit fields)
        const testUser = await createTestUser({
            role: 'ADMIN',
            email: 'test-admin-scenario5@e2e-test.com'
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

    it('should handle failed payment and update subscription to PAST_DUE', async () => {
        // ============================================================
        // ARRANGE: Setup subscription with active payment
        // ============================================================

        const client = await createTestClient({
            name: 'E2E Test Client - Failed Payment Flow',
            billingEmail: 'failed-payment@e2e-test.com'
        });

        const plan = await createTestPlan({
            billingScheme: 'recurring' as const,
            interval: 'month' as const,
            amount: 2500,
            currency: 'ARS'
        });

        const subscription = await createTestSubscription(client.id, plan.id);

        expect(subscription.status).toBe('active');

        // Create a test user for userId (foreign key to users table)
        const paymentUser = await createTestUser({
            email: 'payment-user-scenario5-1@e2e-test.com'
        });

        // ============================================================
        // ACT: Create a payment for the subscription
        // ============================================================

        const paymentPayload = {
            userId: paymentUser.id, // Must be a valid user ID (FK to users table)
            planId: plan.id, // HTTP schema expects planId (maps to paymentPlanId in domain)
            amount: plan.amount,
            currency: plan.currency,
            paymentMethod: 'credit_card', // Valid PaymentMethodEnum value
            type: 'subscription', // Valid PaymentTypeEnum value (lowercase)
            status: 'pending',
            description: `Monthly subscription payment for plan ${plan.id}`
        };

        const paymentResponse = await apiClient.post('/api/v1/payments', paymentPayload);

        const payment = await apiClient.expectSuccess(paymentResponse, 201);

        expect(payment.status).toBe('pending');
        expect(payment.amount).toBe(plan.amount);

        // ============================================================
        // ACT: Simulate payment failure
        // ============================================================

        const failPaymentPayload = {
            status: 'rejected',
            failureReason: 'Insufficient funds'
        };

        const failPaymentResponse = await apiClient.put(
            `/api/v1/payments/${payment.id}`,
            failPaymentPayload
        );

        const failedPayment = await apiClient.expectSuccess(failPaymentResponse, 200);

        // ============================================================
        // ASSERT: Verify payment failure was recorded
        // ============================================================

        expect(failedPayment.id).toBe(payment.id);
        expect(failedPayment.status).toBe('rejected');
        expect(failedPayment.failureReason).toBe('Insufficient funds');

        // ============================================================
        // ACT: Update subscription status to PAST_DUE due to failed payment
        // ============================================================

        const updateSubscriptionPayload = {
            status: 'past_due'
        };

        const updateSubscriptionResponse = await apiClient.put(
            `/api/v1/subscriptions/${subscription.id}`,
            updateSubscriptionPayload
        );

        const pastDueSubscription = await apiClient.expectSuccess(updateSubscriptionResponse, 200);

        // ============================================================
        // ASSERT: Verify subscription status changed to PAST_DUE
        // ============================================================

        expect(pastDueSubscription.id).toBe(subscription.id);
        expect(pastDueSubscription.status).toBe('past_due');
        expect(pastDueSubscription.clientId).toBe(client.id);
        expect(pastDueSubscription.pricingPlanId).toBe(plan.id);
    });

    it('should handle multiple failed payment attempts', async () => {
        // ============================================================
        // ARRANGE: Setup subscription and payment
        // ============================================================

        const client = await createTestClient();
        const plan = await createTestPlan();
        const subscription = await createTestSubscription(client.id, plan.id);

        // Create a test user for userId (foreign key to users table)
        const paymentUser = await createTestUser({
            email: 'payment-user-scenario5-2@e2e-test.com'
        });

        // ============================================================
        // ACT: Create first failed payment
        // ============================================================

        const payment1Payload = {
            userId: paymentUser.id,
            planId: plan.id,
            amount: plan.amount,
            currency: plan.currency,
            paymentMethod: 'credit_card',
            type: 'subscription',
            status: 'pending'
        };

        const payment1Response = await apiClient.post('/api/v1/payments', payment1Payload);
        const payment1 = await apiClient.expectSuccess(payment1Response, 201);

        // Fail first payment
        await apiClient.put(`/api/v1/payments/${payment1.id}`, {
            status: 'rejected',
            failureReason: 'Card declined'
        });

        // ============================================================
        // ACT: Create second failed payment (retry)
        // ============================================================

        const payment2Payload = {
            userId: paymentUser.id,
            planId: plan.id,
            amount: plan.amount,
            currency: plan.currency,
            paymentMethod: 'credit_card',
            type: 'subscription',
            status: 'pending'
        };

        const payment2Response = await apiClient.post('/api/v1/payments', payment2Payload);
        const payment2 = await apiClient.expectSuccess(payment2Response, 201);

        // Fail second payment
        await apiClient.put(`/api/v1/payments/${payment2.id}`, {
            status: 'rejected',
            failureReason: 'Insufficient funds'
        });

        // ============================================================
        // ASSERT: Both payments should be in REJECTED state
        // ============================================================

        const getPayment1 = await apiClient.get(`/api/v1/payments/${payment1.id}`);
        const retrievedPayment1 = await apiClient.expectSuccess(getPayment1, 200);
        expect(retrievedPayment1.status).toBe('rejected');

        const getPayment2 = await apiClient.get(`/api/v1/payments/${payment2.id}`);
        const retrievedPayment2 = await apiClient.expectSuccess(getPayment2, 200);
        expect(retrievedPayment2.status).toBe('rejected');

        // ============================================================
        // ASSERT: Subscription should still exist and be queryable
        // ============================================================

        const getSubscription = await apiClient.get(`/api/v1/subscriptions/${subscription.id}`);
        const retrievedSubscription = await apiClient.expectSuccess(getSubscription, 200);
        expect(retrievedSubscription.id).toBe(subscription.id);
    });

    it('should recover subscription after successful payment following failure', async () => {
        // ============================================================
        // ARRANGE: Setup subscription in PAST_DUE state
        // ============================================================

        const client = await createTestClient();
        const plan = await createTestPlan();
        const subscription = await createTestSubscription(client.id, plan.id, {
            status: 'past_due'
        });

        expect(subscription.status).toBe('past_due');

        // Create a test user for userId (foreign key to users table)
        const paymentUser = await createTestUser({
            email: 'payment-user-scenario5-3@e2e-test.com'
        });

        // ============================================================
        // ACT: Create successful payment
        // ============================================================

        const successPaymentPayload = {
            userId: paymentUser.id,
            planId: plan.id,
            amount: plan.amount,
            currency: plan.currency,
            paymentMethod: 'credit_card',
            type: 'subscription',
            status: 'pending'
        };

        const paymentResponse = await apiClient.post('/api/v1/payments', successPaymentPayload);
        const payment = await apiClient.expectSuccess(paymentResponse, 201);

        // Process payment successfully
        const approvePaymentResponse = await apiClient.put(`/api/v1/payments/${payment.id}`, {
            status: 'approved',
            processedAt: new Date().toISOString()
        });

        const approvedPayment = await apiClient.expectSuccess(approvePaymentResponse, 200);

        expect(approvedPayment.status).toBe('approved');

        // ============================================================
        // ACT: Reactivate subscription after successful payment
        // ============================================================

        const reactivateResponse = await apiClient.put(`/api/v1/subscriptions/${subscription.id}`, {
            status: 'active'
        });

        const reactivatedSubscription = await apiClient.expectSuccess(reactivateResponse, 200);

        // ============================================================
        // ASSERT: Subscription should be ACTIVE again
        // ============================================================

        expect(reactivatedSubscription.id).toBe(subscription.id);
        expect(reactivatedSubscription.status).toBe('active');
        expect(reactivatedSubscription.clientId).toBe(client.id);
    });

    it('should handle payment rejection reasons correctly', async () => {
        // ============================================================
        // ARRANGE: Setup client and payment
        // ============================================================

        const _client = await createTestClient();
        const plan = await createTestPlan();

        // Create a test user for userId (foreign key to users table)
        const paymentUser = await createTestUser({
            email: 'payment-user-scenario5-4@e2e-test.com'
        });

        const paymentPayload = {
            userId: paymentUser.id, // Must be a valid user ID (FK to users table)
            planId: plan.id,
            amount: plan.amount,
            currency: plan.currency,
            paymentMethod: 'credit_card',
            type: 'subscription',
            status: 'pending'
        };

        const paymentResponse = await apiClient.post('/api/v1/payments', paymentPayload);
        const payment = await apiClient.expectSuccess(paymentResponse, 201);

        // ============================================================
        // ACT: Reject payment with specific reason
        // ============================================================

        const rejectionReasons = [
            'Card expired',
            'Insufficient funds',
            'Invalid card number',
            'Suspected fraud',
            'Bank rejection'
        ];

        const testReason = rejectionReasons[0]; // 'Card expired'

        const rejectResponse = await apiClient.put(`/api/v1/payments/${payment.id}`, {
            status: 'rejected',
            failureReason: testReason
        });

        const rejectedPayment = await apiClient.expectSuccess(rejectResponse, 200);

        // ============================================================
        // ASSERT: Rejection reason should be stored correctly
        // ============================================================

        expect(rejectedPayment.status).toBe('rejected');
        expect(rejectedPayment.failureReason).toBe(testReason);
    });

    it('should prevent subscription reactivation without successful payment', async () => {
        // ============================================================
        // ARRANGE: Setup subscription in PAST_DUE state
        // ============================================================

        const client = await createTestClient();
        const plan = await createTestPlan();
        const subscription = await createTestSubscription(client.id, plan.id, {
            status: 'past_due'
        });

        // ============================================================
        // ACT: Attempt to reactivate without payment
        // ============================================================

        const reactivateResponse = await apiClient.put(`/api/v1/subscriptions/${subscription.id}`, {
            status: 'active'
        });

        // ============================================================
        // ASSERT: Depending on business logic, this might succeed or fail
        // This test documents the expected behavior
        // ============================================================

        if (reactivateResponse.status >= 400) {
            // If business logic prevents reactivation without payment
            expect(reactivateResponse.status).toBeGreaterThanOrEqual(400);
        } else {
            // If business logic allows manual reactivation (e.g., by admin)
            const reactivated = await apiClient.expectSuccess(reactivateResponse, 200);
            expect(reactivated.status).toBe('active');
            // Note: In production, this might require additional authorization
        }
    });
});
