/**
 * Tests for the protected AI text-improvement streaming route (SPEC-198 T-005).
 *
 * Strategy: hybrid pattern combining two established approaches from the
 * codebase —
 *
 * 1. **Real factory + mocked dependencies**: We let `createProtectedStreamingRoute`
 *    and the body-validation logic run for real, but mock the three route
 *    middlewares (`protectedAuthMiddleware`, `entitlementMiddleware`,
 *    `createAiRateLimitMiddlewares`, `createAiQuotaMiddleware`) to no-op
 *    pass-throughs. The mocked `createConfiguredAiService` returns a stub
 *    `AiService` whose `streamText` is captured for assertions.
 *
 * 2. **createTestApp + app.request()**: We mount the real route in a Hono
 *    test app and send real HTTP requests, asserting on response status,
 *    SSE frames, and the JSON error envelope. This is identical to the
 *    pattern in `test/route-factory/streaming-route.test.ts`.
 *
 * Body validation (400 on invalid body, 400 on strict-mode unknown keys) is
 * a property of the factory + schema, not the handler; we exercise it
 * end-to-end here so the route's wiring of `requestSchema` is verified too.
 *
 * The `buildTextImprovePrompt` helper is exported specifically so this test
 * file can assert on the exact prompt string for each (fieldType) — the
 * spec §9.2 case "passes fieldValue+fieldType to prompt builder".
 *
 * @module apps/api/test/routes/ai/protected/text-improve
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (must run before importing the route module)
// ---------------------------------------------------------------------------

/** Captured `streamText` invocations from the stub AiService. */
const { streamTextCalls } = vi.hoisted(() => ({
    streamTextCalls: [] as Array<{
        feature: string;
        prompt: string;
        locale: string;
    }>
}));

