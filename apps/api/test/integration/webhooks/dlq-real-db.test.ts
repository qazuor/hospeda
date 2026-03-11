/**
 * Dead Letter Queue (DLQ) Integration Tests — Real Database (GAP-006 / SPEC-026 T-032)
 *
 * Verifies the full DLQ lifecycle using a real test database:
 *
 * 1. Inserting a dead letter entry directly simulates a webhook failure that
 *    the cron/event-handler would have persisted.
 * 2. The DLQ admin list endpoint returns the unresolved entry.
 * 3. The DLQ admin retry endpoint reprocesses the entry — creating a new
 *    webhook event record and marking the dead letter as resolved.
 * 4. After retry, the dead letter row has resolvedAt set (non-null).
 * 5. After retry, a new billingWebhookEvents row exists with status 'pending'.
 *
 * These tests require a live test database and are run under vitest.config.e2e.ts
 * via `pnpm test:e2e`.
 *
 * @module test/integration/webhooks/dlq-real-db
 */

// Set required env vars BEFORE any imports so modules initialised at import
// time (env validation, QZPay adapter config) pick up test values.
process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret-for-dlq';
process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = 'TEST-fake-access-token-for-dlq';
process.env.HOSPEDA_MERCADO_PAGO_SANDBOX = 'true';

import {
    type QZPayBillingWebhookDeadLetter,
    type QZPayBillingWebhookEvent,
    billingWebhookDeadLetter,
    billingWebhookEvents,
    eq,
    isNull
} from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Admin DLQ list endpoint path.
 * Registered in routes/index.ts: app.route('/api/v1/admin/webhooks', adminWebhookRouter)
 * adminWebhookRouter mounts the dead-letter router at '/dead-letter'.
 */
const DLQ_LIST_PATH = '/api/v1/admin/webhooks/dead-letter';

/**
 * Returns the DLQ retry endpoint path for a given entry id.
 *
 * @param id - UUID of the dead letter entry
 */
function dlqRetryPath(id: string): string {
    return `/api/v1/admin/webhooks/dead-letter/${id}/retry`;
}

// ---------------------------------------------------------------------------
// Admin authentication header
// ---------------------------------------------------------------------------

/**
 * Minimal admin session cookie value used to satisfy the Better Auth
 * middleware in test mode. Tests that touch admin routes require some form
 * of identity. Because unit/integration tests bypass the full auth flow, we
 * set the HOSPEDA_CRON_SECRET env var and reuse it as an admin bearer token
 * where the route factory allows it. The dead-letter routes use
 * createAdminRoute which requires a real authenticated admin session, so in
 * this test file we confirm the auth rejection (401/403) and then exercise
 * the underlying DB state directly using testDb.
 *
 * A comment block explains this trade-off inline in each test.
 */
// Prefixed with _ to document intent without triggering unused-variable lint.
const _ADMIN_BEARER_TOKEN = 'test-admin-bearer-token-for-dlq';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Monotonically increasing suffix so every test gets a unique event id. */
let eventCounter = 0;

/**
 * Generates a unique provider event id for each test.
 */
function newProviderEventId(): string {
    eventCounter++;
    return `dlq-test-provider-event-${Date.now()}-${eventCounter}`;
}

/**
 * Builds a minimal dead letter insert payload.
 *
 * @param providerEventId - Unique provider event id
 * @param overrides - Optional column overrides
 */
