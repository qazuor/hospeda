/**
 * Integration tests for GET /api/v1/ai/social/public-data — HOS-66 T-023 (G-10).
 *
 * The public-data-pull endpoint lets the Custom GPT fetch a tightly-scoped set
 * of public accommodations + destinations to enrich a social draft. Auth is the
 * inbound `x-hospeda-ai-key` API key ONLY (same as /catalog).
 *
 * Tests:
 *  - valid api-key → 200 with the service's `{ items }` payload
 *  - free-text `query` param is forwarded to the service
 *  - omitted `query` forwards `undefined`
 *  - service error → 500 envelope
 *  - missing / invalid api-key header → 401
 *
 * Pattern mirrors `social-catalog.test.ts`: mock `createApiKeyRoute` to capture
 * the raw handler, mock the service, and boot a minimal Hono app with the real
 * `apiKeyMiddleware` for the 401 scenarios.
 *
 * @module test/routes/social/ai/social-public-data
 * @see HOS-66 T-023
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type CapturedHandler = (
    ctx: unknown,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>
) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedHandlers, mockGetPublicData } = vi.hoisted(() => ({
    capturedHandlers: new Map<string, CapturedHandler>(),
    mockGetPublicData: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// SocialPublicDataService — the route constructs `new SocialPublicDataService()`
// and calls `.getPublicData(input)`.
vi.mock('@repo/service-core', () => ({
    SocialPublicDataService: class {
        getPublicData = mockGetPublicData;
    }
}));

// Capture the handler passed to createApiKeyRoute; skip real auth wiring.
vi.mock('../../../../src/utils/route-factory-tiered', () => ({
    createApiKeyRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedHandlers.set(config.path, config.handler);
        return config.handler;
    })
}));

// public-data.ts imports getDecryptedSocialCredential for the api-key getExpectedKey.
vi.mock('../../../../src/services/social-credential-vault.service.js', () => ({
    getDecryptedSocialCredential: vi.fn().mockResolvedValue({
        data: { key: 'ai_social_key', plaintext: 'test-secret-key' }
    })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCOMMODATION_ITEM = {
    entityType: 'ACCOMMODATION',
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Cabaña del Río',
    slug: 'cabana-del-rio',
    summary: 'Una cabaña frente al río Uruguay.',
    imageUrl: 'https://cdn.example.com/cabana.jpg'
};

const DESTINATION_ITEM = {
    entityType: 'DESTINATION',
    id: '00000000-0000-4000-8000-000000000102',
    title: 'Concepción del Uruguay',
    slug: 'concepcion-del-uruguay',
    summary: 'Ciudad histórica del Litoral entrerriano.',
    imageUrl: null
};

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let handler: CapturedHandler | undefined;

beforeEach(async () => {
    vi.clearAllMocks();
    capturedHandlers.clear();

    await import('../../../../src/routes/ai/social/public-data');
    handler = capturedHandlers.get('/');
});

afterEach(() => {
    vi.resetModules();
    capturedHandlers.clear();
});

/** Minimal Hono-context stub exposing only the `json` method the handler uses. */
function makeCtxStub() {
    return {
        json: vi.fn((body: unknown, status?: number) => ({ __body: body, __status: status }))
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/ai/social/public-data (handler-level)', () => {
    describe('200 — valid request', () => {
        it('should return the service items payload', async () => {
            mockGetPublicData.mockResolvedValue({
                data: { items: [ACCOMMODATION_ITEM, DESTINATION_ITEM] }
            });

            const result = (await handler!(makeCtxStub(), {}, {}, {})) as {
                items: unknown[];
            };

            expect(result.items).toHaveLength(2);
            expect(result.items[0]).toEqual(ACCOMMODATION_ITEM);
            expect(result.items[1]).toEqual(DESTINATION_ITEM);
        });

        it('should return an empty items list gracefully', async () => {
            mockGetPublicData.mockResolvedValue({ data: { items: [] } });

            const result = (await handler!(makeCtxStub(), {}, {}, {})) as { items: unknown[] };

            expect(result.items).toHaveLength(0);
        });
    });

    describe('free-text query forwarding', () => {
        it('should forward the query param to the service', async () => {
            mockGetPublicData.mockResolvedValue({ data: { items: [] } });

            await handler!(makeCtxStub(), {}, {}, { query: 'río' });

            expect(mockGetPublicData).toHaveBeenCalledWith({ query: 'río' });
        });

        it('should forward undefined when query is omitted', async () => {
            mockGetPublicData.mockResolvedValue({ data: { items: [] } });

            await handler!(makeCtxStub(), {}, {}, {});

            expect(mockGetPublicData).toHaveBeenCalledWith({ query: undefined });
        });
    });

    describe('error handling', () => {
        it('should return a 500 envelope when the service reports an error', async () => {
            mockGetPublicData.mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'db down' }
            });
            const ctx = makeCtxStub();

            await handler!(ctx, {}, {}, {});

            expect(ctx.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({ code: 'INTERNAL_ERROR' })
                }),
                500
            );
        });
    });

    describe('auth gating — api-key middleware behaviour', () => {
        it('should return 401 when x-hospeda-ai-key header is missing', async () => {
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => 'test-secret-key',
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.get('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/');
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 401 when x-hospeda-ai-key has wrong value', async () => {
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => 'test-secret-key',
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.get('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/', {
                headers: { 'x-hospeda-ai-key': 'wrong-key' }
            });
            expect(res.status).toBe(401);
        });

        it('should pass through with the correct api key', async () => {
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => 'test-secret-key',
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.get('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/', {
                headers: { 'x-hospeda-ai-key': 'test-secret-key' }
            });
            expect(res.status).toBe(200);
        });
    });
});
