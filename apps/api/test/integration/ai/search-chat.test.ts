/**
 * Integration tests for `POST /api/v1/protected/ai/search-chat` (SPEC-212 T-004 / T-005 / T-006 / T-007).
 *
 * ## T-004 coverage
 *
 * Middleware gates that run BEFORE the handler body:
 *
 *   actorMiddleware (test harness)
 *     → protectedAuthMiddleware (factory — rejects unauthenticated requests)
 *     → entitlementMiddleware (STUBBED — loads billing context, no AI_SEARCH gate)
 *     → createAiRateLimitMiddlewares('search') (REAL — per-user + per-IP burst guard)
 *     → handler (T-004 scaffold — opens empty SSE stream, no LLM call)
 *
 * ## T-005 coverage
 *
 * Intent extraction + `filters` SSE event emission:
 *
 *   - Happy path: first-turn message → `generateObject` called → `filters` frame emitted
 *     with correct `params` / `intent` shape reflecting the stubbed entity output.
 *   - Refinement turn: body includes `currentFilters` + a new user message →
 *     `generateObject` still called → `filters` frame emitted (merge is LLM's job;
 *     here we assert the prompt path runs and a filters frame is emitted).
 *   - Frame ordering: `filters` frame appears BEFORE `done` in the SSE stream.
 *   - AI engine error: pre-handler `generateObject` throw → HTTP error response
 *     (no SSE stream started, per factory contract).
 *
 * ## T-006 coverage
 *
 * Natural-language reply streaming via `streamText`:
 *
 *   - Reply streams: after the `filters` frame, `token` frames carry the stubbed
 *     reply text, then a terminal `done` frame is emitted.
 *   - `done` payload: carries the persisted conversationId (T-007) or null on failure.
 *   - Frame ordering: `filters` → `token`(s) → `done`.
 *   - Provider failure mid-reply (streamText throws): emits an `error` frame,
 *     no `done` follows.
 *
 * ## T-007 coverage
 *
 * Best-effort conversation persistence:
 *
 *   - `persistSearchChatTurn` is called with `feature='search'`, the authenticated
 *     user id, the last user message, and the accumulated assistant text.
 *   - `done.conversationId` = persisted id on success.
 *   - Non-fatal reject: persistence throws → stream still emits filters + tokens +
 *     done with `conversationId: null`; `apiLogger.error` is called.
 *   - Non-fatal timeout: persistence never resolves within 1500 ms → done carries
 *     `conversationId: null`; `apiLogger.warn` is called.
 *
 * ## T-014: consolidated integration suite
 *
 * This file IS the SPEC-212 consolidated API integration suite. Acceptance-criteria
 * mapping:
 *   - Happy path (filters → token(s) → done + conversationId): T-005 + T-006 gates.
 *   - Auth required (401): Gate 1.
 *   - Invalid body (400, before the stream opens): Gate 2 (empty/missing/over-cap
 *     messages, bad role, bad conversationId UUID).
 *   - Auth-baseline access (no entitlement gate — SPEC-283): Gate 3
 *     (USER with no entitlements, HOST without AI_SEARCH). billingLoadFailed → 503
 *     (quota middleware is fail-closed, not bypass — SPEC-283 OQ-1).
 *   - Empty / garbage message handling: Gate 2 (empty → 400) + Gate 4 (a message that
 *     yields an unparseable entity object → safeParse falls back to empty intent and
 *     the turn still completes).
 *   - Persistence best-effort (non-fatal on reject + timeout): Gate 6.
 *   - Rate limit (429): NOT re-tested here. `createAiRateLimitMiddlewares('search')`
 *     is the SAME factory exercised directly (per-user + per-IP 429 + Retry-After +
 *     actor restoration) by `test/middlewares/ai-rate-limit.test.ts`, with the
 *     in-memory backend enabled. In this integration harness the limiter fails open
 *     without Redis, so a live 429 is not reproducible (the sibling chat / text-improve
 *     integration suites omit it for the same reason). The route wires the middleware
 *     identically to its siblings.
 *
 * ## External seams stubbed
 *
 * - `@repo/ai-core`: real Error subclasses + stub service methods.
 * - `../../../src/services/ai-service.factory`: `createConfiguredAiService` returns
 *   a stub with both `generateObject` (T-005) and `streamText` (T-006).
 *   `generateObject` is configured per-test via `nextGenerateObjectResult` /
 *   `nextGenerateObjectError`. `streamText` is configured via `nextStreamDeltas` /
 *   `nextStreamError`. Mirrors the chat-route.test.ts pattern for `streamText`.
 * - `@repo/db`: `getDb` returns a Drizzle-chain mock so slug-to-UUID queries are
 *   controlled without a real database. Mirrors search-intent.test.ts §mock @repo/db.
 * - `../../../src/routes/ai/protected/search-chat.persistence`: `persistSearchChatTurn`
 *   is a vi.fn() controlled per-test via `nextPersistPromise`. Mirrors the
 *   chat-route.test.ts pattern for `persistChatTurn`.
 * - `../../../src/utils/logger`: `apiLogger` is a spy object so T-007 failure/timeout
 *   assertions can verify the non-fatal log calls.
 *
 * @module test/integration/ai/search-chat
 */

// ---------------------------------------------------------------------------
// Env flags (must be set before any module that reads them loads).
// ---------------------------------------------------------------------------

process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';

// ---------------------------------------------------------------------------
// Hoisted stub state — declared via vi.hoisted so they are available before
// vi.mock factory functions run.
// ---------------------------------------------------------------------------

const {
    generateObjectCalls,
    nextGenerateObjectResult,
    nextGenerateObjectError,
    streamTextCalls,
    nextStreamDeltas,
    nextStreamError,
    currentEntitlementsForTest,
    currentLimitsForTest,
    currentBillingLoadFailedForTest,
    nextAmenityDbRows,
    nextFeatureDbRows,
    nextDestinationDbRows,
    nextPersistPromise,
    mockApiLogger,
    nextSearchCallCount,
    nextNearbyResult,
    nearbyGetCalls,
    nextAttractionResolveResult,
    attractionResolveCalls,
    nextPoiGetBySlugResult,
    nextPoiDestinationIdsResult,
    poiGetBySlugCalls,
    poiDestinationIdsCalls
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
    /** Calls recorded by the mocked streamText. */
    streamTextCalls: [] as Array<{
        feature: string;
        system?: string;
        messages: Array<{ role: string; content: string }>;
        locale: string;
    }>,
    /** Token deltas yielded by the mocked streamText stream. Defaults to a short reply. */
    nextStreamDeltas: { current: ['Entendido, '] as string[] },
    /** When set, the mock streamText generator throws this after yielding deltas. */
    nextStreamError: { current: null as unknown },
    currentEntitlementsForTest: { current: new Set<string>() },
    currentLimitsForTest: { current: new Map<string, number>() },
    currentBillingLoadFailedForTest: { current: false as boolean },
    /** Rows returned by the mocked amenity DB query. */
    nextAmenityDbRows: { current: [] as Array<{ id: string }> },
    /** Rows returned by the mocked feature DB query. */
    nextFeatureDbRows: { current: [] as Array<{ id: string }> },
    /**
     * Rows returned by the mocked destination DB query
     * (`resolveDestinationIdFromCity` — city → destinationId resolution, fix #4).
     * Both the exact-match and fuzzy-match queries read this same array, so
     * setting it to a single row simulates "the city resolved to a destination"
     * regardless of which of the two queries would have matched in production.
     */
    nextDestinationDbRows: { current: [] as Array<{ id: string }> },
    /**
     * T-007: controls what `persistSearchChatTurn` returns per-test.
     * Default: resolves with a fixed conversation id (happy path).
     */
    nextPersistPromise: {
        current: Promise.resolve({
            conversationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff'
        }) as Promise<{ conversationId: string }>
    },
    /** T-007: spy on logger calls to assert non-fatal failure / timeout handling. */
    mockApiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    },
    /**
     * SPEC-283: controls the value returned by the mocked `getMonthlyCallCount`
     * for the search feature. Set per-test to simulate under-quota / at-quota states.
     * Reset to 0 in `beforeEach` so tests are isolated.
     */
    nextSearchCallCount: { current: 0 },
    /**
     * HOS-111 T-013: controls what the mocked `DestinationService.getNearby`
     * returns per-test. Default (empty nearby array) means "no expansion" so
     * pre-existing tests that never set `expandToNearby: true` are unaffected.
     */
    nextNearbyResult: {
        current: { data: { nearby: [] } } as
            | { data: { nearby: Array<{ id: string; name: string; slug: string }> }; error?: never }
            | { data?: never; error: { code: string; message: string } }
    },
    /** HOS-111 T-013: records every `getNearby` call for call-count/arg assertions. */
    nearbyGetCalls: [] as Array<{ destinationId: string }>,
    /**
     * HOS-111 T-016: controls what the mocked
     * `AttractionService.getDestinationIdsByAttractionSlugs` returns per-test.
     * Default (empty destinationIds) means "no constraint" so pre-existing
     * tests that never set `attractionSlugs` are unaffected.
     */
    nextAttractionResolveResult: {
        current: { data: { destinationIds: [] } } as
            | { data: { destinationIds: string[] }; error?: never }
            | { data?: never; error: { code: string; message: string } }
    },
    /** HOS-111 T-016: records every attraction-resolve call for assertions. */
    attractionResolveCalls: [] as Array<{ slugs: string[] }>,
    /**
     * HOS-113 §6.3: controls what the mocked `PointOfInterestService.getBySlug`
     * returns per-test. Default (NOT_FOUND) means "no landmark resolvable" so
     * pre-existing tests that never set `poiSlugs` are unaffected.
     */
    nextPoiGetBySlugResult: {
        current: { error: { code: 'NOT_FOUND', message: 'not found' } } as
            | { data: { id: string; slug: string; lat: number; long: number }; error?: never }
            | { data?: never; error: { code: string; message: string } }
    },
    /**
     * HOS-113 §6.3: controls what the mocked
     * `PointOfInterestService.getDestinationIdsByPointOfInterestSlugs` returns
     * per-test. Default (empty destinationIds) means "no constraint".
     */
    nextPoiDestinationIdsResult: {
        current: { data: { destinationIds: [] } } as
            | { data: { destinationIds: string[] }; error?: never }
            | { data?: never; error: { code: string; message: string } }
    },
    /** HOS-113 §6.3: records every `getBySlug` call for assertions. */
    poiGetBySlugCalls: [] as Array<{ slug: string }>,
    /** HOS-113 §6.3: records every `getDestinationIdsByPointOfInterestSlugs` call for assertions. */
    poiDestinationIdsCalls: [] as Array<{ slugs: string[] }>
}));

