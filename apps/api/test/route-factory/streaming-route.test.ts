/**
 * T-029 — SSE streaming route factory tests.
 *
 * Covers the acceptance criteria for `createStreamingRoute` and
 * `createProtectedStreamingRoute`:
 *
 *  AC-10  Content-Type is text/event-stream on a successful stream
 *         (spec §10 — SSE response header requirement).
 *  1      Token frames arrive in order with correct {delta} payloads.
 *  2      done frame carries the meta JSON after tokens drain.
 *  3      Iterable that yields 2 tokens then throws AiModerationBlockedError
 *         → 2 token frames then error frame {code:'MODERATION_BLOCKED'}, no done.
 *  4      streamHandler throws AiModerationBlockedError BEFORE returning → HTTP 422.
 *  5      streamHandler throws AiFeatureDisabledError → 503.
 *         streamHandler throws AiEngineExhaustedError → 502.
 *  6      requestSchema rejects invalid body → 400.
 *  7      handler without meta → tokens then stream ends without done frame.
 *  8      createProtectedStreamingRoute without session headers → 401.
 *
 * SSE frame splitting: frames are delimited by "\n\n".
 * Each frame may span multiple "key: value\n" lines.
 * The parser below handles both single-field and multi-field frames.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Mock the logger before importing factory modules that depend on it
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import {
    AiEngineExhaustedError,
    AiFeatureDisabledError,
    AiModerationBlockedError
} from '@repo/ai-core';
import type { AiFeature } from '@repo/ai-core';
import type { AiProviderId } from '@repo/schemas';
import { createTestApp } from '../../src/utils/create-app';
import {
    createProtectedStreamingRoute,
    createStreamingRoute
} from '../../src/utils/streaming-route-factory';

// ---------------------------------------------------------------------------
// SSE body parser
// ---------------------------------------------------------------------------

interface SseFrame {
    event?: string;
    data?: string;
}

/**
 * Reads a streaming response body to completion and parses it into SSE frames.
 *
 * Frames are separated by blank lines ("\n\n").  Within a frame each line has
 * the form "field: value\n".  We only care about the `event` and `data` fields.
 */
const parseSseFrames = async (res: Response): Promise<SseFrame[]> => {
    const body = res.body;
    if (!body) return [];

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let raw = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
    }

    // Split into frame blocks
    const blocks = raw.split(/\n\n/);
    const frames: SseFrame[] = [];

    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        const frame: SseFrame = {};
        for (const line of trimmed.split('\n')) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;
            const field = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim();
            if (field === 'event') frame.event = value;
            if (field === 'data') frame.data = value;
        }
        frames.push(frame);
    }

    return frames;
};

// ---------------------------------------------------------------------------
// Fake async iterable helpers
// ---------------------------------------------------------------------------

/**
 * Creates an async iterable that yields the provided string deltas in order.
 */
const makeIterable = (deltas: string[]): AsyncIterable<{ readonly delta: string }> => ({
    [Symbol.asyncIterator]() {
        let i = 0;
        return {
            async next() {
                if (i < deltas.length) {
                    return { value: { delta: deltas[i++] as string }, done: false };
                }
                return { value: { delta: '' }, done: true };
            }
        };
    }
});

/**
 * Creates an async iterable that yields `yieldCount` deltas then throws.
 */
const makeThrowingIterable = (
    deltas: string[],
    error: Error
): AsyncIterable<{ readonly delta: string }> => ({
    [Symbol.asyncIterator]() {
        let i = 0;
        return {
            async next() {
                if (i < deltas.length) {
                    return { value: { delta: deltas[i++] as string }, done: false };
                }
                throw error;
            }
        };
    }
});

// ---------------------------------------------------------------------------
// Fake AiFeature value for error constructors
// ---------------------------------------------------------------------------

