/**
 * @file make-callbacks.test.ts
 *
 * Route tests for Make.com inbound callback endpoints — SPEC-254 T-048.
 *
 * Tests:
 *  - POST /{targetId}/claim
 *    - 200 happy path (service called with targetId + makeRunId, returns PUBLISHING)
 *    - 409 already-published (service throws ALREADY_EXISTS, reason ALREADY_PUBLISHED)
 *    - 404 not found (service throws NOT_FOUND)
 *    - 401 missing / invalid x-hospeda-make-key (real apiKeyMiddleware via mini-app)
 *
 *  - POST /{targetId}/result
 *    - 200 SUCCESS outcome
 *    - 200 FAILED outcome (with retry/exhaustion returning APPROVED or FAILED)
 *    - 422 invalid body (Zod: missing status field)
 *    - 422 invalid status value (Zod: status not in ['SUCCESS', 'FAILED'])
 *
 * Pattern: mock `createApiKeyRoute` to capture the raw handler and invoke it
 * directly (handler-level). Auth 401 cases use a minimal Hono app with the real
 * `apiKeyMiddleware`.
 *
 * @module test/routes/integrations/make/social/jobs/make-callbacks
 * @see SPEC-254 T-048, US-12, US-13
 */

import { ServiceErrorCode } from '@repo/schemas';
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

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<string, CapturedHandler>()
}));

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

const { mockHandleClaim, mockHandleResult } = vi.hoisted(() => ({
    mockHandleClaim: vi.fn(),
    mockHandleResult: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    SocialPublishDispatchService: vi.fn().mockImplementation(() => ({
        handleMakeCallbackClaim: mockHandleClaim,
        handleMakeCallbackResult: mockHandleResult
    })),
    ServiceError: class ServiceError extends Error {
        public code: string;
        public reason?: string;
        public details?: unknown;

        constructor(code: string, message: string, details?: unknown, reason?: string) {
            super(message);
            this.name = 'ServiceError';
            this.code = code;
            this.details = details;
            this.reason = reason;
        }
    }
}));

// ---------------------------------------------------------------------------
// Route factory mock (capture handlers, skip auth middleware)
// ---------------------------------------------------------------------------

vi.mock('../../../../../../src/utils/route-factory-tiered', () => ({
    createApiKeyRoute: vi.fn(
        (config: {
            method: string;
            path: string;
            handler: CapturedHandler;
            apiKeyConfig: {
                headerName: string;
                getExpectedKey: () => string | undefined;
                actor: { id: string; name: string };
            };
        }) => {
            const key = `${config.method}:${config.path}`;
            capturedHandlers.set(key, config.handler);
            // Also store the apiKeyConfig for inspection
            capturedHandlers.set(
                `${key}:config`,
                config.apiKeyConfig as unknown as CapturedHandler
            );
            return config.handler;
        }
    )
}));

// ---------------------------------------------------------------------------
// Env mock
// ---------------------------------------------------------------------------

const TEST_MAKE_KEY = 'test-make-inbound-key';

vi.mock('../../../../../../src/utils/env', () => ({
    env: {
        HOSPEDA_MAKE_INBOUND_KEY: TEST_MAKE_KEY
    }
}));

