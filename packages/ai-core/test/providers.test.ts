import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NotImplementedError, StubProvider } from '../src/providers/index.js';
import type { AiProvider } from '../src/providers/index.js';

/**
 * Unit tests for `StubProvider` and the `AiProvider` interface (T-012).
 *
 * Guarantees:
 * - Every capability returns a deterministic shape (same input → same output).
 * - The `id` property is always `'stub'`.
 * - `streamText` yields exactly three delta chunks that concatenate to the
 *   expected echo text, and `meta` resolves with the expected metadata.
 * - `generateObject` returns `{ object: T } & GenerateObjectResponseMeta`.
 * - `moderate` always returns `{ flagged: false, categories: {} }`.
 * - `extractIntent` echoes `rawQuery` and returns a fixed intent shape.
 * - `embed` throws `NotImplementedError`.
 * - `StubProvider` satisfies the `AiProvider` interface (compile-time check).
 *
 * AAA pattern: Arrange / Act / Assert.
 */

// ---------------------------------------------------------------------------
// Compile-time structural check
// ---------------------------------------------------------------------------

// This assignment is a COMPILE-TIME assertion that StubProvider satisfies the
// full AiProvider interface. If the interface grows a new method that StubProvider
// doesn't implement, tsc will fail here before any test runs.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _interfaceCheck: AiProvider = new StubProvider();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STUB_USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
const STUB_MODEL = 'stub-model-v1';
const STUB_FINISH = 'stop';

