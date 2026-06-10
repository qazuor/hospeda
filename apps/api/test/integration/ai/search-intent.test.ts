/**
 * Integration tests for `POST /api/v1/protected/ai/search-intent` (SPEC-199 T-012).
 *
 * Updated by SPEC-211 Phase 3 (§7.7 / T-014): `ai_search` is now a free,
 * authenticated-only platform feature. `createAiQuotaMiddleware('search')` has
 * been removed from the middleware chain. The route is governed by auth +
 * per-user/IP rate limits + a USD cost ceiling enforced by the engine.
 *
 * Mounts the real `searchIntentRoute` (from `search-intent.ts`) via a Hono
 * sub-app so the full middleware chain runs:
 *
 *   actorMiddleware → protectedAuthMiddleware (factory)
 *     → entitlementMiddleware (STUBBED — loads context, no AI_SEARCH gate)
 *     → createAiRateLimitMiddlewares (REAL — per-user + per-IP burst guard)
 *     → handler (REAL — calls createConfiguredAiService + getDb for slug resolution)
 *
 * Note: `createAiQuotaMiddleware('search')` is no longer in the chain.
 *
 * ## External seams stubbed
 *
 * - `entitlementMiddleware`: injects `userEntitlements`, `userLimits`, and
 *   `billingLoadFailed` directly into the Hono context. Mirrors the established
 *   pattern in `test/integration/ai/text-improve.test.ts` (SPEC-198 T-006).
 *   Post-SPEC-211: entitlement contents do NOT gate this route — any authenticated
 *   user can use search regardless of their billing plan.
 *
 * - `@repo/ai-core`: stubbed with `AiEngineError`, `AiFeatureNotConfiguredError`,
 *   `getMonthlyCallCount`, `recordAiUsage`, `checkCostCeiling`, and
 *   `createAiService`. No real provider is contacted.
 *
 * - `../../../src/services/ai-service.factory`: `createConfiguredAiService` is
 *   stubbed to return a controlled object with `generateObject` that the handler
 *   calls. Mirrors the chat route integration test pattern.
 *
 * - `@repo/db`: `getDb` is stubbed to return a query builder mock so the
 *   amenity/feature slug-to-UUID DB calls are controlled per-test without
 *   needing a real seeded database (AC-11, AC-12, AC-17).
 *
 * ## Auth pattern
 *
 * `x-mock-actor-id`, `x-mock-actor-role`, `x-mock-actor-permissions` headers
 * are processed by `actorMiddleware` when `HOSPEDA_ALLOW_MOCK_ACTOR=true`.
 *
 * ## §8.4 enum-resilience rule
 *
 * Tests do NOT hard-code numeric enum member counts. Use
 * `Object.values(SomeEnum).length` where counts are needed dynamically.
 *
 * @module test/integration/ai/search-intent
 */

// ---------------------------------------------------------------------------
// Env flags (must be set before any module that reads them loads).
// ---------------------------------------------------------------------------

process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';

// ---------------------------------------------------------------------------
// Hoisted stub state — must be declared via vi.hoisted so they are available
// before vi.mock factory functions run.
// ---------------------------------------------------------------------------

const {
    generateObjectCalls,
    nextGenerateObjectResult,
    nextGenerateObjectError,
    getMonthlyCallCountReturn,
    currentEntitlementsForTest,
    currentLimitsForTest,
    currentBillingLoadFailedForTest,
    nextAmenityDbRows,
    nextFeatureDbRows
} = vi.hoisted(() => ({
    generateObjectCalls: [] as Array<{ feature: string; prompt: string; locale: string }>,
    nextGenerateObjectResult: {
        current: {
            object: {
                confidence: 0.9,
                entities: {}
            },
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        } as unknown
    },
    nextGenerateObjectError: { current: null as unknown },
    getMonthlyCallCountReturn: { current: 0 as number },
    currentEntitlementsForTest: { current: new Set<string>() },
    currentLimitsForTest: { current: new Map<string, number>() },
    currentBillingLoadFailedForTest: { current: false as boolean },
    /**
     * Rows returned by the mocked amenity DB query.
     * Each element is an object `{ id: string }`.
     */
    nextAmenityDbRows: { current: [] as Array<{ id: string }> },
    /**
     * Rows returned by the mocked feature DB query.
     * Each element is an object `{ id: string }`.
     */
    nextFeatureDbRows: { current: [] as Array<{ id: string }> }
}));