// The constructors require `AiFeature` which is a schema enum.
// Casting 'chat' satisfies the branded type without importing @repo/schemas enum.
const FAKE_FEATURE = 'chat' as AiFeature;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createStreamingRoute', () => {
    describe('AC-10 Content-Type header', () => {
        it('returns text/event-stream for a successful stream', async () => {
            const app = createStreamingRoute({
                path: '/',
                summary: 'test stream',
                description: 'test',
                tags: ['Test'],
                streamHandler: async () => ({
                    stream: makeIterable(['hello'])
                })
            });

            const res = await app.request('/', { method: 'POST' });
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('text/event-stream');
        });
    });

    describe('token frames in order', () => {
        it('emits one token frame per delta in order', async () => {
            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                streamHandler: async () => ({
                    stream: makeIterable(['Hola', ' mundo', '!'])
                })
            });

            const res = await app.request('/', { method: 'POST' });
            expect(res.status).toBe(200);

            const frames = await parseSseFrames(res);
            const tokenFrames = frames.filter((f) => f.event === 'token');
            expect(tokenFrames).toHaveLength(3);
            expect(JSON.parse(tokenFrames[0]!.data!)).toEqual({ delta: 'Hola' });
            expect(JSON.parse(tokenFrames[1]!.data!)).toEqual({ delta: ' mundo' });
            expect(JSON.parse(tokenFrames[2]!.data!)).toEqual({ delta: '!' });
        });
    });

    describe('done frame with meta', () => {
        it('emits done frame after tokens when meta is provided', async () => {
            const meta = {
                usage: { promptTokens: 5, completionTokens: 3 },
                provider: 'openai',
                model: 'gpt-4o-mini',
                finishReason: 'stop'
            };

            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                streamHandler: async () => ({
                    stream: makeIterable(['Hi', ' there']),
                    meta: Promise.resolve(meta)
                })
            });

            const res = await app.request('/', { method: 'POST' });
            const frames = await parseSseFrames(res);

            const tokenFrames = frames.filter((f) => f.event === 'token');
            const doneFrames = frames.filter((f) => f.event === 'done');

            expect(tokenFrames).toHaveLength(2);
            expect(doneFrames).toHaveLength(1);
            expect(JSON.parse(doneFrames[0]!.data!)).toEqual(meta);

            // done must come after all tokens
            const tokenIdxLast = frames.reduce(
                (last, f, i) => (f.event === 'token' ? i : last),
                -1
            );
            const doneIdx = frames.findIndex((f: SseFrame) => f.event === 'done');
            expect(doneIdx).toBeGreaterThan(tokenIdxLast);
        });
    });

    describe('mid/post-stream AiModerationBlockedError', () => {
        it('emits 2 tokens then error frame, no done frame', async () => {
            const moderationErr = new AiModerationBlockedError({
                feature: FAKE_FEATURE,
                direction: 'output',
                categories: { hate: true }
            });

            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                streamHandler: async () => ({
                    stream: makeThrowingIterable(['tok1', 'tok2'], moderationErr),
                    meta: Promise.resolve({ usage: {} })
                })
            });

            const res = await app.request('/', { method: 'POST' });
            const frames = await parseSseFrames(res);

            const tokenFrames = frames.filter((f) => f.event === 'token');
            const errorFrames = frames.filter((f) => f.event === 'error');
            const doneFrames = frames.filter((f) => f.event === 'done');

            expect(tokenFrames).toHaveLength(2);
            expect(errorFrames).toHaveLength(1);
            expect(doneFrames).toHaveLength(0);

            const errorData = JSON.parse(errorFrames[0]!.data!) as { code: string };
            expect(errorData.code).toBe('MODERATION_BLOCKED');
        });
    });

    describe('pre-stream AiModerationBlockedError', () => {
        it('returns HTTP 422 JSON when handler throws before returning stream', async () => {
            const moderationErr = new AiModerationBlockedError({
                feature: FAKE_FEATURE,
                direction: 'input',
                categories: { violence: true }
            });

            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                streamHandler: async () => {
                    throw moderationErr;
                }
            });

            const res = await app.request('/', { method: 'POST' });
            expect(res.status).toBe(422);
            expect(res.headers.get('content-type')).toContain('application/json');

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('MODERATION_BLOCKED');
        });
    });

    describe('pre-stream error HTTP status mapping', () => {
        it('returns 503 when handler throws AiFeatureDisabledError', async () => {
            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                streamHandler: async () => {
                    throw new AiFeatureDisabledError(FAKE_FEATURE);
                }
            });

            const res = await app.request('/', { method: 'POST' });
            expect(res.status).toBe(503);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('FEATURE_DISABLED');
        });

        it('returns 502 when handler throws AiEngineExhaustedError', async () => {
            const exhaustedErr = new AiEngineExhaustedError(FAKE_FEATURE, [
                {
                    providerId: 'openai' as AiProviderId,
                    error: new Error('rate limit'),
                    callCount: 3,
                    wasRetryable: true
                }
            ]);

            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                streamHandler: async () => {
                    throw exhaustedErr;
                }
            });

            const res = await app.request('/', { method: 'POST' });
            expect(res.status).toBe(502);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('ENGINE_EXHAUSTED');
        });
    });

    describe('requestSchema validation', () => {
        it('returns HTTP 400 when body fails schema validation', async () => {
            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                requestSchema: z.object({ prompt: z.string().min(1) }),
                streamHandler: async () => ({
                    stream: makeIterable(['ok'])
                })
            });

            const res = await app.request('/', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ prompt: '' }) // fails min(1)
            });

            expect(res.status).toBe(400);
            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });

        it('proceeds to stream when body passes schema validation', async () => {
            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                requestSchema: z.object({ prompt: z.string().min(1) }),
                streamHandler: async () => ({
                    stream: makeIterable(['ok'])
                })
            });

            const res = await app.request('/', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ prompt: 'Hello' })
            });

            expect(res.status).toBe(200);
        });
    });

    describe('handler without meta', () => {
        it('ends stream without emitting a done frame', async () => {
            const app = createStreamingRoute({
                path: '/',
                summary: 'test',
                description: 'test',
                tags: ['Test'],
                // No meta returned
                streamHandler: async () => ({
                    stream: makeIterable(['a', 'b'])
                })
            });

            const res = await app.request('/', { method: 'POST' });
            expect(res.status).toBe(200);

            const frames = await parseSseFrames(res);
            const tokenFrames = frames.filter((f) => f.event === 'token');
            const doneFrames = frames.filter((f) => f.event === 'done');

            expect(tokenFrames).toHaveLength(2);
            expect(doneFrames).toHaveLength(0);
        });
    });
});