// ---------------------------------------------------------------------------
// Mock: @repo/ai-core
// Provides real Error subclasses so `instanceof` checks in ai-error-mapper.ts
// work as in production. Mirrors search-intent.test.ts.
// ---------------------------------------------------------------------------

vi.mock('@repo/ai-core', () => {
    class AiEngineError extends Error {
        readonly engineCode: string;

        constructor(engineCode: string, message?: string) {
            super(message ?? engineCode);
            this.engineCode = engineCode;
        }
    }

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
        getMonthlyCallCount: vi.fn(async () => nextSearchCallCount.current),
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
// Returns a stub AiService with both `generateObject` (T-005) and `streamText`
// (T-006). `generateObject` records invocations and returns/throws the per-test
// configured value. `streamText` yields delta strings and resolves meta after
// drain. Mirrors the pattern from chat-route.test.ts.
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
        }),
        streamText: vi.fn(
            async (args: {
                feature: string;
                system?: string;
                messages: Array<{ role: string; content: string }>;
                locale: string;
            }) => {
                streamTextCalls.push({
                    feature: args.feature,
                    system: args.system,
                    messages: args.messages,
                    locale: args.locale
                });

                const deltas = nextStreamDeltas.current;
                const streamError = nextStreamError.current;
                let markDrained = (): void => {};
                const drained = new Promise<void>((resolve) => {
                    markDrained = resolve;
                });

                return {
                    stream: (async function* () {
                        try {
                            for (const delta of deltas) {
                                yield { delta };
                            }
                            if (streamError) {
                                throw streamError;
                            }
                        } finally {
                            markDrained();
                        }
                    })(),
                    meta: (async () => {
                        await drained;
                        return {
                            usage: { promptTokens: 8, completionTokens: 4, totalTokens: 12 },
                            provider: 'stub',
                            model: 'stub-model',
                            finishReason: 'stop'
                        };
                    })()
                };
            }
        )
    }))
}));

// ---------------------------------------------------------------------------
// Mock: entitlementMiddleware
// Injects per-test entitlement / limits / billingLoadFailed into Hono context.
// Mirrors the exact pattern used by search-intent.test.ts and chat-route.test.ts.
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
// Stubs `getDb()` so amenity/feature slug-to-UUID and city → destinationId
// queries return per-test rows without needing a real seeded database.
// Mirrors search-intent.test.ts exactly, extended with a `destinations` branch
// for `resolveDestinationIdFromCity` (fix #4).
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();

    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: (_cols: unknown) => {
                return {
                    from: (table: unknown) => {
                        let rows: Array<{ id: string }>;
                        if (table === actual.amenities) {
                            rows = nextAmenityDbRows.current;
                        } else if (table === actual.destinations) {
                            rows = nextDestinationDbRows.current;
                        } else {
                            rows = nextFeatureDbRows.current;
                        }
                        return {
                            where: () => Promise.resolve(rows)
                        };
                    }
                };
            }
        })),
        amenities: actual.amenities,
        features: actual.features,
        destinations: actual.destinations,
        inArray: actual.inArray
    };
});

// ---------------------------------------------------------------------------
// Mock: @repo/service-core — DestinationService.getNearby (HOS-111 T-013)
// Preserves every real export (Actor/ServiceError/RoleEnum/etc are used by
// middlewares mounted on the same app) and overrides only DestinationService
// so `getNearby` is controllable per-test without a real database.
// ---------------------------------------------------------------------------

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        DestinationService: class {
            async getNearby(_actor: unknown, params: { destinationId: string }) {
                nearbyGetCalls.push({ destinationId: params.destinationId });
                return nextNearbyResult.current;
            }
        },
        // HOS-111 T-016: mirrors the DestinationService.getNearby mock above —
        // controllable per-test without a real database or DB-mock join chain.
        AttractionService: class {
            async getDestinationIdsByAttractionSlugs(_actor: unknown, params: { slugs: string[] }) {
                attractionResolveCalls.push({ slugs: params.slugs });
                return nextAttractionResolveResult.current;
            }
        },
        // HOS-113 §6.3: mirrors the AttractionService mock above — controllable
        // per-test without a real database.
        PointOfInterestService: class {
            async getBySlug(_actor: unknown, slug: string) {
                poiGetBySlugCalls.push({ slug });
                return nextPoiGetBySlugResult.current;
            }
            async getDestinationIdsByPointOfInterestSlugs(
                _actor: unknown,
                params: { slugs: string[] }
            ) {
                poiDestinationIdsCalls.push({ slugs: params.slugs });
                return nextPoiDestinationIdsResult.current;
            }
        }
    };
});

// ---------------------------------------------------------------------------
// Mock: search-chat.persistence — persistSearchChatTurn (T-007)
// Mirrors the chat-route.test.ts pattern for persistChatTurn: vi.fn() returning
// the per-test configured promise so each test can control success / failure / timeout.
// ---------------------------------------------------------------------------

vi.mock('../../../src/routes/ai/protected/search-chat.persistence', () => ({
    persistSearchChatTurn: vi.fn(() => nextPersistPromise.current)
}));

// ---------------------------------------------------------------------------
// Mock: logger — apiLogger (T-007)
// Spy on warn/error to assert non-fatal failure / timeout log calls.
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Imports (post-mock).
// ---------------------------------------------------------------------------

import { OpenAPIHono } from '@hono/zod-openapi';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import { createErrorHandler } from '../../../src/middlewares/response';
import { protectedAiSearchChatRoute } from '../../../src/routes/ai/protected/search-chat';
import type { AppBindings, AppMiddleware } from '../../../src/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PATH = '/test-search-chat';
const ENDPOINT = `${TEST_PATH}/`;
const UNIQUE_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Fixed UUID returned by the mock DB for amenity slug lookups. */
const POOL_AMENITY_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Fixed UUID returned by the mock DB for feature slug lookups. */
const RIVER_FRONT_FEATURE_UUID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

/** Fixed UUID returned by the mock DB for city → destination resolution (fix #4). */
const COLON_DESTINATION_UUID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

/** HOS-111 T-013: fixed UUIDs for the "nearby destinations" AC-9 fixtures (Colón's neighbors). */
const PUEBLO_LIEBIG_UUID = '11111111-1111-4111-8111-111111111111';
const SAN_JOSE_UUID = '22222222-2222-4222-8222-222222222222';
const CONCEPCION_DEL_URUGUAY_UUID = '33333333-3333-4333-8333-333333333333';

/** HOS-111 T-016: fixed UUIDs for the "attraction-matched destinations" AC-11 fixtures. */
const GUALEGUAYCHU_UUID = '44444444-4444-4444-8444-444444444444';
const GUALEGUAY_UUID = '55555555-5555-4555-8555-555555555555';

/** HOS-113 §6.3: fixed lat/long + slug for the AC-6 "autódromo" fixture. */
const AUTODROMO_POI_SLUG = 'autodromo_concepcion_del_uruguay';
const AUTODROMO_LAT = -32.423;
const AUTODROMO_LONG = -58.2591;

/**
 * HOS-113 review M-2: fixed UUID for the cross-allowlist ambiguity
 * regression fixture (Concordia — the destination shared by BOTH the
 * attraction allowlist's bare "termas" entry and the POI allowlist's
 * "termas de concordia" entry).
 */
const CONCORDIA_UUID = '66666666-6666-4666-8666-666666666666';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

/**
 * Builds a Hono sub-app that mounts the real `protectedAiSearchChatRoute`
 * behind `actorMiddleware` so mock-actor headers populate the `actor` context
 * var read by `protectedAuthMiddleware` (injected by the factory).
 */
function buildTestApp(): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });
    app.onError(createErrorHandler());
    app.use(actorMiddleware());
    app.route(TEST_PATH, protectedAiSearchChatRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds standard mock-actor headers for the protected tier.
 * Default actor is a USER role with no extra permissions.
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
 * Builds a minimal valid request body for the search-chat endpoint.
 * Uses the smallest valid payload: a single user message and default locale.
 */
function makeValidBody(
    overrides: {
        messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
        locale?: string;
        conversationId?: string | null;
        currentFilters?: Record<string, unknown>;
    } = {}
): string {
    const body: Record<string, unknown> = {
        messages: overrides.messages ?? [{ role: 'user', content: 'Quiero un lugar con pileta' }]
    };
    if (overrides.locale !== undefined) {
        body.locale = overrides.locale;
    }
    if (overrides.conversationId !== undefined) {
        body.conversationId = overrides.conversationId;
    }
    if (overrides.currentFilters !== undefined) {
        body.currentFilters = overrides.currentFilters;
    }
    return JSON.stringify(body);
}

interface SseFrame {
    readonly event: string;
    readonly data: string;
}

/**
 * Reads all SSE frames from a streaming response body.
 * Handles chunked transfer and `\n\n`-delimited event blocks.
 */
async function readSseFrames(response: Response): Promise<SseFrame[]> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is null — no SSE stream');
    }

    const decoder = new TextDecoder();
    let raw = '';

    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
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