// ---------------------------------------------------------------------------
// Mock: @repo/ai-core
// Provides real Error subclasses so `instanceof` checks in ai-error-mapper.ts
// work as in production. `getMonthlyCallCount` is per-test configurable.
// ---------------------------------------------------------------------------

vi.mock('@repo/ai-core', () => {
    class AiEngineError extends Error {
        readonly engineCode: string;

        constructor(engineCode: string, message?: string) {
            super(message ?? engineCode);
            this.engineCode = engineCode;
        }
    }

    // AiFeatureNotConfiguredError extends Error (NOT AiEngineError) — mirrors the
    // real class. Required for `instanceof` checks in ai-error-mapper.ts.
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

    class StubProvider {}
    class OpenAiAdapter {}
    class AnthropicAdapter {}

    return {
        AiEngineError,
        AiFeatureNotConfiguredError,
        StubProvider,
        OpenAiAdapter,
        AnthropicAdapter,
        getMonthlyCallCount: vi.fn(async () => getMonthlyCallCountReturn.current),
        recordAiUsage: vi.fn(async () => undefined),
        checkCostCeiling: vi.fn(async () => ({ allowed: true })),
        createAiService: vi.fn(() => ({
            generateObject: vi.fn()
        })),
        scrubPii: vi.fn((s: string) => s),
        resolveSystemPrompt: vi.fn(async () => ({ content: 'stub-prompt', source: 'default' })),
        resolveFeatureConfig: vi.fn(async () => ({
            enabled: true,
            primaryProvider: 'stub',
            fallbackChain: [],
            model: 'stub-model',
            params: {}
        }))
    };
});

// ---------------------------------------------------------------------------
// Mock: ai-service.factory — createConfiguredAiService
// Returns a stub AiService with a `generateObject` that records invocations and
// returns / throws the per-test configured value.
// ---------------------------------------------------------------------------

vi.mock('../../../src/services/ai-service.factory', () => ({
    createConfiguredAiService: vi.fn(async () => ({
        generateObject: vi.fn(async (args: { feature: string; prompt: string; locale: string }) => {
            generateObjectCalls.push({
                feature: args.feature,
                prompt: args.prompt,
                locale: args.locale
            });

            if (nextGenerateObjectError.current) {
                throw nextGenerateObjectError.current;
            }

            return nextGenerateObjectResult.current;
        })
    }))
}));

// ---------------------------------------------------------------------------
// Mock: entitlementMiddleware
// Injects per-test entitlement / limits / billingLoadFailed into Hono context.
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        entitlementMiddleware: () => {
            return async (
                c: Parameters<AppMiddleware>[0],
                next: Parameters<AppMiddleware>[1]
            ): Promise<void> => {
                c.set(
                    'userEntitlements',
                    currentEntitlementsForTest.current as Set<EntitlementKey>
                );
                c.set('userLimits', currentLimitsForTest.current as Map<LimitKey, number>);
                c.set('billingLoadFailed', currentBillingLoadFailedForTest.current);
                await next();
            };
        }
    };
});

// ---------------------------------------------------------------------------
// Mock: @repo/db
// Stubs `getDb()` so amenity/feature slug-to-UUID queries return per-test rows
// without needing a real seeded database.
//
// The route calls the DB as:
//   db.select({ id: amenities.id }).from(amenities).where(inArray(amenities.slug, slugs))
//   db.select({ id: features.id }).from(features).where(inArray(features.slug, slugs))
//
// We model the fluent builder as a chain: select() → from() → where() → Promise<rows>.
// The `amenities` / `features` objects are passed-through sentinels so the route
// code does not crash on `.id` / `.slug` access.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();

    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: (_cols: unknown) => {
                // Determine whether this is an amenity or feature query by
                // looking at which rows array has been configured for this call.
                // Because the route runs the two queries in parallel (Promise.all),
                // we use a simple round-robin on a call counter seeded at zero.
                // The amenity query always runs before the feature query per
                // the Promise.all call order in search-intent.ts.
                //
                // However, using a counter would be fragile. Instead we return a
                // wrapper that uses the nextAmenityDbRows and nextFeatureDbRows
                // order: first call → amenity rows, second call → feature rows.
                const selectCallCountRef = { used: 0 };
                // We close over both so the same `select()` invocation chain
                // can't know which table it's for. Instead, return a chain whose
                // `from()` receives the table object — which IS either `amenities`
                // or `features`. We detect by identity of the table name property.
                return {
                    from: (table: { _: { name?: string }; [k: string]: unknown } | unknown) => {
                        let rows: Array<{ id: string }>;
                        // table is the drizzle table object; check for a known
                        // identifier (the pgTable name is set as [Symbol.for...])
                        // Simpler: peek at the first argument and use slug arrays.
                        // Since both queries are structurally identical, we key
                        // by whether any nextFeatureDbRows.current has been set
                        // differently from nextAmenityDbRows.current via test code.
                        //
                        // The most reliable approach: track call order per `getDb()` call.
                        // We increment selectCallCountRef — but `getDb` is called once and
                        // `select` is called twice on the SAME db instance (Promise.all).
                        // So we attach state to the db mock instance itself.
                        //
                        // Revised: detect table via the exported `amenities` / `features`
                        // table objects from @repo/db (they pass through `...actual`).
                        // The `from()` argument IS the table — compare by reference.
                        if (table === actual.amenities) {
                            rows = nextAmenityDbRows.current;
                        } else {
                            rows = nextFeatureDbRows.current;
                        }
                        void selectCallCountRef.used;
                        return {
                            where: () => Promise.resolve(rows)
                        };
                    }
                };
            }
        })),
        // Pass through table objects so identity comparison above works.
        amenities: actual.amenities,
        features: actual.features,
        inArray: actual.inArray
    };
});

