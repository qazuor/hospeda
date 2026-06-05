/**
 * Unit tests for `AnthropicAdapter` (SPEC-173 T-013).
 *
 * All Vercel AI SDK calls are mocked — no network calls, no real API keys.
 *
 * Guarantees:
 * - Constructor passes `apiKey` to `createAnthropic`.
 * - `generateText` calls the SDK's `generateText` with the right model, prompt
 *   or messages, and maps the result to `GenerateTextResponse`.
 * - `streamText` calls the SDK's `streamText`, yields delta chunks from
 *   `textStream`, and resolves `meta` from `usage`/`finishReason`.
 * - `generateObject` calls the SDK's `generateObject` with `zodSchema(schema)`,
 *   maps the result to `{ object, ...meta }`.
 * - `extractIntent` calls `generateObject` internally and returns an `AiIntent`.
 * - `moderate` throws `NotImplementedError` (Anthropic has no moderation API).
 * - `embed` throws `NotImplementedError`.
 * - `id` is always `'anthropic'`.
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
    mockCreateAnthropic,
    mockAnthropicProvider
} = vi.hoisted(() => {
    const mockAnthropicProvider = vi.fn();
    return {
        mockGenerateText: vi.fn(),
        mockStreamText: vi.fn(),
        mockGenerateObject: vi.fn(),
        mockZodSchema: vi.fn((s: unknown) => s),
        mockCreateAnthropic: vi.fn(() => mockAnthropicProvider),
        mockAnthropicProvider
    };
});

vi.mock('ai', () => ({
    generateText: mockGenerateText,
    streamText: mockStreamText,
    generateObject: mockGenerateObject,
    zodSchema: mockZodSchema
}));

vi.mock('@ai-sdk/anthropic', () => ({
    createAnthropic: mockCreateAnthropic
}));

// ---------------------------------------------------------------------------
// Import adapter AFTER mocks are set up.
// ---------------------------------------------------------------------------

import { AnthropicAdapter, NotImplementedError } from '../src/providers/index.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'test-anthropic-key';
const MOCK_MODEL_ID = 'mock-anthropic-model';

/** Minimal fake SDK LanguageModel instance. */
const FAKE_LANGUAGE_MODEL = { type: 'fake-anthropic-lm' } as const;

/**
 * Fake usage as returned by SDK v6.
 * SDK v6 uses `inputTokens`/`outputTokens`.
 */
const FAKE_SDK_USAGE = {
    inputTokens: 15,
    outputTokens: 25,
    inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined
    },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined }
};

/** Expected mapped usage (platform shape). */
const EXPECTED_USAGE = { promptTokens: 15, completionTokens: 25, totalTokens: 40 };