vi.mock('../../../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let claimHandler: CapturedHandler | undefined;
let resultHandler: CapturedHandler | undefined;

beforeEach(async () => {
    vi.clearAllMocks();
    capturedHandlers.clear();

    // Trigger module evaluation — registers both handlers
    await import('../../../../../../src/routes/integrations/make/social/jobs/claim');
    await import('../../../../../../src/routes/integrations/make/social/jobs/result');

    claimHandler = capturedHandlers.get('post:/{targetId}/claim');
    resultHandler = capturedHandlers.get('post:/{targetId}/result');
});

afterEach(() => {
    vi.resetModules();
    capturedHandlers.clear();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TARGET_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const MAKE_RUN_ID = 'make-run-scenario-001';

// ---------------------------------------------------------------------------
// Tests — POST /{targetId}/claim
// ---------------------------------------------------------------------------

describe('POST /{targetId}/claim', () => {
    describe('handler registration', () => {
        it('registers the claim handler', () => {
            expect(claimHandler).toBeDefined();
        });

        it('uses x-hospeda-make-key header and HOSPEDA_MAKE_INBOUND_KEY env var', () => {
            const config = capturedHandlers.get('post:/{targetId}/claim:config') as unknown as {
                headerName: string;
                getExpectedKey: () => string | undefined;
                actor: { id: string; name: string };
            };
            expect(config).toBeDefined();
            expect(config.headerName).toBe('x-hospeda-make-key');
            expect(config.getExpectedKey()).toBe(TEST_MAKE_KEY);
            expect(config.actor.id).toBe('make-callback');
        });
    });

    describe('200 — happy path', () => {
        it('calls service with targetId + makeRunId and returns PUBLISHING status', async () => {
            const expected = { targetId: TARGET_ID, status: 'PUBLISHING' as const };
            mockHandleClaim.mockResolvedValue(expected);

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = await claimHandler!(
                null,
                { targetId: TARGET_ID },
                { makeRunId: MAKE_RUN_ID }
            );

            expect(mockHandleClaim).toHaveBeenCalledWith({
                targetId: TARGET_ID,
                makeRunId: MAKE_RUN_ID
            });
            expect(result).toEqual(expected);
        });
    });

    describe('409 — already published', () => {
        it('propagates thrown ServiceError with reason ALREADY_PUBLISHED', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const error = new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Target already published',
                undefined,
                'ALREADY_PUBLISHED'
            );
            mockHandleClaim.mockRejectedValue(error);

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const thrown = await claimHandler!(
                null,
                { targetId: TARGET_ID },
                { makeRunId: MAKE_RUN_ID }
            ).catch((e: unknown) => e);

            expect(thrown).toBeInstanceOf(ServiceError);
            const err = thrown as InstanceType<typeof ServiceError>;
            expect(err.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(err.reason).toBe('ALREADY_PUBLISHED');
        });
    });

    describe('404 — target not found', () => {
        it('propagates thrown ServiceError with code NOT_FOUND', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const error = new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `social_post_target not found: ${TARGET_ID}`
            );
            mockHandleClaim.mockRejectedValue(error);

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const thrown = await claimHandler!(
                null,
                { targetId: TARGET_ID },
                { makeRunId: MAKE_RUN_ID }
            ).catch((e: unknown) => e);

            expect(thrown).toBeInstanceOf(ServiceError);
            const err = thrown as InstanceType<typeof ServiceError>;
            expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('401 — missing / invalid x-hospeda-make-key (real middleware)', () => {
        it('returns 401 when x-hospeda-make-key header is missing', async () => {
            const { apiKeyMiddleware } = await import('../../../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-make-key',
                    getExpectedKey: () => TEST_MAKE_KEY,
                    actor: { id: 'make-callback', name: 'Make.com Callback' }
                })
            );
            miniApp.post('/:targetId/claim', (c) => c.json({ ok: true }));

            const res = await miniApp.request(`/${TARGET_ID}/claim`, { method: 'POST' });
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('returns 401 when x-hospeda-make-key has wrong value', async () => {
            const { apiKeyMiddleware } = await import('../../../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-make-key',
                    getExpectedKey: () => TEST_MAKE_KEY,
                    actor: { id: 'make-callback', name: 'Make.com Callback' }
                })
            );
            miniApp.post('/:targetId/claim', (c) => c.json({ ok: true }));

            const res = await miniApp.request(`/${TARGET_ID}/claim`, {
                method: 'POST',
                headers: { 'x-hospeda-make-key': 'wrong-key-value' }
            });
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('returns 401 when env key is not configured (fail-closed)', async () => {
            const { apiKeyMiddleware } = await import('../../../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-make-key',
                    getExpectedKey: () => undefined,
                    actor: { id: 'make-callback', name: 'Make.com Callback' }
                })
            );
            miniApp.post('/:targetId/claim', (c) => c.json({ ok: true }));

            const res = await miniApp.request(`/${TARGET_ID}/claim`, {
                method: 'POST',
                headers: { 'x-hospeda-make-key': TEST_MAKE_KEY }
            });
            expect(res.status).toBe(401);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — POST /{targetId}/result
// ---------------------------------------------------------------------------

describe('POST /{targetId}/result', () => {
    describe('handler registration', () => {
        it('registers the result handler', () => {
            expect(resultHandler).toBeDefined();
        });

        it('uses x-hospeda-make-key header and HOSPEDA_MAKE_INBOUND_KEY env var', () => {
            const config = capturedHandlers.get('post:/{targetId}/result:config') as unknown as {
                headerName: string;
                getExpectedKey: () => string | undefined;
                actor: { id: string; name: string };
            };
            expect(config).toBeDefined();
            expect(config.headerName).toBe('x-hospeda-make-key');
            expect(config.getExpectedKey()).toBe(TEST_MAKE_KEY);
            expect(config.actor.id).toBe('make-callback');
        });
    });

    describe('200 — SUCCESS outcome', () => {
        it('calls service with full SUCCESS payload and returns PUBLISHED status', async () => {
            const expected = { targetId: TARGET_ID, status: 'PUBLISHED' as const };
            mockHandleResult.mockResolvedValue(expected);

            const body = {
                status: 'SUCCESS',
                externalPostId: 'ig-post-abc123',
                externalPostUrl: 'https://www.instagram.com/p/abc123',
                makeRunId: MAKE_RUN_ID
            };

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = await resultHandler!(null, { targetId: TARGET_ID }, body);

            expect(mockHandleResult).toHaveBeenCalledWith({
                targetId: TARGET_ID,
                status: 'SUCCESS',
                externalPostId: 'ig-post-abc123',
                externalPostUrl: 'https://www.instagram.com/p/abc123',
                makeRunId: MAKE_RUN_ID,
                errorMessage: undefined
            });
            expect(result).toEqual(expected);
        });
    });

    describe('200 — FAILED outcome (retry branch)', () => {
        it('calls service with FAILED payload and returns APPROVED when retrying', async () => {
            const expected = { targetId: TARGET_ID, status: 'APPROVED' as const };
            mockHandleResult.mockResolvedValue(expected);

            const body = {
                status: 'FAILED',
                errorMessage: 'Instagram API rate limit exceeded',
                makeRunId: MAKE_RUN_ID
            };

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = await resultHandler!(null, { targetId: TARGET_ID }, body);

            expect(mockHandleResult).toHaveBeenCalledWith({
                targetId: TARGET_ID,
                status: 'FAILED',
                externalPostId: undefined,
                externalPostUrl: undefined,
                makeRunId: MAKE_RUN_ID,
                errorMessage: 'Instagram API rate limit exceeded'
            });
            expect(result).toEqual(expected);
        });
    });

    describe('200 — FAILED outcome (exhaustion branch)', () => {
        it('calls service with FAILED payload and returns FAILED when exhausted', async () => {
            const expected = { targetId: TARGET_ID, status: 'FAILED' as const };
            mockHandleResult.mockResolvedValue(expected);

            const body = {
                status: 'FAILED',
                errorMessage: 'Max retries reached on Make side',
                makeRunId: MAKE_RUN_ID
            };

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = await resultHandler!(null, { targetId: TARGET_ID }, body);

            expect(mockHandleResult).toHaveBeenCalledWith({
                targetId: TARGET_ID,
                status: 'FAILED',
                externalPostId: undefined,
                externalPostUrl: undefined,
                makeRunId: MAKE_RUN_ID,
                errorMessage: 'Max retries reached on Make side'
            });
            expect(result).toEqual(expected);
        });
    });

    describe('422 — invalid body (Zod validation)', () => {
        it('Zod rejects body with missing status field', async () => {
            const { MakeResultCallbackSchema } = await import('@repo/schemas');

            const parseResult = MakeResultCallbackSchema.safeParse({
                externalPostId: 'ig-post-abc'
            });
            expect(parseResult.success).toBe(false);
            if (!parseResult.success) {
                const fields = parseResult.error.issues.map((issue) => issue.path.join('.'));
                expect(fields).toContain('status');
            }
        });

        it('Zod rejects body with invalid status value (not SUCCESS or FAILED)', async () => {
            const { MakeResultCallbackSchema } = await import('@repo/schemas');

            const parseResult = MakeResultCallbackSchema.safeParse({
                status: 'PENDING'
            });
            expect(parseResult.success).toBe(false);
            if (!parseResult.success) {
                const statusIssue = parseResult.error.issues.find(
                    (issue) => issue.path[0] === 'status'
                );
                expect(statusIssue).toBeDefined();
            }
        });

        it('Zod rejects body with invalid externalPostUrl (not a URL)', async () => {
            const { MakeResultCallbackSchema } = await import('@repo/schemas');

            const parseResult = MakeResultCallbackSchema.safeParse({
                status: 'SUCCESS',
                externalPostUrl: 'not-a-valid-url'
            });
            expect(parseResult.success).toBe(false);
            if (!parseResult.success) {
                const urlIssue = parseResult.error.issues.find(
                    (issue) => issue.path[0] === 'externalPostUrl'
                );
                expect(urlIssue).toBeDefined();
            }
        });
    });

    describe('404 — target not found', () => {
        it('propagates thrown ServiceError with code NOT_FOUND', async () => {
            const { ServiceError } = await import('@repo/service-core');
            const error = new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `social_post_target not found: ${TARGET_ID}`
            );
            mockHandleResult.mockRejectedValue(error);

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const thrown = await resultHandler!(
                null,
                { targetId: TARGET_ID },
                { status: 'SUCCESS' }
            ).catch((e: unknown) => e);

            expect(thrown).toBeInstanceOf(ServiceError);
            const err = thrown as InstanceType<typeof ServiceError>;
            expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });
});
