/**
 * Integration tests for `POST /api/v1/protected/ai/text-improve` (SPEC-198 T-006).
 *
 * Builds a Hono test app that mounts the REAL route from
 * `apps/api/src/routes/ai/protected/text-improve.ts` so the full middleware
 * chain runs for real:
 *
 *   actorMiddleware → protectedAuthMiddleware (injected by factory)
 *     → entitlementMiddleware (STUBBED — see vi.mock below)
 *     → createAiRateLimitMiddlewares (REAL — perUser + perIP sliding window)
 *     → createAiQuotaMiddleware (REAL — entitlement + monthly quota)
 *     → streamHandler (REAL — calls createConfiguredAiService)
 *
 * 100% middleware order coverage per spec §9.5: each error-path test exercises
 * the entire stack so the order invariant is verified.
 *
 * ## Why a stub for entitlementMiddleware
 *
 * `entitlementMiddleware` is the documented test-friendly seam — it normally
 * queries QZPay + billing tables, but in this suite it is `vi.mock`ed to
 * inject `userEntitlements` / `userLimits` / `billingLoadFailed` directly into
 * the Hono context. This mirrors the established pattern in
 * `test/integration/ai/quota-enforcement.test.ts` and lets us assert on the
 * downstream quota + rate-limit behaviour without seeding the billing tables.
 *
 * ## Why a stub for @repo/ai-core
 *
 * `vitest.config.e2e.ts` aliases some @repo/* packages to source but does NOT
 * alias `@repo/ai-core`. The route's import chain reaches `@repo/ai-core`
 * transitively (ai-quota.ts → getMonthlyCallCount, ai-service.factory.ts →
 * createAiService, etc.). Following the T-005 precedent
 * (`test/routes/ai/protected/text-improve.test.ts` stubs `@repo/ai-core` with
 * an empty class), this file mocks `@repo/ai-core` with the symbols needed
 * to make the import chain load. No @repo/ai-core source is read — the
 * middlewares see a `getMonthlyCallCount: vi.fn().mockResolvedValue(0)` and
 * a stub `createAiService` for the 200 path.
 *
 * ## Auth pattern
 *
 * Mock-actor headers (`x-mock-actor-id`, `x-mock-actor-role`,
 * `x-mock-actor-permissions`) are processed by `actorMiddleware` when
 * `HOSPEDA_ALLOW_MOCK_ACTOR=true` (set by `apps/api/.env.test`).
 * `protectedAuthMiddleware` then reads the resulting `actor` from context and
 * rejects guest actors with 401.
 *
 * ## DB
 *
 * `testDb.setup()` / `testDb.clean()` / `testDb.teardown()` for isolation.
 * The 403 LIMIT_REACHED test seeds `ai_usage` rows so the real
 * `getMonthlyCallCount` (mocked) reports the user is at quota.
 *
 * @module test/integration/ai/text-improve
 */

// ---------------------------------------------------------------------------
// Vault key + mock-actor flag MUST be set before env-setup.ts loads.
// env-setup runs in setupFiles BEFORE this module, but HOSPEDA_AI_VAULT_MASTER_KEY
// is also needed by the stubbed createConfiguredAiService call path.
// ---------------------------------------------------------------------------

process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';

// ---------------------------------------------------------------------------
// Module mocks (hoisted by vitest before any `import` of the route).
// ---------------------------------------------------------------------------

/**
 * Captures `streamText` invocations on the stubbed `@repo/ai-core` so the
 * 200-path assertions can verify the route did call the engine.
 */
const { streamTextCalls, nextStreamDeltas, nextMeta } = vi.hoisted(() => ({
    streamTextCalls: [] as Array<{ feature: string; prompt: string; locale: string }>,
    nextStreamDeltas: { current: ['Hola', ' mundo', '!'] as string[] },
    nextMeta: {
        current: Promise.resolve({
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        }) as unknown
    }
}));

/**
 * The `getMonthlyCallCount` mock returns a per-test configurable value so the
 * 403 LIMIT_REACHED case can pretend the user is at quota without seeding DB
 * rows. Default is 0 (under quota).
 */
const { getMonthlyCallCountReturn } = vi.hoisted(() => ({
    getMonthlyCallCountReturn: { current: 0 as number }
}));

/**
 * Stub `@repo/ai-core` so the route's import chain resolves without needing a
 * real built dist. The middlewares read `getMonthlyCallCount` /
 * `recordAiUsage`; the handler reads `createAiService` and (transitively) the
 * provider classes. `AiEngineError` is a real class so `instanceof` checks in
 * `ai-error-mapper.ts` behave the same as production.
 *
 * Per the brief: "T-005's precedent: stub transitive deps via vi.mock in the
 * test file — DO NOT modify vitest.config.e2e.ts to add aliases."
 */
