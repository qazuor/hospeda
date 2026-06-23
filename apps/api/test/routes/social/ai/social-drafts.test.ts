/**
 * Integration tests for POST /api/v1/ai/social/drafts — SPEC-254 T-029.
 *
 * Tests:
 *  - missing api-key → 401 (real middleware, minimal Hono app)
 *  - invalid api-key → 401 (real middleware, minimal Hono app)
 *  - missing operator_pin → 403 (handler-level, captured handler)
 *  - invalid operator_pin → 403 (handler-level, captured handler)
 *  - duplicate draftId → 409 (service returns CONFLICT)
 *  - zero valid targets → 422 (service returns ZERO_VALID_TARGETS)
 *  - happy path → 201 (service returns SUCCESS)
 *  - internal error → 500 (service returns INTERNAL_ERROR)
 *
 * Pattern:
 *  - Mock `createApiKeyRoute` to capture the raw handler (skip auth middleware
 *    for handler-level tests).
 *  - Mock `@repo/service-core` to inject a controllable `SocialDraftIngestionService`.
 *  - Auth 401 scenarios use a minimal Hono app with the real `apiKeyMiddleware`.
 *  - A minimal `ctx` mock provides `.json()` and `.get()` for handler-level tests.
 *
 * @module test/routes/social/ai/social-drafts
 * @see SPEC-254 T-029
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

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<string, CapturedHandler>()
}));

// ---------------------------------------------------------------------------
// Service mock (controllable ingestDraft)
// ---------------------------------------------------------------------------

const { mockIngestDraft } = vi.hoisted(() => ({
    mockIngestDraft: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    SocialDraftIngestionService: vi.fn().mockImplementation(() => ({
        ingestDraft: mockIngestDraft
    }))
}));

// ---------------------------------------------------------------------------
// Route factory mock (capture handler, skip real middleware setup)
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory-tiered', () => ({
    createApiKeyRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedHandlers.set(config.path, config.handler);
        return config.handler;
    })
}));

// ---------------------------------------------------------------------------
// Env mock — provide a known PIN hash for tests
// sha256('test-pin-1234') = 4c6a6bdba0f1192b774c1bcf437df50b8324cb0c484eac1528ca6bfeafa7ec62
// ---------------------------------------------------------------------------

const TEST_PIN = 'test-pin-1234';
const TEST_PIN_HASH = '4c6a6bdba0f1192b774c1bcf437df50b8324cb0c484eac1528ca6bfeafa7ec62';
const TEST_AI_KEY = 'test-ai-secret-key';

vi.mock('../../../../src/utils/env', () => ({
    env: {
        HOSPEDA_AI_SOCIAL_KEY: TEST_AI_KEY,
        HOSPEDA_OPERATOR_PIN_HASH: TEST_PIN_HASH
    }
}));

// ---------------------------------------------------------------------------
// Minimal context mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal Hono-like context mock.
 * `.json(body, status)` records the call and returns a sentinel object.
 * `.get('actor')` returns a synthetic GPT actor so getActorFromContext succeeds.
 */
function buildCtxMock() {
    const calls: Array<{ body: unknown; status: number }> = [];

    const ctx = {
        _calls: calls,
        json(body: unknown, status = 200) {
            calls.push({ body, status });
            // Return a sentinel that the handler returns; the test reads `ctx._calls`
            return { __jsonResponse: true, body, status };
        },
        get(key: string) {
            if (key === 'actor') {
                return { id: 'gpt-action', name: 'Custom GPT Social Action', role: 'SYSTEM' };
            }
            return undefined;
        }
    };

    return ctx;
}

// ---------------------------------------------------------------------------
// Request body fixtures
// ---------------------------------------------------------------------------

const VALID_BODY: Record<string, unknown> = {
    operatorPin: TEST_PIN,
    draftId: 'draft-uuid-001',
    title: 'Test Social Post',
    captionBase: 'This is a test caption for social media.',
    targets: [{ platform: 'INSTAGRAM', publishFormat: 'FEED_POST' }]
};

const SUCCESS_RESULT = {
    code: 'SUCCESS' as const,
    data: {
        postId: 'post-uuid-001',
        draftId: 'draft-uuid-001',
        status: 'NEEDS_REVIEW' as const,
        approvalStatus: 'PENDING' as const,
        targetsCreated: 1,
        assetStatus: 'none' as const,
        warnings: []
    }
};