interface JsonErrorBody {
    readonly success: boolean;
    readonly error?: {
        readonly code: string;
        readonly message?: string;
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/ai/search-chat — integration gates (SPEC-212 T-004 / T-005)', () => {
    const app = buildTestApp();

    beforeEach(() => {
        // Reset per-test stub state to safe defaults.
        generateObjectCalls.length = 0;
        nextGenerateObjectError.current = null;
        nextGenerateObjectResult.current = {
            object: { confidence: 0.9, entities: {} },
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        };
        streamTextCalls.length = 0;
        nextStreamDeltas.current = ['Entendido, '];
        nextStreamError.current = null;
        currentBillingLoadFailedForTest.current = false;
        // SPEC-283: ai_search is auth-baseline — no AI_SEARCH entitlement is required,
        // but it is subject to a graduated per-plan monthly quota (MAX_AI_SEARCH_PER_MONTH).
        // Default to empty set + empty limits Map so base-flow tests run under the
        // "key absent → unlimited" semantics (getRemainingLimit returns -1).
        currentEntitlementsForTest.current = new Set<EntitlementKey>();
        currentLimitsForTest.current = new Map<LimitKey, number>();
        // SPEC-283: reset the per-test search call count so quota tests are isolated.
        nextSearchCallCount.current = 0;
        nextAmenityDbRows.current = [];
        nextFeatureDbRows.current = [];
        nextDestinationDbRows.current = [];
        // HOS-111 T-013: reset nearby-expansion stub state ("no expansion" default).
        nextNearbyResult.current = { data: { nearby: [] } };
        nearbyGetCalls.length = 0;
        // HOS-111 T-016: reset attraction-resolution stub state ("no constraint" default).
        nextAttractionResolveResult.current = { data: { destinationIds: [] } };
        attractionResolveCalls.length = 0;
        // HOS-113 §6.3: reset POI-resolution stub state ("no landmark resolvable" default).
        nextPoiGetBySlugResult.current = { error: { code: 'NOT_FOUND', message: 'not found' } };
        nextPoiDestinationIdsResult.current = { data: { destinationIds: [] } };
        poiGetBySlugCalls.length = 0;
        poiDestinationIdsCalls.length = 0;
        // T-007: default happy-path persistence — resolves with a fixed conversation id.
        nextPersistPromise.current = Promise.resolve({
            conversationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff'
        });
        mockApiLogger.info.mockReset();
        mockApiLogger.warn.mockReset();
        mockApiLogger.debug.mockReset();
        mockApiLogger.error.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Gate 1 — 401 unauthenticated
    // =========================================================================

    describe('Gate 1 — 401 when unauthenticated', () => {
        it('returns 401 when no mock-actor headers are provided', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: makeValidBody()
            });

            expect(res.status).toBe(401);
        });
    });

    // =========================================================================
    // Gate 2 — 400 on invalid body (validation runs pre-handler)
    // =========================================================================

    describe('Gate 2 — 400 on invalid request body', () => {
        it('returns 400 VALIDATION_ERROR when messages is an empty array', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({ messages: [] })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 VALIDATION_ERROR when messages field is missing', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({ locale: 'es' })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 VALIDATION_ERROR when messages exceeds the 20-message cap', async () => {
            const tooManyMessages = Array.from({ length: 21 }, (_, i) => ({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `message-${i}`
            }));

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({ messages: tooManyMessages })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 VALIDATION_ERROR when a message has an invalid role', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    messages: [{ role: 'system', content: 'Quiero una cabaña' }]
                })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 VALIDATION_ERROR when conversationId is not a valid UUID', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'Quiero algo cerca del río' }],
                    conversationId: 'not-a-uuid'
                })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    // =========================================================================
    // Gate 3 — 200 SSE response for valid authenticated request
    // Confirms the route is open to ALL authenticated users regardless of plan
    // entitlement (SPEC-283 — ai_search is auth-baseline: no entitlement gate,
    // but a per-plan monthly quota applies via Gate 7).
    // =========================================================================

    describe('Gate 3 — 200 SSE response for valid authenticated request', () => {
        it('returns 200 with text/event-stream content-type for a valid request', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type') ?? '').toContain('text/event-stream');
        });

        it('emits a done SSE frame for a valid request', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((frame) => frame.event === 'done');
            expect(doneFrames).toHaveLength(1);

            // T-007: done payload carries the persisted conversationId (or null on failure).
            const donePayload = JSON.parse(doneFrames[0]?.data ?? '{}') as {
                conversationId: string | null;
            };
            expect(donePayload).toHaveProperty('conversationId');
        });

        it('succeeds for a USER with NO AI entitlements (tourist-free, no plan grants)', async () => {
            // Simulate a tourist-free user: empty entitlements, empty limits.
            currentEntitlementsForTest.current = new Set<EntitlementKey>();
            currentLimitsForTest.current = new Map<LimitKey, number>();

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders({ role: RoleEnum.USER }),
                body: makeValidBody()
            });

