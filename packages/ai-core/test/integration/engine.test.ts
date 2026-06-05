/**
 * Integration tests for AC-1 — engine response shape, provider-order fallback,
 * maxTokens override, stream event ordering, and soft-fail on empty context
 * (SPEC-173 §7 AC-1/AC-2).
 *
 * ## What makes this integration (vs. unit)
 *
 * These tests exercise the FULL wiring path from `createAiService` through the
 * `AiEngine` routing loop down to `StubProvider` — no capability helper is
 * mocked. The config resolver IS mocked (no DB) but everything else is real.
 *
 * ## Scenarios
 *
 * 1. `generateText` returns the correct shape (`text`, `usage`, `provider`,
 *    `model`, `finishReason`).
 * 2. Provider order fallback: primary `anthropic` fails → engine falls back to
 *    `openai` (config-driven, no code change — AC-1 intent).
 * 3. `maxTokens` override propagates to the provider call.
 * 4. `streamText` yields chunks in order (delta events before final meta).
 * 5. Soft-fail on empty context: when the prompt is an empty string the engine
 *    should NOT throw — it returns a valid (empty-echo) response.
 *
 * @module test/integration/engine
 */

import type { AiFeatureConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type AiEngineEvent,
    AiEngineExhaustedError,
    createAiEngine,
    createAiService
} from '../../src/engine/index.js';
import type { AiProvider } from '../../src/providers/ai-provider.interface.js';
import { StubProvider } from '../../src/providers/index.js';

// ---------------------------------------------------------------------------
// Mock: prompt storage — no DB required (same pattern as engine.test.ts)
// ---------------------------------------------------------------------------

vi.mock('../../src/storage/prompt.storage.js', () => ({
    getActivePrompt: vi.fn().mockResolvedValue({ content: null, row: null })
}));

// ---------------------------------------------------------------------------
// Mock: config resolver — no DB required
// ---------------------------------------------------------------------------

vi.mock('../../src/config/resolver.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../src/config/resolver.js')>();
    return {
        ...original,
        resolveConfig: vi.fn(),
        resolveFeatureConfig: vi.fn(),
        getProviderOrder: vi.fn(),
        isFeatureKillSwitched: vi.fn()
    };
});

import * as configResolver from '../../src/config/resolver.js';

const mockResolveConfig = configResolver.resolveConfig as ReturnType<typeof vi.fn>;
const mockResolveFeatureConfig = configResolver.resolveFeatureConfig as ReturnType<typeof vi.fn>;
const mockIsFeatureKillSwitched = configResolver.isFeatureKillSwitched as ReturnType<typeof vi.fn>;
const mockGetProviderOrder = configResolver.getProviderOrder as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FEATURE_CONFIG_ANTHROPIC_PRIMARY: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'anthropic',
    fallbackChain: ['openai'],
    model: 'claude-3-5-haiku-20241022',
    params: {}
};

const FEATURE_CONFIG_OPENAI_PRIMARY: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: ['anthropic'],
    model: 'gpt-4o-mini',
    params: {}
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a failing provider that throws a retryable 503 error on every call.
 */
function makeRetryableFailingProvider(id: AiProvider['id']): AiProvider {
    const stub = new StubProvider();
    const retryableErr = new Error('503 Service Unavailable');
    return {
        id,
        generateText: () => Promise.reject(retryableErr),
        streamText: () => Promise.reject(retryableErr),
        generateObject: () => Promise.reject(retryableErr),
        extractIntent: () => Promise.reject(retryableErr),
        moderate: () => Promise.reject(retryableErr),
        embed: () => stub.embed({ text: '' })
    };
}

// ---------------------------------------------------------------------------
// beforeEach — reset mocks to sane defaults
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();

    // Default: no provider kill-switches active
    mockResolveConfig.mockResolvedValue({ providers: {}, features: {} });
    // Default: chat feature with openai primary
    mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_OPENAI_PRIMARY);
    mockIsFeatureKillSwitched.mockImplementation((cfg: AiFeatureConfig) => !cfg.enabled);
    mockGetProviderOrder.mockImplementation(
        ({ featureConfig }: { featureConfig: AiFeatureConfig }) => ({
            providers: [featureConfig.primaryProvider, ...featureConfig.fallbackChain]
        })
    );
});

// ---------------------------------------------------------------------------
// AC-1 (1): generateText response shape
// ---------------------------------------------------------------------------

