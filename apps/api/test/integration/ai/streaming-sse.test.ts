/**
 * Integration tests for SSE streaming endpoint (SPEC-173 T-038, AC-10).
 *
 * Builds a minimal Hono app wired with `createStreamingRoute` (the real factory)
 * whose `streamHandler` calls the real `AiService.streamText` backed by the
 * StubProvider. No real network calls are made (AC-13).
 *
 * ## AC-10 assertions
 *
 * - Response `Content-Type` includes `text/event-stream`.
 * - Body yields at least 3 `event: token` frames whose concatenated deltas equal
 *   the stub echo string.
 * - A final `event: done` frame whose JSON carries `usage`, `provider`,
 *   `model`, and `finishReason`.
 *
 * ## Moderation (flagged-output path)
 *
 * Skipped here — the unit suite in `packages/ai-core/test/moderation-flow.test.ts`
 * and `stream-text-flow.test.ts` already covers the output-moderation throw path
 * in full (the post-drain generator throwing `AiModerationBlockedError`). That is
 * a pure-library concern with no HTTP/SSE layer; duplicating it here would add
 * test weight without coverage value.
 *
 * ## Auth
 *
 * The route built in this test uses `createStreamingRoute` directly (no auth
 * middleware) so we can focus on the SSE protocol. Auth is tested by the
 * `createProtectedStreamingRoute` path which wraps `protectedAuthMiddleware` —
 * the quota-enforcement tests (T-037) already cover that layer.
 *
 * ## DB
 *
 * `testDb.setup()` / `testDb.clean()` / `testDb.teardown()` for full isolation.
 * The service is built with a custom `getProvider` that always returns a
 * `StubProvider`, bypassing vault / credential lookup. `ai_settings` is seeded
 * with `stub` as the primary provider for the `chat` feature.
 *
 * @module test/integration/ai/streaming-sse
 */

// ---------------------------------------------------------------------------
// Vault key: must be in process.env before env.ts module loads.
// ---------------------------------------------------------------------------

process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';

import { OpenAPIHono } from '@hono/zod-openapi';
import {
    StubProvider,
    createAiService,
    invalidateConfigCache,
    invalidatePromptCache
} from '@repo/ai-core';
import { aiSettings, getDb } from '@repo/db';
import type { AiSettingsValue } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AppBindings } from '../../../src/types';
import { createStreamingRoute } from '../../../src/utils/streaming-route-factory';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_FEATURE = 'chat' as const;
const TEST_ACTOR_ID = crypto.randomUUID();
const TEST_PROMPT = 'Tell me about Concepción del Uruguay';

/** The stub echo formula: `[stub:${feature}] ${prompt}` */
const EXPECTED_ECHO = `[stub:${TEST_FEATURE}] ${TEST_PROMPT}`;

const STREAM_PATH = '/test-stream';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds `ai_settings` with the stub provider as the primary for all features.
 * No cost ceiling — we want the call to succeed.
 */
async function seedAiSettings(actorId: string): Promise<void> {
    const db = getDb();
    const { users } = await import('@repo/db');

    await db
        .insert(users)
        .values({
            id: actorId,
            displayName: 'SSE Test Actor',
            email: `sse-actor-${actorId}@test.invalid`,
            emailVerified: false
        })
        .onConflictDoNothing();

    const stubFeatureConfig = {
        enabled: true,
        primaryProvider: 'stub' as const,
        fallbackChain: [] as Array<'openai' | 'anthropic' | 'stub'>,
        model: 'stub-model',
        params: {} as { temperature?: number; maxTokens?: number; topP?: number }
    };

    const settingsValue: AiSettingsValue = {
        providers: { stub: { enabled: true } },
        features: {
            chat: stubFeatureConfig,
            text_improve: stubFeatureConfig,
            search: stubFeatureConfig,
            support: stubFeatureConfig
        }
    };

    await db
        .insert(aiSettings)
        .values({
            key: 'global',
            value: settingsValue as Record<string, unknown>,
            updatedBy: actorId,
            updatedAt: new Date(),
            createdAt: new Date()
        })
        .onConflictDoUpdate({
            target: aiSettings.key,
            set: {
                value: settingsValue as Record<string, unknown>,
                updatedBy: actorId,
                updatedAt: new Date()
            }
        });

    invalidateConfigCache();
}

/**
 * Builds a Hono app with `createStreamingRoute` whose `streamHandler` calls
 * the real `AiService.streamText` backed by `StubProvider`.
 *
 * `createAiService` is called with a custom `getProvider` that bypasses the
 * vault entirely — always returns `new StubProvider()`. The config cache is
 * still read from `ai_settings` in the DB (seeded in `beforeAll`), which is
 * the correct end-to-end path for verifying the SSE factory contract.
 */