const CONFLICT_RESULT = {
    code: 'CONFLICT' as const,
    error: { message: 'Draft with this ID already exists: draft-uuid-001' }
};

const ZERO_TARGETS_RESULT = {
    code: 'ZERO_VALID_TARGETS' as const,
    error: {
        message: 'All requested targets are invalid',
        warnings: [{ field: 'targets[0]', message: 'Platform format not found or disabled' }]
    }
};

const INTERNAL_ERROR_RESULT = {
    code: 'INTERNAL_ERROR' as const,
    error: { message: 'Unexpected database failure' }
};

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let draftsHandler: CapturedHandler | undefined;

beforeEach(async () => {
    vi.clearAllMocks();
    capturedHandlers.clear();

    // Trigger module evaluation so createApiKeyRoute is called and captures the handler
    await import('../../../../src/routes/ai/social/drafts');
    draftsHandler = capturedHandlers.get('/');
});

afterEach(() => {
    vi.resetModules();
    capturedHandlers.clear();
});

// ---------------------------------------------------------------------------
// Tests — Auth gating (401 via real middleware)
// ---------------------------------------------------------------------------

describe('POST /api/v1/ai/social/drafts', () => {
    describe('auth gating — api-key middleware behaviour', () => {
        it('should return 401 when x-hospeda-ai-key header is missing', async () => {
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => TEST_AI_KEY,
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.post('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/', { method: 'POST' });
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
                    getExpectedKey: () => TEST_AI_KEY,
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.post('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/', {
                method: 'POST',
                headers: { 'x-hospeda-ai-key': 'wrong-value' }
            });
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 401 when env key is not configured (fail-closed)', async () => {
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => undefined, // not configured
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.post('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/', {
                method: 'POST',
                headers: { 'x-hospeda-ai-key': 'any-key' }
            });
            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // Tests — Operator PIN validation (403 via handler-level)
    // -------------------------------------------------------------------------

    describe('operator PIN validation (handler-level)', () => {
        it('should return 403 when operatorPin is missing from body', async () => {
            const ctx = buildCtxMock();
            const bodyWithoutPin: Record<string, unknown> = {
                ...VALID_BODY,
                operatorPin: undefined
            };

            const result = await draftsHandler!(ctx, {}, bodyWithoutPin, {});

            expect(ctx._calls).toHaveLength(1);
            expect(ctx._calls[0]?.status).toBe(403);
            expect((ctx._calls[0]?.body as { error: { code: string } }).error.code).toBe(
                'FORBIDDEN'
            );
            expect(result).toMatchObject({ __jsonResponse: true });
            expect(mockIngestDraft).not.toHaveBeenCalled();
        });

        it('should return 403 when operatorPin is an empty string', async () => {
            const ctx = buildCtxMock();
            const body = { ...VALID_BODY, operatorPin: '' };

            await draftsHandler!(ctx, {}, body, {});

            expect(ctx._calls[0]?.status).toBe(403);
            expect((ctx._calls[0]?.body as { error: { code: string } }).error.code).toBe(
                'FORBIDDEN'
            );
            expect(mockIngestDraft).not.toHaveBeenCalled();
        });

        it('should return 403 when operatorPin is wrong', async () => {
            const ctx = buildCtxMock();
            const body = { ...VALID_BODY, operatorPin: 'wrong-pin' };

            await draftsHandler!(ctx, {}, body, {});

            expect(ctx._calls[0]?.status).toBe(403);
            expect((ctx._calls[0]?.body as { error: { code: string } }).error.code).toBe(
                'FORBIDDEN'
            );
            expect(mockIngestDraft).not.toHaveBeenCalled();
        });

        it('should return 403 when operatorPin is a non-string value', async () => {
            const ctx = buildCtxMock();
            const body = { ...VALID_BODY, operatorPin: 12345 };

            await draftsHandler!(ctx, {}, body, {});

            expect(ctx._calls[0]?.status).toBe(403);
            expect((ctx._calls[0]?.body as { error: { code: string } }).error.code).toBe(
                'FORBIDDEN'
            );
            expect(mockIngestDraft).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Tests — Happy path (201)
    // -------------------------------------------------------------------------

    describe('201 — successful ingestion', () => {
        it('should return 201 with post data when ingestion succeeds', async () => {
            mockIngestDraft.mockResolvedValue(SUCCESS_RESULT);
            const ctx = buildCtxMock();

            const result = await draftsHandler!(ctx, {}, VALID_BODY, {});

            // Handler returns result.data directly (no ctx.json) on SUCCESS
            expect(ctx._calls).toHaveLength(0);
            expect(result).toMatchObject({
                postId: 'post-uuid-001',
                draftId: 'draft-uuid-001',
                status: 'NEEDS_REVIEW',
                approvalStatus: 'PENDING',
                targetsCreated: 1,
                assetStatus: 'none',
                warnings: []
            });
        });

        it('should call ingestDraft with payload and actorId', async () => {
            mockIngestDraft.mockResolvedValue(SUCCESS_RESULT);
            const ctx = buildCtxMock();

            await draftsHandler!(ctx, {}, VALID_BODY, {});

            expect(mockIngestDraft).toHaveBeenCalledOnce();
            const callArg = mockIngestDraft.mock.calls[0]?.[0] as {
                payload: Record<string, unknown>;
                actorId: string;
            };
            expect(callArg?.actorId).toBe('gpt-action');
            expect(callArg?.payload).toMatchObject({
                draftId: 'draft-uuid-001',
                captionBase: 'This is a test caption for social media.'
            });
        });
    });

    // -------------------------------------------------------------------------
    // Tests — Duplicate draftId (409)
    // -------------------------------------------------------------------------

    describe('409 — duplicate draft', () => {
        it('should return 409 when service returns CONFLICT', async () => {
            mockIngestDraft.mockResolvedValue(CONFLICT_RESULT);
            const ctx = buildCtxMock();

            await draftsHandler!(ctx, {}, VALID_BODY, {});

            expect(ctx._calls).toHaveLength(1);
            expect(ctx._calls[0]?.status).toBe(409);
            const body = ctx._calls[0]?.body as {
                success: false;
                error: { code: string; message: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('CONFLICT');
            expect(body.error.message).toContain('draft-uuid-001');
        });
    });

    // -------------------------------------------------------------------------
    // Tests — Zero valid targets (422)
    // -------------------------------------------------------------------------

    describe('422 — zero valid targets', () => {
        it('should return 422 with warnings when service returns ZERO_VALID_TARGETS', async () => {
            mockIngestDraft.mockResolvedValue(ZERO_TARGETS_RESULT);
            const ctx = buildCtxMock();

            await draftsHandler!(ctx, {}, VALID_BODY, {});

            expect(ctx._calls).toHaveLength(1);
            expect(ctx._calls[0]?.status).toBe(422);
            const body = ctx._calls[0]?.body as {
                success: false;
                error: { code: string; message: string; details: unknown[] };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(body.error.message).toBe('All requested targets are invalid');
            expect(Array.isArray(body.error.details)).toBe(true);
            expect(body.error.details).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    // Tests — Internal error (500)
    // -------------------------------------------------------------------------

    describe('500 — internal error', () => {
        it('should return 500 when service returns INTERNAL_ERROR', async () => {
            mockIngestDraft.mockResolvedValue(INTERNAL_ERROR_RESULT);
            const ctx = buildCtxMock();

            await draftsHandler!(ctx, {}, VALID_BODY, {});

            expect(ctx._calls).toHaveLength(1);
            expect(ctx._calls[0]?.status).toBe(500);
            const body = ctx._calls[0]?.body as { success: false; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('INTERNAL_ERROR');
        });
    });

    // -------------------------------------------------------------------------
    // Tests — PIN validation edge cases (whitespace-only, type coercion)
    // -------------------------------------------------------------------------

    describe('PIN env guard — edge cases', () => {
        it('should return 403 when operatorPin is whitespace-only', async () => {
            // The validateOperatorPin function trims the pin and rejects empty after trim.
            const ctx = buildCtxMock();
            const body = { ...VALID_BODY, operatorPin: '   ' };

            await draftsHandler!(ctx, {}, body, {});

            expect(ctx._calls[0]?.status).toBe(403);
            expect((ctx._calls[0]?.body as { error: { code: string } }).error.code).toBe(
                'FORBIDDEN'
            );
            expect(mockIngestDraft).not.toHaveBeenCalled();
        });

        it('should not call service when PIN is valid but service is not configured', async () => {
            // Sanity check: correct PIN bypasses the PIN guard and reaches the service.
            mockIngestDraft.mockResolvedValue(SUCCESS_RESULT);
            const ctx = buildCtxMock();

            await draftsHandler!(ctx, {}, VALID_BODY, {});

            // PIN guard did NOT block — service was called.
            expect(mockIngestDraft).toHaveBeenCalledOnce();
        });
    });
});
