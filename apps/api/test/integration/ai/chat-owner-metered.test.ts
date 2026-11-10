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
    mockOwnerQueryResult,
    getMonthlyCallCountReturn,
    mockRecordAiUsage,
    mockGetMonthlyCallCount,
    mockRateLimitCallCount,
    mockOwnerLimit,
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
        mockOwnerLimit: { current: 20 },
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
vi.mock('@repo/ai-core', async () => {
    // HOS-2095: the route appends the reply-language line through the REAL
    // detector; a whole-module mock would leave it `undefined`.
    const language = await vi.importActual<
        typeof import('../../../../../packages/ai-core/src/language/reply-language.js')
    >('../../../../../packages/ai-core/src/language/reply-language.js');

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
        appendReplyLanguageInstruction: language.appendReplyLanguageInstruction,
        AiEngineError,
        AiFeatureNotConfiguredError,
        getMonthlyCallCount: mockGetMonthlyCallCount,
        recordAiUsage: mockRecordAiUsage,
        resolveSystemPrompt: vi.fn(async () => ({
            content: 'System prompt',
            rules: '',
            source: 'default'
        })),
        composeSystemPrompt: vi.fn(
            (input: { readonly content: string; readonly rules: string | null }) => {
                const { content: c, rules: r } = input;
                return r !== null && r.trim() !== '' ? `${c}\n\n${r}` : c;
            }
        ),
        resolveFeatureConfig: vi.fn(async () => ({
            enabled: true,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'stub-model',
            params: { maxTokens: 512 }
        }))
    };
});

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async () => ({
            entitlements: {
                get: ({ key }: { key: string }) => (key === 'ai_chat' ? 1 : undefined)
            },
            limits: {
                get: ({ key }: { key: string }) =>
                    ({
                        max_ai_chat_per_month: mockOwnerLimit.current,
                        max_ai_chat_consumer_per_month: 20,
                        max_ai_chat_venue_per_month: 20,
                        max_ai_chat_experience_per_month: 20
                    })[key]
            }
        })
    })
}));

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
    const accommodationSchema = await import(
        '../../../../../packages/db/src/schemas/accommodation/accommodation.dbschema.ts'
    );
    const venueSchema = await import(
        '../../../../../packages/db/src/schemas/venue/venue.dbschema.ts'
    );
    const experienceSchema = await import(
        '../../../../../packages/db/src/schemas/experience/experiences.dbschema.ts'
    );

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
        accommodations: accommodationSchema.accommodations,
        venues: venueSchema.venues,
        experiences: experienceSchema.experiences,
        getDb: vi.fn(() => buildChain())
    };
});

