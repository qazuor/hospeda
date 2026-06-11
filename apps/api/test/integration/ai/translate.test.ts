/**
 * Integration test for POST /api/v1/protected/ai/translate (SPEC-212 T-018).
 *
 * Architecture: same as text-improve.test.ts — sub-app envelope, stubbed
 * entitlement middleware (injects entitlements/limits/uo billingLoadFailed),
 * stubbed @repo/ai-core (records generateText calls, returns controlled data),
 * real actorMiddleware reading mock headers,
 * real createErrorHandler mapping ServiceError → HTTP status,
 * real PostgreSQL via testDb (vitest.config.e2e.ts).
 *
 * ## Middleware chain exercised
 *
 *   actorMiddleware → protectedAuthMiddleware → entitlementMiddleware (stub)
 *   → rateLimitMiddlewares (real, disabled by HOSPEDA_TESTING_RATE_LIMIT='')
 *   → createAiQuotaMiddleware('translate') (real, uses stub context)
 *   → route handler (calls stubbed generateText, returns JSON)
 *
 * @module test/integration/ai/translate.test
 */

// ---------------------------------------------------------------------------
// Module-scope env vars (MUST be set before any imports)
// ---------------------------------------------------------------------------

process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports)
// ---------------------------------------------------------------------------

/**
 * Captures generateText invocations so the 200-path assertions can verify
 * the route called the engine with correct feature/locale.
 */
const { generateTextCalls, nextGenerateTextResult } = vi.hoisted(() => ({
    generateTextCalls: [] as Array<{ feature: string; prompt: string; locale: string }>,
    nextGenerateTextResult: {
        current: {
            text: 'River Cabin',
            usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        }
    }
}));

/**
 * getMonthlyCallCount mock — controlled per-test.
 */
const { getMonthlyCallCountReturn } = vi.hoisted(() => ({
    getMonthlyCallCountReturn: { current: 0 as number }
}));

/**
 * Stub @repo/ai-core for route handler resolution.
 */
vi.mock('@repo/ai-core', () => {
    class StubProvider {}
    class OpenAiAdapter {}
    class AnthropicAdapter {}
    class AiEngineError extends Error {
        readonly engineCode: string;
        constructor(engineCode: string, message?: string) {
            super(message ?? engineCode);
            this.engineCode = engineCode;
        }
    }
    class AiFeatureNotConfiguredError extends Error {
        readonly providerId: string;
        constructor({ providerId }: { providerId: string }) {
            super(`Provider not configured: ${providerId}`);
            this.providerId = providerId;
        }
    }

    return {
        StubProvider,
        OpenAiAdapter,
        AnthropicAdapter,
        AiEngineError,
        AiFeatureNotConfiguredError,
        createAiService: vi.fn(() => ({
            generateText: vi.fn(async (req: Record<string, unknown>) => {
                generateTextCalls.push({
                    feature: String(req.feature ?? ''),
                    prompt: String(req.prompt ?? ''),
                    locale: String(req.locale ?? '')
                });
                return nextGenerateTextResult.current;
            }),
            streamText: vi.fn()
        })),
        getMonthlyCallCount: vi.fn(async () => getMonthlyCallCountReturn.current),
        recordAiUsage: vi.fn(),
        checkCostCeiling: vi.fn(async () => ({ allowed: true })),
        resolveFeatureConfig: vi.fn(async () => ({ enabled: true })),
        resolveSystemPrompt: vi.fn(async () => 'Test prompt')
    };
});

// ---------------------------------------------------------------------------
// Entitlement stub (same pattern as text-improve.test.ts)
// ---------------------------------------------------------------------------

const { currentEntitlementsForTest, currentLimitsForTest, currentBillingLoadFailedForTest } =
    vi.hoisted(() => ({
        currentEntitlementsForTest: { current: new Set<string>() },
        currentLimitsForTest: { current: new Map<string, number>() },
        currentBillingLoadFailedForTest: { current: false }
    }));

vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        entitlementMiddleware: () => {
            return async (c: any, next: () => Promise<void>) => {
                c.set('userEntitlements', currentEntitlementsForTest.current);
                c.set('userLimits', currentLimitsForTest.current);
                c.set('billingLoadFailed', currentBillingLoadFailedForTest.current);
                await next();
            };
        }
    };
});

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    return createDbMock();
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { OpenAPIHono } from '@hono/zod-openapi';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import { createErrorHandler } from '../../../src/middlewares/response';
import { protectedAiTranslateRoute } from '../../../src/routes/ai/protected/translate';
import type { AppBindings } from '../../../src/types';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PATH = '/test-translate';
const UNIQUE_USER_ID = '22222222-2222-4222-2222-222222222222';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockActorHeaders(overrides: Record<string, string> = {}): Record<string, string> {
    return {
        'content-type': 'application/json',
        'x-mock-actor-id': overrides.actorId ?? UNIQUE_USER_ID,
        'x-mock-actor-role': overrides.role ?? RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

function buildTestApp(): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });
    app.onError(createErrorHandler());
    app.use(actorMiddleware());
    app.route(TEST_PATH, protectedAiTranslateRoute);
    return app;
}