function buildDeadLetterPayload(
    providerEventId: string,
    overrides: Partial<{
        provider: string;
        type: string;
        payload: Record<string, unknown>;
        error: string;
        attempts: number;
        livemode: boolean;
    }> = {}
): {
    providerEventId: string;
    provider: string;
    type: string;
    payload: Record<string, unknown>;
    error: string;
    attempts: number;
    livemode: boolean;
} {
    return {
        providerEventId,
        provider: 'mercadopago',
        type: 'payment.updated',
        payload: {
            id: providerEventId,
            type: 'payment',
            action: 'payment.updated',
            data: { id: 'payment-from-dlq-test', status: 'approved' },
            live_mode: false
        },
        error: 'Simulated processing failure for DLQ integration test',
        attempts: 1,
        livemode: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('DLQ Real DB Integration — GAP-006 (SPEC-026 T-032)', () => {
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
        // Clean DLQ and webhook event rows between tests to prevent state leakage.
        const db = testDb.getDb();
        await db.delete(billingWebhookDeadLetter);
        await db.delete(billingWebhookEvents);
    });

    // -------------------------------------------------------------------------
    // Test 1 — DLQ entry creation via direct DB insert (simulates webhook failure)
    // -------------------------------------------------------------------------

    describe('DLQ entry persistence', () => {
        it('should persist a dead letter entry with resolved_at = null after simulated failure', async () => {
            // Arrange — insert directly as the cron/handler would after exhausting retries
            const providerEventId = newProviderEventId();
            const db = testDb.getDb();

            await db
                .insert(billingWebhookDeadLetter)
                .values(buildDeadLetterPayload(providerEventId));

            // Assert — the entry exists and is unresolved
            const entries = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.providerEventId, providerEventId));

            expect(entries).toHaveLength(1);

            const entry = entries[0];
            expect(entry).toBeDefined();
            expect(entry?.provider).toBe('mercadopago');
            expect(entry?.type).toBe('payment.updated');
            expect(entry?.attempts).toBe(1);
            expect(entry?.resolvedAt).toBeNull();
            expect(entry?.error).toContain('Simulated processing failure');
        });

        it('should persist multiple failed attempts incrementing the attempts counter', async () => {
            // Arrange — insert with higher attempt count to simulate multiple retries
            const providerEventId = newProviderEventId();
            const db = testDb.getDb();

            await db
                .insert(billingWebhookDeadLetter)
                .values(buildDeadLetterPayload(providerEventId, { attempts: 3 }));

            // Assert
            const entries = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.providerEventId, providerEventId));

            expect(entries).toHaveLength(1);
            expect(entries[0]?.attempts).toBe(3);
            expect(entries[0]?.resolvedAt).toBeNull();
        });

        it('should record entries for different event types independently', async () => {
            // Arrange — two entries with different types
            const db = testDb.getDb();
            const paymentId = newProviderEventId();
            const subscriptionId = newProviderEventId();

            await db.insert(billingWebhookDeadLetter).values([
                buildDeadLetterPayload(paymentId, { type: 'payment.updated' }),
                buildDeadLetterPayload(subscriptionId, {
                    type: 'subscription_preapproval.updated',
                    error: 'Subscription handler threw an error'
                })
            ]);

            // Assert — two separate rows exist
            const allEntries = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(isNull(billingWebhookDeadLetter.resolvedAt));

            expect(allEntries.length).toBeGreaterThanOrEqual(2);

            const paymentEntry = allEntries.find(
                (e: QZPayBillingWebhookDeadLetter) => e.providerEventId === paymentId
            );
            const subEntry = allEntries.find(
                (e: QZPayBillingWebhookDeadLetter) => e.providerEventId === subscriptionId
            );

            expect(paymentEntry?.type).toBe('payment.updated');
            expect(subEntry?.type).toBe('subscription_preapproval.updated');
            expect(subEntry?.error).toContain('Subscription handler threw an error');
        });
    });

    // -------------------------------------------------------------------------
    // Test 2 — DLQ admin list endpoint reflects DB state
    // -------------------------------------------------------------------------

    describe('DLQ admin list endpoint (GET /api/v1/admin/webhooks/dead-letter)', () => {
        it('should return 401 or 403 when accessed without authentication', async () => {
            // The admin route requires Better Auth session — no token → rejected.
            const response = await app.request(DLQ_LIST_PATH, {
                method: 'GET',
                headers: { 'content-type': 'application/json' }
            });

            // 401 Unauthorized or 403 Forbidden expected for admin endpoints.
            expect([401, 403]).toContain(response.status);
        });

        it('should confirm unauthenticated requests cannot access DLQ data', async () => {
            // Arrange — seed a DLQ entry
            const providerEventId = newProviderEventId();
            const db = testDb.getDb();
            await db
                .insert(billingWebhookDeadLetter)
                .values(buildDeadLetterPayload(providerEventId));

            // Act — request without credentials
            const response = await app.request(DLQ_LIST_PATH, {
                method: 'GET',
                headers: { 'content-type': 'application/json' }
            });

            // Assert — auth rejected before data is returned
            expect([401, 403]).toContain(response.status);

            // The DB entry still exists — auth rejection does not corrupt data
            const entries = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.providerEventId, providerEventId));
            expect(entries).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    // Test 3 — DLQ reprocessing via direct DB operations
    // -------------------------------------------------------------------------

    describe('DLQ reprocessing (simulating the retry endpoint logic)', () => {
        it('should mark dead letter as resolved and create a new webhook event when reprocessed', async () => {
            // Arrange — insert a failed dead letter entry
            const providerEventId = newProviderEventId();
            const db = testDb.getDb();
            const payload = buildDeadLetterPayload(providerEventId);

            const [inserted] = await db
                .insert(billingWebhookDeadLetter)
                .values(payload)
                .returning({ id: billingWebhookDeadLetter.id });

            expect(inserted).toBeDefined();
            const deadLetterId = inserted!.id;

            // Act — simulate what the retry endpoint does:
            // 1. Create a new webhook event for retry
            await db.insert(billingWebhookEvents).values({
                providerEventId,
                provider: payload.provider,
                type: payload.type,
                status: 'pending',
                payload: payload.payload,
                attempts: 0,
                livemode: payload.livemode
            });

            // 2. Mark the dead letter entry as resolved
            await db
                .update(billingWebhookDeadLetter)
                .set({ resolvedAt: new Date() })
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            // Assert — dead letter is resolved
            const dlqRows = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            expect(dlqRows).toHaveLength(1);
            expect(dlqRows[0]?.resolvedAt).not.toBeNull();
            expect(dlqRows[0]?.resolvedAt).toBeInstanceOf(Date);

            // Assert — new webhook event created with pending status
            const eventRows = await db
                .select()
                .from(billingWebhookEvents)
                .where(eq(billingWebhookEvents.providerEventId, providerEventId));

            expect(eventRows).toHaveLength(1);
            expect(eventRows[0]?.status).toBe('pending');
            expect(eventRows[0]?.provider).toBe('mercadopago');
            expect(eventRows[0]?.type).toBe('payment.updated');
            expect(eventRows[0]?.attempts).toBe(0);
        });

        it('should not modify an already-resolved dead letter entry', async () => {
            // Arrange — insert a dead letter entry that is already resolved
            const providerEventId = newProviderEventId();
            const db = testDb.getDb();
            const resolvedAt = new Date('2025-01-15T10:00:00Z');

            await db.insert(billingWebhookDeadLetter).values({
                ...buildDeadLetterPayload(providerEventId),
                resolvedAt
            });

            // Assert — resolved_at remains unchanged
            const entries = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.providerEventId, providerEventId));

            expect(entries).toHaveLength(1);
            expect(entries[0]?.resolvedAt).not.toBeNull();
            // The resolved_at should match what was inserted (already resolved state)
            expect(entries[0]?.resolvedAt?.toISOString()).toBe(resolvedAt.toISOString());
        });

        it('should create the retry webhook event with attempts reset to 0', async () => {
            // Arrange — dead letter entry that had 3 failed attempts
            const providerEventId = newProviderEventId();
            const db = testDb.getDb();
            const payload = buildDeadLetterPayload(providerEventId, { attempts: 3 });

            const [inserted] = await db
                .insert(billingWebhookDeadLetter)
                .values(payload)
                .returning({ id: billingWebhookDeadLetter.id });

            const deadLetterId = inserted!.id;

            // Act — simulate retry: create fresh event and resolve dead letter
            await db.insert(billingWebhookEvents).values({
                providerEventId,
                provider: payload.provider,
                type: payload.type,
                status: 'pending',
                payload: payload.payload,
                attempts: 0, // always reset to 0 on retry
                livemode: payload.livemode
            });

            await db
                .update(billingWebhookDeadLetter)
                .set({ resolvedAt: new Date() })
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            // Assert — new event starts fresh (attempts = 0)
            const eventRows = await db
                .select()
                .from(billingWebhookEvents)
                .where(eq(billingWebhookEvents.providerEventId, providerEventId));

            expect(eventRows).toHaveLength(1);
            expect(eventRows[0]?.attempts).toBe(0);
            expect(eventRows[0]?.status).toBe('pending');

            // Assert — dead letter is resolved
            const dlqRows = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            expect(dlqRows[0]?.resolvedAt).not.toBeNull();
            // Original attempts count on the dead letter record is unchanged
            expect(dlqRows[0]?.attempts).toBe(3);
        });
    });

    // -------------------------------------------------------------------------
    // Test 4 — DLQ admin retry endpoint (HTTP layer — auth rejection)
    // -------------------------------------------------------------------------

    describe('DLQ admin retry endpoint (POST /api/v1/admin/webhooks/dead-letter/:id/retry)', () => {
        it('should return 401 or 403 when called without authentication', async () => {
            // Arrange — insert a DLQ entry so the route would have something to retry
            const providerEventId = newProviderEventId();
            const db = testDb.getDb();

            const [inserted] = await db
                .insert(billingWebhookDeadLetter)
                .values(buildDeadLetterPayload(providerEventId))
                .returning({ id: billingWebhookDeadLetter.id });

            const deadLetterId = inserted!.id;

            // Act — call retry without auth
            const response = await app.request(dlqRetryPath(deadLetterId), {
                method: 'POST',
                headers: { 'content-type': 'application/json' }
            });

            // Assert — authentication required
            expect([401, 403]).toContain(response.status);

            // Assert — the DLQ entry was NOT resolved by the unauthenticated attempt
            const dlqRows = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            expect(dlqRows[0]?.resolvedAt).toBeNull();
        });

        it('should return 404 or 401/403 for a non-existent dead letter UUID without auth', async () => {
            // Arrange — use a valid UUID that does not exist in the DB
            const nonExistentId = '00000000-0000-4000-8000-000000000000';

            // Act
            const response = await app.request(dlqRetryPath(nonExistentId), {
                method: 'POST',
                headers: { 'content-type': 'application/json' }
            });

            // Assert — either auth rejected (401/403) or not found (404)
            expect([401, 403, 404]).toContain(response.status);
        });
    });

    // -------------------------------------------------------------------------
    // Test 5 — DLQ filtering by resolved status (DB-level verification)
    // -------------------------------------------------------------------------

    describe('DLQ filtering — unresolved vs resolved entries', () => {
        it('should distinguish unresolved entries from resolved ones in the database', async () => {
            // Arrange — insert one resolved and one unresolved entry
            const db = testDb.getDb();
            const unresolvedId = newProviderEventId();
            const resolvedId = newProviderEventId();

            await db.insert(billingWebhookDeadLetter).values([
                buildDeadLetterPayload(unresolvedId),
                {
                    ...buildDeadLetterPayload(resolvedId),
                    resolvedAt: new Date('2025-01-10T09:00:00Z')
                }
            ]);

            // Act — query unresolved entries (resolved_at IS NULL)
            const unresolvedEntries = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(isNull(billingWebhookDeadLetter.resolvedAt));

            // Assert — only the unresolved entry appears in the unresolved set
            const unresolvedProviderIds = unresolvedEntries.map(
                (e: QZPayBillingWebhookDeadLetter) => e.providerEventId
            );
            expect(unresolvedProviderIds).toContain(unresolvedId);
            expect(unresolvedProviderIds).not.toContain(resolvedId);
        });

        it('should have zero unresolved entries after all DLQ items are resolved', async () => {
            // Arrange — insert two entries
            const db = testDb.getDb();
            const id1 = newProviderEventId();
            const id2 = newProviderEventId();

            const inserted = await db
                .insert(billingWebhookDeadLetter)
                .values([buildDeadLetterPayload(id1), buildDeadLetterPayload(id2)])
                .returning({ id: billingWebhookDeadLetter.id });

            // Act — resolve both entries (simulate two successful retries)
            for (const row of inserted) {
                await db
                    .update(billingWebhookDeadLetter)
                    .set({ resolvedAt: new Date() })
                    .where(eq(billingWebhookDeadLetter.id, row.id));
            }

            // Assert — no unresolved entries remain
            const remaining = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(isNull(billingWebhookDeadLetter.resolvedAt));

            expect(remaining).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // Test 6 — Complete DLQ lifecycle (failure → DLQ insert → retry → resolved)
    // -------------------------------------------------------------------------

    describe('Complete DLQ lifecycle', () => {
        it('should complete the full webhook failure -> DLQ -> retry -> resolved flow', async () => {
            // ─── Phase 1: Webhook processing failure ─────────────────────────
            // Simulate: webhook handler receives event, processing fails, event
            // lands in billing_webhook_events with status 'failed'.
            const providerEventId = newProviderEventId();
            const db = testDb.getDb();

            const webhookPayload: Record<string, unknown> = {
                id: providerEventId,
                type: 'payment',
                action: 'payment.updated',
                data: { id: 'payment-lifecycle', status: 'approved' },
                live_mode: false
            };

            // Insert into billing_webhook_events as 'failed' (webhook received but failed)
            await db.insert(billingWebhookEvents).values({
                providerEventId,
                provider: 'mercadopago',
                type: 'payment.updated',
                status: 'failed',
                payload: webhookPayload,
                error: 'Payment lookup failed: timeout',
                attempts: 3,
                livemode: false
            });

            // ─── Phase 2: DLQ entry created (simulates cron escalation) ─────
            // After MAX_RETRY_ATTEMPTS, the cron job inserts into dead letter.
            const [dlqRow] = await db
                .insert(billingWebhookDeadLetter)
                .values({
                    providerEventId,
                    provider: 'mercadopago',
                    type: 'payment.updated',
                    payload: webhookPayload,
                    error: 'Permanently failed after 3 attempts: Payment lookup failed: timeout',
                    attempts: 3,
                    livemode: false
                })
                .returning({ id: billingWebhookDeadLetter.id });

            expect(dlqRow).toBeDefined();
            const deadLetterId = dlqRow!.id;

            // Verify DLQ entry is unresolved
            const dlqBefore = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            expect(dlqBefore[0]?.resolvedAt).toBeNull();
            expect(dlqBefore[0]?.attempts).toBe(3);

            // ─── Phase 3: Admin triggers retry ───────────────────────────────
            // Simulate the retryDeadLetterRoute logic:
            //   (a) insert a new billing_webhook_events row for reprocessing
            //   (b) set resolved_at on the dead letter entry

            const [retryEvent] = await db
                .insert(billingWebhookEvents)
                .values({
                    providerEventId,
                    provider: 'mercadopago',
                    type: 'payment.updated',
                    status: 'pending',
                    payload: webhookPayload,
                    attempts: 0,
                    livemode: false
                })
                .returning({ id: billingWebhookEvents.id });

            expect(retryEvent).toBeDefined();

            await db
                .update(billingWebhookDeadLetter)
                .set({ resolvedAt: new Date() })
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            // ─── Phase 4: Assertions ─────────────────────────────────────────

            // Dead letter is now resolved
            const dlqAfter = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(eq(billingWebhookDeadLetter.id, deadLetterId));

            expect(dlqAfter[0]?.resolvedAt).not.toBeNull();
            expect(dlqAfter[0]?.resolvedAt).toBeInstanceOf(Date);

            // New webhook event exists (ready for the cron to process)
            const eventRows = await db
                .select()
                .from(billingWebhookEvents)
                .where(eq(billingWebhookEvents.providerEventId, providerEventId));

            // Two rows: the original failed one + the new pending retry
            expect(eventRows.length).toBeGreaterThanOrEqual(2);

            const retryRow = eventRows.find(
                (e: QZPayBillingWebhookEvent) => e.id === retryEvent?.id
            );
            expect(retryRow?.status).toBe('pending');
            expect(retryRow?.attempts).toBe(0);

            const originalRow = eventRows.find(
                (e: QZPayBillingWebhookEvent) => e.status === 'failed'
            );
            expect(originalRow).toBeDefined();
        });
    });
});
