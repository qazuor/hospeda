/**
 * Integration tests for the owner-governed AI chat route (SPEC-211 T-009).
 *
 * Verifies the CENTRAL change of Phase 1:
 *   - The AI_CHAT gate evaluates the **listing owner's** entitlements, not the tourist's.
 *   - The monthly quota counts against the **owner's** userId via `getMonthlyCallCount`.
 *   - `recordAiUsage` is called with `userId === ownerId`, NOT the tourist's id (AC-1.2).
 *   - An owner at their `MAX_AI_CHAT_PER_MONTH` → 403 LIMIT_REACHED, regardless of the
 *     tourist's own (now non-existent) chat entitlement (AC-1.3).
 *   - An owner lacking `AI_CHAT` entirely → 403 ENTITLEMENT_REQUIRED (AC-1.x).
 *   - Per-tourist + per-IP rate-limit middlewares (`createAiRateLimitMiddlewares`) are still
 *     wired and still fire as the burst guard (AC-1.5).
 *   - An unknown accommodation → 404 before any streaming starts.
 *
 * Strategy: real protected streaming route + controlled module mocks at the DB
 * seam (`@repo/db`) and billing seam (`owner-entitlement`). The AI engine and
 * accommodation context are stubbed so no real DB connection is required.
 *
 * @module test/integration/ai/chat-owner-metered
 */

process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';

// ---------------------------------------------------------------------------
// Hoisted mutable test state (vi.hoisted runs BEFORE vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockOwnerEntitlements,
    mockOwnerLimits,
    mockOwnerQueryResult,
    getMonthlyCallCountReturn,
    mockRecordAiUsage,
    mockGetMonthlyCallCount,
    mockRateLimitCallCount,
    nextStreamDeltas,
    nextMeta,
    nextContextResult,
    nextPersistPromise,
    mockApiLogger
} = vi.hoisted(() => {
    const mockRecordAiUsage = vi.fn(async () => ({
        id: 'usage-row-id',
        userId: null as string | null,
        feature: 'chat',
        provider: 'stub',
        model: 'stub-model',
        tokensIn: 11,
        tokensOut: 7,
        costEstimateMicroUsd: 0,
        latencyMs: 0,
        status: 'success',
        createdAt: new Date()
    }));
    const mockGetMonthlyCallCount = vi.fn(async () => 0);

    return {
        // Owner billing state (controlled per test)
        mockOwnerEntitlements: { current: ['ai_chat'] as string[] },
        mockOwnerLimits: { current: new Map<string, number>([['max_ai_chat_per_month', 20]]) },
        // DB row returned for the accommodation's ownerId lookup
        mockOwnerQueryResult: {
            current: [{ ownerId: '11111111-1111-1111-1111-111111111111' }] as Array<{
                ownerId: string;
            }>
        },
        getMonthlyCallCountReturn: { current: 0 },
        mockRecordAiUsage,
        mockGetMonthlyCallCount,
        // Track rate-limit middleware calls
        mockRateLimitCallCount: { current: 0 },
        nextStreamDeltas: { current: ['Hola', ' mundo'] as string[] },
        nextMeta: {
            current: Promise.resolve({
                usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'stop'
            })
        },
        nextContextResult: {
            current: {
                contextBlock: '## Accommodation: Test Cabin',
                systemMessage: 'SYSTEM MESSAGE',
                accommodationName: 'Test Cabin'
            }
        },
        nextPersistPromise: {
            current: Promise.resolve({
                conversationId: '44444444-4444-4444-8444-444444444444'
            }) as Promise<{ conversationId: string }>
        },
        mockApiLogger: {
            info: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        }
    };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Mock @repo/ai-core — stub getMonthlyCallCount and recordAiUsage so we can
 * control their return values and spy on their call arguments.
 */
vi.mock('@repo/ai-core', () => {
    class AiEngineError extends Error {
        readonly engineCode: string;
        constructor(engineCode: string, message?: string) {
            super(message ?? engineCode);
            this.engineCode = engineCode;
        }
    }

    // Mirrors packages/ai-core/src/config/resolver.ts — required so the
    // `instanceof AiFeatureNotConfiguredError` check in ai-error-mapper.ts does
    // not evaluate against `undefined` and crash the mapper (every error → 500).
    // Added when staging's resolveFeatureConfig path merged into the chat handler.
    class AiFeatureNotConfiguredError extends Error {
        readonly feature: string;
        constructor(feature: string) {
            super(`AI feature '${feature}' is not configured in ai_settings.`);
            this.name = 'AiFeatureNotConfiguredError';
            this.feature = feature;
        }
    }

    return {
        AiEngineError,
        AiFeatureNotConfiguredError,
        getMonthlyCallCount: mockGetMonthlyCallCount,
        recordAiUsage: mockRecordAiUsage,
        resolveSystemPrompt: vi.fn(async () => ({
            content: 'System prompt',
            source: 'default'
        })),
        resolveFeatureConfig: vi.fn(async () => ({
            enabled: true,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'stub-model',
            params: { maxTokens: 512 }
        }))
    };
});

/**
 * Mock @repo/db — stub only `getDb` to intercept the inline ownerId lookup.
 * All other exports (schemas, models, etc.) pass through via `importOriginal`
 * so transitive consumers (actor middleware, entitlement middleware, etc.) are
 * not broken by a partial mock.
 *
 * The chain used in the route is:
 *   db.select({ ownerId }).from(accommodations).where(eq(...)).limit(1)
 */
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();

    const buildChain = (): {
        select: (cols: unknown) => {
            from: (table: unknown) => {
                where: (cond: unknown) => {
                    limit: (n: number) => Promise<Array<{ ownerId: string }>>;
                };
            };
        };
    } => ({
        select: (_cols: unknown) => ({
            from: (_table: unknown) => ({
                where: (_cond: unknown) => ({
                    limit: (_n: number) => Promise.resolve(mockOwnerQueryResult.current)
                })
            })
        })
    });

    return {
        ...actual,
        getDb: vi.fn(() => buildChain())
    };
});

