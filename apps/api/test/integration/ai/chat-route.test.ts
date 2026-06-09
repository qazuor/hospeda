/**
 * Integration tests for `POST /api/v1/protected/ai/chat` (SPEC-200 T-004).
 *
 * Uses the REAL protected streaming route + REAL auth/rate-limit/quota route
 * factory stack. The external seams are stubbed at the module boundary:
 *
 * - `entitlementMiddleware()` injects entitlements/limits into context.
 * - `@repo/ai-core` is stubbed for `AiEngineError`, `getMonthlyCallCount`,
 *   `recordAiUsage`, and `resolveSystemPrompt`.
 * - `createConfiguredAiService()` returns a controlled streaming stub.
 * - `assembleAccommodationContext()` and `persistChatTurn()` are controlled
 *   per-test so we can exercise 404 / timeout / failure behavior without
 *   seeding unrelated tables.
 * - `getPostHogClient()` returns a capture spy so event payloads can be
 *   asserted for no-PII compliance.
 *
 * @module test/integration/ai/chat-route
 */

process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';

const {
    streamTextCalls,
    nextStreamDeltas,
    nextMeta,
    nextStreamError,
    getMonthlyCallCountReturn,
    currentEntitlementsForTest,
    currentLimitsForTest,
    currentBillingLoadFailedForTest,
    resolvedPromptForTest,
    nextContextResult,
    nextContextError,
    featureConfigMaxTokensForTest,
    nextPersistPromise,
    mockPostHogCapture,
    mockApiLogger
} = vi.hoisted(() => ({
    streamTextCalls: [] as Array<{
        feature: string;
        messages: Array<{ role: string; content: string }>;
        locale: string;
        params?: { maxTokens?: number };
    }>,
    nextStreamDeltas: { current: ['Hola', ' mundo', '!'] as string[] },
    nextMeta: {
        current: Promise.resolve({
            usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        }) as Promise<{
            usage: { promptTokens: number; completionTokens: number; totalTokens: number };
            provider: string;
            model: string;
            finishReason: string;
        }>
    },
    nextStreamError: { current: null as unknown },
    getMonthlyCallCountReturn: { current: 0 },
    currentEntitlementsForTest: { current: new Set<string>() },
    currentLimitsForTest: { current: new Map<string, number>() },
    currentBillingLoadFailedForTest: { current: false },
    resolvedPromptForTest: { current: 'Resolved prompt from admin/default.' },
    nextContextResult: {
        current: {
            contextBlock: '## Accommodation: Test Cabin',
            systemMessage: 'SYSTEM MESSAGE',
            accommodationName: 'Test Cabin'
        }
    },
    nextContextError: { current: null as unknown },
    featureConfigMaxTokensForTest: { current: undefined as number | undefined },
    nextPersistPromise: {
        current: Promise.resolve({
            conversationId: '44444444-4444-4444-8444-444444444444'
        }) as Promise<{
            conversationId: string;
        }>
    },
    mockPostHogCapture: vi.fn(),
    mockApiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('@repo/ai-core', () => {
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
        AiEngineError,
        AiFeatureNotConfiguredError,
        getMonthlyCallCount: vi.fn(async () => getMonthlyCallCountReturn.current),
        recordAiUsage: vi.fn(async () => undefined),
        resolveSystemPrompt: vi.fn(async () => ({
            content: resolvedPromptForTest.current,
            source: 'default'
        })),
        resolveFeatureConfig: vi.fn(async () => ({
            enabled: true,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'stub-model',
            params: { maxTokens: featureConfigMaxTokensForTest.current }
        }))
    };
});

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

vi.mock('../../../src/services/ai-service.factory', () => ({
    createConfiguredAiService: vi.fn(async () => ({
        streamText: vi.fn(
            async (args: {
                feature: string;
                messages: Array<{ role: string; content: string }>;
                locale: string;
                params?: { maxTokens?: number };
            }) => {
                streamTextCalls.push({
                    feature: args.feature,
                    messages: args.messages,
                    locale: args.locale,
                    params: args.params
                });

                const deltas = nextStreamDeltas.current;
                const streamError = nextStreamError.current;
                let markDrained = (): void => {};
                const drained = new Promise<void>((resolve) => {
                    markDrained = () => {
                        resolve();
                    };
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
                        return await nextMeta.current;
                    })()
                };
            }
        )
    }))
}));

vi.mock('../../../src/services/accommodation-ai-context', () => ({
    assembleAccommodationContext: vi.fn(async () => {
        if (nextContextError.current) {
            throw nextContextError.current;
        }

        return nextContextResult.current;
    })
}));

vi.mock('../../../src/services/ai-chat-persistence', () => ({
    persistChatTurn: vi.fn(() => nextPersistPromise.current)
}));

vi.mock('../../../src/lib/posthog', () => ({
    getPostHogClient: vi.fn(() => ({ capture: mockPostHogCapture }))
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: mockApiLogger
}));

import { OpenAPIHono } from '@hono/zod-openapi';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import { createErrorHandler } from '../../../src/middlewares/response';
import { protectedAiChatRoute } from '../../../src/routes/ai/protected/chat';
import type { AppBindings, AppMiddleware } from '../../../src/types';

const TEST_PATH = '/test-chat';
const STREAM_PATH = `${TEST_PATH}/`;
const UNIQUE_USER_ID = '55555555-5555-4555-8555-555555555555';
const ACCOMMODATION_ID = '66666666-6666-4666-8666-666666666666';
const CONVERSATION_ID = '77777777-7777-4777-8777-777777777777';
const PII_SENTINEL = 'pii-user-message-content';

function buildTestApp(): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });
    app.onError(createErrorHandler());
    app.use(actorMiddleware());
    app.route(TEST_PATH, protectedAiChatRoute);
    return app;
}

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