            // The route must succeed — no entitlement gate exists on this route.
            expect(res.status).toBe(200);
        });

        it('succeeds for a HOST with AI_CHAT entitlement but NOT AI_SEARCH', async () => {
            // HOST user with chat but no explicit search entitlement.
            // Confirms the route does not gate on AI_SEARCH (SPEC-211 §7.7).
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_CHAT]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 20]]);

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders({ role: RoleEnum.HOST }),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);
        });

        it('returns 503 when billingLoadFailed is true (quota middleware fail-closed — SPEC-283)', async () => {
            // SPEC-283: the quota middleware mounts on this route and is fail-closed.
            // When billingLoadFailed=true the limits Map is empty; treating absence as
            // unlimited during a billing outage would be a privilege escalation, so the
            // middleware returns 503 SERVICE_UNAVAILABLE instead of passing the request.
            currentBillingLoadFailedForTest.current = true;

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            // Quota middleware is fail-closed — billing outage blocks search.
            expect(res.status).toBe(503);
        });

        it('accepts a valid multi-turn conversation body with conversationId', async () => {
            const multiTurnMessages = [
                { role: 'user' as const, content: 'Quiero una cabaña con pileta' },
                {
                    role: 'assistant' as const,
                    content: 'Encontré varios alojamientos con pileta.'
                },
                { role: 'user' as const, content: 'Que también tenga wifi' }
            ];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: multiTurnMessages,
                    locale: 'es',
                    conversationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
                })
            });

            expect(res.status).toBe(200);
        });
    });

    // =========================================================================
    // Gate 4 — T-005: filters SSE event emission
    // =========================================================================

    describe('Gate 4 — T-005: filters SSE event', () => {
        it('happy path: first-turn message emits a filters SSE frame with correct shape', async () => {
            // Arrange: stub generateObject to return entities with accommodationType
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.85,
                    entities: { accommodationType: 'CABIN', minGuests: 4 }
                },
                usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cabaña para 4 personas' }],
                    locale: 'es'
                })
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const filtersFrames = frames.filter((f) => f.event === 'filters');

            // A single filters frame must be present
            expect(filtersFrames).toHaveLength(1);

            const payload = JSON.parse(filtersFrames[0]?.data ?? '{}') as {
                params: Record<string, unknown>;
                intent: Record<string, unknown>;
            };

            // The frame must have both required fields
            expect(payload).toHaveProperty('params');
            expect(payload).toHaveProperty('intent');

            // intent reflects what generateObject returned
            expect(payload.intent).toMatchObject({ accommodationType: 'CABIN', minGuests: 4 });

            // params is a non-null object (URL-ready mapping)
            expect(typeof payload.params).toBe('object');
            expect(payload.params).not.toBeNull();
        });

        it('happy path: amenity slugs resolved to UUIDs appear in params', async () => {
            // Arrange: stub generateObject to return amenity slug 'pool'
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { amenitySlugs: ['pool'] }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // DB mock returns POOL_AMENITY_UUID for the slug
            nextAmenityDbRows.current = [{ id: POOL_AMENITY_UUID }];
            nextFeatureDbRows.current = [];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'Quiero pileta' }]
                })
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');

            expect(filtersFrame).toBeDefined();

            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                intent: Record<string, unknown>;
            };

            // amenities in params should contain the resolved UUID
            // (mapper uses key 'amenities', not 'amenityIds')
            expect(payload.params.amenities).toEqual(expect.arrayContaining([POOL_AMENITY_UUID]));
        });

        it('happy path: feature slugs resolved to UUIDs appear in params', async () => {
            // Arrange: stub generateObject to return feature slug 'river_front'
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
            nextAmenityDbRows.current = [];
            nextFeatureDbRows.current = [{ id: RIVER_FRONT_FEATURE_UUID }];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'frente al río' }]
                })
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');

            expect(filtersFrame).toBeDefined();

            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                intent: Record<string, unknown>;
            };

            // features in params should contain the resolved UUID
            // (mapper uses key 'features', not 'featureIds')
            expect(payload.params.features).toEqual(
                expect.arrayContaining([RIVER_FRONT_FEATURE_UUID])
            );
        });

        it('refinement turn: body with currentFilters + new message still emits a filters frame', async () => {
            // Arrange: prior filters for a cabin + new turn refines price
            const priorFilters = { accommodationType: 'CABIN', minGuests: 4 };

            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { accommodationType: 'CABIN', minGuests: 4, maxPrice: 50000 }
                },
                usage: { promptTokens: 25, completionTokens: 12, totalTokens: 37 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [
                        { role: 'user', content: 'cabaña para 4' },
                        { role: 'assistant', content: 'Encontré cabañas para 4 personas.' },
                        { role: 'user', content: 'más barata, hasta 50 mil' }
                    ],
                    currentFilters: priorFilters,
                    locale: 'es'
                })
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const filtersFrames = frames.filter((f) => f.event === 'filters');

            // filters frame must be present even on a refinement turn
            expect(filtersFrames).toHaveLength(1);

            const payload = JSON.parse(filtersFrames[0]?.data ?? '{}') as {
                params: Record<string, unknown>;
                intent: Record<string, unknown>;
            };

            expect(payload).toHaveProperty('params');
            expect(payload).toHaveProperty('intent');
            // intent carries the full updated entity set the stub returned
            expect(payload.intent).toMatchObject({ maxPrice: 50000 });
        });

        it('filters frame is emitted BEFORE done frame', async () => {
            // Arrange: default stub with empty entities
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const filtersIndex = frames.findIndex((f) => f.event === 'filters');
            const doneIndex = frames.findIndex((f) => f.event === 'done');

            expect(filtersIndex).toBeGreaterThanOrEqual(0);
            expect(doneIndex).toBeGreaterThanOrEqual(0);
            expect(filtersIndex).toBeLessThan(doneIndex);
        });

        it('generateObject is called with feature=search and the correct locale', async () => {
            // Arrange
            nextGenerateObjectResult.current = {
                object: { confidence: 0.7, entities: {} },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'I want a cabin by the river' }],
                    locale: 'en'
                })
            });

            expect(res.status).toBe(200);

            // generateObject must have been called exactly once
            expect(generateObjectCalls).toHaveLength(1);
            expect(generateObjectCalls[0]?.feature).toBe('search');
            expect(generateObjectCalls[0]?.locale).toBe('en');
        });

        it('entities safeParse failure falls back to empty intent and still emits filters frame', async () => {
            // Arrange: return an object that fails SearchIntentEntitiesSchema validation
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    // Intentionally invalid: amenitySlugs must be string[], here it's a string.
                    // `nextGenerateObjectResult` is typed as `unknown` so no cast is needed.
                    entities: { amenitySlugs: 'not-an-array' }
                },
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

            // Route must still succeed — fallback path
            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const filtersFrames = frames.filter((f) => f.event === 'filters');

            // filters frame still emitted (with empty intent)
            expect(filtersFrames).toHaveLength(1);

            const payload = JSON.parse(filtersFrames[0]?.data ?? '{}') as {
                params: Record<string, unknown>;
                intent: Record<string, unknown>;
            };

            // intent is the empty fallback
            expect(payload.intent).toEqual({});
        });
    });

    // =========================================================================
    // Gate 5 — T-006: streamText reply frames
    // =========================================================================

    describe('Gate 5 — T-006: streamText reply streaming', () => {
        it('emits one or more token frames carrying the stubbed reply text', async () => {
            // Arrange: stub yields two delta strings
            nextStreamDeltas.current = ['Entendido,', ' búsqueda registrada.'];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const tokenFrames = frames.filter((f) => f.event === 'token');

            // At least one token frame must be emitted
            expect(tokenFrames.length).toBeGreaterThanOrEqual(1);

            // Each token frame must carry a `delta` string
            for (const tf of tokenFrames) {
                const payload = JSON.parse(tf.data) as { delta: string };
                expect(typeof payload.delta).toBe('string');
            }

            // The full concatenated text matches the stub deltas
            const fullText = tokenFrames
                .map((tf) => (JSON.parse(tf.data) as { delta: string }).delta)
                .join('');
            expect(fullText).toBe('Entendido, búsqueda registrada.');
        });

        it('frame ordering: filters → token(s) → done', async () => {
            nextStreamDeltas.current = ['¡Perfecto!'];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const filtersIdx = frames.findIndex((f) => f.event === 'filters');
            const firstTokenIdx = frames.findIndex((f) => f.event === 'token');
            const doneIdx = frames.findIndex((f) => f.event === 'done');

            // All three event types must be present
            expect(filtersIdx).toBeGreaterThanOrEqual(0);
            expect(firstTokenIdx).toBeGreaterThanOrEqual(0);
            expect(doneIdx).toBeGreaterThanOrEqual(0);

            // Ordering: filters < first-token < done
            expect(filtersIdx).toBeLessThan(firstTokenIdx);
            expect(firstTokenIdx).toBeLessThan(doneIdx);
        });

        it('done frame carries the persisted conversationId on success (T-007)', async () => {
            const PERSISTED_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
            nextPersistPromise.current = Promise.resolve({ conversationId: PERSISTED_ID });

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);

            const donePayload = JSON.parse(doneFrames[0]?.data ?? '{}') as {
                conversationId: string | null;
            };
            // T-007: the real persisted id is returned, not an echo-back.
            expect(donePayload.conversationId).toBe(PERSISTED_ID);
        });

        it('streamText is called with feature=search and correct locale', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'I want a cabin by the river' }],
                    locale: 'en'
                })
            });

            expect(res.status).toBe(200);
            // Drain the stream so streamText is fully called
            await readSseFrames(res);

            expect(streamTextCalls).toHaveLength(1);
            expect(streamTextCalls[0]?.feature).toBe('search');
            expect(streamTextCalls[0]?.locale).toBe('en');
        });

        it('streamText is called with the reply prompt as `system` and no role:"system" message (HOS security-warning regression)', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({ locale: 'es' })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            expect(streamTextCalls).toHaveLength(1);
            const call = streamTextCalls[0];

            // The reply system prompt is passed via `system` (caller-wins override),
            // never as a `role: 'system'` message — that pattern triggers the
            // Vercel AI SDK's mid-array system-message security warning.
            expect(typeof call?.system).toBe('string');
            expect((call?.system ?? '').length).toBeGreaterThan(0);
            expect((call?.messages ?? []).some((m) => m.role === 'system')).toBe(false);
        });

        it('provider failure mid-reply emits error frame and no done frame', async () => {
            // Arrange: streamText generator throws after yielding some tokens
            nextStreamDeltas.current = ['partial'];
            nextStreamError.current = new Error('MODERATION_BLOCKED');

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const errorFrames = frames.filter((f) => f.event === 'error');
            const doneFrames = frames.filter((f) => f.event === 'done');

            // An error frame must be present
            expect(errorFrames).toHaveLength(1);

            // No done frame after an error (factory contract)
            expect(doneFrames).toHaveLength(0);
        });
    });

    // =========================================================================
    // Gate 6 — T-007: conversation persistence (best-effort)
    // =========================================================================

    describe('Gate 6 — T-007: conversation persistence', () => {
        it('persistSearchChatTurn is called with feature=search, userId, and the user + assistant text', async () => {
            const PERSISTED_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
            nextPersistPromise.current = Promise.resolve({ conversationId: PERSISTED_ID });
            nextStreamDeltas.current = ['Great', ' choice!'];

            const { persistSearchChatTurn } = await import(
                '../../../src/routes/ai/protected/search-chat.persistence'
            );

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: UNIQUE_USER_ID }),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'Quiero una cabaña con pileta' }],
                    locale: 'es'
                })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            // persistSearchChatTurn must have been called exactly once
            expect(vi.mocked(persistSearchChatTurn)).toHaveBeenCalledTimes(1);
            expect(vi.mocked(persistSearchChatTurn)).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: UNIQUE_USER_ID,
                    userMessage: 'Quiero una cabaña con pileta',
                    // Accumulated reply from the two stub deltas
                    assistantMessage: 'Great choice!',
                    conversationId: null
                })
            );
        });

        it('persistSearchChatTurn receives the request conversationId when provided (subsequent turn)', async () => {
            const EXISTING_CONV_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
            nextPersistPromise.current = Promise.resolve({ conversationId: EXISTING_CONV_ID });

            const { persistSearchChatTurn } = await import(
                '../../../src/routes/ai/protected/search-chat.persistence'
            );

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({ conversationId: EXISTING_CONV_ID })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            expect(vi.mocked(persistSearchChatTurn)).toHaveBeenCalledWith(
                expect.objectContaining({ conversationId: EXISTING_CONV_ID })
            );
        });

        it('done frame carries the persisted conversationId when persistence succeeds', async () => {
            const PERSISTED_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
            nextPersistPromise.current = Promise.resolve({ conversationId: PERSISTED_ID });

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const donePayload = JSON.parse(
                frames.find((f) => f.event === 'done')?.data ?? '{}'
            ) as { conversationId: string | null };

            expect(donePayload.conversationId).toBe(PERSISTED_ID);
        });

        it('non-fatal: stream still emits filters + tokens + done(conversationId:null) when persistence rejects', async () => {
            nextPersistPromise.current = Promise.reject(new Error('db connection lost'));
            nextStreamDeltas.current = ['Encontré', ' opciones.'];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            // The HTTP response must still be 200 (stream started before persistence)
            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);

            // filters + token frames must be present (stream was not broken)
            expect(frames.filter((f) => f.event === 'filters')).toHaveLength(1);
            expect(frames.filter((f) => f.event === 'token').length).toBeGreaterThanOrEqual(1);

            // done frame must be present with conversationId: null
            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);
            const donePayload = JSON.parse(doneFrames[0]?.data ?? '{}') as {
                conversationId: string | null;
            };
            expect(donePayload.conversationId).toBeNull();

            // The failure must have been logged via apiLogger.error (non-fatal signal)
            expect(mockApiLogger.error).toHaveBeenCalledTimes(1);
        });

        it('non-fatal: stream still emits done(conversationId:null) when persistence times out (never resolves)', async () => {
            // A promise that never resolves simulates a persistence call that exceeds
            // the 1500 ms race timeout. The real setTimeout fires after 1500 ms and
            // the race resolves to null. This test waits for the full timeout.
            nextPersistPromise.current = new Promise<{ conversationId: string }>(() => {
                // intentionally never resolves
            });

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);

            const donePayload = JSON.parse(doneFrames[0]?.data ?? '{}') as {
                conversationId: string | null;
            };
            expect(donePayload.conversationId).toBeNull();

            // Timeout must be logged via apiLogger.warn
            expect(mockApiLogger.warn).toHaveBeenCalledTimes(1);
        }, 10_000 /* allow up to 10 s for the 1500 ms timeout to fire */);
    });

    // =========================================================================
    // Gate 7 — SPEC-283: per-plan search quota
    //
    // Verifies that `createAiQuotaMiddleware('search', { skipEntitlementGate: true })`
    // enforces the MAX_AI_SEARCH_PER_MONTH per-plan quota before the handler runs.
    //
    // All 403 responses are JSON (the quota middleware throws BEFORE the SSE stream
    // opens, so `createErrorHandler` serialises them normally). The 200 cases verify
    // that the SSE stream still emits a `done` frame when quota allows the request.
    // =========================================================================

    describe('Gate 7 — SPEC-283: per-plan search quota', () => {
        it('(a) under quota: returns 200 SSE stream when call count is below the limit', async () => {
            // Arrange: plan allows 50 searches/month; user has used 0.
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_SEARCH_PER_MONTH, 50]]);
            nextSearchCallCount.current = 0;

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);
        });

        it('(b) quota reached: returns 403 LIMIT_REACHED when call count equals the limit', async () => {
            // Arrange: plan allows 50 searches/month; user has used all 50.
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_SEARCH_PER_MONTH, 50]]);
            nextSearchCallCount.current = 50;

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(403);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('LIMIT_REACHED');
        });

        it('(c) limit = 0 (disabled): returns 403 LIMIT_REACHED without querying usage count', async () => {
            // Arrange: plan has MAX_AI_SEARCH_PER_MONTH = 0 (feature disabled in plan).
            // The quota middleware short-circuits at the limit-value gate (step 4) —
            // getMonthlyCallCount is NEVER called (no DB query needed).
            // Setting nextSearchCallCount to a high value would expose an incorrect
            // code path that reads usage before gating; the test still passes regardless
            // because any path hits 403 LIMIT_REACHED (both step 4 and step 5 do so).
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_SEARCH_PER_MONTH, 0]]);
            nextSearchCallCount.current = 999; // detect if middleware reads count unnecessarily

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(403);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('LIMIT_REACHED');
        });

        it('(d) skipEntitlementGate verified: returns 200 for a user with NO AI_SEARCH entitlement when under quota', async () => {
            // Arrange: empty entitlements (no AI_SEARCH granted), but plan limit allows 50.
            // skipEntitlementGate=true — the entitlement check is SKIPPED entirely;
            // only the monthly quota applies. A tourist-free user with calls remaining must
            // succeed, which is the core semantics of SPEC-283 OQ-1 (auth-baseline).
            currentEntitlementsForTest.current = new Set<EntitlementKey>(); // NO AI_SEARCH
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_SEARCH_PER_MONTH, 50]]);
            nextSearchCallCount.current = 0;

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders({ role: RoleEnum.USER }),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);
        });

        it('(e) limit absent from Map (getRemainingLimit → -1 unlimited): returns 200 regardless of usage count', async () => {
            // Arrange: empty limits Map — the MAX_AI_SEARCH_PER_MONTH key is absent.
            // getRemainingLimit returns -1 when the key is missing, which the middleware
            // interprets as "unlimited" and calls next() without querying usage count.
            // This documents that a plan with NO MAX_AI_SEARCH_PER_MONTH key is treated
            // as unlimited — the per-key absence semantics are intentional for backward
            // compatibility with plans that predate SPEC-283.
            currentLimitsForTest.current = new Map<LimitKey, number>(); // key absent
            nextSearchCallCount.current = 999; // high value to expose any accidental limit check

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);
        });
    });

    // =========================================================================
    // Gate 8 — intent-extraction pipeline fixes:
    //   fix #1: guests/bedrooms/bathrooms min===max collapses to min-only.
    //   fix #2: boolean-shortcut amenity slugs (hasPool/hasParking/hasWifi/
    //           allowsPets) are deduped out of amenitySlugs before resolution.
    //   fix #4: entities.city resolves server-side to destinationId.
    // =========================================================================

    describe('Gate 8 — intent-extraction pipeline fixes', () => {
        it('fix #1: minGuests === maxGuests collapses to minGuests only in the emitted params', async () => {
            // Arrange: the model extracted an exact headcount ("para 4 personas"),
            // not an explicit range.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { minGuests: 4, maxGuests: 4 }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cabaña para 4 personas' }]
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            expect(payload.params.minGuests).toBe('4');
            expect(payload.params.maxGuests).toBeUndefined();
        });

        it('fix #2: hasPool=true + amenitySlugs=["pool"] resolves only via the boolean shortcut, not amenities', async () => {
            // Arrange: the model extracted BOTH the boolean shortcut AND the
            // duplicated amenity slug for the same physical amenity (pool).
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { hasPool: true, amenitySlugs: ['pool'] }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // If the (buggy) route resolved 'pool' anyway, the mock would return
            // this UUID — asserting it is ABSENT proves the dedup ran.
            nextAmenityDbRows.current = [{ id: POOL_AMENITY_UUID }];

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'quiero pileta' }]
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            // The boolean shortcut still applies (OR-based, correct behavior).
            expect(payload.params.hasPool).toBe('true');
            // The exact-amenity AND filter must NOT also be applied — 'pool' was
            // deduped out of amenitySlugs before resolution, so `amenities` is
            // omitted (an empty resolvedAmenityIds array means the mapper never
            // sets the key at all).
            expect(payload.params.amenities).toBeUndefined();
        });

        it('fix #2: an amenity slug NOT covered by a boolean shortcut is still resolved normally', async () => {
            // Arrange: hasPool is true (pool deduped), but 'bbq' has no boolean
            // shortcut counterpart and must still resolve.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { hasPool: true, amenitySlugs: ['pool', 'bbq'] }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            const BBQ_AMENITY_UUID = 'f0000000-0000-4000-8000-0000000000bb';
            // The mock's `from()` branch returns nextAmenityDbRows.current for ANY
            // amenities-table query — set it to only the BBQ UUID; the handler's
            // dedup ensures 'pool' is never included in the resolved query slugs,
            // so this simulates the DB matching only the surviving 'bbq' slug.
            nextAmenityDbRows.current = [{ id: BBQ_AMENITY_UUID }];

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'quiero pileta y parrilla' }]
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            expect(payload.params.hasPool).toBe('true');
            expect(payload.params.amenities).toEqual(expect.arrayContaining([BBQ_AMENITY_UUID]));
        });

        it('fix #4: city resolved to a known destination emits destinationId, not q', async () => {
            // Arrange: the model extracted a bare city name.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.85,
                    entities: { city: 'Colón' }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // The mocked destinations-table query matches "Colón" to a real destination.
            nextDestinationDbRows.current = [{ id: COLON_DESTINATION_UUID }];

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'algo en Colón' }]
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            expect(payload.params.destinationId).toBe(COLON_DESTINATION_UUID);
            expect(payload.params.q).toBeUndefined();
        });

        it('fix #4: city NOT resolved to any destination falls back to q (existing behavior preserved)', async () => {
            // Arrange: the model extracted a city name with no destinations-table match.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.8,
                    entities: { city: 'Nowhereland' }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // No destination rows match — resolveDestinationIdFromCity returns undefined.
            nextDestinationDbRows.current = [];

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'algo en Nowhereland' }]
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            expect(payload.params.q).toBe('Nowhereland');
            expect(payload.params.destinationId).toBeUndefined();
        });

        it('fix #4: city resolution is skipped entirely when entities.destinationId is already present', async () => {
            // Arrange: the model already extracted a destinationId directly —
            // the handler must not waste a DB round-trip resolving city too.
            const explicitDestinationId = 'a1111111-1111-4111-8111-111111111111';
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.95,
                    entities: { destinationId: explicitDestinationId, city: 'Colón' }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // If city resolution ran anyway, this row would leak through — it must not.
            nextDestinationDbRows.current = [{ id: COLON_DESTINATION_UUID }];

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            // The model's own destinationId wins (city resolution was skipped).
            expect(payload.params.destinationId).toBe(explicitDestinationId);
        });
    });

    // =========================================================================
    // Gate 9 — HOS-111 T-013: nearby-destination expansion (AC-9)
    //
    // "cabaña en Colón, y también en destinos cercanos" → Colón + ~50km
    // neighbors (Pueblo Liebig, San José, Concepción del Uruguay), with the
    // filters frame listing the included destinations.
    // =========================================================================

    describe('Gate 9 — HOS-111 T-013: nearby-destination expansion (AC-9)', () => {
        it('AC-9: expandToNearby=true + resolved destinationId expands the search and lists the neighbors', async () => {
            // Arrange: turn 2 of a conversation — Colón is already the anchor
            // in the CURRENT FILTER SET, and the new message asks to expand.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { destinationId: COLON_DESTINATION_UUID, expandToNearby: true }
                },
                usage: { promptTokens: 15, completionTokens: 8, totalTokens: 23 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextNearbyResult.current = {
                data: {
                    nearby: [
                        { id: PUEBLO_LIEBIG_UUID, name: 'Pueblo Liebig', slug: 'pueblo-liebig' },
                        { id: SAN_JOSE_UUID, name: 'San José', slug: 'san-jose' },
                        {
                            id: CONCEPCION_DEL_URUGUAY_UUID,
                            name: 'Concepción del Uruguay',
                            slug: 'concepcion-del-uruguay'
                        }
                    ]
                }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [
                        { role: 'user', content: 'cabaña en Colón' },
                        { role: 'assistant', content: 'Encontré cabañas en Colón.' },
                        { role: 'user', content: 'y también en destinos cercanos' }
                    ],
                    currentFilters: { destinationId: COLON_DESTINATION_UUID },
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            expect(filtersFrame).toBeDefined();

            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                intent: Record<string, unknown>;
                nearbyDestinations?: Array<{ id: string; name: string; slug: string }>;
            };

            // getNearby was called with the resolved Colón anchor.
            expect(nearbyGetCalls).toEqual([{ destinationId: COLON_DESTINATION_UUID }]);

            // The search widens to a multi-destination query: anchor + neighbors.
            expect(payload.params.destinationIds).toEqual(
                expect.arrayContaining([
                    COLON_DESTINATION_UUID,
                    PUEBLO_LIEBIG_UUID,
                    SAN_JOSE_UUID,
                    CONCEPCION_DEL_URUGUAY_UUID
                ])
            );

            // The filters frame lists which destinations were included (T-014 reads this).
            expect(payload.nearbyDestinations).toEqual([
                { id: PUEBLO_LIEBIG_UUID, name: 'Pueblo Liebig', slug: 'pueblo-liebig' },
                { id: SAN_JOSE_UUID, name: 'San José', slug: 'san-jose' },
                {
                    id: CONCEPCION_DEL_URUGUAY_UUID,
                    name: 'Concepción del Uruguay',
                    slug: 'concepcion-del-uruguay'
                }
            ]);
        });

        it('does not call getNearby and omits nearbyDestinations when expandToNearby is absent', async () => {
            // Arrange: a normal (non-expansion) turn with a resolved destination.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { destinationId: COLON_DESTINATION_UUID }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cabaña en Colón' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                nearbyDestinations?: unknown;
            };

            expect(nearbyGetCalls).toHaveLength(0);
            expect(payload.nearbyDestinations).toBeUndefined();
            expect(payload.params.destinationIds).toBeUndefined();
            expect(payload.params.destinationId).toBe(COLON_DESTINATION_UUID);
        });

        it('does not call getNearby when expandToNearby=true but no destinationId was resolved (nothing to expand from)', async () => {
            // Arrange: expandToNearby is set but there is no anchor destination
            // this turn (e.g. a context-free message the model mis-flagged, or
            // a query/geo/no-location turn) — the deterministic guard must skip.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.6,
                    entities: { expandToNearby: true, minGuests: 4 }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'también cerca' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                nearbyDestinations?: unknown;
            };

            expect(nearbyGetCalls).toHaveLength(0);
            expect(payload.nearbyDestinations).toBeUndefined();
        });

        it('non-fatal: a getNearby failure is logged and the turn still completes without expansion', async () => {
            // Arrange
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { destinationId: COLON_DESTINATION_UUID, expandToNearby: true }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextNearbyResult.current = {
                error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'y también cerca' }],
                    currentFilters: { destinationId: COLON_DESTINATION_UUID },
                    locale: 'es'
                })
            });

            // Assert: the turn still succeeds end-to-end (non-fatal contract).
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);

            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                nearbyDestinations?: unknown;
            };
            expect(payload.nearbyDestinations).toBeUndefined();
            expect(payload.params.destinationIds).toBeUndefined();
            expect(payload.params.destinationId).toBe(COLON_DESTINATION_UUID);
            expect(mockApiLogger.warn).toHaveBeenCalled();
        });

        it('empty-radius fallback still surfaces via nearbyDestinations when the model returns fallback neighbors', async () => {
            // Arrange: the model-layer radius/fallback logic itself is unit-tested
            // at packages/db/test/models/destination-nearby.test.ts. Here we only
            // verify the route surfaces whatever DestinationService.getNearby
            // returns (radius hit OR fallback) identically in the filters frame.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { destinationId: COLON_DESTINATION_UUID, expandToNearby: true }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // Only one destination came back (simulating the N-nearest fallback
            // path when the fixed radius yielded nothing) — still surfaced.
            nextNearbyResult.current = {
                data: {
                    nearby: [
                        {
                            id: CONCEPCION_DEL_URUGUAY_UUID,
                            name: 'Concepción del Uruguay',
                            slug: 'concepcion-del-uruguay'
                        }
                    ]
                }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'y en destinos cercanos' }],
                    currentFilters: { destinationId: COLON_DESTINATION_UUID },
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                nearbyDestinations?: Array<{ id: string; name: string; slug: string }>;
            };

            // A "nearby" result (radius hit or fallback) is never empty at this
            // layer — the search-chat route never returns 0 results back empty.
            expect(payload.nearbyDestinations).toHaveLength(1);
            expect(payload.params.destinationIds).toEqual(
                expect.arrayContaining([COLON_DESTINATION_UUID, CONCEPCION_DEL_URUGUAY_UUID])
            );
        });
    });

    // =========================================================================
    // Gate 10 — HOS-111 T-016: attraction-constrained destination search (AC-11)
    //
    // "una ciudad con carnavales" → constrains results to the destinations
    // that have that attraction (Gualeguaychú, Gualeguay).
    // =========================================================================

    describe('Gate 10 — HOS-111 T-016: attraction-constrained destination search (AC-11)', () => {
        it('AC-11: attractionSlugs resolves and constrains params.destinationIds when there is no other location constraint', async () => {
            // Arrange
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { attractionSlugs: ['sede_carnaval', 'corsodromo'] }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextAttractionResolveResult.current = {
                data: { destinationIds: [GUALEGUAYCHU_UUID, GUALEGUAY_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'una ciudad con carnavales' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            expect(filtersFrame).toBeDefined();

            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };

            expect(attractionResolveCalls).toEqual([{ slugs: ['sede_carnaval', 'corsodromo'] }]);
            expect(payload.params.destinationIds).toEqual([GUALEGUAYCHU_UUID, GUALEGUAY_UUID]);
            expect(
                (payload as { attractionLocationConflict?: unknown }).attractionLocationConflict
            ).toBeUndefined();
        });

        it('intersects with an already-resolved destinationId when the city HAS the attraction', async () => {
            // Arrange: the model resolved a city (Colón) AND Colón is one of the
            // attraction-matched destinations → the intersection is non-empty, so
            // the search narrows to exactly Colón.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: {
                        destinationId: COLON_DESTINATION_UUID,
                        attractionSlugs: ['sede_carnaval']
                    }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextAttractionResolveResult.current = {
                data: { destinationIds: [COLON_DESTINATION_UUID, GUALEGUAYCHU_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'una cabaña en Colón con carnavales' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                attractionLocationConflict?: unknown;
            };

            // Non-empty intersection (Colón ∈ {Colón, Gualeguaychú}) → narrows to Colón.
            expect(payload.params.destinationIds).toEqual([COLON_DESTINATION_UUID]);
            expect(payload.attractionLocationConflict).toBeUndefined();
        });

        it('AC-11 no-match: an incompatible city+attraction emits attractionLocationConflict and does NOT widen to the attraction set', async () => {
            // Arrange: the model resolved a city (Colón) but Colón is NOT one of
            // the attraction-matched destinations → empty intersection. Owner
            // decision: no-match (zero results + explanation), NOT a silent
            // substitution of the attraction destinations.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: {
                        destinationId: COLON_DESTINATION_UUID,
                        city: 'Colón',
                        attractionSlugs: ['sede_carnaval']
                    }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextAttractionResolveResult.current = {
                data: { destinationIds: [GUALEGUAYCHU_UUID, GUALEGUAY_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'una cabaña en Colón con carnavales' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                attractionLocationConflict?: { attractionSlugs: string[]; locationLabel?: string };
            };

            // The conflict is signalled so the web client skips the search.
            expect(payload.attractionLocationConflict).toBeDefined();
            expect(payload.attractionLocationConflict?.attractionSlugs).toEqual(['sede_carnaval']);
            expect(payload.attractionLocationConflict?.locationLabel).toBe('Colón');
            // CRITICAL: params are NOT widened to the attraction destinations —
            // the search must NOT silently substitute them.
            expect(payload.params.destinationIds).not.toEqual([GUALEGUAYCHU_UUID, GUALEGUAY_UUID]);
            expect(payload.params.destinationId).toBe(COLON_DESTINATION_UUID);
        });

        it('does not call the attraction resolver when attractionSlugs is absent', async () => {
            // Arrange
            nextGenerateObjectResult.current = {
                object: { confidence: 0.9, entities: { destinationId: COLON_DESTINATION_UUID } },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cabaña en Colón' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            expect(attractionResolveCalls).toHaveLength(0);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            expect(payload.params.destinationIds).toBeUndefined();
            expect(payload.params.destinationId).toBe(COLON_DESTINATION_UUID);
        });

        it('non-fatal: an attraction-resolution failure is logged and the turn still completes without constraining', async () => {
            // Arrange
            nextGenerateObjectResult.current = {
                object: { confidence: 0.9, entities: { attractionSlugs: ['sede_carnaval'] } },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextAttractionResolveResult.current = {
                error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'una ciudad con carnavales' }],
                    locale: 'es'
                })
            });

            // Assert: the turn still succeeds end-to-end (non-fatal contract).
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);

            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            expect(payload.params.destinationIds).toBeUndefined();
            expect(
                (payload as { attractionLocationConflict?: unknown }).attractionLocationConflict
            ).toBeUndefined();
            expect(mockApiLogger.warn).toHaveBeenCalled();
        });

        it('no-match: an attraction that matched NO destination emits attractionLocationConflict (owner decision)', async () => {
            // Arrange: the user asked for an attraction that no destination carries.
            nextGenerateObjectResult.current = {
                object: { confidence: 0.7, entities: { attractionSlugs: ['sede_carnaval'] } },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextAttractionResolveResult.current = { data: { destinationIds: [] } };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'una ciudad con carnavales' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                attractionLocationConflict?: { attractionSlugs: string[] };
            };
            // No-match: conflict signalled, and params carry NO location filter
            // (never an empty destinationIds array — that would be the full catalog).
            expect(payload.attractionLocationConflict).toBeDefined();
            expect(payload.attractionLocationConflict?.attractionSlugs).toEqual(['sede_carnaval']);
            expect(payload.params.destinationIds).toBeUndefined();
        });
    });

    // =========================================================================
    // Gate 11 — HOS-113 T-042: POI-constrained + proximity-centered search
    //
    // "cerca del autódromo" → resolves the matched landmark's coordinates and
    // centers the accommodation search on them (proximity), plus (when an
    // existing location constraint is present) narrows params.destinationIds
    // the same intersect-or-no-match way attractions do.
    // =========================================================================

    describe('Gate 11 — HOS-113 T-042: POI-constrained + proximity-centered search', () => {
        it('matched: poiSlugs resolves and centers the search on the landmark coordinates (no other location constraint)', async () => {
            // Arrange
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { poiSlugs: [AUTODROMO_POI_SLUG] }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                data: { destinationIds: [CONCEPCION_DEL_URUGUAY_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'busco algo cerca del autódromo' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            expect(filtersFrame).toBeDefined();

            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
            };

            expect(poiGetBySlugCalls).toEqual([{ slug: AUTODROMO_POI_SLUG }]);
            expect(poiDestinationIdsCalls).toEqual([{ slugs: [AUTODROMO_POI_SLUG] }]);
            // Reuses the EXISTING geo path (NG-2) — same params fields as an
            // explicit latitude/longitude/radius search.
            expect(payload.params.latitude).toBe(AUTODROMO_LAT);
            expect(payload.params.longitude).toBe(AUTODROMO_LONG);
            expect(payload.params.radius).toBe(5);
            expect(payload.params.destinationIds).toEqual([CONCEPCION_DEL_URUGUAY_UUID]);
            expect(payload.poiSlugs).toEqual([AUTODROMO_POI_SLUG]);
        });

        it('intersects with an already-resolved destinationId when it HAS the matched POI', async () => {
            // Arrange
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: {
                        destinationId: CONCEPCION_DEL_URUGUAY_UUID,
                        poiSlugs: [AUTODROMO_POI_SLUG]
                    }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                data: { destinationIds: [CONCEPCION_DEL_URUGUAY_UUID, GUALEGUAYCHU_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [
                        { role: 'user', content: 'en Concepción del Uruguay, cerca del autódromo' }
                    ],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
            };

            expect(payload.params.destinationIds).toEqual([CONCEPCION_DEL_URUGUAY_UUID]);
            expect(payload.params.latitude).toBe(AUTODROMO_LAT);
            expect(payload.params.longitude).toBe(AUTODROMO_LONG);
            expect(payload.poiSlugs).toEqual([AUTODROMO_POI_SLUG]);
        });

        it('honors a model-extracted radius (clamped) instead of the default 5km', async () => {
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { poiSlugs: [AUTODROMO_POI_SLUG], radius: 12 }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                data: { destinationIds: [CONCEPCION_DEL_URUGUAY_UUID] }
            };

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'a 12km del autódromo' }],
                    locale: 'es'
                })
            });

            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
            };
            expect(payload.params.radius).toBe(12);
        });

        it('does not call the POI resolver when poiSlugs is absent, and poiSlugs defaults to []', async () => {
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { destinationId: CONCEPCION_DEL_URUGUAY_UUID }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cabaña en Concepción del Uruguay' }],
                    locale: 'es'
                })
            });

            expect(res.status).toBe(200);
            expect(poiGetBySlugCalls).toHaveLength(0);
            expect(poiDestinationIdsCalls).toHaveLength(0);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
            };
            expect(payload.params.latitude).toBeUndefined();
            expect(payload.poiSlugs).toEqual([]);
        });

        it('AC-6: an unresolvable/hallucinated landmark mention yields empty poiSlugs, no proximity, and no crash', async () => {
            // Arrange: the model emitted a slug the DB does not recognise (the
            // allowlist matcher never invents slugs, but this exercises the
            // defensive path if it ever did, or if the seed data drifted —
            // R-4 hallucination defence at the resolver layer too).
            nextGenerateObjectResult.current = {
                object: { confidence: 0.6, entities: { poiSlugs: ['faro_imaginario'] } },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // Default stub state already returns NOT_FOUND for getBySlug.

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cerca del faro imaginario' }],
                    locale: 'es'
                })
            });

            // Assert: the turn still succeeds end-to-end (non-fatal contract).
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);

            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
            };
            expect(payload.poiSlugs).toEqual([]);
            expect(payload.params.latitude).toBeUndefined();
            expect(payload.params.longitude).toBeUndefined();
            // getDestinationIdsByPointOfInterestSlugs is never reached — the
            // primary landmark's coordinates could not be resolved first.
            expect(poiDestinationIdsCalls).toHaveLength(0);
        });

        it('no-match: an incompatible destination + POI silently skips proximity (not surfaced as a conflict)', async () => {
            // Arrange: the resolved destination does not carry the matched POI.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: {
                        destinationId: GUALEGUAYCHU_UUID,
                        poiSlugs: [AUTODROMO_POI_SLUG]
                    }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                data: { destinationIds: [CONCEPCION_DEL_URUGUAY_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'en Gualeguaychú, cerca del autódromo' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
            };
            // The proximity constraint is skipped (no destination shares the
            // landmark) but the existing location constraint is left intact —
            // deliberately no dedicated "conflict" frame for POIs (out of
            // scope for T-038..T-044).
            expect(payload.params.destinationId).toBe(GUALEGUAYCHU_UUID);
            expect(payload.params.latitude).toBeUndefined();
            expect(payload.poiSlugs).toEqual([]);
        });

        it('non-fatal: a POI-resolution failure is logged and the turn still completes without proximity', async () => {
            // Arrange
            nextGenerateObjectResult.current = {
                object: { confidence: 0.9, entities: { poiSlugs: [AUTODROMO_POI_SLUG] } },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cerca del autódromo' }],
                    locale: 'es'
                })
            });

            // Assert: the turn still succeeds end-to-end (non-fatal contract).
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);

            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
            };
            expect(payload.poiSlugs).toEqual([]);
            expect(payload.params.latitude).toBeUndefined();
            expect(mockApiLogger.warn).toHaveBeenCalled();
        });

        // ---------------------------------------------------------------------
        // HOS-113 review H-1/M-1: the reply narrative must not misrepresent an
        // unresolved POI mention. Reuses the "no-match" and "non-fatal" setups
        // above, but asserts the `streamText` messages instead of `params` —
        // these are new checkpoints, not replacements for the existing ones.
        // ---------------------------------------------------------------------

        it('H-1/M-1: no-match scrubs poiSlugs from the reply filters context and injects a corrective note', async () => {
            // Arrange: same incompatible destination + POI setup as the
            // "no-match: ... silently skips proximity" test above.
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: {
                        destinationId: GUALEGUAYCHU_UUID,
                        poiSlugs: [AUTODROMO_POI_SLUG]
                    }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                data: { destinationIds: [CONCEPCION_DEL_URUGUAY_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'en Gualeguaychú, cerca del autódromo' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            await readSseFrames(res);
            expect(streamTextCalls).toHaveLength(1);
            const call = streamTextCalls[0];
            const messages = call?.messages ?? [];

            // The raw unresolved landmark slug must NOT reach the assistant's
            // filters-context note — otherwise the model could claim the
            // search was centered near it when it wasn't (H-1's original bug).
            const assistantNote = messages.find(
                (m) => m.role === 'assistant' && m.content.startsWith('Extracted search filters')
            );
            expect(assistantNote).toBeDefined();
            expect(assistantNote?.content).not.toContain(AUTODROMO_POI_SLUG);

            // A corrective note (in `system`, never a `role: 'system'` message)
            // must instruct the model not to narrate an unapplied proximity search.
            expect(messages.some((m) => m.role === 'system')).toBe(false);
            expect(call?.system).toContain('LANDMARK NOT APPLIED');
            expect(call?.system).toContain(AUTODROMO_POI_SLUG);
            // Unlike the attraction conflict, this must not claim zero results.
            expect((call?.system ?? '').toUpperCase()).not.toContain('ZERO');
        });

        it('H-1/M-1: a non-fatal POI-resolution failure (with a raw mention) also scrubs poiSlugs and injects the corrective note', async () => {
            // Arrange: same non-fatal failure setup as the "non-fatal: a
            // POI-resolution failure ..." test above (poiResolution kind
            // degrades to `none`, but a raw poiSlugs mention was extracted).
            nextGenerateObjectResult.current = {
                object: { confidence: 0.9, entities: { poiSlugs: [AUTODROMO_POI_SLUG] } },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cerca del autódromo' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            await readSseFrames(res);
            expect(streamTextCalls).toHaveLength(1);
            const call = streamTextCalls[0];
            const messages = call?.messages ?? [];

            const assistantNote = messages.find(
                (m) => m.role === 'assistant' && m.content.startsWith('Extracted search filters')
            );
            expect(assistantNote?.content).not.toContain(AUTODROMO_POI_SLUG);

            expect(messages.some((m) => m.role === 'system')).toBe(false);
            expect(call?.system).toContain('LANDMARK NOT APPLIED');
        });

        it('H-1/M-1: a successfully resolved POI does NOT scrub poiSlugs or inject the corrective note', async () => {
            // Arrange: happy-path resolution (matched: poiSlugs resolves ...).
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.9,
                    entities: { poiSlugs: [AUTODROMO_POI_SLUG] }
                },
                usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                data: { destinationIds: [CONCEPCION_DEL_URUGUAY_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'busco algo cerca del autódromo' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            await readSseFrames(res);
            expect(streamTextCalls).toHaveLength(1);
            const call = streamTextCalls[0];
            const messages = call?.messages ?? [];

            const assistantNote = messages.find(
                (m) => m.role === 'assistant' && m.content.startsWith('Extracted search filters')
            );
            // A resolved landmark IS expected to appear in the reply context.
            expect(assistantNote?.content).toContain(AUTODROMO_POI_SLUG);

            expect(call?.system).not.toContain('LANDMARK NOT APPLIED');
        });
    });

    // =========================================================================
    // HOS-113 review M-2 — cross-allowlist ambiguity regression
    //
    // `ATTRACTION_ALLOWLIST.es.termas` (a bare word) substring-matches THREE
    // `POI_ALLOWLIST` terms ("termas de concordia", "complejo termal
    // concordia", "termas de federación"). A message that trips BOTH
    // dictionaries only resolves correctly today because Concordia and
    // Federación both happen to be within the attraction "termas"
    // 7-destination seed set — a SUPERSET ASSUMPTION that is not enforced
    // anywhere else. This guards it: if a future seed/migration change ever
    // drops one of those destinations from the "termas" attraction set, the
    // intersection computed in Step 7.7 goes empty and this test fails
    // loudly instead of the POI proximity narrowing silently vanishing.
    // =========================================================================

    describe('HOS-113 review M-2 — cross-allowlist ambiguity ("termas" bare-word vs POI-specific terms)', () => {
        it('a message matching BOTH the attraction "termas" bare-word AND the POI-specific "termas de concordia" term resolves coherently (POI proximity applies, not silently dropped)', async () => {
            // Arrange: mirrors what matchAttractionTerms('cerca de las termas
            // de concordia', 'es') and matchPoiTerms(..., 'es') would each
            // independently flag — see attraction-allowlist.ts's bare
            // "termas" entry and poi-allowlist.ts's "termas de concordia" /
            // "complejo termal concordia" entries.
            const TERMAS_ATTRACTION_SLUGS = [
                'aqua_parque_termal',
                'centro_spa_termal',
                'complejo_termal_principal',
                'piscinas_termales',
                'termas_familiares'
            ];
            const CONCORDIA_TERMAL_POI_SLUG = 'complejo_termal_concordia';
            const CONCORDIA_LAT = -31.393;
            const CONCORDIA_LONG = -58.021;

            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.85,
                    entities: {
                        attractionSlugs: TERMAS_ATTRACTION_SLUGS,
                        poiSlugs: [CONCORDIA_TERMAL_POI_SLUG]
                    }
                },
                usage: { promptTokens: 14, completionTokens: 7, totalTokens: 21 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // The "termas" attraction's real 7-destination seed set. Concordia
            // is deliberately included — this is the superset assumption
            // documented above.
            nextAttractionResolveResult.current = {
                data: {
                    destinationIds: [
                        CONCORDIA_UUID,
                        GUALEGUAYCHU_UUID,
                        GUALEGUAY_UUID,
                        COLON_DESTINATION_UUID,
                        CONCEPCION_DEL_URUGUAY_UUID,
                        PUEBLO_LIEBIG_UUID,
                        SAN_JOSE_UUID
                    ]
                }
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-concordia-termas',
                    slug: CONCORDIA_TERMAL_POI_SLUG,
                    lat: CONCORDIA_LAT,
                    long: CONCORDIA_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                data: { destinationIds: [CONCORDIA_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cerca de las termas de concordia' }],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
                attractionLocationConflict?: unknown;
            };

            // Step 7.6 (attraction): no prior location constraint → constrains
            // to the full termas-destination set (7 destinations).
            // Step 7.7 (POI): intersects that set with the POI's single
            // destination (Concordia) — a NON-EMPTY intersection → narrows
            // further to Concordia AND centers the search on the POI's own
            // coordinates. If the superset assumption ever broke (Concordia
            // dropped from the termas set), this intersection would go empty,
            // `resolvePoiConstraint` would return `no-match`, and
            // `params.destinationIds` would stay at the full 7-destination
            // attraction set with NO latitude/longitude — these assertions
            // would fail.
            expect(payload.params.destinationIds).toEqual([CONCORDIA_UUID]);
            expect(payload.params.latitude).toBe(CONCORDIA_LAT);
            expect(payload.params.longitude).toBe(CONCORDIA_LONG);
            expect(payload.poiSlugs).toEqual([CONCORDIA_TERMAL_POI_SLUG]);
            expect(payload.attractionLocationConflict).toBeUndefined();

            // The reply-narrative correction (H-1/M-1) must NOT fire — the
            // POI resolved successfully, so the model may cite it.
            expect(streamTextCalls).toHaveLength(1);
            expect(streamTextCalls[0]?.system).not.toContain('LANDMARK NOT APPLIED');
        });
    });

    // =========================================================================
    // AC-6 (HOS-113 T-044) — AI chat POI resolution acceptance test
    //
    // Consolidated end-to-end checkpoint (as opposed to Gate 11's fine-grained,
    // one-concern-per-test breakdown): a single scenario per outcome, each
    // asserting every AC-6 bullet point together — resolved poiSlugs,
    // proximity filtering applied via the landmark's real seeded coordinates
    // (`autodromo_concepcion_del_uruguay`, cross-checked against
    // `packages/seed/src/data/pointOfInterest/001-*.json`), and the
    // no-hallucination / no-crash guarantee for an unresolvable mention.
    // =========================================================================

    describe('AC-6 (HOS-113 T-044) — AI chat POI resolution acceptance test', () => {
        it('a NL mention of a seeded landmark resolves poiSlugs AND applies proximity ranking via the landmark coordinates', async () => {
            // Arrange: "cerca del autódromo" is a real allowlisted alias
            // (poi-allowlist.ts) for the real seeded slug
            // autodromo_concepcion_del_uruguay (lat -32.423, long -58.2591).
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.92,
                    entities: { poiSlugs: [AUTODROMO_POI_SLUG] }
                },
                usage: { promptTokens: 14, completionTokens: 7, totalTokens: 21 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            nextPoiGetBySlugResult.current = {
                data: {
                    id: 'poi-1',
                    slug: AUTODROMO_POI_SLUG,
                    lat: AUTODROMO_LAT,
                    long: AUTODROMO_LONG
                }
            };
            nextPoiDestinationIdsResult.current = {
                data: { destinationIds: [CONCEPCION_DEL_URUGUAY_UUID] }
            };

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [
                        { role: 'user', content: 'quiero un alojamiento cerca del autódromo' }
                    ],
                    locale: 'es'
                })
            });

            // Assert
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            expect(filtersFrame).toBeDefined();
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
            };

            // AC-6 bullet 1: the response's poiSlugs includes the resolved slug.
            expect(payload.poiSlugs).toEqual([AUTODROMO_POI_SLUG]);

            // AC-6 bullet 2: proximity filtering was applied using the POI's
            // real seeded coordinates — the same latitude/longitude/radius
            // params `AccommodationService.search` already consumes to build
            // the Haversine `WITHIN RADIUS` clause (T-033, NG-2). This mirrors
            // T-036's real-DB assertion at the boundary shared with this route.
            expect(payload.params.latitude).toBe(AUTODROMO_LAT);
            expect(payload.params.longitude).toBe(AUTODROMO_LONG);
            expect(payload.params.radius).toBe(5);

            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);
        });

        it('an unresolvable/hallucinated landmark mention yields empty poiSlugs with no invented slug and no crash', async () => {
            // Arrange: no allowlist term matches this text, so
            // entities.poiSlugs would normally stay absent — but even if a
            // future provider drifts and emits an unrecognised slug directly,
            // the resolver must degrade gracefully rather than invent
            // destinations/coordinates for it (R-4).
            nextGenerateObjectResult.current = {
                object: {
                    confidence: 0.4,
                    entities: { poiSlugs: ['castillo_inventado'] }
                },
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            };
            // Default stub state: getBySlug → NOT_FOUND.

            // Act
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: [{ role: 'user', content: 'cerca del castillo inventado' }],
                    locale: 'es'
                })
            });

            // Assert: the turn completes normally — no 5xx, no unhandled rejection.
            expect(res.status).toBe(200);
            const frames = await readSseFrames(res);
            const filtersFrame = frames.find((f) => f.event === 'filters');
            const payload = JSON.parse(filtersFrame?.data ?? '{}') as {
                params: Record<string, unknown>;
                poiSlugs?: string[];
            };

            // AC-6 bullet 3: no hallucinated slug, no proximity applied, no crash.
            expect(payload.poiSlugs).toEqual([]);
            expect(payload.params.latitude).toBeUndefined();
            expect(payload.params.longitude).toBeUndefined();
            expect(payload.params.destinationIds).toBeUndefined();

            const doneFrames = frames.filter((f) => f.event === 'done');
            expect(doneFrames).toHaveLength(1);
        });
    });
});