// ---------------------------------------------------------------------------
// Protected variant
// ---------------------------------------------------------------------------

describe('createProtectedStreamingRoute', () => {
    it('returns 401 when request carries a guest actor identity', async () => {
        const routerApp = createProtectedStreamingRoute({
            path: '/stream-protected',
            summary: 'protected stream',
            description: 'test',
            tags: ['AI - Test'],
            streamHandler: async () => ({
                stream: makeIterable(['secret'])
            })
        });

        // Mount into createTestApp so the global error handler (which converts
        // HTTPException(401) to a proper 401 JSON response) is active, and so
        // actorMiddleware runs (builds a guest Actor that protectedAuthMiddleware
        // then rejects).
        const app = createTestApp(routerApp);

        // x-mock-actor-role: GUEST — actorMiddleware/mockAuthMiddleware recognises
        // this as a guest; protectedAuthMiddleware then throws 401.
        // user-agent is required by validationMiddleware (default config).
        const res = await app.request('/stream-protected', {
            method: 'POST',
            headers: {
                'user-agent': 'vitest',
                'x-mock-actor-role': 'GUEST'
            }
        });
        expect(res.status).toBe(401);
    });

    it('returns 401 on a path containing OpenAPI-style params (regression: middleware path conversion)', async () => {
        // Regression: app.use() receives the OpenAPI path verbatim; without the
        // {id} → :id conversion the auth middleware would silently not match
        // the route path and the stream would be served WITHOUT auth.
        const routerApp = createProtectedStreamingRoute({
            path: '/items/{id}/stream',
            summary: 'protected stream with param',
            description: 'test',
            tags: ['AI - Test'],
            streamHandler: async () => ({
                stream: makeIterable(['secret'])
            })
        });

        const app = createTestApp(routerApp);

        const res = await app.request('/items/123/stream', {
            method: 'POST',
            headers: {
                'user-agent': 'vitest',
                'x-mock-actor-role': 'GUEST'
            }
        });
        expect(res.status).toBe(401);
    });
});