describe('StubProvider', () => {
    // -------------------------------------------------------------------------
    // Identity
    // -------------------------------------------------------------------------

    describe('id', () => {
        it('should be "stub"', () => {
            // Arrange
            const provider = new StubProvider();

            // Assert
            expect(provider.id).toBe('stub');
        });

        it('should be the same value on every instance', () => {
            // Arrange
            const a = new StubProvider();
            const b = new StubProvider();

            // Assert
            expect(a.id).toBe(b.id);
        });
    });

    // -------------------------------------------------------------------------
    // generateText
    // -------------------------------------------------------------------------

    describe('generateText', () => {
        it('should echo the prompt in the text field', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'hola mundo'
            });

            // Assert
            expect(result.text).toBe('[stub:text_improve] hola mundo');
        });

        it('should echo the last message content when messages are provided', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.generateText({
                feature: 'chat',
                locale: 'en',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Tell me about Concepción del Uruguay.' }
                ]
            });

            // Assert
            expect(result.text).toBe('[stub:chat] Tell me about Concepción del Uruguay.');
        });

        it('should return fixed usage stats', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.generateText({
                feature: 'search',
                locale: 'pt',
                prompt: 'query'
            });

            // Assert
            expect(result.usage).toEqual(STUB_USAGE);
        });

        it('should return provider id "stub"', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.generateText({
                feature: 'support',
                locale: 'es',
                prompt: 'help me'
            });

            // Assert
            expect(result.provider).toBe('stub');
        });

        it('should return fixed model and finishReason', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            });

            // Assert
            expect(result.model).toBe(STUB_MODEL);
            expect(result.finishReason).toBe(STUB_FINISH);
        });

        it('should produce the same output for the same input (determinism)', async () => {
            // Arrange
            const provider = new StubProvider();
            const input = { feature: 'chat' as const, locale: 'es' as const, prompt: 'saludo' };

            // Act
            const r1 = await provider.generateText(input);
            const r2 = await provider.generateText(input);

            // Assert
            expect(r1).toEqual(r2);
        });
    });

    // -------------------------------------------------------------------------
    // streamText
    // -------------------------------------------------------------------------

    describe('streamText', () => {
        it('should return a stream and a meta promise', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.streamText({
                feature: 'chat',
                locale: 'es',
                prompt: 'stream test'
            });

            // Assert
            expect(result).toHaveProperty('stream');
            expect(result).toHaveProperty('meta');
            expect(typeof result.meta.then).toBe('function');
        });

        it('should yield exactly three chunks', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const { stream } = await provider.streamText({
                feature: 'text_improve',
                locale: 'en',
                prompt: 'hello'
            });
            const chunks: string[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk.delta);
            }

            // Assert
            expect(chunks).toHaveLength(3);
        });

        it('should produce chunks that concatenate to the expected echo text', async () => {
            // Arrange
            const provider = new StubProvider();
            const prompt = 'split me into chunks';
            const expectedFull = `[stub:text_improve] ${prompt}`;

            // Act
            const { stream } = await provider.streamText({
                feature: 'text_improve',
                locale: 'es',
                prompt
            });
            let assembled = '';
            for await (const chunk of stream) {
                assembled += chunk.delta;
            }

            // Assert
            expect(assembled).toBe(expectedFull);
        });

        it('should resolve meta with fixed provider, model, finishReason, and usage', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const { stream, meta } = await provider.streamText({
                feature: 'search',
                locale: 'pt',
                prompt: 'meta test'
            });
            // Drain the stream first so meta can resolve.
            for await (const _ of stream) {
                // intentional no-op drain
            }
            const finalMeta = await meta;

            // Assert
            expect(finalMeta.provider).toBe('stub');
            expect(finalMeta.model).toBe(STUB_MODEL);
            expect(finalMeta.finishReason).toBe(STUB_FINISH);
            expect(finalMeta.usage).toEqual(STUB_USAGE);
        });

        it('should use the last message when messages array is provided', async () => {
            // Arrange
            const provider = new StubProvider();
            const lastMessage = 'What is the best cabin near Gualeguaychú?';

            // Act
            const { stream } = await provider.streamText({
                feature: 'chat',
                locale: 'es',
                messages: [
                    { role: 'user', content: 'first turn' },
                    { role: 'assistant', content: 'some answer' },
                    { role: 'user', content: lastMessage }
                ]
            });
            let assembled = '';
            for await (const chunk of stream) {
                assembled += chunk.delta;
            }

            // Assert
            expect(assembled).toBe(`[stub:chat] ${lastMessage}`);
        });

        it('should produce identical chunks for the same input (determinism)', async () => {
            // Arrange
            const provider = new StubProvider();
            const input = { feature: 'support' as const, locale: 'en' as const, prompt: 'repeat' };

            // Act
            const { stream: s1 } = await provider.streamText(input);
            const { stream: s2 } = await provider.streamText(input);

            const chunks1: string[] = [];
            for await (const c of s1) chunks1.push(c.delta);

            const chunks2: string[] = [];
            for await (const c of s2) chunks2.push(c.delta);

            // Assert
            expect(chunks1).toEqual(chunks2);
        });
    });

    // -------------------------------------------------------------------------
    // generateObject
    // -------------------------------------------------------------------------

    describe('generateObject', () => {
        it('should return the parsed object from the provided schema', async () => {
            // Arrange
            const provider = new StubProvider();
            const schema = z.object({
                name: z.string().default('stub-name'),
                count: z.number().default(0)
            });

            // Act
            const result = await provider.generateObject(
                { feature: 'search', locale: 'es', prompt: 'find something' },
                schema
            );

            // Assert
            expect(result.object).toEqual({ name: 'stub-name', count: 0 });
        });

        it('should include provider, model, finishReason, usage in the result', async () => {
            // Arrange
            const provider = new StubProvider();
            const schema = z.object({ value: z.string().default('x') });

            // Act
            const result = await provider.generateObject(
                { feature: 'text_improve', locale: 'en', prompt: 'test' },
                schema
            );

            // Assert
            expect(result.provider).toBe('stub');
            expect(result.model).toBe(STUB_MODEL);
            expect(result.finishReason).toBe(STUB_FINISH);
            expect(result.usage).toEqual(STUB_USAGE);
        });

        it('should produce the same object for the same schema and input (determinism)', async () => {
            // Arrange
            const provider = new StubProvider();
            const schema = z.object({ x: z.number().default(42) });
            const input = { feature: 'support' as const, locale: 'pt' as const, prompt: 'q' };

            // Act
            const r1 = await provider.generateObject(input, schema);
            const r2 = await provider.generateObject(input, schema);

            // Assert
            expect(r1.object).toEqual(r2.object);
        });

        it('should return a result whose object is typed as T (type-level check)', async () => {
            // Arrange
            const provider = new StubProvider();
            const schema = z.object({ label: z.string().default('ok') });

            // Act
            const result = await provider.generateObject(
                { feature: 'chat', locale: 'es', prompt: 'label me' },
                schema
            );

            // Assert — TypeScript would catch this at compile-time if typed incorrectly
            const label: string = result.object.label;
            expect(label).toBe('ok');
        });
    });

    // -------------------------------------------------------------------------
    // extractIntent
    // -------------------------------------------------------------------------

    describe('extractIntent', () => {
        it('should return kind "stub"', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const intent = await provider.extractIntent({ query: 'cabañas en Colón' });

            // Assert
            expect(intent.kind).toBe('stub');
        });

        it('should return confidence 0.99', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const intent = await provider.extractIntent({ query: 'test' });

            // Assert
            expect(intent.confidence).toBe(0.99);
        });

        it('should echo the original query as rawQuery', async () => {
            // Arrange
            const provider = new StubProvider();
            const query = 'alojamiento con pileta para 4 personas';

            // Act
            const intent = await provider.extractIntent({ query });

            // Assert
            expect(intent.rawQuery).toBe(query);
        });

        it('should return empty entities', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const intent = await provider.extractIntent({ query: 'something' });

            // Assert
            expect(intent.entities).toEqual({});
        });

        it('should return the same intent for the same query (determinism)', async () => {
            // Arrange
            const provider = new StubProvider();
            const input = { query: 'same query', locale: 'es' as const };

            // Act
            const r1 = await provider.extractIntent(input);
            const r2 = await provider.extractIntent(input);

            // Assert
            expect(r1).toEqual(r2);
        });

        it('should accept an optional locale without changing the shape', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const withLocale = await provider.extractIntent({ query: 'q', locale: 'en' });
            const withoutLocale = await provider.extractIntent({ query: 'q' });

            // Assert — locale is optional; shape is the same
            expect(withLocale.kind).toBe(withoutLocale.kind);
            expect(withLocale.confidence).toBe(withoutLocale.confidence);
        });
    });

    // -------------------------------------------------------------------------
    // moderate
    // -------------------------------------------------------------------------

    describe('moderate', () => {
        it('should always return flagged: false', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.moderate({ input: 'some user content' });

            // Assert
            expect(result.flagged).toBe(false);
        });

        it('should return empty categories', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.moderate({ input: 'anything at all' });

            // Assert
            expect(result.categories).toEqual({});
        });

        it('should not include scores (omitted by design)', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const result = await provider.moderate({ input: 'test' });

            // Assert
            expect(result.scores).toBeUndefined();
        });

        it('should return the same result regardless of content (determinism)', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const r1 = await provider.moderate({ input: 'hello' });
            const r2 = await provider.moderate({
                input: 'totally different content with bad words'
            });

            // Assert
            expect(r1).toEqual(r2);
        });

        it('should accept an optional locale without changing the result', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act
            const withLocale = await provider.moderate({ input: 'text', locale: 'es' });
            const withoutLocale = await provider.moderate({ input: 'text' });

            // Assert
            expect(withLocale).toEqual(withoutLocale);
        });
    });

    // -------------------------------------------------------------------------
    // embed (V2 stub — must throw NotImplementedError)
    // -------------------------------------------------------------------------

    describe('embed', () => {
        it('should throw NotImplementedError', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act + Assert
            await expect(provider.embed({ text: 'some text' })).rejects.toThrow(
                NotImplementedError
            );
        });

        it('should include the method name in the error message', async () => {
            // Arrange
            const provider = new StubProvider();

            // Act + Assert
            await expect(provider.embed({ text: 'test' })).rejects.toThrow('embed');
        });
    });
});

// ---------------------------------------------------------------------------
// NotImplementedError
// ---------------------------------------------------------------------------

describe('NotImplementedError', () => {
    it('should be an instance of Error', () => {
        // Arrange + Act
        const error = new NotImplementedError('myMethod');

        // Assert
        expect(error).toBeInstanceOf(Error);
    });

    it('should have name "NotImplementedError"', () => {
        // Arrange + Act
        const error = new NotImplementedError('myMethod');

        // Assert
        expect(error.name).toBe('NotImplementedError');
    });

    it('should include the method name in the message', () => {
        // Arrange + Act
        const error = new NotImplementedError('embed');

        // Assert
        expect(error.message).toContain('embed');
    });
});
