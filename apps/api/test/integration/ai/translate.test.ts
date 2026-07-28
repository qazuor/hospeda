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
const { generateTextCalls, nextGenerateTextResult, nextGenerateTextThrow } = vi.hoisted(() => ({
    generateTextCalls: [] as Array<{ feature: string; prompt: string; locale: string }>,
    /**
     * When set, the stubbed `generateText` throws it instead of returning.
     * Drives the "every provider call failed" branch (HOS-328), which must be
     * recorded as `status: 'error'` so it does not consume a quota unit.
     */
    nextGenerateTextThrow: { current: undefined as unknown },
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
 * Hoisted `recordAiUsage` spy (HOS-328).
 *
 * The route must write one `ai_usage` row per request — that row is the ONLY
 * thing `getMonthlyCallCount` counts, so without it the monthly counter can
 * never advance and `MAX_AI_TRANSLATE_PER_MONTH` is unenforceable.
 */
const { mockRecordAiUsage } = vi.hoisted(() => ({
    mockRecordAiUsage: vi.fn(async (_input: Record<string, unknown>) => undefined)
}));

/**
 * When set, `persistTranslations` throws it. Drives the HOS-328 catch path:
 * the provider calls were already paid for, so the spend must still be recorded
 * — as `status: 'error'`, which keeps it visible to the cost ceiling without
 * charging the caller a quota unit for a request that visibly 500s.
 */
const { nextPersistThrow } = vi.hoisted(() => ({
    nextPersistThrow: { current: undefined as unknown }
}));

vi.mock('../../../src/services/ai-translate.service', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/services/ai-translate.service')>();
    return {
        ...actual,
        persistTranslations: async (...args: Parameters<typeof actual.persistTranslations>) => {
            if (nextPersistThrow.current !== undefined) {
                throw nextPersistThrow.current;
            }
            return actual.persistTranslations(...args);
        }
    };
});

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
                if (nextGenerateTextThrow.current !== undefined) {
                    throw nextGenerateTextThrow.current;
                }
                return nextGenerateTextResult.current;
            }),
            streamText: vi.fn()
        })),
        getMonthlyCallCount: vi.fn(async () => getMonthlyCallCountReturn.current),
        recordAiUsage: mockRecordAiUsage,
        checkCostCeiling: vi.fn(async () => ({ allowed: true })),
        resolveFeatureConfig: vi.fn(async () => ({ enabled: true })),
        resolveSystemPrompt: vi.fn(async () => 'Test prompt'),
        // ai-service.factory.createConfiguredAiService awaits resolveConfig() to
        // read the opt-in moderation provider; the stub reports none so the engine
        // skips moderation. Without it the 200-path throws "No resolveConfig
        // export is defined on the @repo/ai-core mock".
        resolveConfig: vi.fn(async () => ({ moderation: undefined }))
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

/**
 * Holds the entity row that the mocked `getDb()` query builder resolves to.
 * `null` makes the builder resolve to `[]` (entity-not-found path); a row object
 * makes it resolve to `[row]` (happy path). Set per-test via `resetMockState()`
 * and overridden in the 404 test. Hoisted so the `vi.mock` factory can close
 * over it.
 */
const { entityRowHolder } = vi.hoisted(() => ({
    entityRowHolder: { current: null as Record<string, unknown> | null }
}));

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    const base = createDbMock();

    // Minimal stub for the `ai_provider_credentials` table (declared INSIDE the
    // factory — vi.mock is hoisted above any top-level const, so an outer
    // reference would hit the temporal dead zone). createConfiguredAiService
    // (ai-service.factory.ts) selects providerId/metadata from it; the mocked
    // query resolves it to [] (no providers configured) so the factory falls
    // through to the stubbed @repo/ai-core engine.
    const aiProviderCredentialsStub = {
        providerId: 'provider_id',
        metadata: 'metadata',
        deletedAt: 'deleted_at'
    } as const;

    // The shared createDbMock's query builder sets `limit: mockReturnThis()`, so
    // `const [row] = await db.select()…limit(1)` destructures the non-iterable
    // mock object and throws (→ HTTP 500). This suite's happy path instead needs
    // the builder to RESOLVE to an array holding one entity row. Override getDb()
    // with a thenable chain: every builder method returns the chain, and awaiting
    // the chain yields `entityRowHolder.current` wrapped in an array (or []). The
    // DB access paths in ai-translate.service — loadTranslatableFields /
    // loadExistingTranslations (`select().from().where().limit(1)`, awaited) and
    // persistTranslations (`update().set().where()`, awaited) — all terminate in
    // an await, so a single thenable covers both the read and write paths. The
    // `.from()` table is captured so the ai-service.factory's credentials query
    // (from `aiProviderCredentials`) resolves to `[]` instead of the entity row.
    const makeChain = (): Record<string, unknown> => {
        let fromTable: unknown;
        // Invariant this mock relies on: every getDb() call issues statements
        // against ONE table (the entity table, or aiProviderCredentials). `rows`
        // is broad-by-default — any table that is not the credentials stub yields
        // the entity row. If ai-translate.service ever reads a second, different
        // table on the same getDb() handle, extend this branch accordingly.
        const rows = () => {
            if (fromTable === aiProviderCredentialsStub) return [];
            return entityRowHolder.current ? [entityRowHolder.current] : [];
        };
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        for (const method of [
            'select',
            'where',
            'innerJoin',
            'leftJoin',
            'orderBy',
            'limit',
            'update',
            'set',
            'insert',
            'values',
            'delete'
        ]) {
            chain[method] = self;
        }
        chain.from = (table: unknown) => {
            fromTable = table;
            return chain;
        };
        chain.returning = () => Promise.resolve(rows());
        chain.execute = () => Promise.resolve(rows());
        // Intentional thenable: the mock query builder must be awaitable to mimic
        // Drizzle's terminal `await` on `select()…limit(1)` and `update()…where()`.
        // biome-ignore lint/suspicious/noThenProperty: intentional awaitable mock builder
        chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(rows()).then(resolve, reject);
        return chain;
    };

    return {
        ...base,
        aiProviderCredentials: aiProviderCredentialsStub,
        getDb: vi.fn(() => makeChain())
    };
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