/**
 * Mock the owner-entitlement helpers so we control what the route sees for the
 * owner's billing state without a real QZPay round-trip.
 */
vi.mock('../../../src/middlewares/owner-entitlement', () => ({
    resolveOwnerEntitlementsForOwnerId: vi.fn(
        async () => mockOwnerEntitlements.current as string[]
    ),
    resolveOwnerLimitsForOwnerId: vi.fn(async () => mockOwnerLimits.current as Map<string, number>)
}));

/**
 * Mock entitlementMiddleware — no-op. The chat route no longer gates on the
 * tourist's entitlements for AI_CHAT; the middleware still runs (tourist state
 * might be consumed by other middlewares) but is a pass-through here.
 */
vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        entitlementMiddleware: () => {
            return async (
                _c: Parameters<AppMiddleware>[0],
                next: Parameters<AppMiddleware>[1]
            ): Promise<void> => {
                await next();
            };
        }
    };
});

/**
 * Mock rate-limit middlewares — track invocation count to assert AC-1.5
 * (rate-limit is still wired). Each invocation increments the counter.
 */
vi.mock('../../../src/middlewares/ai-rate-limit', () => ({
    createAiRateLimitMiddlewares: vi.fn(() => [
        async (_c: unknown, next: () => Promise<void>) => {
            mockRateLimitCallCount.current += 1;
            await next();
        }
    ])
}));

/**
 * Mock AI service factory — returns a stub streamer.
 */
vi.mock('../../../src/services/ai-service.factory', () => ({
    createConfiguredAiService: vi.fn(async () => ({
        streamText: vi.fn(async () => {
            const deltas = nextStreamDeltas.current;
            return {
                stream: (async function* () {
                    for (const delta of deltas) {
                        yield { delta };
                    }
                })(),
                meta: nextMeta.current
            };
        })
    }))
}));

/**
 * Mock accommodation context — short-circuit the DB-heavy context assembly.
 */
vi.mock('../../../src/services/accommodation-ai-context', () => ({
    assembleAccommodationContext: vi.fn(async () => nextContextResult.current)
}));

/**
 * Mock persistence — always succeeds with a known conversationId.
 */
vi.mock('../../../src/services/ai-chat-persistence', () => ({
    persistChatTurn: vi.fn(() => nextPersistPromise.current)
}));

/**
 * Mock PostHog — suppress analytics side-effects.
 */
vi.mock('../../../src/lib/posthog', () => ({
    getPostHogClient: vi.fn(() => ({ capture: vi.fn() }))
}));

/**
 * Mock logger — suppress output.
 */
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { OpenAPIHono } from '@hono/zod-openapi';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import * as ownerEntitlementModule from '../../../src/middlewares/owner-entitlement';
import { createErrorHandler } from '../../../src/middlewares/response';
import { protectedAiChatRoute } from '../../../src/routes/ai/protected/chat';
import type { AppBindings, AppMiddleware } from '../../../src/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PATH = '/test-chat-owner';
const STREAM_PATH = `${TEST_PATH}/`;

/** The tourist (requesting user) — NOT the one billed for AI usage. */
const TOURIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
/** The listing owner — the one billed for AI usage (AC-1.2). */
const OWNER_ID = '11111111-1111-1111-1111-111111111111';
const ACCOMMODATION_ID = '66666666-6666-4666-8666-666666666666';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function buildTestApp(): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });
    app.onError(createErrorHandler());
    app.use(actorMiddleware());
    app.route(TEST_PATH, protectedAiChatRoute);
    return app;
}

