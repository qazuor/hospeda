/**
 * Full integration tests for webhook idempotency (SPEC-026 T-003).
 *
 * Verifies that the MercadoPago webhook endpoint correctly persists events
 * to the billingWebhookEvents table, handles duplicate providerEventId
 * idempotently, and reprocesses previously failed events.
 *
 * These tests require a live test database and run under vitest.config.e2e.ts
 * via `pnpm test:e2e`.
 *
 * @module test/integration/webhooks/webhook-idempotency-full
 */

// Set env vars BEFORE any imports so that modules initialised at import
// time (env validation, QZPay adapter config) pick up the test values.
process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret-for-sig-verification';
process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = 'TEST-fake-access-token-for-tests';
process.env.HOSPEDA_MERCADO_PAGO_SANDBOX = 'true';

import { createHmac } from 'node:crypto';
import { billingWebhookEvents, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-webhook-secret-for-sig-verification';
const WEBHOOK_PATH = '/api/v1/webhooks/mercadopago';

/**
 * Generates a valid x-signature header value for a MercadoPago webhook
 * request using HMAC-SHA256.
 *
 * The signed payload format mirrors the production QZPay verification logic:
 * `id:<dataId>;request-id:<ts>;ts:<ts>;`
 *
 * @param params.dataId - The value of `event.data.id` in the webhook payload
 * @param params.timestamp - Optional unix timestamp (seconds). Defaults to now.
 * @returns Formatted signature string: `ts=<ts>,v1=<hmac>`
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

/** Monotonically-increasing suffix so every call yields a distinct event id. */
let eventCounter = 0;

/**
 * Builds a minimal MercadoPago-style webhook payload.
 *
 * The numeric top-level `id` field is used as `providerEventId` (String(id))
 * by the event handler, matching QZPay's extraction logic.
 *
 * @param dataId - Value used in `data.id` (also drives signature generation)
 * @returns Webhook payload object
 */
function createWebhookPayload(dataId: string): {
    readonly id: number;
    readonly type: string;
    readonly action: string;
    readonly data: { readonly id: string };
    readonly date_created: string;
    readonly live_mode: boolean;
} {
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
// Test suite
// ---------------------------------------------------------------------------

describe('Webhook Idempotency - Full DB Integration (SPEC-026 T-003)', () => {
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
        // Clean the webhook events table between tests to avoid state leakage.
        const db = testDb.getDb();
        await db.delete(billingWebhookEvents);
    });

    // -----------------------------------------------------------------------
    // Test 1 — Persistence
    // -----------------------------------------------------------------------

    it('should persist webhook event in billingWebhookEvents table', async () => {
        // Arrange
        const dataId = `test-idemp-persist-${Date.now()}`;
        const payload = createWebhookPayload(dataId);
        // providerEventId = String(payload.id) as stored by handleWebhookEvent
        const providerEventId = String(payload.id);
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

        // Assert - HTTP layer
        expect(response.status).toBe(200);

        // Assert - DB persistence
        const db = testDb.getDb();
        const events = await db
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, providerEventId));

        expect(events).toHaveLength(1);

        const persistedEvent = events[0];
        // The event handler marks the record as 'processed' after successful
        // handling; QZPay updates the status internally after onEvent returns.
        expect(persistedEvent?.status).toBe('processed');
    });

    // -----------------------------------------------------------------------
    // Test 2 — Duplicate idempotency
    // -----------------------------------------------------------------------

    it('should handle duplicate providerEventId idempotently', async () => {
        // Arrange
        const dataId = `test-idemp-dup-${Date.now()}`;
        const payload = createWebhookPayload(dataId);
        const providerEventId = String(payload.id);

        // Act - first request
        const signature1 = createWebhookSignature({ dataId });
        const res1 = await app.request(WEBHOOK_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-signature': signature1,
                'user-agent': 'vitest'
            },
            body: JSON.stringify(payload)
        });
        expect(res1.status).toBe(200);

        // Act - second request with same payload but a fresh (valid) signature
        // so the signature check does not reject it before idempotency kicks in.
        const signature2 = createWebhookSignature({ dataId });
        const res2 = await app.request(WEBHOOK_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-signature': signature2,
                'user-agent': 'vitest'
            },
            body: JSON.stringify(payload)
        });
        expect(res2.status).toBe(200);

        // Assert - exactly one DB record for this providerEventId
        const db = testDb.getDb();
        const events = await db
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, providerEventId));

        expect(events).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // Test 3 — Reprocessing of a previously failed event
    // -----------------------------------------------------------------------

    it('should reprocess a previously failed event', async () => {
        // Arrange - create a payload so we know the providerEventId in advance.
        const dataId = `test-idemp-retry-${Date.now()}`;
        const payload = createWebhookPayload(dataId);
        const providerEventId = String(payload.id);

        // Seed the database with a 'failed' record for this providerEventId.
        const db = testDb.getDb();
        await db.insert(billingWebhookEvents).values({
            provider: 'mercadopago',
            type: 'payment',
            providerEventId,
            status: 'failed',
            // billingWebhookEvents.payload is jsonb (notNull: true)
            payload: payload as unknown as Record<string, unknown>,
            error: 'Previous processing failed'
        });

        // Verify the seeded record is in 'failed' state.
        const before = await db
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, providerEventId));
        expect(before).toHaveLength(1);
        expect(before[0]?.status).toBe('failed');

        // Act - send the webhook with the same event id.
        const signature = createWebhookSignature({ dataId });
        const response = await app.request(WEBHOOK_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-signature': signature,
                'user-agent': 'vitest'
            },
            body: JSON.stringify(payload)
        });

        // Assert - HTTP layer always returns 200 for webhook endpoints.
        expect(response.status).toBe(200);

        // Assert - DB state after reprocessing attempt.
        const after = await db
            .select()
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, providerEventId));

        // The event handler detects the 'failed' status and calls an UPDATE to
        // reset it to 'pending' before continuing processing (see event-handler.ts
        // lines 177-199). QZPay then advances the status to 'processed' on
        // success. Either way at least one record must exist.
        //
        // If QZPay creates a new record instead of updating, there will be 2 rows.
        // Both outcomes are valid - the important invariant is that the handler
        // accepted the event (200 OK) and did not silently discard it.
        expect(after.length).toBeGreaterThanOrEqual(1);

        // The record for this providerEventId must NOT remain permanently
        // 'failed' after reprocessing; it should have been reset to 'pending'
        // (if still processing) or advanced to 'processed'.
        const relevantRecord = after.find(
            (e: { providerEventId: string }) => e.providerEventId === providerEventId
        );
        expect(relevantRecord).toBeDefined();
        expect(relevantRecord?.status).not.toBe('failed');
    });
});