describe('AC-1 — engine response shape', () => {
    it('should return correct GenerateTextResponse shape from StubProvider', async () => {
        // Arrange
        const stub = new StubProvider();
        const engine = createAiEngine({
            getProvider: () => stub
        });

        // Act
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Mejorar texto de prueba'
        });

        // Assert — all required fields present
        expect(typeof result.text).toBe('string');
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.usage).toBeDefined();
        expect(typeof result.usage.promptTokens).toBe('number');
        expect(typeof result.usage.completionTokens).toBe('number');
        expect(typeof result.usage.totalTokens).toBe('number');
        expect(result.usage.totalTokens).toBe(
            result.usage.promptTokens + result.usage.completionTokens
        );
        expect(result.provider).toBe('stub');
        expect(result.model).toBe('stub-model-v1');
        expect(result.finishReason).toBe('stop');
    });

    it('should echo the feature name in the text (deterministic stub contract)', async () => {
        // Arrange
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        // Act
        const result = await engine.generateText({
            feature: 'chat',
            locale: 'es',
            prompt: 'hola mundo'
        });

        // Assert — stub determinism: text contains feature tag
        expect(result.text).toContain('[stub:chat]');
        expect(result.text).toContain('hola mundo');
    });

    it('should return the same shape for AiService.generateText (facade wraps engine)', async () => {
        // Arrange — exercise AiService facade, not just raw engine
        const service = createAiService({ getProvider: () => new StubProvider() });

        // Act
        const result = await service.generateText({
            feature: 'text_improve',
            prompt: 'Fix grammar'
        });

        // Assert
        expect(result.text).toBeDefined();
        expect(result.provider).toBe('stub');
        expect(result.finishReason).toBe('stop');
    });
});

// ---------------------------------------------------------------------------
// AC-1 (2): provider order fallback (Anthropic → OpenAI) via config change
// ---------------------------------------------------------------------------

describe('AC-1 — provider-order fallback (config-driven, no code change)', () => {
    it('should fall back from anthropic to openai when anthropic fails (retryable)', async () => {
        // Arrange — config says anthropic primary → openai fallback
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_ANTHROPIC_PRIMARY);

        const failingAnthropic = makeRetryableFailingProvider('anthropic');
        const workingOpenAi = new StubProvider();
        // Wrap StubProvider with 'openai' id — class methods are not enumerable
        // so spread ({ ...stub }) loses them. Use explicit delegation instead.
        const openAiProvider: AiProvider = {
            id: 'openai',
            generateText: (req) => workingOpenAi.generateText(req),
            streamText: (req) => workingOpenAi.streamText(req),
            generateObject: (req, schema) => workingOpenAi.generateObject(req, schema),
            extractIntent: (req) => workingOpenAi.extractIntent(req),
            moderate: (req) => workingOpenAi.moderate(req),
            embed: (req) => workingOpenAi.embed(req)
        };

        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: (id) => {
                if (id === 'anthropic') return failingAnthropic;
                if (id === 'openai') return openAiProvider;
                return new StubProvider();
            },
            recordEvent: (e) => events.push(e)
        });

        // Act
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'test fallback'
        });

        // Assert — result came from openai after anthropic failed
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();

        // A fallback event was recorded — provider order changed via config, not code
        const fallbackEvents = events.filter((e) => e.type === 'fallback');
        expect(fallbackEvents).toHaveLength(1);
        expect(fallbackEvents[0]).toMatchObject({
            type: 'fallback',
            feature: 'text_improve',
            fromProvider: 'anthropic',
            toProvider: 'openai'
        });
    });

    it('should succeed with openai as primary (no fallback) when config switches primary', async () => {
        // Arrange — config now says openai primary (simulates admin changing the setting)
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_OPENAI_PRIMARY);

        const stub = new StubProvider();
        const openAiProvider: AiProvider = {
            id: 'openai',
            generateText: (req) => stub.generateText(req),
            streamText: (req) => stub.streamText(req),
            generateObject: (req, schema) => stub.generateObject(req, schema),
            extractIntent: (req) => stub.extractIntent(req),
            moderate: (req) => stub.moderate(req),
            embed: (req) => stub.embed(req)
        };
        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: () => openAiProvider,
            recordEvent: (e) => events.push(e)
        });

        // Act
        const result = await engine.generateText({
            feature: 'chat',
            locale: 'es',
            prompt: 'test with openai primary'
        });

        // Assert — success, no fallback event
        expect(result).toBeDefined();
        const fallbackEvents = events.filter((e) => e.type === 'fallback');
        expect(fallbackEvents).toHaveLength(0);
        const successEvents = events.filter((e) => e.type === 'success');
        expect(successEvents).toHaveLength(1);
    });

    it('should throw AiEngineExhaustedError when all providers in chain fail', async () => {
        // Arrange — both anthropic and openai fail
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_ANTHROPIC_PRIMARY);

        const failingAnthropic = makeRetryableFailingProvider('anthropic');
        const failingOpenAi = makeRetryableFailingProvider('openai');

        const engine = createAiEngine({
            getProvider: (id) => {
                if (id === 'anthropic') return failingAnthropic;
                return failingOpenAi;
            }
        });

        // Act + Assert
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).rejects.toThrow(AiEngineExhaustedError);
    });
});

