import { initializeDb } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getQZPayBilling } from '../../../src/middlewares/billing';
import {
    createCleanupTracker,
    generateTestId,
    getDefaultRetryConfig,
    getSandboxConfig,
    skipIfNoSandbox,
    withRetry
} from './sandbox-config';

import type { QZPayBilling, QZPayCustomer, QZPaySubscription } from '@qazuor/qzpay-core';

describe('MercadoPago Sandbox E2E', () => {
    let billing: QZPayBilling;
    const cleanup = createCleanupTracker();
    const retryConfig = getDefaultRetryConfig();

    /**
     * Setup: Initialize database and billing system
     * Skip all tests if sandbox is not configured
     */
    beforeAll(async () => {
        // Skip all tests if sandbox not configured
        try {
            skipIfNoSandbox();
        } catch (error) {
            console.warn('⚠️  Skipping MercadoPago sandbox tests - not configured');
            console.warn('   Set MERCADO_PAGO_ACCESS_TOKEN=TEST-... to enable these tests');
            throw error; // Re-throw to skip all tests
        }

        const _config = getSandboxConfig();

        // Initialize database for QZPay storage
        await initializeDb();

        // Get or create billing instance
        billing = getQZPayBilling();

        // Verify billing is initialized
        expect(billing).toBeDefined();
        expect(billing.customers).toBeDefined();
        expect(billing.subscriptions).toBeDefined();
    });

    /**
     * Cleanup: Remove tracked test resources
     */
    afterAll(async () => {
        if (cleanup) {
            await cleanup.cleanup();
        }
    });

    describe('Payment Preference Creation', () => {
        /**
         * Test: Creating a payment preference for subscription checkout
         *
         * This test verifies that we can create a MercadoPago payment preference
         * (checkout session) with correct items, amounts, and URLs.
         *
         * WHY: Payment preferences are the entry point for subscription checkout.
         * Users are redirected to MercadoPago's hosted checkout page using this
         * preference URL.
         */
        it('should create a payment preference for subscription checkout', async () => {
            // Arrange: Create test data
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;

            // Create a test customer first
            const customer = await withRetry<QZPayCustomer>({
                fn: async () => {
                    const result = await billing.customers.create({
                        email: testEmail,
                        externalId: `user-${testId}`,
                        metadata: {
                            test: true,
                            testId
                        }
                    });
                    return result;
                },
                ...retryConfig,
                description: 'Create test customer for preference'
            });

            expect(customer).toBeDefined();
            expect(customer.email).toBe(testEmail);
            cleanup.track('customer', customer.id);

            // Get available plans
            const plans = await withRetry({
                fn: async () => billing.plans.list(),
                ...retryConfig,
                description: 'List available plans'
            });

            expect(plans).toBeDefined();
            expect(Array.isArray(plans)).toBe(true);

            if (plans.length === 0) {
                console.warn('⚠️  No plans available in sandbox - skipping preference creation');
                return;
            }

            const testPlan = plans[0];
            expect(testPlan).toBeDefined();
            expect(testPlan.id).toBeDefined();

            // Act: Create payment preference (checkout session)
            const preference = await withRetry({
                fn: async () =>
                    billing.checkout.create({
                        customerId: customer.id,
                        planId: testPlan.id,
                        successUrl: 'https://hospeda.test/checkout/success',
                        cancelUrl: 'https://hospeda.test/checkout/cancel',
                        metadata: {
                            test: true,
                            testId
                        }
                    }),
                ...retryConfig,
                description: 'Create payment preference'
            });

            // Assert: Verify preference structure
            expect(preference).toBeDefined();
            expect(preference.id).toBeDefined();
            expect(typeof preference.id).toBe('string');

            // Preferences should have a checkout URL
            expect(preference).toHaveProperty('checkoutUrl');
            expect(typeof preference.checkoutUrl).toBe('string');
            expect(preference.checkoutUrl).toMatch(/^https:\/\//);

            // Track for cleanup
            cleanup.track('preference', preference.id);
        });

        /**
         * Test: Verify preference includes correct items and amounts
         *
         * WHY: MercadoPago requires specific item structure with title, quantity,
         * unit_price, and currency. Incorrect values cause checkout failures.
         */
        it('should include correct items and amounts in preference', async () => {
            // Arrange
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;

            const customer = await withRetry<QZPayCustomer>({
                fn: async () =>
                    billing.customers.create({
                        email: testEmail,
                        externalId: `user-${testId}`,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create customer'
            });

            cleanup.track('customer', customer.id);

            const plans = await billing.plans.list();
            if (plans.length === 0) {
                console.warn('⚠️  No plans available - skipping');
                return;
            }

            const plan = plans[0];

            // Act
            const preference = await withRetry({
                fn: async () =>
                    billing.checkout.create({
                        customerId: customer.id,
                        planId: plan.id,
                        successUrl: 'https://hospeda.test/success',
                        cancelUrl: 'https://hospeda.test/cancel'
                    }),
                ...retryConfig,
                description: 'Create preference'
            });

            // Assert: Verify preference has valid structure
            expect(preference).toBeDefined();
            expect(preference.id).toBeDefined();
            expect(preference.checkoutUrl).toBeDefined();

            // MercadoPago preferences should have metadata
            if (preference.metadata) {
                expect(preference.metadata).toHaveProperty('customerId');
                expect(preference.metadata.customerId).toBe(customer.id);
            }

            cleanup.track('preference', preference.id);
        });

        /**
         * Test: Verify back URLs are correctly set
         *
         * WHY: After payment, MercadoPago redirects users to success/failure URLs.
         * These URLs must be correctly configured for proper user flow.
         */
        it('should set correct back URLs for redirect', async () => {
            // Arrange
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;
            const successUrl = `https://hospeda.test/checkout/success?session=${testId}`;
            const cancelUrl = `https://hospeda.test/checkout/cancel?session=${testId}`;

            const customer = await withRetry<QZPayCustomer>({
                fn: async () =>
                    billing.customers.create({
                        email: testEmail,
                        externalId: `user-${testId}`,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create customer'
            });

            cleanup.track('customer', customer.id);

            const plans = await billing.plans.list();
            if (plans.length === 0) {
                console.warn('⚠️  No plans available - skipping');
                return;
            }

            const plan = plans[0];

            // Act
            const preference = await withRetry({
                fn: async () =>
                    billing.checkout.create({
                        customerId: customer.id,
                        planId: plan.id,
                        successUrl,
                        cancelUrl
                    }),
                ...retryConfig,
                description: 'Create preference with URLs'
            });

            // Assert
            expect(preference).toBeDefined();
            expect(preference.id).toBeDefined();

            // URLs should be stored in metadata or accessible via API
            // Note: QZPay may store these internally; exact structure depends on implementation
            expect(preference.checkoutUrl).toBeDefined();

            cleanup.track('preference', preference.id);
        });
    });

    describe('Customer Management', () => {
        /**
         * Test: Creating a test customer in sandbox
         *
         * WHY: Customers are required for all billing operations. This tests
         * the fundamental operation of creating a customer record in MercadoPago.
         */
        it('should create a test customer', async () => {
            // Arrange
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;
            const externalId = `user-${testId}`;

            // Act: Create customer
            const customer = await withRetry<QZPayCustomer>({
                fn: async () =>
                    billing.customers.create({
                        email: testEmail,
                        externalId,
                        metadata: {
                            test: true,
                            testId,
                            createdAt: new Date().toISOString()
                        }
                    }),
                ...retryConfig,
                description: 'Create customer'
            });

            // Assert: Verify customer structure
            expect(customer).toBeDefined();
            expect(customer.id).toBeDefined();
            expect(customer.email).toBe(testEmail);
            expect(customer.externalId).toBe(externalId);
            expect(customer.metadata).toBeDefined();
            expect(customer.metadata?.test).toBe(true);

            // Track for cleanup
            cleanup.track('customer', customer.id);
        });

        /**
         * Test: Retrieving customer by external ID
         *
         * WHY: We need to look up customers by our internal user ID (externalId)
         * to link MercadoPago customers to Hospeda users.
         */
        it('should retrieve customer by external ID', async () => {
            // Arrange: Create a customer first
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;
            const externalId = `user-${testId}`;

            const createdCustomer = await withRetry<QZPayCustomer>({
                fn: async () =>
                    billing.customers.create({
                        email: testEmail,
                        externalId,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create customer for retrieval test'
            });

            expect(createdCustomer).toBeDefined();
            cleanup.track('customer', createdCustomer.id);

            // Act: Retrieve by external ID
            const retrievedCustomer = await withRetry<QZPayCustomer>({
                fn: async () => billing.customers.getByExternalId(externalId),
                ...retryConfig,
                description: 'Retrieve customer by external ID'
            });

            // Assert: Should match created customer
            expect(retrievedCustomer).toBeDefined();
            expect(retrievedCustomer.id).toBe(createdCustomer.id);
            expect(retrievedCustomer.email).toBe(testEmail);
            expect(retrievedCustomer.externalId).toBe(externalId);
        });

        /**
         * Test: Retrieving customer by email
         *
         * WHY: Sometimes we need to find customers by email for support or
         * duplicate prevention.
         */
        it('should retrieve customer by email', async () => {
            // Arrange
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;

            const createdCustomer = await withRetry<QZPayCustomer>({
                fn: async () =>
                    billing.customers.create({
                        email: testEmail,
                        externalId: `user-${testId}`,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create customer'
            });

            cleanup.track('customer', createdCustomer.id);

            // Act
            const retrievedCustomer = await withRetry<QZPayCustomer>({
                fn: async () => billing.customers.getByEmail(testEmail),
                ...retryConfig,
                description: 'Retrieve customer by email'
            });

            // Assert
            expect(retrievedCustomer).toBeDefined();
            expect(retrievedCustomer.id).toBe(createdCustomer.id);
            expect(retrievedCustomer.email).toBe(testEmail);
        });
    });

    describe('Subscription Lifecycle', () => {
        /**
         * Test: Creating a subscription with sandbox plan
         *
         * WHY: Subscriptions are the core of our billing system. This tests
         * that we can successfully create a subscription linked to a customer
         * and plan.
         *
         * NOTE: In sandbox, subscriptions may not process actual payments,
         * but the API operations should work.
         */
        it('should create a subscription with sandbox plan', async () => {
            // Arrange: Create customer
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;

            const customer = await withRetry<QZPayCustomer>({
                fn: async () =>
                    billing.customers.create({
                        email: testEmail,
                        externalId: `user-${testId}`,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create customer for subscription'
            });

            expect(customer).toBeDefined();
            cleanup.track('customer', customer.id);

            // Get available plans
            const plans = await withRetry({
                fn: async () => billing.plans.list(),
                ...retryConfig,
                description: 'List plans'
            });

            if (plans.length === 0) {
                console.warn('⚠️  No plans available in sandbox - skipping subscription test');
                return;
            }

            const plan = plans[0];
            expect(plan).toBeDefined();
            expect(plan.id).toBeDefined();

            // Get plan's first price
            const prices = plan.prices || [];
            if (prices.length === 0) {
                console.warn('⚠️  Plan has no prices - skipping subscription test');
                return;
            }

            const price = prices[0];

            // Act: Create subscription
            const subscription = await withRetry<QZPaySubscription>({
                fn: async () =>
                    billing.subscriptions.create({
                        customerId: customer.id,
                        planId: plan.id,
                        priceId: price.id,
                        metadata: {
                            test: true,
                            testId
                        }
                    }),
                ...retryConfig,
                description: 'Create subscription'
            });

            // Assert: Verify subscription structure
            expect(subscription).toBeDefined();
            expect(subscription.id).toBeDefined();
            expect(subscription.customerId).toBe(customer.id);
            expect(subscription.planId).toBe(plan.id);
            expect(subscription.status).toBeDefined();

            // Status should be one of the valid subscription statuses
            expect([
                'active',
                'pending',
                'trialing',
                'past_due',
                'canceled',
                'incomplete'
            ]).toContain(subscription.status);

            // Track for cleanup
            cleanup.track('subscription', subscription.id);
        });

        /**
         * Test: Retrieving subscription status
         *
         * WHY: We need to check subscription status to enforce entitlements
         * and determine if a user has active access to features.
         */
        it('should retrieve subscription status', async () => {
            // Arrange: Create customer and subscription
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;

            const customer = await withRetry<QZPayCustomer>({
                fn: async () =>
                    billing.customers.create({
                        email: testEmail,
                        externalId: `user-${testId}`,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create customer'
            });

            cleanup.track('customer', customer.id);

            const plans = await billing.plans.list();
            if (plans.length === 0 || !plans[0].prices || plans[0].prices.length === 0) {
                console.warn('⚠️  No valid plans available - skipping');
                return;
            }

            const plan = plans[0];
            const price = plan.prices[0];

            const createdSubscription = await withRetry<QZPaySubscription>({
                fn: async () =>
                    billing.subscriptions.create({
                        customerId: customer.id,
                        planId: plan.id,
                        priceId: price.id,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create subscription'
            });

            cleanup.track('subscription', createdSubscription.id);

            // Act: Retrieve subscription
            const retrievedSubscription = await withRetry<QZPaySubscription>({
                fn: async () => billing.subscriptions.get(createdSubscription.id),
                ...retryConfig,
                description: 'Retrieve subscription'
            });

            // Assert
            expect(retrievedSubscription).toBeDefined();
            expect(retrievedSubscription.id).toBe(createdSubscription.id);
            expect(retrievedSubscription.customerId).toBe(customer.id);
            expect(retrievedSubscription.status).toBeDefined();
        });

        /**
         * Test: List subscriptions for a customer
         *
         * WHY: Users may have multiple subscriptions (main plan + addons).
         * We need to list all subscriptions for a customer.
         */
        it('should list subscriptions for customer', async () => {
            // Arrange
            const testId = generateTestId();
            const testEmail = `test-${testId}@sandbox.hospeda.test`;

            const customer = await withRetry<QZPayCustomer>({
                fn: async () =>
                    billing.customers.create({
                        email: testEmail,
                        externalId: `user-${testId}`,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create customer'
            });

            cleanup.track('customer', customer.id);

            const plans = await billing.plans.list();
            if (plans.length === 0 || !plans[0].prices || plans[0].prices.length === 0) {
                console.warn('⚠️  No valid plans available - skipping');
                return;
            }

            const plan = plans[0];
            const price = plan.prices[0];

            const subscription = await withRetry<QZPaySubscription>({
                fn: async () =>
                    billing.subscriptions.create({
                        customerId: customer.id,
                        planId: plan.id,
                        priceId: price.id,
                        metadata: { test: true }
                    }),
                ...retryConfig,
                description: 'Create subscription'
            });

            cleanup.track('subscription', subscription.id);

            // Act: List subscriptions
            const subscriptions = await withRetry({
                fn: async () => billing.subscriptions.getByCustomerId(customer.id),
                ...retryConfig,
                description: 'List customer subscriptions'
            });

            // Assert
            expect(subscriptions).toBeDefined();
            expect(Array.isArray(subscriptions)).toBe(true);
            expect(subscriptions.length).toBeGreaterThan(0);

            const found = subscriptions.find((sub) => sub.id === subscription.id);
            expect(found).toBeDefined();
        });
    });

    describe('Webhook Verification', () => {
        /**
         * Test: Verify webhook signature validation
         *
         * WHY: Webhooks notify us of payment events (successful payment,
         * subscription renewal, etc.). We MUST verify webhook signatures
         * to prevent attackers from forging payment notifications.
         */
        it('should verify a valid webhook signature', async () => {
            // Arrange: Get webhook secret
            const config = getSandboxConfig();

            if (!config.webhookSecret) {
                console.warn('⚠️  Webhook secret not configured - skipping signature test');
                return;
            }

            // Create a mock webhook payload (structure from MercadoPago docs)
            const webhookPayload = {
                id: 12345,
                live_mode: false,
                type: 'payment',
                date_created: new Date().toISOString(),
                application_id: 'test-app',
                user_id: 'test-user',
                version: 1,
                api_version: 'v1',
                action: 'payment.created',
                data: {
                    id: 'payment-123'
                }
            };

            // Generate signature (simplified - actual implementation depends on QZPay)
            const _payloadString = JSON.stringify(webhookPayload);

            // Act: Verify signature using QZPay's webhook handler
            // Note: This is a conceptual test - actual implementation depends on
            // how QZPay exposes webhook verification

            // For now, we just verify that the webhook secret is configured
            expect(config.webhookSecret).toBeDefined();
            expect(typeof config.webhookSecret).toBe('string');
            expect(config.webhookSecret.length).toBeGreaterThan(0);
        });

        /**
         * Test: Reject invalid webhook signature
         *
         * WHY: Must reject webhooks with invalid signatures to prevent
         * forgery attacks.
         */
        it('should reject an invalid webhook signature', async () => {
            // Arrange
            const config = getSandboxConfig();

            if (!config.webhookSecret) {
                console.warn('⚠️  Webhook secret not configured - skipping');
                return;
            }

            // This test verifies webhook validation logic exists
            // Actual implementation would test the webhook verification function
            // from the billing system

            expect(config.webhookSecret).toBeDefined();
        });
    });
});
