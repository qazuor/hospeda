/**
 * Unit tests for `OpenAiAdapter` (SPEC-173 T-013).
 *
 * All Vercel AI SDK calls are mocked — no network calls, no real API keys.
 *
 * Guarantees:
 * - Constructor passes `apiKey` to `createOpenAI`.
 * - `generateText` calls the SDK's `generateText` with the right model, prompt
 *   or messages, and maps the result to `GenerateTextResponse`.
 * - `streamText` calls the SDK's `streamText`, yields delta chunks from
 *   `textStream`, and resolves `meta` from `usage`/`finishReason`.
 * - `generateObject` calls the SDK's `generateObject` with `zodSchema(schema)`,
 *   maps the result to `{ object, ...meta }`.
 * - `extractIntent` calls `generateObject` internally and returns an `AiIntent`.
 * - `moderate` calls the OpenAI Moderation REST endpoint and maps the response.
 * - `embed` throws `NotImplementedError`.
 * - `id` is always `'openai'`.
 *
 * AAA pattern: Arrange / Act / Assert.
 *
 * Mocking strategy: use `vi.hoisted()` to declare mock functions before the
 * `vi.mock()` factory is hoisted, which avoids the temporal dead-zone error
 * that occurs when factory closures reference `const` variables declared below.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Declare mock functions with vi.hoisted() so they are available when the
// vi.mock() factories are hoisted to the top of the file at runtime.
// ---------------------------------------------------------------------------

const {
    mockGenerateText,
    mockStreamText,
    mockGenerateObject,
    mockZodSchema,
    mockCreateOpenAI,
    mockOpenAiProvider
} = vi.hoisted(() => {
    const mockOpenAiProvider = vi.fn();
    return {
        mockGenerateText: vi.fn(),
        mockStreamText: vi.fn(),
        mockGenerateObject: vi.fn(),
        mockZodSchema: vi.fn((s: unknown) => s),
        mockCreateOpenAI: vi.fn(() => mockOpenAiProvider),
        mockOpenAiProvider
    };
});

vi.mock('ai', () => ({
    generateText: mockGenerateText,
    streamText: mockStreamText,
    generateObject: mockGenerateObject,
    zodSchema: mockZodSchema
}));

vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: mockCreateOpenAI
}));

// ---------------------------------------------------------------------------
// Import adapter AFTER mocks are set up.
// ---------------------------------------------------------------------------

import { NotImplementedError, OpenAiAdapter } from '../src/providers/index.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'test-openai-key';
const MOCK_MODEL_ID = 'mock-openai-model';

/** Minimal fake SDK LanguageModel instance (just needs to be truthy). */
const FAKE_LANGUAGE_MODEL = { type: 'fake-lm' } as const;

/**
 * Fake usage as returned by SDK v6.
 * SDK v6 uses `inputTokens`/`outputTokens` (not `promptTokens`/`completionTokens`).
 */
const FAKE_SDK_USAGE = {
    inputTokens: 10,
    outputTokens: 20,
    inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined
    },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined }
};

/** Expected mapped usage (platform shape: promptTokens / completionTokens / totalTokens). */
const EXPECTED_USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };

// ---------------------------------------------------------------------------
// beforeEach: reset mocks and configure default return values
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.resetAllMocks();

    // Re-wire mockCreateOpenAI after reset so it still returns the provider factory.
    mockOpenAiProvider.mockReturnValue(FAKE_LANGUAGE_MODEL);
    mockCreateOpenAI.mockReturnValue(mockOpenAiProvider);
    // mockZodSchema is a pass-through by default after reset; re-assign.
    mockZodSchema.mockImplementation((s: unknown) => s);
});

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