// ---------------------------------------------------------------------------
// AC-1 (3): maxTokens override propagates
// ---------------------------------------------------------------------------

describe('AC-1 — maxTokens override in params', () => {
    it('should accept params with maxTokens in the feature config', async () => {
        // Arrange — config with maxTokens param set
        const configWithMaxTokens: AiFeatureConfig = {
            ...FEATURE_CONFIG_OPENAI_PRIMARY,
            params: { maxTokens: 100 }
        };
        mockResolveFeatureConfig.mockResolvedValue(configWithMaxTokens);

        let capturedRequest: unknown;
        const trackingProvider: AiProvider = {
            id: 'openai',
            generateText: (req) => {
                capturedRequest = req;
                return new StubProvider().generateText(req);
            },
            streamText: (req) => new StubProvider().streamText(req),
            generateObject: (req, schema) => new StubProvider().generateObject(req, schema),
            extractIntent: (req) => new StubProvider().extractIntent(req),
            moderate: (req) => new StubProvider().moderate(req),
            embed: (req) => new StubProvider().embed(req)
        };

        const engine = createAiEngine({ getProvider: () => trackingProvider });

        // Act
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Shorten this text',
            params: { maxTokens: 100 }
        });

        // Assert — the call succeeded and params were present on the request
        expect(result).toBeDefined();
        expect(capturedRequest).toBeDefined();
        expect((capturedRequest as { params?: { maxTokens?: number } }).params?.maxTokens).toBe(
            100
        );
    });
});

// ---------------------------------------------------------------------------
// AC-1 (4): stream event order — chunks before meta resolves
// ---------------------------------------------------------------------------

describe('AC-1 — streamText event ordering', () => {
    it('should yield delta chunks before meta resolves', async () => {
        // Arrange
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        // Act
        const { stream, meta } = await engine.streamText({
            feature: 'chat',
            locale: 'es',
            prompt: 'Stream me tokens'
        });

        // Collect all chunks
        const chunks: string[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk.delta);
        }

        // Meta resolves AFTER stream is drained
        const finalMeta = await meta;

        // Assert — chunks arrived, then meta resolved
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.every((c) => typeof c === 'string')).toBe(true);

        // Concatenated chunks reconstruct the full echo text
        const fullText = chunks.join('');
        expect(fullText).toContain('[stub:chat]');
        expect(fullText).toContain('Stream me tokens');

        // Meta shape is valid
        expect(finalMeta.provider).toBe('stub');
        expect(finalMeta.model).toBe('stub-model-v1');
        expect(finalMeta.finishReason).toBe('stop');
        expect(finalMeta.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should yield exactly 3 chunks for StubProvider (deterministic split)', async () => {
        // Arrange
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        // Act
        const { stream } = await engine.streamText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Hello World test'
        });

        const chunks: string[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk.delta);
        }

        // Assert — stub always produces 3 chunks
        expect(chunks).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// AC-1 (5): soft-fail on empty context / empty prompt
// ---------------------------------------------------------------------------

describe('AC-1 — soft-fail on empty context (empty prompt)', () => {
    it('should NOT throw when prompt is an empty string', async () => {
        // Arrange
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        // Act — empty string prompt, should not throw
        const act = engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: ''
        });

        // Assert — resolves without error
        await expect(act).resolves.toBeDefined();
    });

    it('should return a valid GenerateTextResponse with empty prompt', async () => {
        // Arrange
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        // Act
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: ''
        });

        // Assert — all required fields still present
        expect(typeof result.text).toBe('string');
        expect(result.provider).toBe('stub');
        expect(result.finishReason).toBe('stop');
    });

    it('should NOT throw when messages array is empty', async () => {
        // Arrange
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        // Act — empty messages array (no context)
        const act = engine.generateText({
            feature: 'chat',
            locale: 'es',
            messages: []
        });

        // Assert — resolves without error
        await expect(act).resolves.toBeDefined();
    });
});
