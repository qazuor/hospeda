/**
 * Regression test for HOS-719.
 *
 * `upsertEntry` (idempotency-key.ts) persists every cached idempotency-key
 * response with a direct Drizzle INSERT into `billing_idempotency_keys`. The
 * bug: that INSERT hardcoded `livemode: true` instead of deriving it, so
 * every row was mislabeled as production data regardless of
 * `HOSPEDA_MERCADO_PAGO_SANDBOX` — same shape as HOS-708 on
 * `billing_webhook_events`.
 *
 * The fix mirrors the single source of truth `middlewares/billing.ts` and
 * the mercadopago webhook event-handler already use for the same
 * computation: `livemode = !env.HOSPEDA_MERCADO_PAGO_SANDBOX`.
 *
 * Like `webhook-event-livemode.test.ts` (HOS-708's regression test, same
 * directory), this locally overrides the global `@repo/db` mock (which
 * apps/api's `setup.ts` stubs wholesale — asserting against ITS default
 * insert behavior would be vacuous) with a query-chain mock that captures
 * the exact values object passed to `.values()`, so the assertion is about
 * what the middleware computed, not what a shared mock happens to do.
 *
 * @module test/middlewares/idempotency-key-livemode
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted, declared before the import under test).
// ---------------------------------------------------------------------------

const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();

const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();

const mockDb = {
    select: mockSelect,
    insert: mockInsert
};

vi.mock('@repo/db', () => ({
    getDb: () => mockDb,
    billingIdempotencyKeys: {
        key: 'key',
        operation: 'operation',
        requestParams: 'request_params',
        responseBody: 'response_body',
        statusCode: 'status_code',
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        livemode: 'livemode'
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ column: col, value: val, op: 'eq' })),
    sql: Object.assign(vi.fn(), { raw: vi.fn() })
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

const mockActor = { id: 'user-livemode-test', roles: [], permissions: [] };

vi.mock('../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => mockActor)
}));

// Hoisted so the env value can be flipped per-test via `mockEnv.HOSPEDA_...`.
const mockEnv = vi.hoisted(() => ({
    HOSPEDA_MERCADO_PAGO_SANDBOX: true as boolean
}));

vi.mock('../../src/utils/env', () => ({
    env: mockEnv
}));

// ---------------------------------------------------------------------------
// Imports (vi.mock calls above are hoisted, so these are safe).
// ---------------------------------------------------------------------------

import { Hono } from 'hono';
import { idempotencyKeyMiddleware } from '../../src/middlewares/idempotency-key';
import type { AppBindings } from '../../src/types';

describe('idempotencyKeyMiddleware — livemode on the billing_idempotency_keys INSERT (HOS-719)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_MERCADO_PAGO_SANDBOX = true;

        // No existing cached entry — fetchEntry() returns [].
        mockLimit.mockResolvedValue([]);
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockSelect.mockReturnValue({ from: mockFrom });

        // Insert chain — capture the values() argument via mockValues.
        mockOnConflictDoUpdate.mockResolvedValue(undefined);
        mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
        mockInsert.mockReturnValue({ values: mockValues });
    });

    function buildApp() {
        const app = new Hono<AppBindings>();
        app.use('/*', idempotencyKeyMiddleware({ operation: 'test-op' }));
        app.post('/action', (c) => c.json({ success: true, id: 'created-1' }, 200));
        return app;
    }

    it('writes livemode: false when HOSPEDA_MERCADO_PAGO_SANDBOX is true (sandbox)', async () => {
        mockEnv.HOSPEDA_MERCADO_PAGO_SANDBOX = true;
        const app = buildApp();

        const res = await app.request('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'key-sandbox' },
            body: JSON.stringify({ foo: 'bar' })
        });

        expect(res.status).toBe(200);
        expect(mockValues).toHaveBeenCalledTimes(1);
        const insertedValues = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues.livemode).toBe(false);
    });

    it('writes livemode: true when HOSPEDA_MERCADO_PAGO_SANDBOX is false (production)', async () => {
        mockEnv.HOSPEDA_MERCADO_PAGO_SANDBOX = false;
        const app = buildApp();

        const res = await app.request('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'key-prod' },
            body: JSON.stringify({ foo: 'bar' })
        });

        expect(res.status).toBe(200);
        expect(mockValues).toHaveBeenCalledTimes(1);
        const insertedValues = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues.livemode).toBe(true);
    });

    it('never omits livemode from the insert payload', async () => {
        const app = buildApp();

        await app.request('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'key-present' },
            body: JSON.stringify({ foo: 'bar' })
        });

        const insertedValues = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues).toHaveProperty('livemode');
        expect(typeof insertedValues.livemode).toBe('boolean');
    });
});
