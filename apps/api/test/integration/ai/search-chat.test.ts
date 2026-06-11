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
    nextPersistPromise,
    mockApiLogger
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
    }
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
        getMonthlyCallCount: vi.fn(async () => 0),
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
                messages: Array<{ role: string; content: string }>;
                locale: string;
            }) => {
                streamTextCalls.push({
                    feature: args.feature,
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
// Stubs `getDb()` so amenity/feature slug-to-UUID queries return per-test rows
// without needing a real seeded database. Mirrors search-intent.test.ts exactly.
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
        inArray: actual.inArray
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
        // SPEC-211 §7.7: ai_search is a free platform feature — no AI entitlement
        // required. Default to empty set (tourist-free user) to verify the route
        // is open to all authenticated users regardless of billing plan.
        currentEntitlementsForTest.current = new Set<EntitlementKey>();
        currentLimitsForTest.current = new Map<LimitKey, number>();
        nextAmenityDbRows.current = [];
        nextFeatureDbRows.current = [];
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
    // (SPEC-211 §7.7 — ai_search is a free platform feature).
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

        it('succeeds even when billingLoadFailed is true (platform feature is billing-transparent)', async () => {
            currentBillingLoadFailedForTest.current = true;

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            // Platform-governed — a billing outage does not block search.
            expect(res.status).toBe(200);
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

        it('streamText messages include a system message (reply prompt) as first element', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({ locale: 'es' })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            expect(streamTextCalls).toHaveLength(1);
            const messages = streamTextCalls[0]?.messages ?? [];
            expect(messages.length).toBeGreaterThanOrEqual(1);

            // First message must be the system prompt (caller-wins override)
            const first = messages[0];
            expect(first?.role).toBe('system');
            expect(typeof first?.content).toBe('string');
            expect((first?.content ?? '').length).toBeGreaterThan(0);
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
});