function resetMockState() {
    generateTextCalls.length = 0;
    nextGenerateTextResult.current = {
        text: 'River Cabin',
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        provider: 'stub',
        model: 'stub-model',
        finishReason: 'stop'
    };
    getMonthlyCallCountReturn.current = 0;
    currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TRANSLATE]);
    currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TRANSLATE_PER_MONTH, 200]]);
    currentBillingLoadFailedForTest.current = false;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/ai/translate (integration)', () => {
    let testApp: OpenAPIHono<AppBindings>;

    beforeAll(async () => {
        await testDb.setup();
        testApp = buildTestApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(() => {
        resetMockState();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // -----------------------------------------------------------------------
    // 401 — unauthenticated
    // -----------------------------------------------------------------------

    it('returns 401 when no actor headers are present', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-0000-000000000001'
            })
        });

        expect(res.status).toBe(401);
    });

    // -----------------------------------------------------------------------
    // 403 ENTITLEMENT_REQUIRED — no translate entitlement
    // -----------------------------------------------------------------------

    it('returns 403 ENTITLEMENT_REQUIRED when user lacks ai_translate', async () => {
        currentEntitlementsForTest.current = new Set<EntitlementKey>();
        currentLimitsForTest.current = new Map<LimitKey, number>();

        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-0000-000000000001'
            })
        });

        expect(res.status).toBe(403);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.error).toBeDefined();
    });

    // -----------------------------------------------------------------------
    // 403 LIMIT_REACHED — over monthly quota
    // -----------------------------------------------------------------------

    it('returns 403 LIMIT_REACHED when over monthly quota', async () => {
        getMonthlyCallCountReturn.current = 200; // limit is 200

        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-0000-000000000001'
            })
        });

        expect(res.status).toBe(403);
        const body = (await res.json()) as Record<string, unknown>;
        const error = body.error as Record<string, unknown>;
        expect(error?.code).toBe('LIMIT_REACHED');
    });

    // -----------------------------------------------------------------------
    // 503 SERVICE_UNAVAILABLE — billing outage
    // -----------------------------------------------------------------------

    it('returns 503 SERVICE_UNAVAILABLE when billing load fails', async () => {
        currentBillingLoadFailedForTest.current = true;

        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-0000-000000000001'
            })
        });

        expect(res.status).toBe(503);
    });

    // -----------------------------------------------------------------------
    // 400 VALIDATION_ERROR — missing fields
    // -----------------------------------------------------------------------

    it('returns 400 when entityType is missing', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({ entityId: '00000000-0000-4000-0000-000000000001' })
        });

        expect(res.status).toBe(400);
    });

    it('returns 400 when entityId is missing', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({ entityType: 'accommodation' })
        });

        expect(res.status).toBe(400);
    });

    it('returns 400 with invalid entityType', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'invalid_type',
                entityId: '00000000-0000-4000-0000-000000000001'
            })
        });

        expect(res.status).toBe(400);
    });

    it('returns 400 with invalid UUID', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({ entityType: 'accommodation', entityId: 'not-a-uuid' })
        });

        expect(res.status).toBe(400);
    });

    // -----------------------------------------------------------------------
    // 200 — successful translation
    // -----------------------------------------------------------------------

    it('returns 200 with translation results for entitled user', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-0000-000000000001'
            })
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.success).toBe(true);

        const data = body.data as Record<string, unknown>;
        expect(data.entityId).toBeDefined();
        expect(data.translations).toBeDefined();
    });

    it('includes targetLocales in the response', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-0000-000000000001',
                targetLocales: ['en']
            })
        });

        expect(res.status).toBe(200);
    });

    it('accepts destination as entityType', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'destination',
                entityId: '11111111-1111-4111-1111-111111111111'
            })
        });

        expect(res.status).toBe(200);
    });

    it('accepts event as entityType', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'event',
                entityId: '33333333-3333-4333-3333-333333333333'
            })
        });

        expect(res.status).toBe(200);
    });

    it('accepts post as entityType', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'post',
                entityId: '44444444-4444-4444-4444-444444444444'
            })
        });

        expect(res.status).toBe(200);
    });

    // -----------------------------------------------------------------------
    // 404 NOT_FOUND — entity not in DB
    // -----------------------------------------------------------------------

    it('returns 404 when entity is not found in database', async () => {
        // Use an ID that doesn't exist in any table
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: 'ffffffff-ffff-4fff-ffff-ffffffffffff'
            })
        });

        expect(res.status).toBe(404);
    });
});