function makeMockActorHeaders(
    overrides: { actorId?: string; role?: RoleEnum } = {}
): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'user-agent': 'vitest-integration',
        'x-mock-actor-id': overrides.actorId ?? TOURIST_ID,
        'x-mock-actor-role': overrides.role ?? RoleEnum.USER,
        'x-mock-actor-permissions': '[]'
    };
}

// ---------------------------------------------------------------------------
// SSE frame reader
// ---------------------------------------------------------------------------

interface SseFrame {
    readonly event: string;
    readonly data: string;
}

async function readSseFrames(response: Response): Promise<SseFrame[]> {
    const reader = response.body?.getReader();
    if (!reader) {
        return [];
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
                if (line.startsWith('event: ')) event = line.slice('event: '.length).trim();
                else if (line.startsWith('data: ')) data = line.slice('data: '.length).trim();
            }
            return { event, data };
        });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/ai/chat — owner-metered (SPEC-211 T-009)', () => {
    const app = buildTestApp();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: owner has AI_CHAT with 20 quota, 0 used
        mockOwnerEntitlements.current = [EntitlementKey.AI_CHAT];
        mockOwnerLimits.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 20]]);
        mockOwnerQueryResult.current = [{ ownerId: OWNER_ID }];
        getMonthlyCallCountReturn.current = 0;
        mockRateLimitCallCount.current = 0;

        // Reset mocks to their default implementations
        mockGetMonthlyCallCount.mockReset();
        mockGetMonthlyCallCount.mockResolvedValue(0);

        mockRecordAiUsage.mockReset();
        mockRecordAiUsage.mockResolvedValue({
            id: 'usage-row-id',
            userId: OWNER_ID,
            feature: 'chat',
            provider: 'stub',
            model: 'stub-model',
            tokensIn: 11,
            tokensOut: 7,
            costEstimateMicroUsd: 0,
            latencyMs: 0,
            status: 'success',
            createdAt: new Date()
        });

        nextStreamDeltas.current = ['Hola', ' mundo'];
        nextMeta.current = Promise.resolve({
            usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        });
        nextPersistPromise.current = Promise.resolve({
            conversationId: '44444444-4444-4444-8444-444444444444'
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // AC-1.2: success path — recordAiUsage called with userId === ownerId
    // =========================================================================

    describe('AC-1.2 — successful request records usage against the owner, not the tourist', () => {
        it('returns 200 SSE stream when owner has AI_CHAT + remaining quota', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tiene piscina?' }],
                    locale: 'es'
                })
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type') ?? '').toContain('text/event-stream');
        });

        it('calls recordAiUsage with userId === ownerId (NOT the tourist)', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tiene wifi?' }],
                    locale: 'es'
                })
            });

            expect(res.status).toBe(200);

            // Drain the stream so augmentedMeta settles and recordAiUsage is called.
            await readSseFrames(res);

            // AC-1.2: recordAiUsage MUST be called with the OWNER's userId.
            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
            expect(mockRecordAiUsage).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: OWNER_ID,
                    feature: 'chat',
                    status: 'success'
                })
            );

            // Critical: the TOURIST's id must NOT appear as the userId.
            const callArgs = mockRecordAiUsage.mock.calls[0] as unknown[] | undefined;
            const callArg = callArgs?.[0] as { userId: string | null } | undefined;
            expect(callArg?.userId).not.toBe(TOURIST_ID);
            expect(callArg?.userId).toBe(OWNER_ID);
        });

        it('passes correct provider/model/tokens from resolvedMeta to recordAiUsage', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Cuántas camas?' }],
                    locale: 'en'
                })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            expect(mockRecordAiUsage).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: OWNER_ID,
                    feature: 'chat',
                    provider: 'stub',
                    model: 'stub-model',
                    promptTokens: 11,
                    completionTokens: 7,
                    status: 'success'
                })
            );
        });

        it('passes `resolveOwnerEntitlementsForOwnerId` and `resolveOwnerLimitsForOwnerId` the correct ownerId', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tiene desayuno?' }]
                })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            expect(
                vi.mocked(ownerEntitlementModule.resolveOwnerEntitlementsForOwnerId)
            ).toHaveBeenCalledWith(OWNER_ID);
            expect(
                vi.mocked(ownerEntitlementModule.resolveOwnerLimitsForOwnerId)
            ).toHaveBeenCalledWith(OWNER_ID);
        });
    });

    // =========================================================================
    // AC-1.3: owner-at-quota → 403 LIMIT_REACHED (tourist's quota irrelevant)
    // =========================================================================

    describe('AC-1.3 — owner at monthly quota → 403 LIMIT_REACHED (pre-stream)', () => {
        it('returns 403 LIMIT_REACHED when owner has used all chat quota', async () => {
            // Owner is at their 20-call limit
            mockOwnerLimits.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 20]]);
            mockGetMonthlyCallCount.mockResolvedValue(20);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Hay parking?' }]
                })
            });

            expect(res.status).toBe(403);
            const body = (await res.json()) as { error: { code: string } };
            expect(body.error.code).toBe('LIMIT_REACHED');
        });

        it('blocks even when the tourist would previously have had their own quota', async () => {
            // Simulate: owner has 0 remaining, tourist entitlements irrelevant
            mockOwnerLimits.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 5]]);
            mockGetMonthlyCallCount.mockResolvedValue(5);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                // Tourist has TOURIST role (would have had own entitlements before SPEC-211)
                headers: makeMockActorHeaders({ actorId: TOURIST_ID, role: RoleEnum.USER }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tiene pileta?' }]
                })
            });

            expect(res.status).toBe(403);
            const body = (await res.json()) as { error: { code: string } };
            expect(body.error.code).toBe('LIMIT_REACHED');
        });

        it('does NOT call getMonthlyCallCount when owner limit is -1 (unlimited/staff)', async () => {
            // Staff owners get -1 → unlimited, so no DB count query needed
            mockOwnerLimits.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, -1]]);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Qué incluye?' }]
                })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            // The -1 unlimited branch skips the DB count entirely
            expect(mockGetMonthlyCallCount).not.toHaveBeenCalled();
        });

        it('counts getMonthlyCallCount with userId === ownerId (not tourist)', async () => {
            mockOwnerLimits.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 20]]);
            mockGetMonthlyCallCount.mockResolvedValue(5);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Está en el centro?' }]
                })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            expect(mockGetMonthlyCallCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: OWNER_ID,
                    feature: 'chat'
                })
            );

            // Tourist id must NOT be used for the count
            const countCallArgs = mockGetMonthlyCallCount.mock.calls[0] as unknown[] | undefined;
            const countArg = countCallArgs?.[0] as
                | { userId: string; feature: string; now: Date }
                | undefined;
            expect(countArg?.userId).not.toBe(TOURIST_ID);
        });
    });

    // =========================================================================
    // Owner lacks AI_CHAT entitlement → 403 ENTITLEMENT_REQUIRED
    // =========================================================================

    describe('owner lacks AI_CHAT entitlement → 403 ENTITLEMENT_REQUIRED (pre-stream)', () => {
        it('returns 403 ENTITLEMENT_REQUIRED when owner plan does not include AI_CHAT', async () => {
            // Owner on a plan without AI_CHAT (e.g., expired/no sub)
            mockOwnerEntitlements.current = [];

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Aceptan mascotas?' }]
                })
            });

            expect(res.status).toBe(403);
            const body = (await res.json()) as { error: { code: string } };
            expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        });

        it('does NOT call getMonthlyCallCount when the gate fails on entitlement', async () => {
            mockOwnerEntitlements.current = [];

            await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: 'Test' }]
                })
            });

            expect(mockGetMonthlyCallCount).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // AC-1.5: per-tourist + per-IP rate-limit middleware still fires
    // =========================================================================

    describe('AC-1.5 — per-tourist rate-limit middleware preserved', () => {
        it('invokes the rate-limit middleware on a valid request', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tienen desayuno?' }]
                })
            });

            // Rate-limit middleware was called (AC-1.5)
            expect(mockRateLimitCallCount.current).toBeGreaterThanOrEqual(1);
            // And the request still succeeded (the stub rate-limit passes through)
            expect(res.status).toBe(200);
        });

        it('invokes rate-limit middleware even when owner is at quota (burst guard fires first)', async () => {
            // Rate-limit runs BEFORE the handler's owner gate
            mockOwnerLimits.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 20]]);
            mockGetMonthlyCallCount.mockResolvedValue(20);

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: 'test' }]
                })
            });

            // Rate-limit middleware executed (burst guard is in the middleware chain)
            expect(mockRateLimitCallCount.current).toBeGreaterThanOrEqual(1);
            // But the owner quota blocks the request at the handler level
            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // 404 for unknown accommodation (pre-stream)
    // =========================================================================

    describe('404 when accommodation does not exist', () => {
        it('returns 404 when the accommodation row is not found in the DB', async () => {
            // Empty result set → no accommodation row
            mockOwnerQueryResult.current = [];

            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                    messages: [{ role: 'user', content: 'test' }]
                })
            });

            expect(res.status).toBe(404);
        });
    });

    // =========================================================================
    // 401 when unauthenticated
    // =========================================================================

    it('returns 401 when no mock-actor headers are provided', async () => {
        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: [{ role: 'user', content: 'test' }]
            })
        });

        expect(res.status).toBe(401);
    });
});