// ---------------------------------------------------------------------------
// beforeEach: reset mocks and configure defaults
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.resetAllMocks();

    mockAnthropicProvider.mockReturnValue(FAKE_LANGUAGE_MODEL);
    mockCreateAnthropic.mockReturnValue(mockAnthropicProvider);
    mockZodSchema.mockImplementation((s: unknown) => s);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnthropicAdapter', () => {
    // -------------------------------------------------------------------------
    // Identity
    // -------------------------------------------------------------------------

    describe('id', () => {
        it('should always be "anthropic"', () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });

            // Assert
            expect(adapter.id).toBe('anthropic');
        });
    });

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    describe('constructor', () => {
        it('should pass the apiKey to createAnthropic', () => {
            // Act
            new AnthropicAdapter({ apiKey: TEST_API_KEY });

            // Assert
            expect(mockCreateAnthropic).toHaveBeenCalledWith({ apiKey: TEST_API_KEY });
        });

        it('should call createAnthropic exactly once', () => {
            // Act
            new AnthropicAdapter({ apiKey: TEST_API_KEY });

            // Assert
            expect(mockCreateAnthropic).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // generateText
    // -------------------------------------------------------------------------

    describe('generateText', () => {
        it('should call SDK generateText with the resolved model and prompt', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            mockGenerateText.mockResolvedValueOnce({
                text: 'Generated text',
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            await adapter.generateText({
                feature: 'text_improve',
                locale: 'es',
                model: MOCK_MODEL_ID,
                prompt: 'hello'
            });

            // Assert
            expect(mockAnthropicProvider).toHaveBeenCalledWith(MOCK_MODEL_ID);
            expect(mockGenerateText).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: FAKE_LANGUAGE_MODEL,
                    prompt: 'hello'
                })
            );
        });

        it('should use the default model when no model override is provided', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
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

            // Assert — default model is 'claude-3-5-haiku-20241022'
            expect(mockAnthropicProvider).toHaveBeenCalledWith('claude-3-5-haiku-20241022');
        });

        it('should pass messages array to the SDK when provided', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
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

        it('should map SDK usage to AiUsageStats', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
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

        it('should return provider "anthropic", the resolved model, and finishReason', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
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
            expect(result.provider).toBe('anthropic');
            expect(result.model).toBe(MOCK_MODEL_ID);
            expect(result.finishReason).toBe('length');
        });

        it('should pass temperature and maxTokens params to the SDK', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
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
                params: { temperature: 0.5, maxTokens: 512 }
            });

            // Assert
            expect(mockGenerateText).toHaveBeenCalledWith(
                expect.objectContaining({ temperature: 0.5, maxOutputTokens: 512 })
            );
        });
    });

    // -------------------------------------------------------------------------
    // streamText
    // -------------------------------------------------------------------------

    describe('streamText', () => {
        it('should call SDK streamText with the resolved model', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
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
            expect(mockAnthropicProvider).toHaveBeenCalledWith(MOCK_MODEL_ID);
            expect(mockStreamText).toHaveBeenCalledWith(
                expect.objectContaining({ model: FAKE_LANGUAGE_MODEL })
            );
        });

        it('should yield StreamTextChunk objects from textStream', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            async function* fakeTextStream() {
                yield 'alpha';
                yield 'beta';
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
            expect(chunks).toEqual(['alpha', 'beta']);
        });

        it('should resolve meta with mapped usage and finishReason', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            async function* fakeTextStream() {
                yield 'data';
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
            expect(finalMeta.provider).toBe('anthropic');
            expect(finalMeta.usage).toEqual(EXPECTED_USAGE);
            expect(finalMeta.finishReason).toBe('stop');
        });

        it('should include the resolved model in meta', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            async function* fakeTextStream() {
                yield '';
            }
            mockStreamText.mockReturnValueOnce({
                textStream: fakeTextStream(),
                usage: Promise.resolve(FAKE_SDK_USAGE),
                finishReason: Promise.resolve('length')
            });

            // Act
            const { stream, meta } = await adapter.streamText({
                feature: 'chat',
                locale: 'pt',
                model: MOCK_MODEL_ID,
                prompt: 'p'
            });
            for await (const _ of stream) {
                // drain
            }
            const finalMeta = await meta;

            // Assert
            expect(finalMeta.model).toBe(MOCK_MODEL_ID);
            expect(finalMeta.finishReason).toBe('length');
        });
    });

    // -------------------------------------------------------------------------
    // generateObject
    // -------------------------------------------------------------------------

    describe('generateObject', () => {
        it('should call SDK generateObject with zodSchema-wrapped schema and prompt', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            const schema = z.object({ title: z.string() });
            mockGenerateObject.mockResolvedValueOnce({
                object: { title: 'test' },
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
                expect.objectContaining({ prompt: 'find', model: FAKE_LANGUAGE_MODEL })
            );
            expect(mockZodSchema).toHaveBeenCalledWith(schema);
        });

        it('should return the typed object from the SDK result', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            const schema = z.object({ count: z.number() });
            mockGenerateObject.mockResolvedValueOnce({
                object: { count: 7 },
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            const result = await adapter.generateObject(
                { feature: 'search', locale: 'en', prompt: 'count to 7' },
                schema
            );

            // Assert
            expect(result.object).toEqual({ count: 7 });
        });

        it('should include usage, provider, model, and finishReason in the result', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            const schema = z.object({ flag: z.boolean() });
            mockGenerateObject.mockResolvedValueOnce({
                object: { flag: true },
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
            expect(result.provider).toBe('anthropic');
            expect(result.model).toBe(MOCK_MODEL_ID);
        });
    });

    // -------------------------------------------------------------------------
    // extractIntent
    // -------------------------------------------------------------------------

    describe('extractIntent', () => {
        it('should return an AiIntent with the rawQuery from the input', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            const fakeIntent = {
                kind: 'search',
                confidence: 0.85,
                entities: { type: 'hotel' },
                rawQuery: 'hotel en Buenos Aires'
            };
            mockGenerateObject.mockResolvedValueOnce({
                object: fakeIntent,
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            const intent = await adapter.extractIntent({
                query: 'hotel en Buenos Aires',
                locale: 'es'
            });

            // Assert
            expect(intent.rawQuery).toBe('hotel en Buenos Aires');
            expect(intent.kind).toBe('search');
        });

        it('should call generateObject internally (zodSchema called once)', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });
            mockGenerateObject.mockResolvedValueOnce({
                object: { kind: 'stub', confidence: 0.5, entities: {}, rawQuery: 'q' },
                usage: FAKE_SDK_USAGE,
                finishReason: 'stop'
            });

            // Act
            await adapter.extractIntent({ query: 'q' });

            // Assert
            expect(mockZodSchema).toHaveBeenCalledTimes(1);
            expect(mockGenerateObject).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // moderate — MUST throw (Anthropic has no moderation endpoint)
    // -------------------------------------------------------------------------

    describe('moderate', () => {
        it('should throw NotImplementedError', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });

            // Act + Assert
            await expect(adapter.moderate({ input: 'some text' })).rejects.toThrow(
                NotImplementedError
            );
        });

        it('should include a message about routing moderation to OpenAI', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });

            // Act + Assert
            await expect(adapter.moderate({ input: 'text' })).rejects.toThrow(/OpenAI/i);
        });

        it('should throw regardless of the input content', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });

            // Act + Assert
            await expect(
                adapter.moderate({ input: 'totally clean text', locale: 'en' })
            ).rejects.toThrow(NotImplementedError);
        });
    });

    // -------------------------------------------------------------------------
    // embed (V2 stub)
    // -------------------------------------------------------------------------

    describe('embed', () => {
        it('should throw NotImplementedError', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });

            // Act + Assert
            await expect(adapter.embed({ text: 'embed me' })).rejects.toThrow(NotImplementedError);
        });

        it('should include "embed" in the error message', async () => {
            // Arrange
            const adapter = new AnthropicAdapter({ apiKey: TEST_API_KEY });

            // Act + Assert
            await expect(adapter.embed({ text: 'test' })).rejects.toThrow('embed');
        });
    });
});