vi.mock('@repo/ai-core', () => {
    class StubProvider {
        // Empty class — provider class identity is all the route needs.
    }
    class OpenAiAdapter {}
    class AnthropicAdapter {}
    class AiEngineError extends Error {
        readonly engineCode: string;
        constructor(engineCode: string, message?: string) {
            super(message ?? engineCode);
            this.engineCode = engineCode;
        }
    }
    // AiFeatureNotConfiguredError extends Error (NOT AiEngineError) — mirrors the
    // real class in packages/ai-core/src/config/resolver.ts. Required so that
    // the `instanceof AiFeatureNotConfiguredError` check in ai-error-mapper.ts
    // does not evaluate against `undefined` and crash the mapper.
    class AiFeatureNotConfiguredError extends Error {
        readonly feature: string;
        constructor(feature: string) {
            super(
                `AI feature '${feature}' is not configured in ai_settings. An admin must save a configuration for this feature before it can be used.`
            );
            this.name = 'AiFeatureNotConfiguredError';
            this.feature = feature;
        }
    }
    return {
        StubProvider,
        OpenAiAdapter,
        AnthropicAdapter,
        AiEngineError,
        AiFeatureNotConfiguredError,
        getMonthlyCallCount: vi.fn(async () => getMonthlyCallCountReturn.current),
        recordAiUsage: vi.fn(async () => undefined),
        checkCostCeiling: vi.fn(async () => ({ allowed: true })),
        createAiService: vi.fn(() => ({
            streamText: vi.fn(async (args: { feature: string; prompt: string; locale: string }) => {
                streamTextCalls.push({
                    feature: args.feature,
                    prompt: args.prompt,
                    locale: args.locale
                });
                const deltas = nextStreamDeltas.current;
                return {
                    stream: (async function* () {
                        for (const d of deltas) {
                            yield { delta: d };
                        }
                    })(),
                    meta: nextMeta.current
                };
            })
        })),
        scrubPii: vi.fn((s: string) => s)
    };
});

/**
 * Stub `entitlementMiddleware` to inject `userEntitlements`, `userLimits`,
 * and `billingLoadFailed` directly into the Hono context. This is the
 * documented test-friendly seam — see the module JSDoc.
 *
 * The function returns a Hono middleware; the factory does `entitlementMiddleware()`,
 * so we must export a function that returns the middleware.
 */
vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        entitlementMiddleware: () => {
            return async (
                c: Parameters<AppMiddleware>[0],
                next: Parameters<AppMiddleware>[1]
            ): Promise<void> => {
                c.set('userEntitlements', currentEntitlementsForTest.current);
                c.set('userLimits', currentLimitsForTest.current);
                c.set('billingLoadFailed', currentBillingLoadFailedForTest.current);
                await next();
            };
        }
    };
});

/**
 * Per-test injectable values for the entitlement stub above. Each test sets
 * the `.current` field to the values it wants the stubbed middleware to
 * inject. Defaults match an entitled HOST on the owner-basico plan.
 */
const { currentEntitlementsForTest, currentLimitsForTest, currentBillingLoadFailedForTest } =
    vi.hoisted(() => ({
        currentEntitlementsForTest: {
            current: new Set<EntitlementKey>()
        },
        currentLimitsForTest: {
            current: new Map<LimitKey, number>()
        },
        currentBillingLoadFailedForTest: { current: false }
    }));

// ---------------------------------------------------------------------------
// Imports (post-mock).
// ---------------------------------------------------------------------------

import { OpenAPIHono } from '@hono/zod-openapi';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import { createErrorHandler } from '../../../src/middlewares/response';
import { protectedAiTextImproveRoute } from '../../../src/routes/ai/protected/text-improve';
import type { AppBindings, AppMiddleware } from '../../../src/types';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PATH = '/test-text-improve';
const STREAM_PATH = `${TEST_PATH}/`;
const UNIQUE_USER_ID = 'test-user-text-improve-integration';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

/**
 * Mounts the REAL protected AI text-improve route in a Hono sub-app. The
 * `actorMiddleware` is added as a global so mock-actor headers populate the
 * Hono `actor` context variable that `protectedAuthMiddleware` reads.
 *
 * We deliberately use a sub-path (not `/`) so the test app can be extended
 * in future without conflicting with the route's own internal `path: '/'`.
 */
