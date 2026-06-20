/**
 * Tests for the admin AI post-generation route (SPEC-223 T-008).
 *
 * Strategy: hybrid pattern mirroring `test/routes/ai/protected/text-improve.test.ts`.
 *
 * - Module-level `vi.mock` hoists replace the ai-service factory with a stub
 *   whose `generateObject` is configurable per test.
 * - `@repo/ai-core` error classes are reproduced faithfully (extending the
 *   real hierarchy) so `mapAiEngineErrorToHttpStatus` instanceof guards fire.
 * - `authorization` middleware is no-op'd so the route does not 401/403.
 * - `create-app` is stubbed to return a minimal `OpenAPIHono` (avoids pulling
 *   in transitive dependencies not present in the worktree).
 * - `createConfiguredAiService` is also no-op'd in the logger mock.
 *
 * Tests cover (per T-008 spec):
 * 1. `buildPostGeneratePrompt` — pure unit tests for the exported helper.
 * 2. Route integration — valid request → 200 with `AiPostGenerateDraft` body.
 * 3. Route integration — invalid body → 400 VALIDATION_ERROR.
 * 4. Route integration — moderation blocked → 422 MODERATION_FAILED.
 * 5. Route integration — ceiling hit → 429 AI_CEILING_HIT.
 * 6. Route integration — engine exhausted → 503 ENGINE_EXHAUSTED.
 *
 * @module apps/api/test/routes/ai/admin/post-generate
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before importing the route module)
// ---------------------------------------------------------------------------

/** Captured `generateObject` invocations from the stub AiService. */
const { generateObjectCalls } = vi.hoisted(() => ({
    generateObjectCalls: [] as Array<{
        feature: string;
        prompt: string;
        locale: string;
    }>
}));

/**
 * Configurable next return/throw for the stubbed `generateObject`.
 *
 * `nextReturnValue` — when set, `generateObject` resolves with this value.
 * `nextThrow`       — when set, `generateObject` throws this error instead.
 */