// ---------------------------------------------------------------------------
// Imports (post-mock).
// ---------------------------------------------------------------------------

import { OpenAPIHono } from '@hono/zod-openapi';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import { createErrorHandler } from '../../../src/middlewares/response';
import { searchIntentRoute } from '../../../src/routes/ai/protected/search-intent';
import type { AppBindings, AppMiddleware } from '../../../src/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PATH = '/test-search-intent';
const ENDPOINT = `${TEST_PATH}/`;
const UNIQUE_USER_ID = '11111111-1111-4111-8111-111111111111';

/** Fixed UUID returned by the mock DB for 'bbq' amenity slug lookups. */
const BBQ_AMENITY_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Fixed UUID returned by the mock DB for 'river_front' feature slug lookups. */
const RIVER_FRONT_FEATURE_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

/**
 * Builds a Hono sub-app that mounts the real `searchIntentRoute` behind
 * `actorMiddleware` so mock-actor headers populate the `actor` context var
 * read by `protectedAuthMiddleware` (injected by the factory).
 */
function buildTestApp(): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });
    app.onError(createErrorHandler());
    app.use(actorMiddleware());
    app.route(TEST_PATH, searchIntentRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds standard mock-actor headers for the protected tier.
 * Default actor is a USER role with no extra permissions (entitlements are
 * injected by the stubbed entitlementMiddleware, not by permissions).
 */
function makeMockActorHeaders(
    overrides: { actorId?: string; role?: RoleEnum; permissions?: PermissionEnum[] } = {}
): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest-integration',
        'x-mock-actor-id': overrides.actorId ?? UNIQUE_USER_ID,
        'x-mock-actor-role': overrides.role ?? RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify(overrides.permissions ?? [])
    };
}

/** Standard valid request body for the search-intent endpoint. */
function makeValidBody(overrides: { query?: string; locale?: string } = {}): string {
    const body: Record<string, unknown> = {
        query: overrides.query ?? 'cabaña con pileta cerca del río'
    };
    if (overrides.locale !== undefined) {
        body.locale = overrides.locale;
    }
    return JSON.stringify(body);
}