/** Configurable stream contents for the next stubbed streamText call. */
const { nextStreamDeltas, nextMeta, nextPreStreamThrow, nextPostDrainThrow } = vi.hoisted(() => ({
    nextStreamDeltas: { current: [] as string[] },
    nextMeta: { current: undefined as unknown },
    // When set, the stub `streamText` throws this BEFORE returning a stream
    // (pre-stream block path → mapped to HTTP 422 JSON by the factory).
    nextPreStreamThrow: { current: undefined as unknown },
    // When set, the stub's async generator yields the configured deltas and
    // THEN throws this (post-drain / mid-stream block path → SSE error frame).
    nextPostDrainThrow: { current: undefined as unknown }
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Auth middleware: no-op pass-through so the protected route does not 401.
 * The factory prepends this middleware to the options.middlewares chain.
 */
vi.mock('../../../../src/middlewares/authorization', () => ({
    protectedAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

/**
 * Entitlement loader: no-op. We are not testing the entitlement loader here —
 * `createAiQuotaMiddleware` is what enforces the entitlement gate, and that
 * is mocked separately (and exercised in T-006 integration tests).
 */
vi.mock('../../../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

/**
 * Rate-limit middlewares: no-op. Layer-level rate limits are tested in
 * SPEC-173's dedicated suite; not in scope for the route-handler unit test.
 */
vi.mock('../../../../src/middlewares/ai-rate-limit', () => ({
    createAiRateLimitMiddlewares: () => []
}));

/**
 * Quota + entitlement gate: no-op. T-006 covers the real behaviour with a
 * live DB and entitlement-mock helper.
 */
vi.mock('../../../../src/middlewares/ai-quota', () => ({
    createAiQuotaMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

/**
 * AI service factory: return a stub AiService. `streamText` records the
 * call and yields a configurable AsyncIterable of delta strings so we can
 * assert on the SSE frames downstream.
 */
vi.mock('../../../../src/services/ai-service.factory.js', () => ({
    createConfiguredAiService: async () => ({
        streamText: async (args: {
            feature: string;
            prompt: string;
            locale: string;
        }) => {
            streamTextCalls.push({
                feature: args.feature,
                prompt: args.prompt,
                locale: args.locale
            });
            // Pre-stream block: throw BEFORE the factory begins streaming, so
            // the error is mapped to an HTTP 422 JSON envelope.
            if (nextPreStreamThrow.current !== undefined) {
                throw nextPreStreamThrow.current;
            }
            const deltas = nextStreamDeltas.current;
            const postDrainThrow = nextPostDrainThrow.current;
            return {
                stream: (async function* () {
                    for (const d of deltas) {
                        yield { delta: d };
                    }
                    // Post-drain / mid-stream block: throw AFTER yielding tokens,
                    // so the factory's SSE try/catch emits an `error` frame.
                    if (postDrainThrow !== undefined) {
                        throw postDrainThrow;
                    }
                })(),
                meta: nextMeta.current
            };
        }
    })
}));

// Mock the logger to silence the apiLogger.warn in the auth middleware
// rejection path (unused here but keeps the test output clean).
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

/**
 * `@repo/ai-core` is a workspace package that is not always installed in
 * worktree `node_modules` (it ships via Turbo build artifacts). The streaming
 * route factory uses `mapAiEngineErrorToHttpStatus` (from the local
 * `ai-error-mapper.ts`), which does an `instanceof AiEngineError` guard before
 * branching on `engineCode`.
 *
 * The mock MUST faithfully reproduce the real error hierarchy
 * (`packages/ai-core/src/engine/errors.ts`): `AiEngineError extends Error`,
 * and `AiModerationBlockedError extends AiEngineError` with
 * `engineCode = 'MODERATION_BLOCKED'`. A bare `class {}` would NOT satisfy the
 * `instanceof` guard, so the moderation-block path (SPEC-198) could never be
 * exercised — which is exactly the gap this test closes.
 */
const { AiEngineError, AiModerationBlockedError, AiFeatureNotConfiguredError } = vi.hoisted(() => {
    class AiEngineError extends Error {
        readonly engineCode: string;
        constructor(message: string, engineCode: string) {
            super(message);
            this.name = 'AiEngineError';
            this.engineCode = engineCode;
        }
    }
    class AiModerationBlockedError extends AiEngineError {
        readonly feature?: string;
        readonly direction: 'input' | 'output';
        readonly categories?: readonly string[];
        constructor(input: {
            feature?: string;
            direction: 'input' | 'output';
            categories?: readonly string[];
        }) {
            super(`Content blocked by moderation (${input.direction})`, 'MODERATION_BLOCKED');
            this.name = 'AiModerationBlockedError';
            this.feature = input.feature;
            this.direction = input.direction;
            this.categories = input.categories;
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
    return { AiEngineError, AiModerationBlockedError, AiFeatureNotConfiguredError };
});

vi.mock('@repo/ai-core', () => ({
    AiEngineError,
    AiModerationBlockedError,
    AiFeatureNotConfiguredError
}));

/**
 * `create-app.ts` transitively imports `middlewares/response.ts`, which
 * imports `@repo/service-core` → `@repo/content-moderation` (not always
 * present in worktree `node_modules`). The streaming route factory only
 * needs `createRouter` from this module — provide a minimal Hono sub-app
 * stub that supports the two methods the factory calls (`app.use`,
 * `app.openapi`).
 */
vi.mock('../../../../src/utils/create-app', () => {
    const { OpenAPIHono } = require('@hono/zod-openapi');
    return {
        createRouter: () => new OpenAPIHono()
    };
});

// ---------------------------------------------------------------------------
// Imports (post-mock)
// ---------------------------------------------------------------------------

import {
    buildTextImprovePrompt,
    protectedAiTextImproveRoute
} from '../../../../src/routes/ai/protected/text-improve';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

/**
 * Test app: the real `createProtectedStreamingRoute` factory returns a Hono
 * sub-app that we can call directly. We deliberately do NOT use
 * `createTestApp` (the project-wide test helper) because it loads the full
 * global middleware stack which transitively imports packages that may be
 * absent in a worktree (`@repo/content-moderation`). The factory's own
 * middleware composition is the system under test here.
 *
 * The `protectedAuthMiddleware` prepended by `createProtectedStreamingRoute`
 * is mocked to a no-op above, so the auth check does not 401 our requests.
 */
const buildTestApp = () => protectedAiTextImproveRoute;

// ---------------------------------------------------------------------------
// SSE frame parser
// ---------------------------------------------------------------------------

interface SseFrame {
    event?: string;
    data?: string;
}

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

    const frames: SseFrame[] = [];
    for (const block of raw.split(/\n\n/)) {
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
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_DESCRIPTION_BODY = {
    fieldType: 'description',
    fieldValue: 'A cozy cabin in the woods near the river.',
    locale: 'en'
};

const VALID_SUMMARY_BODY = {
    fieldType: 'summary',
    fieldValue: 'Cozy cabin.'
};

const POST = (
    app: ReturnType<typeof buildTestApp>,
    body: unknown,
    opts: { method?: string; contentType?: string } = {}
) =>
    app.request('/', {
        method: opts.method ?? 'POST',
        headers: {
            'content-type': opts.contentType ?? 'application/json',
            ...((opts as Record<string, unknown>).headers as Record<string, string>)
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('protected AI text-improve route (SPEC-198 T-005)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        streamTextCalls.length = 0;
        nextStreamDeltas.current = ['Hola', ' mundo'];
        nextMeta.current = undefined;
        nextPreStreamThrow.current = undefined;
        nextPostDrainThrow.current = undefined;
    });

    // =========================================================================
    // buildTextImprovePrompt — pure helper
    // =========================================================================

    describe('buildTextImprovePrompt', () => {
        it('produces the description prompt shape', () => {
            const out = buildTextImprovePrompt({
                fieldType: 'description',
                fieldValue: 'Cabin near the river.'
            });
            expect(out).toBe(
                'Please improve the following accommodation description:\n\nCabin near the river.'
            );
        });

        it('produces the summary prompt shape', () => {
            const out = buildTextImprovePrompt({
                fieldType: 'summary',
                fieldValue: 'Cabin near the river.'
            });
            expect(out).toBe(
                'Please improve the following accommodation summary:\n\nCabin near the river.'
            );
        });
    });

    // =========================================================================
    // Route + factory wiring
    // =========================================================================

    describe('streamHandler integration', () => {
        it('calls aiService.streamText with feature="text_improve" and the description prompt', async () => {
            const app = buildTestApp();
            const res = await POST(app, VALID_DESCRIPTION_BODY);
            expect(res.status).toBe(200);

            expect(streamTextCalls).toHaveLength(1);
            const call = streamTextCalls[0]!;
            expect(call.feature).toBe('text_improve');
            expect(call.prompt).toBe(
                `Please improve the following accommodation description:\n\n${VALID_DESCRIPTION_BODY.fieldValue}`
            );
        });

        it('passes the request locale to aiService.streamText', async () => {
            const app = buildTestApp();
            const res = await POST(app, VALID_DESCRIPTION_BODY);
            expect(res.status).toBe(200);

            expect(streamTextCalls[0]!.locale).toBe('en');
        });

        it('defaults the locale to "es" when the request omits it', async () => {
            const app = buildTestApp();
            const res = await POST(app, VALID_SUMMARY_BODY); // no locale
            expect(res.status).toBe(200);

            expect(streamTextCalls[0]!.locale).toBe('es');
        });

        it('emits the expected SSE token frames in order', async () => {
            nextStreamDeltas.current = ['Hola', ' mundo', '!'];
            const app = buildTestApp();
            const res = await POST(app, VALID_DESCRIPTION_BODY);
            expect(res.status).toBe(200);

            const frames = await parseSseFrames(res);
            const tokenFrames = frames.filter((f) => f.event === 'token');
            expect(tokenFrames).toHaveLength(3);
            expect(JSON.parse(tokenFrames[0]!.data!)).toEqual({ delta: 'Hola' });
            expect(JSON.parse(tokenFrames[1]!.data!)).toEqual({ delta: ' mundo' });
            expect(JSON.parse(tokenFrames[2]!.data!)).toEqual({ delta: '!' });
        });
    });

    // =========================================================================
    // Moderation block (SPEC-198) — the gap this suite closes.
    //
    // The route maps an AiModerationBlockedError to:
    //   - a pre-stream HTTP 422 JSON envelope when the engine blocks INPUT
    //     before any SSE byte is written, OR
    //   - an SSE `error` frame when the engine blocks mid/post-stream (e.g.
    //     OUTPUT moderation after tokens have already been emitted).
    //
    // Both paths flow through `mapAiEngineErrorToHttpStatus`, whose
    // `instanceof AiEngineError` guard only fires because the `@repo/ai-core`
    // mock above faithfully extends the real error hierarchy.
    // =========================================================================

    describe('moderation block (SPEC-198)', () => {
        it('PRE-STREAM input block → HTTP 422 with error.code MODERATION_BLOCKED', async () => {
            // Arrange — streamText throws an input-moderation error before
            // streaming begins.
            nextPreStreamThrow.current = new AiModerationBlockedError({
                feature: 'text_improve',
                direction: 'input',
                categories: ['hate']
            });
            const app = buildTestApp();

            // Act
            const res = await POST(app, VALID_DESCRIPTION_BODY);

            // Assert — JSON envelope, NOT an SSE stream.
            expect(res.status).toBe(422);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('MODERATION_BLOCKED');

            // The handler reached streamText (block is engine-side, not validation).
            expect(streamTextCalls).toHaveLength(1);
        });

        it('POST-DRAIN output block → SSE error frame with code MODERATION_BLOCKED after token frames', async () => {
            // Arrange — yield two tokens, then throw an output-moderation error.
            nextStreamDeltas.current = ['Hola', ' mundo'];
            nextPostDrainThrow.current = new AiModerationBlockedError({
                feature: 'text_improve',
                direction: 'output',
                categories: ['violence']
            });
            const app = buildTestApp();

            // Act
            const res = await POST(app, VALID_DESCRIPTION_BODY);

            // Assert — the response is a 200 SSE stream (bytes already flushed),
            // ending with an `error` frame carrying the moderation code.
            expect(res.status).toBe(200);
            const frames = await parseSseFrames(res);

            const tokenFrames = frames.filter((f) => f.event === 'token');
            expect(tokenFrames).toHaveLength(2);

            const errorFrames = frames.filter((f) => f.event === 'error');
            expect(errorFrames).toHaveLength(1);
            expect(JSON.parse(errorFrames[0]!.data!).code).toBe('MODERATION_BLOCKED');

            // No `done` frame is emitted when the stream throws.
            expect(frames.filter((f) => f.event === 'done')).toHaveLength(0);
        });
    });

    // =========================================================================
    // Body validation (factory + schema integration)
    // =========================================================================

    describe('body validation', () => {
        it('returns HTTP 400 with VALIDATION_ERROR when fieldValue is empty', async () => {
            const app = buildTestApp();
            const res = await POST(app, {
                fieldType: 'description',
                fieldValue: ''
            });
            expect(res.status).toBe(400);

            const body = (await res.json()) as {
                success: boolean;
                error: { code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');

            // The stub should NOT have been called — validation rejects before
            // the handler runs.
            expect(streamTextCalls).toHaveLength(0);
        });

        it('returns HTTP 400 with VALIDATION_ERROR when the body has an unknown key (strict mode)', async () => {
            const app = buildTestApp();
            const res = await POST(app, {
                fieldType: 'description',
                fieldValue: 'Some text',
                extra: 'should be rejected'
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

        it('returns HTTP 400 with VALIDATION_ERROR when fieldType is unknown', async () => {
            const app = buildTestApp();
            const res = await POST(app, {
                fieldType: 'title', // not in the V1 enum
                fieldValue: 'Some text'
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
});
