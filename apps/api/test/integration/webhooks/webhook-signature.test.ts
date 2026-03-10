/**
 * Webhook signature verification integration tests.
 *
 * Validates that the MercadoPago webhook endpoint correctly enforces
 * HMAC-SHA256 signature verification, replay-attack prevention via
 * timestamp window, and returns appropriate HTTP status codes for all
 * failure modes.
 *
 * @remarks
 * - Runs under vitest.config.e2e.ts via `pnpm test:e2e`
 * - Requires a real DB connection (TEST_DB_URL or default local config)
 * - Env vars are set before any imports to ensure the app boots correctly
 *
 * @module test/integration/webhooks/webhook-signature
 */

// IMPORTANT: Set env vars BEFORE any imports so app initializes with the
// correct billing credentials.
process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret-for-sig-verification';
process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = 'TEST-fake-access-token-for-tests';
process.env.HOSPEDA_MERCADO_PAGO_SANDBOX = 'true';

import { createHmac } from 'node:crypto';
import { billingWebhookEvents } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-webhook-secret-for-sig-verification';
const WEBHOOK_PATH = '/api/v1/webhooks/mercadopago';

// ---------------------------------------------------------------------------
// Helper: build a valid x-signature header value
// ---------------------------------------------------------------------------

/**
 * Create a well-formed MercadoPago `x-signature` header value.
 *
 * The signed payload follows the QZPay convention:
 * `id:<dataId>;request-id:<ts>;ts:<ts>;`
 *
 * @param params - Signature input parameters
 * @param params.dataId - The `data.id` field from the webhook payload
 * @param params.timestamp - Unix seconds; defaults to `now`
 * @returns A string in the form `ts=<ts>,v1=<hmac-hex>`
 */
function createWebhookSignature({
    dataId,
    timestamp
}: {
    readonly dataId: string;
    readonly timestamp?: number;
}): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signedPayload = `id:${dataId};request-id:${ts};ts:${ts};`;
    const hmac = createHmac('sha256', WEBHOOK_SECRET).update(signedPayload).digest('hex');
    return `ts=${ts},v1=${hmac}`;
}

// ---------------------------------------------------------------------------
// Helper: build a valid MercadoPago IPN payload
// ---------------------------------------------------------------------------

let eventCounter = 0;

/**
 * Build a minimal MercadoPago IPN (Instant Payment Notification) payload.
 *
 * Each call produces a unique `id` to avoid idempotency collisions between
 * tests that share the same DB.
 *
 * @param dataId - Value to place in `data.id`; used for signature construction
 * @returns A plain object shaped like a real MercadoPago webhook event
 */
function createWebhookPayload(dataId: string): Record<string, unknown> {
    eventCounter++;
    return {
        id: Date.now() + eventCounter,
        type: 'payment',
        action: 'payment.updated',
        data: { id: dataId },
        date_created: new Date().toISOString(),
        live_mode: false
    };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Webhook Signature Verification', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        validateApiEnv();
        app = initApp();
        await testDb.setup();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        const db = testDb.getDb();
        await db.delete(billingWebhookEvents);
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    it('should return 200 for a valid webhook request with correct signature', async () => {
        // Arrange
        const dataId = `test-sig-valid-${Date.now()}`;
        const payload = createWebhookPayload(dataId);
        const signature = createWebhookSignature({ dataId });

        // Act
        const response = await app.request(WEBHOOK_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-signature': signature,
                'user-agent': 'vitest'
            },
            body: JSON.stringify(payload)
        });

        // Assert
        expect(response.status).toBe(200);
    });

    // -----------------------------------------------------------------------
    // Rejection: wrong HMAC value
    // -----------------------------------------------------------------------

    it('should reject a request with invalid signature', async () => {
        // Arrange
        const dataId = `test-sig-invalid-${Date.now()}`;
        const payload = createWebhookPayload(dataId);

        // Act
        const response = await app.request(WEBHOOK_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-signature': 'ts=123456,v1=invalid-hex-value-not-a-real-hmac',
                'user-agent': 'vitest'
            },
            body: JSON.stringify(payload)
        });

        // Assert
        expect(response.status).toBe(401);
    });

    // -----------------------------------------------------------------------
    // Rejection: absent header
    // -----------------------------------------------------------------------

    it('should reject a request with missing x-signature header', async () => {
        // Arrange
        const dataId = `test-sig-missing-${Date.now()}`;
        const payload = createWebhookPayload(dataId);

        // Act
        const response = await app.request(WEBHOOK_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest'
            },
            body: JSON.stringify(payload)
        });

        // Assert
        expect(response.status).toBe(401);
    });

    // -----------------------------------------------------------------------
    // Rejection: stale timestamp (replay-attack prevention)
    // -----------------------------------------------------------------------

    it('should reject a request with stale timestamp', async () => {
        // Arrange
        const dataId = `test-sig-stale-${Date.now()}`;
        const payload = createWebhookPayload(dataId);

        // 10 minutes ago; replay window is 300 s (5 min)
        const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
        const signature = createWebhookSignature({ dataId, timestamp: staleTimestamp });

        // Act
        const response = await app.request(WEBHOOK_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-signature': signature,
                'user-agent': 'vitest'
            },
            body: JSON.stringify(payload)
        });

        // Assert
        expect(response.status).toBe(401);
    });

    // -----------------------------------------------------------------------
    // Documentation: QZPay rejection response shape
    // -----------------------------------------------------------------------

    it('should document QZPay rejection behavior', async () => {
        // Arrange
        const dataId = `test-sig-doc-${Date.now()}`;
        const payload = createWebhookPayload(dataId);

        // Act - send a clearly malformed signature to trigger rejection
        const response = await app.request(WEBHOOK_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-signature': 'ts=123456,v1=wrong',
                'user-agent': 'vitest'
            },
            body: JSON.stringify(payload)
        });

        // Assert - document QZPay's rejection behavior
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body).toHaveProperty('error');
    });
});