/**
 * Builds a mock entity row carrying every translatable source column across the
 * four entity types (accommodation / destination / event / post) as non-empty
 * Spanish strings, so `loadTranslatableFields` returns fields for whichever
 * entity a test targets. The per-field i18n columns are `null` so
 * `loadExistingTranslations` reports no existing translations and every target
 * locale is treated as missing (the AI stub then "translates" each one).
 */
function makeEntityRow(): Record<string, unknown> {
    return {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Cabaña del Río',
        title: 'Título de Prueba',
        summary: 'Resumen breve del contenido.',
        description: 'Descripción larga del contenido para traducir.',
        richDescription: 'Descripción enriquecida del contenido.',
        content: 'Contenido extenso del post para traducir.',
        nameI18n: null,
        titleI18n: null,
        summaryI18n: null,
        descriptionI18n: null,
        richDescriptionI18n: null,
        contentI18n: null,
        translationMeta: null
    };
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
    // Happy-path default: the entity exists. The 404 test overrides to null.
    entityRowHolder.current = makeEntityRow();
    nextGenerateTextThrow.current = undefined;
    nextPersistThrow.current = undefined;
    mockRecordAiUsage.mockClear();
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
                entityId: '00000000-0000-4000-8000-000000000001'
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
                entityId: '00000000-0000-4000-8000-000000000001'
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
                entityId: '00000000-0000-4000-8000-000000000001'
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
                entityId: '00000000-0000-4000-8000-000000000001'
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
            body: JSON.stringify({ entityId: '00000000-0000-4000-8000-000000000001' })
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
                entityId: '00000000-0000-4000-8000-000000000001'
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
                entityId: '00000000-0000-4000-8000-000000000001'
            })
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.success).toBe(true);

        const data = body.data as Record<string, unknown>;
        expect(data.entityId).toBeDefined();
        expect(data.translations).toBeDefined();

        // Regression guard (SPEC-212 S-1): provider/model/totalTokens must be
        // captured from the AI call, not returned empty/zero.
        expect(data.provider).toBe('stub');
        expect(data.model).toBe('stub-model');
        expect(typeof data.totalTokens).toBe('number');
        expect(data.totalTokens as number).toBeGreaterThan(0);
    });

    it('includes targetLocales in the response', async () => {
        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-8000-000000000001',
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
                entityId: '11111111-1111-4111-8111-111111111111'
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
                entityId: '33333333-3333-4333-8333-333333333333'
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
                entityId: '44444444-4444-4444-8444-444444444444'
            })
        });

        expect(res.status).toBe(200);
    });

    // -----------------------------------------------------------------------
    // 404 NOT_FOUND — entity not in DB
    // -----------------------------------------------------------------------

    it('returns 404 when entity is not found in database', async () => {
        // Simulate the entity being absent: the query builder resolves to [].
        entityRowHolder.current = null;

        const res = await testApp.request(`${TEST_PATH}`, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                entityType: 'accommodation',
                entityId: 'ffffffff-ffff-4fff-8fff-ffffffffffff'
            })
        });

        expect(res.status).toBe(404);
    });

    // -----------------------------------------------------------------------
    // HOS-328 — usage metering.
    //
    // Regression guard: before HOS-328 this route never called `recordAiUsage`,
    // so no `ai_usage` row was ever written for `translate`. Because
    // `getMonthlyCallCount` derives the monthly counter by counting exactly
    // those rows, the counter stayed at 0 forever and
    // `MAX_AI_TRANSLATE_PER_MONTH` could never be reached. This route is the
    // worst case of the three: one request fans out to one provider call per
    // (field × target locale), so all of that spend was invisible.
    // -----------------------------------------------------------------------

    describe('HOS-328 — records AI usage', () => {
        it('writes exactly one ai_usage row per request, aggregating every provider call', async () => {
            const res = await testApp.request(`${TEST_PATH}`, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000001'
                })
            });

            expect(res.status).toBe(200);

            // The fan-out is real: this request made several provider calls.
            expect(generateTextCalls.length).toBeGreaterThan(1);

            // ...and still cost the caller exactly ONE quota unit. The counter
            // counts rows, so one row per provider call would make a request
            // cost an unpredictable 1..N units.
            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);

            const recorded = mockRecordAiUsage.mock.calls[0]?.[0];
            expect(recorded).toMatchObject({
                userId: UNIQUE_USER_ID,
                feature: 'translate',
                provider: 'stub',
                model: 'stub-model',
                status: 'success'
            });

            // Tokens are the SUM across every call — not one call's tokens, and
            // not zero. Each stubbed call reports 50 in / 30 out.
            expect(recorded?.promptTokens).toBe(50 * generateTextCalls.length);
            expect(recorded?.completionTokens).toBe(30 * generateTextCalls.length);
        });

        it('does not record usage when the request is rejected before the handler', async () => {
            // At quota → the middleware rejects. The only row it may write is
            // its own `quota_exceeded` bookkeeping row, never a success row.
            getMonthlyCallCountReturn.current = 200;

            const res = await testApp.request(`${TEST_PATH}`, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000001'
                })
            });

            expect(res.status).toBe(403);
            const successRows = mockRecordAiUsage.mock.calls.filter(
                (call) => call[0]?.status === 'success'
            );
            expect(successRows).toHaveLength(0);
        });

        it('still returns 200 when metering fails (metering is never fatal)', async () => {
            mockRecordAiUsage.mockRejectedValueOnce(new Error('ai_usage insert failed'));

            const res = await testApp.request(`${TEST_PATH}`, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000001'
                })
            });

            expect(res.status).toBe(200);
            // Non-vacuous: without the fix the queued rejection is never
            // consumed and this test would pass with the change reverted.
            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
        });

        it('records nothing when every provider call fails', async () => {
            // A failed call contributes zero tokens: `translateFieldWithRetry`
            // returns 0 and `translateEntity` only accumulates inside its success
            // branch. So a row here would carry zero spend under a fabricated
            // provider — no cost visibility gained, and it would invent the same
            // synthetic provider bucket the already-translated case avoids.
            // The per-field failures are logged by the service instead.
            nextGenerateTextThrow.current = new Error('provider exhausted');

            const res = await testApp.request(`${TEST_PATH}`, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000001'
                })
            });

            expect(res.status).toBe(200);
            // The fan-out really did run — this is not the zero-call case.
            expect(generateTextCalls.length).toBeGreaterThan(0);
            expect(mockRecordAiUsage).not.toHaveBeenCalled();
        });

        it('records nothing when the entity is already fully translated (no provider call)', async () => {
            // `onlyMissing: true` skips every (field x locale) pair that already
            // has a value, so re-clicking Translate makes ZERO provider calls.
            // That is a successful no-op, not a failure: writing a row here would
            // pollute the error-rate signal with a permanent stream of fake
            // failures and invent a 'none' provider bucket in the usage report.
            const alreadyTranslated = {
                es: 'Original',
                en: 'Already translated',
                pt: 'Ja traduzido'
            };
            entityRowHolder.current = {
                ...makeEntityRow(),
                nameI18n: alreadyTranslated,
                summaryI18n: alreadyTranslated,
                descriptionI18n: alreadyTranslated,
                richDescriptionI18n: alreadyTranslated,
                titleI18n: alreadyTranslated,
                contentI18n: alreadyTranslated
            };

            const res = await testApp.request(`${TEST_PATH}`, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000001'
                })
            });

            expect(res.status).toBe(200);
            expect(generateTextCalls).toHaveLength(0);
            expect(mockRecordAiUsage).not.toHaveBeenCalled();
        });

        it('records the spend as error — exactly once — when persistence fails', async () => {
            // The provider calls are already paid for at this point, so the cost
            // must stay visible. But status must be 'error', not 'success':
            // HOS-190's Zod gate fails deterministically for a given entity, so
            // charging a quota unit here would burn the caller's whole monthly
            // quota on retries of the same poisoned entity.
            nextPersistThrow.current = new Error('translationMeta failed validation');

            const res = await testApp.request(`${TEST_PATH}`, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000001'
                })
            });

            expect(res.status).toBe(500);

            // Exactly one row: the success-path write is skipped and the catch
            // must not double-write what the success path already cleared.
            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
            const recorded = mockRecordAiUsage.mock.calls[0]?.[0];
            expect(recorded).toMatchObject({
                feature: 'translate',
                status: 'error',
                provider: 'stub',
                model: 'stub-model'
            });
            // Real, non-zero spend — this is the whole reason the row exists.
            expect(recorded?.promptTokens).toBe(50 * generateTextCalls.length);
        });
    });
});
