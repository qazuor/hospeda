/**
 * Regression test for HOS-708.
 *
 * `handleWebhookEvent` (event-handler.ts) persists every incoming MercadoPago
 * webhook with a direct Drizzle INSERT into `billing_webhook_events` — it
 * bypasses the QZPay storage adapter entirely (see the comment on that INSERT
 * in the source), so it must derive `livemode` itself instead of inheriting
 * the adapter's computation.
 *
 * The bug: that INSERT never set `livemode` at all, so every row fell through
 * to the column's `DEFAULT true` (packages/db/src/migrations/0000_baseline.sql).
 * On staging — where `HOSPEDA_MERCADO_PAGO_SANDBOX=true` — the very first
 * webhook event was persisted as `livemode=true`, indistinguishable from a
 * real production event in the same table.
 *
 * The fix mirrors the single source of truth `middlewares/billing.ts` already
 * uses for the same computation: `livemode = !env.HOSPEDA_MERCADO_PAGO_SANDBOX`.
 *
 * This is a DB-level test in the spirit of `webhook-idempotency-db.test.ts`
 * (same directory): it locally overrides the global `@repo/db` mock (which
 * apps/api's `setup.ts` stubs wholesale — asserting against ITS default
 * insert behavior would be vacuous) with a query-chain mock that captures the
 * exact values object passed to `.values()`, so the assertion is about what
 * the handler computed, not what a shared mock happens to do.
 *
 * @module test/routes/webhooks/webhook-event-livemode
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted, declared before the import under test).
// ---------------------------------------------------------------------------

const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();
const mockDb = {
    insert: mockInsert
};

vi.mock('@repo/db', () => ({
    getDb: () => mockDb,
    billingWebhookEvents: {
        id: 'id',
        providerEventId: 'provider_event_id',
        status: 'status',
        provider: 'provider',
        type: 'type',
        payload: 'payload',
        error: 'error',
        processedAt: 'processed_at',
        createdAt: 'created_at',
        livemode: 'livemode'
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ column: col, value: val, op: 'eq' }))
}));

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    createMercadoPagoAdapter: vi.fn(),
    getAddonBySlug: vi.fn()
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../../src/lib/sentry', () => ({
    captureWebhookError: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Hoisted so the env value can be flipped per-test via `mockEnv.HOSPEDA_...`.
const mockEnv = vi.hoisted(() => ({
    HOSPEDA_MERCADO_PAGO_SANDBOX: true as boolean
}));

vi.mock('../../../src/utils/env', () => ({
    env: mockEnv
}));

// ---------------------------------------------------------------------------
// Imports (vi.mock calls above are hoisted, so these are safe).
// ---------------------------------------------------------------------------

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import type { Context } from 'hono';
import { handleWebhookEvent } from '../../../src/routes/webhooks/mercadopago/event-handler';

/**
 * Minimal Hono context stub — `handleWebhookEvent` only calls `c.get('requestId')`.
 */
function makeMockContext(): Context {
    return {
        get: vi.fn(() => 'test-request-id')
    } as unknown as Context;
}

function makeTestEvent(id: string): QZPayWebhookEvent {
    return {
        id,
        type: 'subscription.updated',
        data: { id },
        created: new Date()
    } as QZPayWebhookEvent;
}

describe('handleWebhookEvent — livemode on the direct billing_webhook_events INSERT (HOS-708)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_MERCADO_PAGO_SANDBOX = true;
        mockInsert.mockReturnValue({ values: mockValues });
        mockValues.mockReturnValue({ returning: mockReturning });
        mockReturning.mockResolvedValue([{ id: 'row-1' }]);
    });

    it('writes livemode: false when HOSPEDA_MERCADO_PAGO_SANDBOX is true (staging)', async () => {
        await handleWebhookEvent(makeMockContext(), makeTestEvent('mp-event-livemode-sandbox'));

        expect(mockValues).toHaveBeenCalledTimes(1);
        const insertedValues = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues.livemode).toBe(false);
    });

    it('writes livemode: true when HOSPEDA_MERCADO_PAGO_SANDBOX is false (production)', async () => {
        mockEnv.HOSPEDA_MERCADO_PAGO_SANDBOX = false;

        await handleWebhookEvent(makeMockContext(), makeTestEvent('mp-event-livemode-prod'));

        expect(mockValues).toHaveBeenCalledTimes(1);
        const insertedValues = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues.livemode).toBe(true);
    });

    it('never omits livemode from the insert payload', async () => {
        await handleWebhookEvent(makeMockContext(), makeTestEvent('mp-event-livemode-present'));

        const insertedValues = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues).toHaveProperty('livemode');
        expect(typeof insertedValues.livemode).toBe('boolean');
    });
});