/** Headers representing a SUPER_ADMIN actor that holds AI_SETTINGS_MANAGE. */
function makeAiAdminHeaders(overrides: { actorId?: string } = {}): Record<string, string> {
    return makeMockActorHeaders({
        actorId: overrides.actorId,
        role: RoleEnum.SUPER_ADMIN,
        permissions: [PermissionEnum.AI_SETTINGS_MANAGE]
    });
}

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

function makeMessages(count = 1): Array<{ role: 'user' | 'assistant'; content: string }> {
    return Array.from({ length: count }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `${index % 2 === 0 ? 'user' : 'assistant'}-${index + 1}`
    }));
}

describe('POST /api/v1/protected/ai/chat — integration (SPEC-200 T-004)', () => {
    const app = buildTestApp();

    beforeEach(() => {
        getMonthlyCallCountReturn.current = 0;
        currentBillingLoadFailedForTest.current = false;
        currentEntitlementsForTest.current = new Set([EntitlementKey.AI_CHAT]);
        currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 20]]);
        resolvedPromptForTest.current = 'Resolved prompt from admin/default.';
        nextContextResult.current = {
            contextBlock: '## Accommodation: Test Cabin',
            systemMessage: 'SYSTEM MESSAGE',
            accommodationName: 'Test Cabin'
        };
        nextContextError.current = null;
        featureConfigMaxTokensForTest.current = undefined;
        nextStreamDeltas.current = ['Hola', ' mundo', '!'];
        nextStreamError.current = null;
        nextMeta.current = Promise.resolve({
            usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop'
        });
        nextPersistPromise.current = Promise.resolve({
            conversationId: '44444444-4444-4444-8444-444444444444'
        });

        streamTextCalls.length = 0;
        mockPostHogCapture.mockReset();
        mockApiLogger.info.mockReset();
        mockApiLogger.warn.mockReset();
        mockApiLogger.debug.mockReset();
        mockApiLogger.error.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when no mock-actor headers are provided', async () => {
        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(401);
        expect(streamTextCalls).toHaveLength(0);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when the user lacks ai_chat', async () => {
        currentEntitlementsForTest.current = new Set();
        currentLimitsForTest.current = new Map();

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(403);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        expect(streamTextCalls).toHaveLength(0);
    });

    it('returns 403 LIMIT_REACHED when monthly count >= plan limit', async () => {
        getMonthlyCallCountReturn.current = 20;

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(403);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('LIMIT_REACHED');
        expect(streamTextCalls).toHaveLength(0);
    });

    it('returns 503 SERVICE_UNAVAILABLE when billingLoadFailed is true', async () => {
        currentBillingLoadFailedForTest.current = true;

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(503);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
        expect(streamTextCalls).toHaveLength(0);
    });

    it('returns 400 VALIDATION_ERROR when messages exceed the 20-message cap', async () => {
        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(21)
            })
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(streamTextCalls).toHaveLength(0);
    });

    it('returns 404 pre-stream when context assembly throws NOT_FOUND', async () => {
        nextContextError.current = new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Accommodation not found'
        );

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(404);
        expect(streamTextCalls).toHaveLength(0);
    });

    it('streams token frames and a final done frame for a valid request', async () => {
        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1),
                locale: 'en'
            })
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type') ?? '').toContain('text/event-stream');

        const frames = await readSseFrames(res);
        const tokenFrames = frames.filter((frame) => frame.event === 'token');
        const doneFrames = frames.filter((frame) => frame.event === 'done');

        expect(tokenFrames).toHaveLength(3);
        expect(JSON.parse(tokenFrames[0]?.data ?? '{}')).toEqual({ delta: 'Hola' });
        expect(JSON.parse(tokenFrames[1]?.data ?? '{}')).toEqual({ delta: ' mundo' });
        expect(JSON.parse(tokenFrames[2]?.data ?? '{}')).toEqual({ delta: '!' });

        expect(doneFrames).toHaveLength(1);
        expect(JSON.parse(doneFrames[0]?.data ?? '{}')).toMatchObject({
            provider: 'stub',
            model: 'stub-model',
            finishReason: 'stop',
            conversationId: '44444444-4444-4444-8444-444444444444'
        });
    });

    it('does NOT emit any debug SSE event to a tourist caller (no system-prompt / context leak — FIX 1)', async () => {
        // Tourist actor: RoleEnum.USER, empty permissions array — no AI_SETTINGS_MANAGE.
        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders({ role: RoleEnum.USER, permissions: [] }),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(200);

        const frames = await readSseFrames(res);
        // No `debug` frame must be emitted to a non-admin caller.
        expect(frames.filter((frame) => frame.event === 'debug')).toHaveLength(0);
        // The system prompt and context block must never appear in any frame payload.
        const serialized = JSON.stringify(frames);
        expect(serialized).not.toContain('SYSTEM MESSAGE');
        expect(serialized).not.toContain('## Accommodation: Test Cabin');
    });

    it('emits a debug SSE frame containing system prompt and context when actor holds AI_SETTINGS_MANAGE', async () => {
        // Admin actor: holds AI_SETTINGS_MANAGE — should receive the debug frame.
        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeAiAdminHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type') ?? '').toContain('text/event-stream');

        const frames = await readSseFrames(res);

        // Exactly one debug frame must be present.
        const debugFrames = frames.filter((frame) => frame.event === 'debug');
        expect(debugFrames).toHaveLength(1);

        // The debug payload must carry the expected inspection fields.
        const debugPayload = JSON.parse(debugFrames[0]?.data ?? '{}') as Record<string, unknown>;
        expect(debugPayload).toMatchObject({
            contextBlock: '## Accommodation: Test Cabin',
            resolvedPrompt: 'Resolved prompt from admin/default.',
            systemMessage: 'SYSTEM MESSAGE',
            feature: 'chat',
            accommodationId: ACCOMMODATION_ID
        });

        // The debug frame must appear BEFORE any token frames (factory contract).
        const debugIndex = frames.findIndex((frame) => frame.event === 'debug');
        const firstTokenIndex = frames.findIndex((frame) => frame.event === 'token');
        expect(debugIndex).toBeLessThan(firstTokenIndex);

        // Token and done frames must still be present (stream not disrupted).
        expect(frames.filter((frame) => frame.event === 'token')).toHaveLength(3);
        expect(frames.filter((frame) => frame.event === 'done')).toHaveLength(1);
    });

    it('applies the default output token cap when feature config has no maxTokens (FIX 3)', async () => {
        featureConfigMaxTokensForTest.current = undefined;

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(200);
        await readSseFrames(res);

        expect(streamTextCalls).toHaveLength(1);
        // Falls back to the sane default constant (1024) when config is absent.
        expect(streamTextCalls[0]?.params?.maxTokens).toBe(1024);
    });

    it('prefers the resolved feature-config maxTokens over the default (FIX 3)', async () => {
        featureConfigMaxTokensForTest.current = 256;

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(200);
        await readSseFrames(res);

        expect(streamTextCalls).toHaveLength(1);
        // The admin-configured cap wins over the default.
        expect(streamTextCalls[0]?.params?.maxTokens).toBe(256);
    });

    it('prepends the system message and defaults locale to es when omitted', async () => {
        await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: [{ role: 'user', content: '¿Tiene wifi?' }]
            })
        });

        expect(streamTextCalls).toHaveLength(1);
        const call = streamTextCalls[0];
        expect(call?.feature).toBe('chat');
        expect(call?.locale).toBe('es');
        expect(call?.messages[0]).toEqual({ role: 'system', content: 'SYSTEM MESSAGE' });
        expect(call?.messages[1]).toEqual({ role: 'user', content: '¿Tiene wifi?' });
    });

    it('forwards multi-turn history and persists the last user turn with the existing conversationId', async () => {
        const messages = [
            { role: 'user' as const, content: 'Hola' },
            { role: 'assistant' as const, content: 'Hola, ¿en qué te ayudo?' },
            { role: 'user' as const, content: '¿Tiene pileta?' }
        ];

        const { persistChatTurn } = await import('../../../src/services/ai-chat-persistence');

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                conversationId: CONVERSATION_ID,
                messages,
                locale: 'pt'
            })
        });

        expect(res.status).toBe(200);
        await readSseFrames(res);

        expect(streamTextCalls).toHaveLength(1);
        const call = streamTextCalls[0];
        expect(call?.messages).toEqual([
            { role: 'system', content: 'SYSTEM MESSAGE' },
            ...messages
        ]);
        expect(call?.locale).toBe('pt');

        expect(vi.mocked(persistChatTurn)).toHaveBeenCalledWith(
            expect.objectContaining({
                accommodationId: ACCOMMODATION_ID,
                conversationId: CONVERSATION_ID,
                userMessage: '¿Tiene pileta?',
                assistantMessage: 'Hola mundo!',
                userId: UNIQUE_USER_ID
            })
        );
    });

    it('emits SSE error and no done when the stream ends with MODERATION_BLOCKED', async () => {
        const { AiEngineError } = await import('@repo/ai-core');
        nextStreamDeltas.current = ['Parcial'];
        nextStreamError.current = new AiEngineError('MODERATION_BLOCKED', 'flagged');

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(200);

        const frames = await readSseFrames(res);
        expect(frames.filter((frame) => frame.event === 'token')).toHaveLength(1);
        expect(frames.filter((frame) => frame.event === 'done')).toHaveLength(0);

        const errorFrames = frames.filter((frame) => frame.event === 'error');
        expect(errorFrames).toHaveLength(1);
        expect(JSON.parse(errorFrames[0]?.data ?? '{}')).toMatchObject({
            code: 'MODERATION_BLOCKED'
        });
        expect(mockPostHogCapture).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'ai_chat_moderation_blocked' })
        );
    });

    it('still emits done without conversationId when persistence rejects, and logs apiLogger.error', async () => {
        nextPersistPromise.current = Promise.reject(new Error('db down'));

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(200);

        const frames = await readSseFrames(res);
        const doneData = JSON.parse(frames.find((frame) => frame.event === 'done')?.data ?? '{}');
        expect(doneData).not.toHaveProperty('conversationId');
        expect(mockApiLogger.error).toHaveBeenCalledTimes(1);
    });

    it('still emits done without conversationId when persistence times out, and logs apiLogger.warn', async () => {
        nextPersistPromise.current = new Promise<{ conversationId: string }>(() => {});

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(res.status).toBe(200);

        const frames = await readSseFrames(res);
        const doneData = JSON.parse(frames.find((frame) => frame.event === 'done')?.data ?? '{}');
        expect(doneData).not.toHaveProperty('conversationId');
        expect(mockApiLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('captures opened, sent, completed, and cap-reached events with no PII in properties', async () => {
        const messages = makeMessages(20).map((message, index) =>
            index === 18 ? { ...message, content: PII_SENTINEL } : message
        );

        const res = await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders({ actorId: UNIQUE_USER_ID }),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages,
                locale: 'es'
            })
        });

        expect(res.status).toBe(200);
        await readSseFrames(res);

        const events = mockPostHogCapture.mock.calls.map((call) => call[0]?.event);
        expect(events).toContain('ai_chat_message_sent');
        expect(events).toContain('ai_chat_response_completed');
        expect(events).toContain('ai_chat_cap_reached');
        expect(events).not.toContain('ai_chat_opened');

        for (const [payload] of mockPostHogCapture.mock.calls) {
            const serialized = JSON.stringify(payload);
            expect(serialized).not.toContain(PII_SENTINEL);
            expect(serialized).not.toContain('SYSTEM MESSAGE');
        }
    });

    it('captures ai_chat_opened on the first-turn request only', async () => {
        await app.request(STREAM_PATH, {
            method: 'POST',
            headers: makeMockActorHeaders(),
            body: JSON.stringify({
                accommodationId: ACCOMMODATION_ID,
                messages: makeMessages(1)
            })
        });

        expect(mockPostHogCapture).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'ai_chat_opened' })
        );
    });
});