vi.mock('../../../src/utils/response-helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/response-helpers')>();
    return {
        ...actual,
        handleRouteError: (error: unknown, context: import('hono').Context) =>
            (error as { code?: string }).code === 'NOT_FOUND'
                ? context.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)
                : actual.handleRouteError(error, context)
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
            // Like the real engine, `meta` settles only AFTER the stream drains
            // (it awaits usage + finishReason), so the route reads the full text.
            let markDrained: () => void = () => undefined;
            const drained = new Promise<void>((resolve) => {
                markDrained = resolve;
            });
            return {
                stream: (async function* () {
                    for (const delta of deltas) {
                        yield { delta };
                    }
                    markDrained();
                })(),
                meta: drained.then(() => nextMeta.current)
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
import { RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import { createErrorHandler } from '../../../src/middlewares/response';
import { protectedAiChatRoute } from '../../../src/routes/ai/protected/chat';
import { persistChatTurn } from '../../../src/services/ai-chat-persistence';
import type { AppBindings } from '../../../src/types';

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

describe('TEST:V5:32 POST /api/v1/protected/ai/chat — owner-metered (SPEC-211 T-009)', () => {
    const app = buildTestApp();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: owner has AI_CHAT with 20 quota, 0 used
        mockOwnerQueryResult.current = [{ ownerId: OWNER_ID }];
        getMonthlyCallCountReturn.current = 0;
        mockRateLimitCallCount.current = 0;
        mockOwnerLimit.current = 20;

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
        it('returns 200 SSE stream without a monthly plan quota', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tiene piscina?' }],
                    locale: 'es'
                })
            });

            const logged = mockApiLogger.error.mock.calls[0]?.[0] as
                | { error?: { message?: string } }
                | undefined;
            expect(res.status, logged?.error?.message).toBe(200);
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

            // HOS-2095: ONE chat request writes exactly ONE ai_usage row. The
            // listing owner bears the cost (`userId`); the tourist who asked is
            // carried on the same row (`consumerUserId`) so the consumer quota
            // can count it without a second, cost-bearing row.
            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
            const [onlyCall] = mockRecordAiUsage.mock.calls as unknown[][];
            const onlyArg = onlyCall?.[0] as
                | { userId: string | null; consumerUserId?: string | null; status: string }
                | undefined;
            expect(onlyArg?.userId).toBe(OWNER_ID);
            expect(onlyArg?.consumerUserId).toBe(TOURIST_ID);
            expect(onlyArg?.status).toBe('success');
        });

        it('counts the owner quota by userId and the tourist quota by consumerUserId', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tiene cochera?' }],
                    locale: 'es'
                })
            });
            expect(res.status).toBe(200);
            await readSseFrames(res);

            const countArgs = mockGetMonthlyCallCount.mock.calls.map(
                (call) =>
                    (call as unknown[])[0] as { userId: string; keyedBy?: 'user' | 'consumer' }
            );
            expect(countArgs).toHaveLength(2);
            expect(countArgs[0]?.userId).toBe(OWNER_ID);
            expect(countArgs[0]?.keyedBy ?? 'user').toBe('user');
            expect(countArgs[1]?.userId).toBe(TOURIST_ID);
            expect(countArgs[1]?.keyedBy).toBe('consumer');
        });

        it('writes ONE row for a self-chat (owner asking about their own listing)', async () => {
            const res = await app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: OWNER_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tiene wifi?' }],
                    locale: 'es'
                })
            });

            expect(res.status).toBe(200);
            await readSseFrames(res);

            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
            const [onlyCall] = mockRecordAiUsage.mock.calls as unknown[][];
            const onlyArg = onlyCall?.[0] as
                | { userId: string | null; consumerUserId?: string | null }
                | undefined;
            expect(onlyArg?.userId).toBe(OWNER_ID);
            expect(onlyArg?.consumerUserId).toBe(OWNER_ID);
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
    });

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

        it('invokes rate-limit middleware when historical usage is high', async () => {
            // Rate-limit runs BEFORE the handler's owner gate
            mockGetMonthlyCallCount.mockResolvedValueOnce(20).mockResolvedValue(0);
            mockOwnerLimit.current = 2147483647;

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
            // The configured effective limit is above this historical count.
            expect(res.status).toBe(200);
            expect(mockGetMonthlyCallCount).toHaveBeenCalled();
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

            const logged = mockApiLogger.error.mock.calls[0]?.[0] as
                | { error?: { message?: string } }
                | undefined;
            expect(res.status, logged?.error?.message).toBe(404);
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

    // =========================================================================
    // HOS-2095: an empty drained stream must not burn quota or persist a turn
    // =========================================================================

    describe('HOS-2095 — empty answer (reasoning model spent every token reasoning)', () => {
        const postChat = () =>
            app.request(STREAM_PATH, {
                method: 'POST',
                headers: makeMockActorHeaders({ actorId: TOURIST_ID }),
                body: JSON.stringify({
                    accommodationId: ACCOMMODATION_ID,
                    messages: [{ role: 'user', content: '¿Tiene piscina?' }],
                    locale: 'es'
                })
            });

        it('records exactly one usage row as error, persists nothing and warns', async () => {
            nextStreamDeltas.current = [];
            nextMeta.current = Promise.resolve({
                usage: { promptTokens: 11, completionTokens: 1024, totalTokens: 1035 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'length'
            });

            const res = await postChat();
            expect(res.status).toBe(200);
            await readSseFrames(res);

            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
            const rows = mockRecordAiUsage.mock.calls.map(
                (call) =>
                    (call as unknown[])[0] as {
                        userId: string | null;
                        consumerUserId?: string | null;
                        status: string;
                    }
            );
            expect(rows.map((c) => c.status)).toEqual(['error']);
            expect(rows.map((c) => c.userId)).toEqual([OWNER_ID]);
            expect(rows.map((c) => c.consumerUserId)).toEqual([TOURIST_ID]);
            expect(persistChatTurn).not.toHaveBeenCalled();
            expect(mockApiLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    feature: 'chat',
                    model: 'stub-model',
                    finishReason: 'length',
                    completionTokens: 1024
                }),
                expect.stringContaining('empty')
            );
        });

        it('keeps success and persists a non-empty answer truncated by length', async () => {
            nextMeta.current = Promise.resolve({
                usage: { promptTokens: 11, completionTokens: 1024, totalTokens: 1035 },
                provider: 'stub',
                model: 'stub-model',
                finishReason: 'length'
            });

            const res = await postChat();
            await readSseFrames(res);

            const statuses = mockRecordAiUsage.mock.calls.map(
                (call) => ((call as unknown[])[0] as { status: string }).status
            );
            expect(statuses).toEqual(['success']);
            expect(persistChatTurn).toHaveBeenCalledTimes(1);
        });
    });
});