function buildTestApp(): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });
    // Attach the real error handler so ServiceError thrown by the quota
    // middleware is mapped to the correct HTTP status (403 ENTITLEMENT_REQUIRED
    // / 403 LIMIT_REACHED) rather than falling through to Hono's default 500.
    app.onError(createErrorHandler());
    app.use(actorMiddleware());
    app.route(TEST_PATH, protectedAiTextImproveRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build standard mock-actor headers. The route is the `protected` tier so the
 * actor must NOT be a guest (use `RoleEnum.USER` for HOST callers — the
 * `ai_text_improve` entitlement is gated by billing, not by role).
 */
function makeMockActorHeaders(
    overrides: { actorId?: string; role?: RoleEnum; permissions?: PermissionEnum[] } = {}
): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'user-agent': 'vitest-integration',
        'x-mock-actor-id': overrides.actorId ?? UNIQUE_USER_ID,
        'x-mock-actor-role': overrides.role ?? RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify(overrides.permissions ?? [])
    };
}

/**
 * Read the full SSE body as a string and split on `\n\n` to obtain typed
 * frames. Mirrors the helper used by the streaming-sse integration test
 * (`test/integration/ai/streaming-sse.test.ts`).
 */
interface SseFrame {
    readonly event: string;
    readonly data: string;
}

