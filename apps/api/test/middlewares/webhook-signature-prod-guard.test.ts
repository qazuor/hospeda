/**
 * Unit tests for the SPEC-109 Phase 1 fail-closed behaviour of the
 * MercadoPago webhook signature middleware.
 *
 * The middleware must:
 * - Throw `HTTPException(503)` when running in production with the webhook
 *   secret unset (defense in depth against accidentally accepting
 *   unverified webhooks on prod containers).
 * - Keep the legacy warn-and-pass behaviour in non-production environments
 *   so local dev / CI without billing configured can still boot.
 * - Behave normally (run the signature verification) when the secret is
 *   set, regardless of NODE_ENV.
 *
 * These tests run as pure unit tests (no DB, no HTTP). The full
 * end-to-end signature verification is covered by
 * `test/integration/webhooks/webhook-signature.test.ts`.
 *
 * @module test/middlewares/webhook-signature-prod-guard
 */

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

/**
 * Mutable env mock — individual tests override values via the helper
 * `setEnv()` defined inside the suite. Hoisted so it is available before
 * `vi.mock` factory runs.
 */
const { mockEnv } = vi.hoisted(() => ({
    mockEnv: {
        NODE_ENV: 'test' as 'development' | 'test' | 'production',
        HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET: undefined as string | undefined
    }
}));

vi.mock('../../src/utils/env', () => ({
    env: mockEnv
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// IMPORTANT: import the middleware AFTER the mocks above are registered.
import { createWebhookSignatureMiddleware } from '../../src/middlewares/webhook-signature';
import { apiLogger } from '../../src/utils/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Hono `Context` mock that satisfies what the middleware
 * actually reads (`c.req.path`, `c.req.header`, `c.req.text`).
 */
function createMockContext(overrides: {
    path?: string;
    headers?: Record<string, string>;
    body?: string;
}): Context {
    const headers = overrides.headers ?? {};
    return {
        req: {
            path: overrides.path ?? '/api/v1/webhooks/mercadopago',
            header: (name: string) => headers[name.toLowerCase()],
            text: async () => overrides.body ?? ''
        }
    } as unknown as Context;
}

function setEnv(node: 'development' | 'test' | 'production', secret: string | undefined): void {
    mockEnv.NODE_ENV = node;
    mockEnv.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = secret;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createWebhookSignatureMiddleware — production fail-closed (SPEC-109)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when secret is unset', () => {
        it('throws HTTPException(503) in production', async () => {
            setEnv('production', undefined);
            const middleware = createWebhookSignatureMiddleware();
            const ctx = createMockContext({ body: '{}' });
            const next = vi.fn<Next>();

            await expect(middleware(ctx, next)).rejects.toBeInstanceOf(HTTPException);
            await expect(middleware(ctx, next)).rejects.toMatchObject({ status: 503 });
            expect(next).not.toHaveBeenCalled();
        });

        it('logs an error in production explaining the missing secret', async () => {
            setEnv('production', undefined);
            const middleware = createWebhookSignatureMiddleware();
            const ctx = createMockContext({ body: '{}' });
            const next = vi.fn<Next>();

            await expect(middleware(ctx, next)).rejects.toBeInstanceOf(HTTPException);

            expect(apiLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/webhooks/mercadopago' }),
                expect.stringContaining('not set in production')
            );
        });

        it('warns but passes through in development (regression guard)', async () => {
            setEnv('development', undefined);
            const middleware = createWebhookSignatureMiddleware();
            const ctx = createMockContext({ body: '{}' });
            const next = vi.fn<Next>();

            await middleware(ctx, next);

            expect(next).toHaveBeenCalledOnce();
            expect(apiLogger.warn).toHaveBeenCalled();
            expect(apiLogger.error).not.toHaveBeenCalled();
        });

        it('warns but passes through in test environment', async () => {
            setEnv('test', undefined);
            const middleware = createWebhookSignatureMiddleware();
            const ctx = createMockContext({ body: '{}' });
            const next = vi.fn<Next>();

            await middleware(ctx, next);

            expect(next).toHaveBeenCalledOnce();
            expect(apiLogger.warn).toHaveBeenCalled();
        });
    });

    describe('when secret IS set', () => {
        it('does NOT short-circuit in production — proceeds to signature checks', async () => {
            setEnv('production', 'a-real-secret-for-prod-tests');
            const middleware = createWebhookSignatureMiddleware();
            // No x-signature header → expected to reject with 401 from the
            // SIGNATURE-MISSING branch, NOT the 503 fail-closed branch.
            const ctx = createMockContext({ body: '{"data":{"id":"123"}}' });
            const next = vi.fn<Next>();

            await expect(middleware(ctx, next)).rejects.toMatchObject({ status: 401 });
            expect(next).not.toHaveBeenCalled();
            // The fail-closed error log must not fire when a secret is configured.
            expect(apiLogger.error).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining('not set in production')
            );
        });

        it('does not warn about missing secret in development when secret is set', async () => {
            setEnv('development', 'a-dev-secret');
            const middleware = createWebhookSignatureMiddleware();
            const ctx = createMockContext({ body: '{"data":{"id":"123"}}' });
            const next = vi.fn<Next>();

            await expect(middleware(ctx, next)).rejects.toMatchObject({ status: 401 });
            // The "secret is not set" warning should be silent.
            for (const call of vi.mocked(apiLogger.warn).mock.calls) {
                expect(String(call[0] ?? call)).not.toContain('not set');
            }
        });
    });
});
