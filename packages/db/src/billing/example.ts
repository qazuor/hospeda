/**
 * QZPay Billing Integration Example
 *
 * This file demonstrates how to use the QZPay billing adapter
 * with the Hospeda database connection.
 *
 * @module @repo/db/billing/example
 */

import { QZPay } from '@qazuor/qzpay-core';
import { Pool } from 'pg';
import { getDb, initializeDb } from '../client.ts';
import { createBillingAdapter } from './drizzle-adapter.ts';

/**
 * Example: Initialize billing system
 *
 * This example shows how to:
 * 1. Initialize the database connection
 * 2. Create a billing adapter
 * 3. Initialize QZPay
 */
export async function initializeBilling() {
    // Step 1: Create PostgreSQL connection pool
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/hospeda'
    });

    // Step 2: Initialize database
    initializeDb(pool);

    // Step 3: Get database instance
    const db = getDb();

    // Step 4: Create billing adapter
    const billingAdapter = createBillingAdapter(db, {
        livemode: process.env.NODE_ENV === 'production'
    });

    // Step 5: Initialize QZPay
    const qzpay = new QZPay({
        storage: billingAdapter,
        config: {
            currency: 'ARS',
            locale: 'es-AR',
            timezone: 'America/Argentina/Buenos_Aires'
        }
    });

    return qzpay;
}

/**
 * Example: Create customer and subscription
 */
export async function createCustomerWithSubscription() {
    const qzpay = await initializeBilling();

    // Create customer
    const customer = await qzpay.customers.create({
        email: 'customer@example.com',
        name: 'John Doe',
        metadata: {
            userId: 'user_123',
            source: 'web_signup'
        }
    });

    // Create subscription
    const subscription = await qzpay.subscriptions.create({
        customerId: customer.id,
        planId: 'plan_basic',
        trialDays: 14,
        metadata: {
            campaign: 'summer_2024'
        }
    });

    return { customer, subscription };
}

/**
 * Example: Generate and send invoice
 */
export async function generateInvoice(customerId: string, subscriptionId: string) {
    const qzpay = await initializeBilling();

    // Create invoice
    const invoice = await qzpay.invoices.create({
        customerId,
        subscriptionId,
        items: [
            {
                description: 'Pro Plan - January 2024',
                amount: 2900,
                quantity: 1
            }
        ]
    });

    // Finalize invoice
    const finalized = await qzpay.invoices.finalize(invoice.id);

    // Send invoice via email
    await qzpay.invoices.send(invoice.id);

    return finalized;
}

/**
 * Example: Process payment
 */
export async function processPayment(invoiceId: string, paymentMethodId: string) {
    const qzpay = await initializeBilling();

    // Get invoice
    const invoice = await qzpay.invoices.retrieve(invoiceId);

    // Create payment
    const payment = await qzpay.payments.create({
        invoiceId: invoice.id,
        paymentMethodId,
        amount: invoice.total
    });

    return payment;
}

/**
 * Example: Check entitlement
 */
export async function checkFeatureAccess(customerId: string, featureKey: string) {
    const qzpay = await initializeBilling();

    // Check if customer has access to feature
    const hasAccess = await qzpay.entitlements.check({
        customerId,
        entitlementKey: featureKey
    });

    return hasAccess;
}

/**
 * Example: Record usage
 */
export async function recordApiUsage(customerId: string, subscriptionId: string, count: number) {
    const qzpay = await initializeBilling();

    // Record API usage
    await qzpay.usage.record({
        customerId,
        subscriptionId,
        metricKey: 'api_calls',
        quantity: count,
        timestamp: new Date()
    });
}

/**
 * Example: Apply promo code
 */
export async function applyPromoCode(customerId: string, code: string, subscriptionId: string) {
    const qzpay = await initializeBilling();

    // Validate promo code
    const isValid = await qzpay.promoCodes.validate(code);

    if (!isValid) {
        throw new Error('Invalid promo code');
    }

    // Apply promo code
    const applied = await qzpay.promoCodes.apply({
        customerId,
        code,
        subscriptionId
    });

    return applied;
}