async function readSseFrames(response: Response): Promise<SseFrame[]> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is null — no SSE stream');
    }

    const decoder = new TextDecoder();
    let raw = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();

    return raw
        .split('\n\n')
        .filter((block) => block.trim() !== '')
        .map((block) => {
            const lines = block.split('\n');
            let event = '';
            let data = '';
            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    event = line.slice('event: '.length).trim();
                } else if (line.startsWith('data: ')) {
                    data = line.slice('data: '.length).trim();
                }
            }
            return { event, data };
        });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/ai/text-improve — integration (SPEC-198 T-006)', () => {
    let app: OpenAPIHono<AppBindings>;

    beforeAll(async () => {
        await testDb.setup();
        app = buildTestApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(() => {
        // Reset per-test stub state. Each test that exercises a different
        // entitlement / limit / billing-failure scenario sets these explicitly
        // before issuing its request, so the defaults here are only used when
        // a test forgets (and the assertion will fail loudly).
        getMonthlyCallCountReturn.current = 0;
        currentBillingLoadFailedForTest.current = false;
        currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
        currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);
        nextStreamDeltas.current = ['Hola', ' mundo', '!'];
        nextMeta.current = Promise.resolve({
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        });
        streamTextCalls.length = 0;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // 401 — unauthenticated request (no mock-actor headers)
    // protectedAuthMiddleware must reject before any downstream middleware runs.
    // =========================================================================

    describe('401 — unauthenticated', () => {
        it('returns 401 when no mock-actor headers are provided (guest actor)', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    fieldType: 'description',
                    fieldValue: 'Cabin near the river.'
                })
            });

            expect(res.status).toBe(401);
        });
    });

    // =========================================================================
    // 403 ENTITLEMENT_REQUIRED — tourist plan (gate absent, not zero-limited).
    // The real quota middleware reads the stubbed context and rejects because
    // the user does not have `ai_text_improve` in their entitlement set.
    // =========================================================================

    describe('403 ENTITLEMENT_REQUIRED — tourist plan', () => {
        it('returns 403 with ENTITLEMENT_REQUIRED when the user lacks ai_text_improve', async () => {
            // Tourist plan: no AI entitlements at all
            currentEntitlementsForTest.current = new Set<EntitlementKey>();
            currentLimitsForTest.current = new Map<LimitKey, number>();

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'description',
                    fieldValue: 'A cozy cabin in the woods.'
                })
            });

            expect(res.status).toBe(403);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string; message: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');

            // The handler must NOT have been reached
            expect(streamTextCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // 403 LIMIT_REACHED — owner-basico at quota (count >= limit).
    // We mock `getMonthlyCallCount` to return the limit value so the real
    // quota middleware's monthly-count comparison fires.
    // =========================================================================

    describe('403 LIMIT_REACHED — at-quota user', () => {
        it('returns 403 with LIMIT_REACHED when monthly count >= limit', async () => {
            // Entitled, with a limit of 20
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);
            // Mocked getMonthlyCallCount returns 20 (= limit) → at quota
            getMonthlyCallCountReturn.current = 20;

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'description',
                    fieldValue: 'A cozy cabin in the woods.'
                })
            });

            expect(res.status).toBe(403);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string; message: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('LIMIT_REACHED');

            // Handler must NOT have been reached
            expect(streamTextCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // 503 SERVICE_UNAVAILABLE — billingLoadFailed=true.
    // The real quota middleware's billing-outage guard trips before any
    // entitlement check runs.
    // =========================================================================

    describe('503 SERVICE_UNAVAILABLE — billing outage', () => {
        it('returns 503 with SERVICE_UNAVAILABLE when billingLoadFailed is true', async () => {
            // Even entitled + under quota — the billing-load guard fires first.
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);
            currentBillingLoadFailedForTest.current = true;

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'description',
                    fieldValue: 'A cozy cabin in the woods.'
                })
            });

            expect(res.status).toBe(503);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string; message: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('SERVICE_UNAVAILABLE');

            // Handler must NOT have been reached
            expect(streamTextCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // 400 VALIDATION_ERROR — missing fieldValue
    // =========================================================================

    describe('400 — missing fieldValue', () => {
        it('returns 400 with VALIDATION_ERROR when fieldValue is absent', async () => {
            // Entitled + under quota + healthy billing so we reach validation
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'description'
                    // fieldValue intentionally omitted
                })
            });

            expect(res.status).toBe(400);
            const contentType = res.headers.get('content-type') ?? '';
            // Validation failures return JSON, NOT SSE
            expect(contentType).not.toContain('text/event-stream');

            const body = (await res.json()) as {
                success: boolean;
                error: { code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');

            // Handler must NOT have been reached
            expect(streamTextCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // 400 VALIDATION_ERROR — unknown fieldType
    // =========================================================================

    describe('400 — unknown fieldType', () => {
        it('returns 400 with VALIDATION_ERROR when fieldType is not in the enum', async () => {
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'title', // not in the V1 enum (only 'description' | 'summary')
                    fieldValue: 'A title'
                })
            });

            expect(res.status).toBe(400);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');

            expect(streamTextCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // 400 VALIDATION_ERROR — fieldValue exceeds per-type max
    // The schema's superRefine enforces per-field cap: description max 5000,
    // summary max 300. Sending 5001 chars for description must reject.
    // =========================================================================

    describe('400 — exceeds per-type max', () => {
        it('returns 400 when a description fieldValue exceeds 5000 chars', async () => {
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);

            // 5001 chars is one over the description cap
            const oversized = 'a'.repeat(5001);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'description',
                    fieldValue: oversized
                })
            });

            expect(res.status).toBe(400);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');

            expect(streamTextCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // 200 text/event-stream — entitled HOST with valid body.
    // The stream emits token + done frames via the stubbed createAiService.
    // =========================================================================

    describe('200 — entitled HOST streams tokens', () => {
        it('returns 200 with text/event-stream for a valid request', async () => {
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'description',
                    fieldValue: 'A cozy cabin in the woods near the river.',
                    locale: 'en'
                })
            });

            expect(res.status).toBe(200);

            // The handler must have been reached exactly once
            expect(streamTextCalls).toHaveLength(1);
            const call = streamTextCalls[0];
            if (!call) throw new Error('Expected one streamText call');
            expect(call.feature).toBe('text_improve');
            expect(call.prompt).toBe(
                'Please improve the following accommodation description:\n\nA cozy cabin in the woods near the river.'
            );
            expect(call.locale).toBe('en');
        });

        it('emits a token event for each delta and a final done event', async () => {
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);

            // 3 deltas configured by default in the hoisted stub
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'description',
                    fieldValue: 'A cozy cabin in the woods near the river.'
                })
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const tokenFrames = frames.filter((f) => f.event === 'token');
            const doneFrames = frames.filter((f) => f.event === 'done');

            // 3 token frames from the 3 default deltas
            expect(tokenFrames).toHaveLength(3);
            expect(JSON.parse(tokenFrames[0]?.data ?? '{}')).toEqual({ delta: 'Hola' });
            expect(JSON.parse(tokenFrames[1]?.data ?? '{}')).toEqual({ delta: ' mundo' });
            expect(JSON.parse(tokenFrames[2]?.data ?? '{}')).toEqual({ delta: '!' });

            // Exactly one done frame, with usage/provider/model/finishReason
            expect(doneFrames).toHaveLength(1);
            const doneData = JSON.parse(doneFrames[0]?.data ?? '{}') as Record<string, unknown>;
            expect(doneData).toHaveProperty('usage');
            expect(doneData).toHaveProperty('provider', 'stub');
            expect(doneData).toHaveProperty('model', 'stub-model');
            expect(doneData).toHaveProperty('finishReason', 'stop');
        });

        it('sets the Content-Type response header to text/event-stream', async () => {
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_TEXT_IMPROVE]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, 20]]);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    fieldType: 'description',
                    fieldValue: 'A cozy cabin in the woods near the river.'
                })
            });

            expect(res.status).toBe(200);
            const contentType = res.headers.get('content-type') ?? '';
            expect(contentType).toContain('text/event-stream');
        });
    });
});