interface SearchIntentResponse {
    readonly success: boolean;
    readonly data?: {
        readonly intent: { readonly kind: string; readonly confidence: number };
        readonly mappedParams: Record<string, unknown>;
        readonly confidence: number;
        readonly fallbackToKeyword: boolean;
    };
    readonly error?: {
        readonly code: string;
        readonly message: string;
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/ai/search-intent — integration (SPEC-199 T-012)', () => {
    const app = buildTestApp();

    beforeEach(() => {
        // Reset all per-test stub state to safe defaults before each test.
        generateObjectCalls.length = 0;
        nextGenerateObjectError.current = null;
        nextGenerateObjectResult.current = {
            object: { confidence: 0.9, entities: {} },
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        };
        getMonthlyCallCountReturn.current = 0;
        currentBillingLoadFailedForTest.current = false;
        // SPEC-211 §7.7: ai_search is a free platform feature — no AI entitlement
        // is required. Default to an empty entitlement set (simulates a tourist-free
        // user with no billing plan grants) to verify the route is open to all
        // authenticated users regardless of their plan.
        currentEntitlementsForTest.current = new Set<EntitlementKey>();
        currentLimitsForTest.current = new Map<LimitKey, number>();
        nextAmenityDbRows.current = [];
        nextFeatureDbRows.current = [];
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // TC-1: Authenticated + ai_search entitlement + high confidence → 200,
    //       fallbackToKeyword: false, confidence present in data.
    //       §8.2 test #1 — do NOT assert specific mappedParams values.
    //       Note: the route sets `successStatusCode: 200` (it creates no
    //       resource), overriding the POST-default 201. Matches spec §5.1/§8.2.
    // =========================================================================

    describe('TC-1 — 200 high confidence, fallbackToKeyword: false', () => {
        it('returns 200 with fallbackToKeyword false when confidence >= 0.5', async () => {
            nextGenerateObjectResult.current = {
                object: { confidence: 0.9, entities: {} },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(true);

            // Envelope shape assertions (§8.2 rule: do not assert specific mappedParams values).
            expect(body.data).toBeDefined();
            expect(typeof body.data?.confidence).toBe('number');
            expect(body.data?.fallbackToKeyword).toBe(false);
            expect(body.data?.intent).toBeDefined();
            expect(body.data?.mappedParams).toBeDefined();

            // generateObject MUST have been called exactly once.
            expect(generateObjectCalls).toHaveLength(1);
        });
    });

    // =========================================================================
    // TC-2: Stub returns confidence: 0.3 → 200, fallbackToKeyword: true.
    //       §8.2 test #2.
    // =========================================================================

    describe('TC-2 — 200 low confidence, fallbackToKeyword: true', () => {
        it('returns 200 with fallbackToKeyword true when confidence < 0.5', async () => {
            nextGenerateObjectResult.current = {
                object: { confidence: 0.3, entities: {} },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(true);
            expect(body.data?.confidence).toBeCloseTo(0.3);
            expect(body.data?.fallbackToKeyword).toBe(true);
        });
    });

    // =========================================================================
    // TC-3: No auth headers → 401.
    //       §8.2 test #3.
    // =========================================================================

    describe('TC-3 — 401 unauthenticated', () => {
        it('returns 401 when no mock-actor headers are provided', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: makeValidBody()
            });

            expect(res.status).toBe(401);
            expect(generateObjectCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // TC-4 (AC-3.2 — SPEC-211 §7.7): Authenticated WITHOUT any AI entitlements
    // (e.g. tourist-free user, no billing plan grants) → search SUCCEEDS (200).
    //
    // Before SPEC-211: this test asserted 403 ENTITLEMENT_REQUIRED because
    // `createAiQuotaMiddleware('search')` checked the AI_SEARCH entitlement.
    //
    // After SPEC-211 Phase 3: `ai_search` is a free platform feature. No billing
    // entitlement is required. Any authenticated user can use search regardless of
    // their plan. The quota middleware has been removed from the chain.
    // =========================================================================

    describe('TC-4 (AC-3.2) — 200 success for authenticated user with NO AI entitlements', () => {
        it('returns 200 when the user has no AI entitlements (tourist-free, no plan grants)', async () => {
            // Simulate a tourist-free user: empty entitlements, empty limits.
            // This is the default in beforeEach, set explicitly for clarity.
            currentEntitlementsForTest.current = new Set<EntitlementKey>();
            currentLimitsForTest.current = new Map<LimitKey, number>();

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            // Search must succeed — no entitlement gate exists on this route.
            expect(res.status).toBe(200);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(typeof body.data?.confidence).toBe('number');
            expect(body.data?.mappedParams).toBeDefined();

            // generateObject must have been called — the route reached the handler.
            expect(generateObjectCalls).toHaveLength(1);
        });

        it('returns 200 when the user has AI_CHAT entitlement but NOT AI_SEARCH (role:HOST)', async () => {
            // HOST user with chat but no search entitlement.
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_CHAT]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 20]]);

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders({ role: RoleEnum.HOST }),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(true);
            // The handler reached generateObject despite no AI_SEARCH entitlement.
            expect(generateObjectCalls).toHaveLength(1);
        });
    });

    // =========================================================================
    // TC-5: query > 500 chars → 400 VALIDATION_ERROR.
    //       §8.2 test #5.
    // =========================================================================

    describe('TC-5 — 400 VALIDATION_ERROR query too long', () => {
        it('returns 400 VALIDATION_ERROR when query exceeds 500 characters', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({ query: 'a'.repeat(501) })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(generateObjectCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // TC-6: Empty query → 400 VALIDATION_ERROR.
    //       §8.2 test #6.
    // =========================================================================

    describe('TC-6 — 400 VALIDATION_ERROR empty query', () => {
        it('returns 400 VALIDATION_ERROR when query is an empty string', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({ query: '' })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(generateObjectCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // TC-7: Stub throws AiEngineError MODERATION_BLOCKED → 422.
    //       §8.2 test #7.
    // =========================================================================

    describe('TC-7 — 422 MODERATION_BLOCKED', () => {
        it('returns 422 when the AI service throws MODERATION_BLOCKED', async () => {
            const { AiEngineError } = await import('@repo/ai-core');
            nextGenerateObjectError.current = new AiEngineError('MODERATION_BLOCKED', 'flagged');

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(422);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('MODERATION_BLOCKED');
        });
    });

    // =========================================================================
    // TC-8 (updated — SPEC-211 §7.7): billingLoadFailed: true in context.
    //
    // Before SPEC-211: `createAiQuotaMiddleware('search')` short-circuited with
    // 503 SERVICE_UNAVAILABLE when billingLoadFailed was true, because the quota
    // middleware needed to verify the AI_SEARCH entitlement against the billing
    // context.
    //
    // After SPEC-211 Phase 3: `createAiQuotaMiddleware('search')` is gone. The
    // route is platform-governed — it does NOT consult the billing entitlement
    // context to gate access. A billing outage is therefore transparent to the
    // search route: `entitlementMiddleware` sets `billingLoadFailed=true` and
    // calls `next()` (no 503 from it), the rate-limit middleware is unaffected,
    // and the handler runs normally.
    //
    // The route still returns 200 when billing fails (fail-open for a
    // platform-governed, non-billing-gated feature).
    // =========================================================================

    describe('TC-8 (updated) — 200 when billingLoadFailed is true (platform feature is billing-transparent)', () => {
        it('returns 200 even when billingLoadFailed is true (no billing gate on search route)', async () => {
            currentBillingLoadFailedForTest.current = true;

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            // The route is platform-governed — a billing outage does not block search.
            expect(res.status).toBe(200);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            // generateObject was called — the handler ran despite billingLoadFailed.
            expect(generateObjectCalls).toHaveLength(1);
        });
    });

    // =========================================================================
    // TC-9: Stub throws AiEngineError ENGINE_EXHAUSTED → 502.
    //       §8.2 test #9.
    // =========================================================================

    describe('TC-9 — 502 ENGINE_EXHAUSTED', () => {
        it('returns 502 when the AI service throws ENGINE_EXHAUSTED', async () => {
            const { AiEngineError } = await import('@repo/ai-core');
            nextGenerateObjectError.current = new AiEngineError(
                'ENGINE_EXHAUSTED',
                'all providers failed'
            );

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(502);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('ENGINE_EXHAUSTED');
        });
    });

    // =========================================================================
    // TC-10: Amenity slug resolution — stub returns amenitySlugs: ['bbq'].
    //        Mock DB returns BBQ_AMENITY_UUID for the 'bbq' slug lookup.
    //        Assert mappedParams.amenities contains the resolved UUID.
    //        Also assert an unknown amenity slug yields no amenities param (AC-12).
    //        §8.2 test #10.
    // =========================================================================

    describe('TC-10 — amenity slug to UUID resolution (AC-11, AC-12)', () => {
        it('maps amenitySlugs to resolved UUIDs in mappedParams.amenities when bbq resolves', async () => {
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.85,
                    entities: { amenitySlugs: ['bbq'] }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // Mock DB returns one row for the 'bbq' amenity slug.
            nextAmenityDbRows.current = [{ id: BBQ_AMENITY_UUID }];
            nextFeatureDbRows.current = [];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(true);

            // The mapper places resolved amenity UUIDs under `amenities`.
            const amenities = body.data?.mappedParams?.amenities;
            expect(Array.isArray(amenities)).toBe(true);
            expect((amenities as string[]).includes(BBQ_AMENITY_UUID)).toBe(true);
        });

        it('produces no amenities param when the slug is unknown (AC-12)', async () => {
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.8,
                    entities: { amenitySlugs: ['unknown_slug_xyz'] }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // DB returns empty — slug does not exist.
            nextAmenityDbRows.current = [];
            nextFeatureDbRows.current = [];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(true);

            // No amenities param should be present when resolution yields nothing.
            const mappedParams = body.data?.mappedParams ?? {};
            const amenities = mappedParams.amenities;
            const hasAmenities =
                amenities !== undefined &&
                amenities !== null &&
                (Array.isArray(amenities) ? (amenities as unknown[]).length > 0 : true);
            expect(hasAmenities).toBe(false);
        });
    });

    // =========================================================================
    // TC-11: Feature slug resolution — stub returns featureSlugs: ['river_front'].
    //        Mock DB returns RIVER_FRONT_FEATURE_UUID for the 'river_front' slug.
    //        Assert mappedParams.features contains the resolved UUID (AC-17).
    //        §8.2 test #11.
    // =========================================================================

    describe('TC-11 — feature slug to UUID resolution (AC-17)', () => {
        it('maps featureSlugs to resolved UUIDs in mappedParams.features when river_front resolves', async () => {
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.88,
                    entities: { featureSlugs: ['river_front'] }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // Amenity query returns nothing (no amenity slugs in entities).
            nextAmenityDbRows.current = [];
            // Feature query returns one row for 'river_front'.
            nextFeatureDbRows.current = [{ id: RIVER_FRONT_FEATURE_UUID }];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(true);

            // The mapper places resolved feature UUIDs under `features`.
            const featuresList = body.data?.mappedParams?.features;
            expect(Array.isArray(featuresList)).toBe(true);
            expect((featuresList as string[]).includes(RIVER_FRONT_FEATURE_UUID)).toBe(true);
        });
    });

    // =========================================================================
    // AC-3.3 (SPEC-211 §7.7) — USD ceiling enforcement gap note.
    //
    // When the per-feature USD ceiling for `search` is exceeded, the engine's
    // `checkCostCeiling` throws `AiCeilingHitError`. The route's `catch` block
    // maps it via `mapAiEngineErrorToHttpStatus` — which maps `AiEngineError`
    // subclasses by their `engineCode`. `AiCeilingHitError` has
    // `engineCode = 'CEILING_HIT'` and is mapped to HTTP 503.
    //
    // Gap: `AiCeilingHitError` is thrown INSIDE `createConfiguredAiService()` /
    // the engine, which is stubbed in this test file. The stub's `checkCostCeiling`
    // returns `{ allowed: true }` unconditionally and the stub `generateObject`
    // does NOT invoke the real ceiling check. Driving a ceiling-hit requires
    // either:
    //   (a) a real DB + seeded ai_usage rows totalling >= the ceiling, or
    //   (b) a more granular stub of the engine internals that makes `generateObject`
    //       throw `AiCeilingHitError` directly.
    //
    // Option (b) is feasible here — `AiCeilingHitError extends AiEngineError`, and
    // `nextGenerateObjectError` already supports arbitrary throws via the stub.
    // The test below covers the ceiling-hit → 503 path using that mechanism.
    //
    // Note: this test validates the CEILING_HIT error mapping path (which existed
    // before SPEC-211). The ceiling itself is enforced inside the engine, not as a
    // middleware. This test confirms the route correctly surfaces ceiling errors.
    // =========================================================================

    describe('AC-3.3 — 503 CEILING_HIT when the USD cost ceiling is exceeded', () => {
        it('returns 503 CEILING_HIT when the AI engine throws AiCeilingHitError (ceiling exceeded)', async () => {
            // Simulate the engine throwing AiCeilingHitError (engineCode: 'CEILING_HIT').
            // This is the error thrown by checkCostCeiling inside createConfiguredAiService
            // when accumulated spend >= the per-feature or global USD ceiling.
            const { AiEngineError } = await import('@repo/ai-core');
            nextGenerateObjectError.current = new AiEngineError(
                'CEILING_HIT',
                'Monthly cost ceiling for feature "search" reached'
            );

            // User has NO AI entitlements (tourist-free) — ceiling check is independent
            // of billing entitlements. The route should still reach the engine and
            // surface the ceiling error.
            currentEntitlementsForTest.current = new Set<EntitlementKey>();
            currentLimitsForTest.current = new Map<LimitKey, number>();

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(503);

            const body = (await res.json()) as SearchIntentResponse;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('CEILING_HIT');
            // The route reached the handler (generateObject was invoked before throwing).
            expect(generateObjectCalls).toHaveLength(1);
        });
    });
});