function buildStreamApp(): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });

    const streamRoute = createStreamingRoute({
        method: 'post',
        path: STREAM_PATH,
        summary: 'Test streaming endpoint',
        description: 'Streams AI chat response via SSE using the stub provider.',
        tags: ['Test - Streaming'],
        requestSchema: z.object({ prompt: z.string().min(1) }),
        streamHandler: async ({ c }) => {
            const body = await c.req.json<{ prompt: string }>();

            // Build the service here so each request gets a fresh stub-wired
            // service — no vault calls, always stub.
            const service = createAiService({
                getProvider: (_id) => new StubProvider(),
                defaultLocale: 'es'
            });

            return service.streamText({
                feature: TEST_FEATURE,
                prompt: body.prompt
            });
        }
    });

    app.route('/', streamRoute);

    return app;
}

// ---------------------------------------------------------------------------
// Parse SSE frames from the raw response body string.
// ---------------------------------------------------------------------------

interface SseFrame {
    readonly event: string;
    readonly data: string;
}

/**
 * Reads the full SSE response body via a ReadableStream reader and splits it
 * into typed frames. Each SSE message block is delimited by `\n\n`.
 */
async function parseSseFrames(response: Response): Promise<SseFrame[]> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is null — no SSE stream');
    }

    const decoder = new TextDecoder();
    let raw = '';

    // Read all chunks until the stream closes.
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
    }

    // Flush the decoder.
    raw += decoder.decode();

    // Split on the SSE block delimiter `\n\n` and parse each block.
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
// Suite
// ---------------------------------------------------------------------------

describe('SSE streaming endpoint (SPEC-173 T-038 AC-10)', () => {
    let streamApp: OpenAPIHono<AppBindings>;

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        await seedAiSettings(TEST_ACTOR_ID);

        streamApp = buildStreamApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        invalidateConfigCache();
        invalidatePromptCache();
        await testDb.clean();
    });

    // -------------------------------------------------------------------------
    // AC-10a: Content-Type is text/event-stream
    // -------------------------------------------------------------------------

    describe('AC-10a — Content-Type header', () => {
        it('returns Content-Type: text/event-stream', async () => {
            // Re-seed after clean in afterEach on first run (beforeAll seeds once;
            // afterEach cleans; subsequent tests need a fresh seed).
            await seedAiSettings(TEST_ACTOR_ID);

            const res = await streamApp.request(STREAM_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: TEST_PROMPT })
            });

            expect(res.status).toBe(200);
            const contentType = res.headers.get('content-type') ?? '';
            expect(contentType).toContain('text/event-stream');
        });
    });

    // -------------------------------------------------------------------------
    // AC-10b: at least 3 token frames + 1 done frame
    // -------------------------------------------------------------------------

    describe('AC-10b — token frames and done frame', () => {
        it('emits at least 3 token frames and one done frame', async () => {
            await seedAiSettings(TEST_ACTOR_ID);

            const res = await streamApp.request(STREAM_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: TEST_PROMPT })
            });

            expect(res.status).toBe(200);

            const frames = await parseSseFrames(res);

            const tokenFrames = frames.filter((f) => f.event === 'token');
            const doneFrames = frames.filter((f) => f.event === 'done');

            // StubProvider splits the echo into exactly 3 chunks.
            expect(tokenFrames.length).toBeGreaterThanOrEqual(3);
            expect(doneFrames.length).toBe(1);
        });

        it('token frame deltas concatenate to the stub echo string', async () => {
            await seedAiSettings(TEST_ACTOR_ID);

            const res = await streamApp.request(STREAM_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: TEST_PROMPT })
            });

            const frames = await parseSseFrames(res);
            const tokenFrames = frames.filter((f) => f.event === 'token');

            const concatenated = tokenFrames
                .map((f) => {
                    const parsed = JSON.parse(f.data) as { delta: string };
                    return parsed.delta;
                })
                .join('');

            expect(concatenated).toBe(EXPECTED_ECHO);
        });

        it('done frame JSON carries usage, provider, model, and finishReason', async () => {
            await seedAiSettings(TEST_ACTOR_ID);

            const res = await streamApp.request(STREAM_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: TEST_PROMPT })
            });

            const frames = await parseSseFrames(res);
            const doneFrames = frames.filter((f) => f.event === 'done');

            expect(doneFrames.length).toBe(1);

            const doneData = JSON.parse(doneFrames[0]!.data) as Record<string, unknown>;

            expect(doneData).toHaveProperty('usage');
            expect(doneData).toHaveProperty('provider', 'stub');
            expect(doneData).toHaveProperty('model');
            expect(doneData).toHaveProperty('finishReason');
        });
    });

    // -------------------------------------------------------------------------
    // Validation: invalid body returns 400 (not SSE)
    // -------------------------------------------------------------------------

    describe('body validation', () => {
        it('returns 400 JSON (not SSE) when body prompt is empty string', async () => {
            await seedAiSettings(TEST_ACTOR_ID);

            const res = await streamApp.request(STREAM_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: '' })
            });

            expect(res.status).toBe(400);
            const contentType = res.headers.get('content-type') ?? '';
            expect(contentType).not.toContain('text/event-stream');
        });

        it('returns 400 JSON when body is missing prompt field', async () => {
            await seedAiSettings(TEST_ACTOR_ID);

            const res = await streamApp.request(STREAM_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            expect(res.status).toBe(400);
        });
    });
});