describe('OpenAiAdapter', () => {
    describe('id', () => {
        it('should always be "openai"', () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });

            // Assert
            expect(adapter.id).toBe('openai');
        });
    });

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    describe('constructor', () => {
        it('should pass the apiKey to createOpenAI', () => {
            // Act
            new OpenAiAdapter({ apiKey: TEST_API_KEY });

            // Assert
            expect(mockCreateOpenAI).toHaveBeenCalledWith({ apiKey: TEST_API_KEY });
        });

        it('should call createOpenAI exactly once', () => {
            // Act
            new OpenAiAdapter({ apiKey: TEST_API_KEY });

            // Assert
            expect(mockCreateOpenAI).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // generateText
    // -------------------------------------------------------------------------

    describe('generateText', () => {
        it('should call SDK generateText with the resolved model and prompt', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            mockGenerateText.mockResolvedValueOnce({
                text: 'Generated text',
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop',
                response: { modelId: MOCK_MODEL_ID }
            });

            // Act
            await adapter.generateText({
                feature: 'text_improve',
                locale: 'es',
                model: MOCK_MODEL_ID,
                prompt: 'hello'
            });

            // Assert
            expect(mockOpenAiProvider).toHaveBeenCalledWith(MOCK_MODEL_ID);
            expect(mockGenerateText).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: FAKE_LANGUAGE_MODEL,
                    prompt: 'hello'
                })
            );
        });

        it('should use the default model when no model override is provided', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            mockGenerateText.mockResolvedValueOnce({
                text: 'text',
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            await adapter.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'hello'
            });

            // Assert — default model is 'gpt-4o-mini'
            expect(mockOpenAiProvider).toHaveBeenCalledWith('gpt-4o-mini');
        });

        it('should pass messages array to the SDK when provided', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            mockGenerateText.mockResolvedValueOnce({
                text: 'reply',
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });
            const messages = [{ role: 'user' as const, content: 'hi' }];

            // Act
            await adapter.generateText({
                feature: 'chat',
                locale: 'en',
                messages
            });

            // Assert
            expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({ messages }));
        });

        it('should map SDK usage to AiUsageStats (inputTokens → promptTokens)', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            mockGenerateText.mockResolvedValueOnce({
                text: 'result',
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            const result = await adapter.generateText({
                feature: 'search',
                locale: 'es',
                prompt: 'test'
            });

            // Assert
            expect(result.usage).toEqual(EXPECTED_USAGE);
        });

        it('should return provider "openai", the resolved model, and finishReason', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            mockGenerateText.mockResolvedValueOnce({
                text: 'ok',
                usage: FAKE_SDK_USAGE,
                finishReason: 'length'
            });

            // Act
            const result = await adapter.generateText({
                feature: 'support',
                locale: 'en',
                model: MOCK_MODEL_ID,
                prompt: 'p'
            });

            // Assert
            expect(result.provider).toBe('openai');
            expect(result.model).toBe(MOCK_MODEL_ID);
            expect(result.finishReason).toBe('length');
        });

        it('should pass temperature and maxTokens params to the SDK', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            mockGenerateText.mockResolvedValueOnce({
                text: 'ok',
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            await adapter.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'p',
                params: { temperature: 0.7, maxTokens: 200 }
            });

            // Assert
            expect(mockGenerateText).toHaveBeenCalledWith(
                expect.objectContaining({ temperature: 0.7, maxOutputTokens: 200 })
            );
        });
    });

    // -------------------------------------------------------------------------
    // streamText
    // -------------------------------------------------------------------------

    describe('streamText', () => {
        it('should call SDK streamText with the resolved model', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            async function* fakeTextStream() {
                yield 'hello';
                yield ' world';
            }
            mockStreamText.mockReturnValueOnce({
                textStream: fakeTextStream(),
                usage: Promise.resolve(FAKE_SDK_USAGE),
                finishReason: Promise.resolve('stop')
            });

            // Act
            await adapter.streamText({
                feature: 'chat',
                locale: 'es',
                model: MOCK_MODEL_ID,
                prompt: 'hi'
            });

            // Assert
            expect(mockOpenAiProvider).toHaveBeenCalledWith(MOCK_MODEL_ID);
            expect(mockStreamText).toHaveBeenCalledWith(
                expect.objectContaining({ model: FAKE_LANGUAGE_MODEL })
            );
        });

        it('should yield StreamTextChunk objects wrapping each delta from textStream', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            async function* fakeTextStream() {
                yield 'foo';
                yield 'bar';
            }
            mockStreamText.mockReturnValueOnce({
                textStream: fakeTextStream(),
                usage: Promise.resolve(FAKE_SDK_USAGE),
                finishReason: Promise.resolve('stop')
            });

            // Act
            const { stream } = await adapter.streamText({
                feature: 'chat',
                locale: 'en',
                prompt: 'q'
            });
            const chunks: string[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk.delta);
            }

            // Assert
            expect(chunks).toEqual(['foo', 'bar']);
        });

        it('should resolve meta with mapped usage and finishReason after stream is drained', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            async function* fakeTextStream() {
                yield 'chunk';
            }
            mockStreamText.mockReturnValueOnce({
                textStream: fakeTextStream(),
                usage: Promise.resolve(FAKE_SDK_USAGE),
                finishReason: Promise.resolve('stop')
            });

            // Act
            const { stream, meta } = await adapter.streamText({
                feature: 'support',
                locale: 'es',
                prompt: 'help'
            });
            for await (const _ of stream) {
                // drain
            }
            const finalMeta = await meta;

            // Assert
            expect(finalMeta.provider).toBe('openai');
            expect(finalMeta.usage).toEqual(EXPECTED_USAGE);
            expect(finalMeta.finishReason).toBe('stop');
        });

        it('should include the resolved model in meta', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            async function* fakeTextStream() {
                yield '';
            }
            mockStreamText.mockReturnValueOnce({
                textStream: fakeTextStream(),
                usage: Promise.resolve(FAKE_SDK_USAGE),
                finishReason: Promise.resolve('stop')
            });

            // Act
            const { stream, meta } = await adapter.streamText({
                feature: 'text_improve',
                locale: 'es',
                model: MOCK_MODEL_ID,
                prompt: 'p'
            });
            for await (const _ of stream) {
                // drain
            }
            const finalMeta = await meta;

            // Assert
            expect(finalMeta.model).toBe(MOCK_MODEL_ID);
        });
    });

    // -------------------------------------------------------------------------
    // generateObject
    // -------------------------------------------------------------------------

    describe('generateObject', () => {
        it('should call SDK generateObject with zodSchema-wrapped schema and prompt', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            const schema = z.object({ name: z.string() });
            mockGenerateObject.mockResolvedValueOnce({
                object: { name: 'result' },
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            await adapter.generateObject(
                { feature: 'search', locale: 'es', prompt: 'find' },
                schema
            );

            // Assert
            expect(mockGenerateObject).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: 'find',
                    model: FAKE_LANGUAGE_MODEL
                })
            );
            expect(mockZodSchema).toHaveBeenCalledWith(schema);
        });

        it('should return the typed object from the SDK result', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            const schema = z.object({ value: z.number() });
            mockGenerateObject.mockResolvedValueOnce({
                object: { value: 42 },
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            const result = await adapter.generateObject(
                { feature: 'search', locale: 'en', prompt: 'give me 42' },
                schema
            );

            // Assert
            expect(result.object).toEqual({ value: 42 });
        });

        it('should include usage, provider, model, and finishReason in the result', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            const schema = z.object({ x: z.boolean() });
            mockGenerateObject.mockResolvedValueOnce({
                object: { x: true },
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            const result = await adapter.generateObject(
                { feature: 'chat', locale: 'es', prompt: 'q', model: MOCK_MODEL_ID },
                schema
            );

            // Assert
            expect(result.usage).toEqual(EXPECTED_USAGE);
            expect(result.provider).toBe('openai');
            expect(result.model).toBe(MOCK_MODEL_ID);
            expect(result.finishReason).toBe('stop');
        });
    });

    // -------------------------------------------------------------------------
    // extractIntent
    // -------------------------------------------------------------------------

    describe('extractIntent', () => {
        it('should return an AiIntent with the rawQuery from the input', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            const fakeIntent = {
                kind: 'search',
                confidence: 0.9,
                entities: { location: 'Colón' },
                rawQuery: 'cabaña en Colón'
            };
            mockGenerateObject.mockResolvedValueOnce({
                object: fakeIntent,
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            const intent = await adapter.extractIntent({
                query: 'cabaña en Colón',
                locale: 'es'
            });

            // Assert
            expect(intent.rawQuery).toBe('cabaña en Colón');
            expect(intent.kind).toBe('search');
            expect(intent.confidence).toBe(0.9);
        });

        it('should call generateObject with a Zod schema (zodSchema called once)', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            mockGenerateObject.mockResolvedValueOnce({
                object: { kind: 'stub', confidence: 0.5, entities: {}, rawQuery: 'q' },
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            await adapter.extractIntent({ query: 'q' });

            // Assert — zodSchema is called (wrapping AiIntentSchema)
            expect(mockZodSchema).toHaveBeenCalledTimes(1);
            expect(mockGenerateObject).toHaveBeenCalledTimes(1);
        });

        it('should include the locale hint in the prompt when locale is provided', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            mockGenerateObject.mockResolvedValueOnce({
                object: { kind: 'stub', confidence: 0.5, entities: {}, rawQuery: 'hi' },
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            await adapter.extractIntent({ query: 'hi', locale: 'pt' });

            // Assert — prompt passed to generateObject contains locale hint
            const callArgs = mockGenerateObject.mock.calls[0]?.[0] as { prompt?: string };
            expect(callArgs?.prompt).toContain('pt');
        });
    });

    // -------------------------------------------------------------------------
    // moderate
    // -------------------------------------------------------------------------

    describe('moderate', () => {
        it('should call the OpenAI Moderation REST endpoint with the input text', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    results: [
                        {
                            flagged: false,
                            categories: { hate: false, violence: false },
                            category_scores: { hate: 0.001, violence: 0.002 }
                        }
                    ]
                })
            });
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await adapter.moderate({ input: 'benign content' });

            // Assert
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/moderations',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${TEST_API_KEY}`
                    }),
                    body: JSON.stringify({ input: 'benign content' })
                })
            );

            vi.unstubAllGlobals();
        });

        it('should return flagged: false and categories for clean content', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        results: [
                            {
                                flagged: false,
                                categories: { hate: false },
                                category_scores: { hate: 0.001 }
                            }
                        ]
                    })
                })
            );

            // Act
            const result = await adapter.moderate({ input: 'hello world' });

            // Assert
            expect(result.flagged).toBe(false);
            expect(result.categories).toEqual({ hate: false });
            expect(result.scores).toEqual({ hate: 0.001 });

            vi.unstubAllGlobals();
        });

        it('should return flagged: true when content violates policy', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        results: [
                            {
                                flagged: true,
                                categories: { hate: true, violence: false },
                                category_scores: { hate: 0.95, violence: 0.1 }
                            }
                        ]
                    })
                })
            );

            // Act
            const result = await adapter.moderate({ input: 'hateful content' });

            // Assert
            expect(result.flagged).toBe(true);
            expect(result.categories.hate).toBe(true);

            vi.unstubAllGlobals();
        });

        it('should throw when the API returns a non-OK status', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    statusText: 'Unauthorized'
                })
            );

            // Act + Assert
            await expect(adapter.moderate({ input: 'test' })).rejects.toThrow('401');

            vi.unstubAllGlobals();
        });

        it('should return a safe fallback when the results array is empty', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ results: [] })
                })
            );

            // Act
            const result = await adapter.moderate({ input: 'edge case' });

            // Assert
            expect(result.flagged).toBe(false);
            expect(result.categories).toEqual({});

            vi.unstubAllGlobals();
        });
    });

    // -------------------------------------------------------------------------
    // embed (V2 stub)
    // -------------------------------------------------------------------------

    describe('embed', () => {
        it('should throw NotImplementedError', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });

            // Act + Assert
            await expect(adapter.embed({ text: 'some text' })).rejects.toThrow(NotImplementedError);
        });

        it('should include "embed" in the error message', async () => {
            // Arrange
            const adapter = new OpenAiAdapter({ apiKey: TEST_API_KEY });

            // Act + Assert
            await expect(adapter.embed({ text: 'test' })).rejects.toThrow('embed');
        });
    });
});