const { nextReturnValue, nextThrow } = vi.hoisted(() => ({
    nextReturnValue: {
        current: null as null | {
            object: {
                title: string;
                summary: string;
                content: string;
            };
            usage: { promptTokens: number; completionTokens: number; totalTokens: number };
            provider: string;
            model: string;
            finishReason: string;
        }
    },
    nextThrow: { current: undefined as unknown }
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Admin auth middleware: no-op pass-through so the route does not 401/403.
 */
vi.mock('../../../../src/middlewares/authorization', () => ({
    adminAuthMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

/**
 * AI service factory: returns a stub `AiService` with a configurable
 * `generateObject`. The stub records calls and resolves/throws as configured.
 */
vi.mock('../../../../src/services/ai-service.factory.js', () => ({
    createConfiguredAiService: async () => ({
        generateObject: async (
            args: { feature: string; prompt: string; locale: string },
            _schema: unknown
        ) => {
            generateObjectCalls.push({
                feature: args.feature,
                prompt: args.prompt,
                locale: args.locale
            });
            if (nextThrow.current !== undefined) {
                throw nextThrow.current;
            }
            if (nextReturnValue.current !== null) {
                return nextReturnValue.current;
            }
            // Defensive: tests should always set nextReturnValue or nextThrow.
            throw new Error('generateObject stub: no return value or throw configured');
        }
    })
}));

/**
 * Logger: silence all output in tests.
 */
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

/**
 * `@repo/ai-core` error class hierarchy.
 *
 * MUST faithfully reproduce the real hierarchy so `mapAiEngineErrorToHttpStatus`
 * `instanceof AiEngineError` guards fire correctly.
 *
 * - `AiEngineError extends Error` with `engineCode: string`.
 * - `AiModerationBlockedError extends AiEngineError` with `engineCode = 'MODERATION_BLOCKED'`.
 * - `AiCeilingHitError extends AiEngineError` with `engineCode = 'CEILING_HIT'`.
 * - `AiEngineExhaustedError extends AiEngineError` with `engineCode = 'ENGINE_EXHAUSTED'`.
 * - `AiFeatureNotConfiguredError extends Error` (NOT AiEngineError — different hierarchy).
 */
const {
    AiEngineError,
    AiModerationBlockedError,
    AiCeilingHitError,
    AiEngineExhaustedError,
    AiFeatureNotConfiguredError
} = vi.hoisted(() => {
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

    class AiCeilingHitError extends AiEngineError {
        constructor(feature?: string) {
            super(`Cost ceiling hit for feature: ${feature ?? 'unknown'}`, 'CEILING_HIT');
            this.name = 'AiCeilingHitError';
        }
    }

    class AiEngineExhaustedError extends AiEngineError {
        constructor(feature?: string) {
            super(
                `All providers exhausted for feature: ${feature ?? 'unknown'}`,
                'ENGINE_EXHAUSTED'
            );
            this.name = 'AiEngineExhaustedError';
        }
    }

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
        AiModerationBlockedError,
        AiCeilingHitError,
        AiEngineExhaustedError,
        AiFeatureNotConfiguredError
    };
});

vi.mock('@repo/ai-core', () => ({
    AiEngineError,
    AiModerationBlockedError,
    AiCeilingHitError,
    AiEngineExhaustedError,
    AiFeatureNotConfiguredError
}));

/**
 * `create-app.ts` transitively imports a large middleware chain (incl.
 * `@repo/service-core`, `@repo/content-moderation`). The route only needs
 * `createRouter` — stub it with a minimal `OpenAPIHono` instance.
 */
vi.mock('../../../../src/utils/create-app', () => {
    const { OpenAPIHono } = require('@hono/zod-openapi');
    return {
        createRouter: () => new OpenAPIHono()
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks are hoisted)
// ---------------------------------------------------------------------------

import {
    adminAiPostGenerateRoute,
    buildPostGeneratePrompt
} from '../../../../src/routes/ai/admin/post-generate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid AiPostGenerateDraft for use in `nextReturnValue`. */
const VALID_DRAFT = {
    object: {
        title: 'Visit Concepción del Uruguay This Summer',
        summary:
            'Discover the best of Concepción del Uruguay with its river beaches, colonial architecture, and vibrant local gastronomy.',
        content:
            '<h2>Why Visit</h2><p>Concepción del Uruguay is one of the hidden gems of Entre Ríos province...</p>'
    },
    usage: { promptTokens: 120, completionTokens: 280, totalTokens: 400 },
    provider: 'stub',
    model: 'stub-model',
    finishReason: 'stop'
};

/** A valid request body. */
const VALID_BODY = {
    topic: 'Summer tourism in Concepción del Uruguay',
    points: [
        'River beaches on the Uruguay River',
        'Colonial historic center (UNESCO heritage candidate)',
        'Local gastronomy: asado and river fish'
    ],
    category: 'TOURISM',
    tone: 'formal',
    locale: 'es'
};

const POST = (body: unknown) =>
    adminAiPostGenerateRoute.request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin AI post-generate route (SPEC-223 T-008)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateObjectCalls.length = 0;
        nextReturnValue.current = VALID_DRAFT;
        nextThrow.current = undefined;
    });

    // =========================================================================
    // buildPostGeneratePrompt — pure unit tests
    // =========================================================================

    describe('buildPostGeneratePrompt', () => {
        it('formats a single point with default tone and no category', () => {
            const result = buildPostGeneratePrompt({
                topic: 'River tourism',
                points: ['Beautiful beaches'],
                locale: 'es'
            });
            expect(result).toBe(
                'Tone: neutral.\n\nTopic: River tourism\n\nKey points:\n1. Beautiful beaches'
            );
        });

        it('includes the category prefix when provided', () => {
            const result = buildPostGeneratePrompt({
                topic: 'Local food',
                points: ['Traditional asado'],
                category: 'GASTRONOMY',
                locale: 'es'
            });
            expect(result).toMatch(/^Category: GASTRONOMY\. /);
        });

        it('uses the supplied tone instead of the neutral default', () => {
            const result = buildPostGeneratePrompt({
                topic: 'Historic center',
                points: ['Colonial architecture'],
                tone: 'formal',
                locale: 'es'
            });
            expect(result).toContain('Tone: formal.');
        });

        it('uses informal tone when specified', () => {
            const result = buildPostGeneratePrompt({
                topic: 'Summer events',
                points: ['Music festivals'],
                tone: 'informal',
                locale: 'es'
            });
            expect(result).toContain('Tone: informal.');
        });

        it('numbers multiple points sequentially starting from 1', () => {
            const result = buildPostGeneratePrompt({
                topic: 'Tourism tips',
                points: ['Tip one', 'Tip two', 'Tip three'],
                locale: 'es'
            });
            expect(result).toContain('1. Tip one');
            expect(result).toContain('2. Tip two');
            expect(result).toContain('3. Tip three');
        });

        it('produces the exact expected string for the full input set', () => {
            const result = buildPostGeneratePrompt({
                topic: 'Summer tourism in Concepción del Uruguay',
                points: ['River beaches', 'Colonial center'],
                category: 'TOURISM',
                tone: 'formal',
                locale: 'es'
            });
            expect(result).toBe(
                'Category: TOURISM. Tone: formal.\n\nTopic: Summer tourism in Concepción del Uruguay\n\nKey points:\n1. River beaches\n2. Colonial center'
            );
        });
    });

    // =========================================================================
    // Route integration — happy path
    // =========================================================================

    describe('happy path', () => {
        it('returns HTTP 200 with a schema-valid AiPostGenerateDraft on valid input', async () => {
            const res = await POST(VALID_BODY);
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                success: boolean;
                data: { title: string; summary: string; content: string };
            };
            expect(body.success).toBe(true);
            expect(body.data.title).toBe(VALID_DRAFT.object.title);
            expect(body.data.summary).toBe(VALID_DRAFT.object.summary);
            expect(body.data.content).toBe(VALID_DRAFT.object.content);
        });

        it('calls generateObject with feature="post_generate"', async () => {
            await POST(VALID_BODY);
            expect(generateObjectCalls).toHaveLength(1);
            expect(generateObjectCalls[0]!.feature).toBe('post_generate');
        });

        it('uses the locale from the request body', async () => {
            await POST({ ...VALID_BODY, locale: 'en' });
            expect(generateObjectCalls[0]!.locale).toBe('en');
        });

        it('defaults the locale to "es" when the request omits it', async () => {
            const { locale: _locale, ...bodyWithoutLocale } = VALID_BODY;
            await POST(bodyWithoutLocale);
            expect(generateObjectCalls[0]!.locale).toBe('es');
        });

        it('includes the category, tone, and topic in the prompt', async () => {
            await POST(VALID_BODY);
            const prompt = generateObjectCalls[0]!.prompt;
            expect(prompt).toContain('Category: TOURISM.');
            expect(prompt).toContain('Tone: formal.');
            expect(prompt).toContain('Topic: Summer tourism in Concepción del Uruguay');
        });

        it('works without optional fields (category, tone, locale)', async () => {
            const minimalBody = {
                topic: 'A simple topic',
                points: ['One key point']
            };
            nextReturnValue.current = {
                ...VALID_DRAFT,
                object: {
                    title: 'Simple title',
                    summary: 'A short summary for the generated post about a simple topic.',
                    content: '<p>Content goes here with enough text to exceed the minimum.</p>'
                }
            };
            const res = await POST(minimalBody);
            expect(res.status).toBe(200);
        });
    });

    // =========================================================================
    // Route integration — validation errors (400)
    // =========================================================================

    describe('validation errors', () => {
        it('returns HTTP 400 VALIDATION_ERROR when topic is too short', async () => {
            const res = await POST({ ...VALID_BODY, topic: 'ab' });
            expect(res.status).toBe(400);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(generateObjectCalls).toHaveLength(0);
        });

        it('returns HTTP 400 VALIDATION_ERROR when points array is empty', async () => {
            const res = await POST({ ...VALID_BODY, points: [] });
            expect(res.status).toBe(400);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(generateObjectCalls).toHaveLength(0);
        });

        it('returns HTTP 400 VALIDATION_ERROR when a point is an empty string', async () => {
            const res = await POST({ ...VALID_BODY, points: [''] });
            expect(res.status).toBe(400);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(generateObjectCalls).toHaveLength(0);
        });

        it('returns HTTP 400 VALIDATION_ERROR when tone is invalid', async () => {
            const res = await POST({ ...VALID_BODY, tone: 'aggressive' });
            expect(res.status).toBe(400);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(generateObjectCalls).toHaveLength(0);
        });

        it('returns HTTP 400 VALIDATION_ERROR when the body is missing the required topic', async () => {
            const { topic: _topic, ...bodyWithoutTopic } = VALID_BODY;
            const res = await POST(bodyWithoutTopic);
            expect(res.status).toBe(400);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(generateObjectCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // Route integration — AI engine error paths
    // =========================================================================

    describe('AI engine error mapping', () => {
        it('returns HTTP 422 MODERATION_FAILED when content is moderation-blocked', async () => {
            nextThrow.current = new AiModerationBlockedError({
                feature: 'post_generate',
                direction: 'output',
                categories: ['violence']
            });
            nextReturnValue.current = null;

            const res = await POST(VALID_BODY);
            expect(res.status).toBe(422);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('MODERATION_FAILED');
            expect(generateObjectCalls).toHaveLength(1);
        });

        it('returns HTTP 429 when the cost ceiling is hit', async () => {
            nextThrow.current = new AiCeilingHitError('post_generate');
            nextReturnValue.current = null;

            const res = await POST(VALID_BODY);
            expect(res.status).toBe(429);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('CEILING_HIT');
        });

        it('returns HTTP 502 when the engine is exhausted (all providers failed)', async () => {
            nextThrow.current = new AiEngineExhaustedError('post_generate');
            nextReturnValue.current = null;

            const res = await POST(VALID_BODY);
            expect(res.status).toBe(502);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('ENGINE_EXHAUSTED');
        });

        it('returns HTTP 503 when the feature is not configured', async () => {
            nextThrow.current = new AiFeatureNotConfiguredError('post_generate');
            nextReturnValue.current = null;

            const res = await POST(VALID_BODY);
            expect(res.status).toBe(503);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('FEATURE_NOT_CONFIGURED');
        });

        it('returns HTTP 500 INTERNAL_ERROR for unexpected errors', async () => {
            nextThrow.current = new Error('Unexpected database failure');
            nextReturnValue.current = null;

            const res = await POST(VALID_BODY);
            expect(res.status).toBe(500);

            const body = (await res.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
