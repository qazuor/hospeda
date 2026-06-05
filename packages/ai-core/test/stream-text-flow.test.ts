/**
 * Tests for streamText capability + stream moderation (SPEC-173 T-024).
 *
 * All tests use the config resolver mock (no DB required). Providers are wired
 * via the `makeEngine` / `makeService` helpers following the same pattern as
 * `moderation-flow.test.ts`.
 *
 * ## Coverage
 *
 * 1. `executeStreamText` locale defaulting — uses `defaultLocale` when
 *    `request.locale` is absent; preserves explicit locale.
 * 2. `service.streamText` exists on the facade and returns `{ stream, meta }`;
 *    StubProvider yields 3 chunks; concatenated text equals stub echo; `meta`
 *    resolves after drain with stub usage.
 * 3. Flagged INPUT → throws `AiModerationBlockedError` direction 'input' BEFORE
 *    the generation provider's `streamText` is called (assert via spy).
 * 4. Flagged OUTPUT → all chunks yielded first, THEN the for-await throws
 *    `AiModerationBlockedError` direction 'output'; `moderation_blocked` event
 *    recorded.
 * 5. Output moderation fail-open → moderation provider throws on the output call
 *    → stream completes without throwing; `moderation_error` event recorded.
 * 6. Clean run → moderation called exactly twice (input + output).
 * 7. Pre-stream fallback + moderation active → primary provider's `streamText`
 *    rejects with a retryable error → fallback provider serves the stream;
 *    fallback event recorded, chunks arrive correctly.
 * 8. Ceiling-first order → `checkCeiling` throws → moderation never called.
 *
 * @module test/stream-text-flow
 */

import type { AiFeatureConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStreamText } from '../src/capabilities/stream-text.capability.js';
import {
    AiCeilingHitError,
    AiModerationBlockedError,
    createAiEngine,
    createAiService
} from '../src/engine/index.js';
import type { AiEngine, AiEngineEvent, AiService } from '../src/engine/index.js';
import type { AiProvider, StreamTextResult } from '../src/providers/ai-provider.interface.js';
import { StubProvider } from '../src/providers/index.js';

// ---------------------------------------------------------------------------
// Mock: config resolver — no DB required
// ---------------------------------------------------------------------------

vi.mock('../src/config/resolver.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/config/resolver.js')>();
    return {
        ...original,
        resolveConfig: vi.fn(),
        resolveFeatureConfig: vi.fn(),
        getProviderOrder: vi.fn(),
        isFeatureKillSwitched: vi.fn()
    };
});

import * as configResolver from '../src/config/resolver.js';

const mockResolveConfig = configResolver.resolveConfig as ReturnType<typeof vi.fn>;
const mockResolveFeatureConfig = configResolver.resolveFeatureConfig as ReturnType<typeof vi.fn>;
const mockIsFeatureKillSwitched = configResolver.isFeatureKillSwitched as ReturnType<typeof vi.fn>;
const mockGetProviderOrder = configResolver.getProviderOrder as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FEATURE_CONFIG_ENABLED: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'stub',
    fallbackChain: [],
    model: 'stub-model-v1',
    params: {}
};

// ---------------------------------------------------------------------------
// Engine + Service factory helpers
// ---------------------------------------------------------------------------

/**
 * Creates an engine where:
 * - `generationProvider` (id='stub') handles `streamText`.
 * - `moderationProvider` (id='openai') handles `moderate`.
 * - Events are optionally collected into `events`.
 * - Optional `checkCeiling` + `getNow` for ceiling tests.
 */
function makeEngine(overrides: {
    generationProvider?: AiProvider;
    moderationProvider?: AiProvider;
    events?: AiEngineEvent[];
    throwOnGetModProvider?: boolean;
    checkCeiling?: (input: { feature: string; now: Date }) => Promise<void>;
    getNow?: () => Date;
}): AiEngine {
    const {
        generationProvider = new StubProvider(),
        moderationProvider = new StubProvider(),
        events,
        throwOnGetModProvider = false,
        checkCeiling,
        getNow
    } = overrides;

    return createAiEngine({
        getProvider: (id) => {
            if (id === 'openai') {
                if (throwOnGetModProvider) {
                    throw new Error('Moderation provider not configured');
                }
                return moderationProvider;
            }
            if (id === 'stub') {
                return generationProvider;
            }
            throw new Error(`No provider for id: ${id}`);
        },
        moderationProviderId: 'openai',
        recordEvent: events ? (e) => events.push(e) : undefined,
        checkCeiling,
        getNow
    });
}

/**
 * Creates an AiService backed by the same provider wiring as `makeEngine`.
 */
function makeService(overrides: {
    generationProvider?: AiProvider;
    moderationProvider?: AiProvider;
    events?: AiEngineEvent[];
    defaultLocale?: 'es' | 'en' | 'pt';
}): AiService {
    const {
        generationProvider = new StubProvider(),
        moderationProvider = new StubProvider(),
        events,
        defaultLocale = 'es'
    } = overrides;

    return createAiService({
        getProvider: (id) => {
            if (id === 'openai') return moderationProvider;
            if (id === 'stub') return generationProvider;
            throw new Error(`No provider for id: ${id}`);
        },
        moderationProviderId: 'openai',
        recordEvent: events ? (e) => events.push(e) : undefined,
        defaultLocale
    });
}

/** Drains an `AsyncIterable<{delta: string}>` and returns the concatenated text. */
async function drainStream(stream: AsyncIterable<{ delta: string }>): Promise<string> {
    let text = '';
    for await (const chunk of stream) {
        text += chunk.delta;
    }
    return text;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    mockResolveConfig.mockResolvedValue({ providers: {}, features: {} });
    mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_ENABLED);
    mockIsFeatureKillSwitched.mockImplementation((cfg: AiFeatureConfig) => !cfg.enabled);
    mockGetProviderOrder.mockImplementation(
        ({ featureConfig }: { featureConfig: AiFeatureConfig }) => ({
            providers: [featureConfig.primaryProvider, ...featureConfig.fallbackChain]
        })
    );
});

// ---------------------------------------------------------------------------
// 1. executeStreamText locale defaulting
// ---------------------------------------------------------------------------

describe('executeStreamText locale defaulting', () => {
    it('should fill in defaultLocale when request.locale is absent', async () => {
        // Arrange
        const engine = makeEngine({});
        const engineSpy = vi.spyOn(engine, 'streamText');

        // Act
        await executeStreamText({
            request: { feature: 'chat', prompt: 'Hello' },
            defaultLocale: 'pt',
            engine
        });

        // Assert — engine was called with locale 'pt'
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'pt' }));
    });

    it('should preserve explicit locale when request.locale is provided', async () => {
        // Arrange
        const engine = makeEngine({});
        const engineSpy = vi.spyOn(engine, 'streamText');

        // Act
        await executeStreamText({
            request: { feature: 'chat', prompt: 'Hello', locale: 'en' },
            defaultLocale: 'pt',
            engine
        });

        // Assert — explicit 'en' is NOT overridden
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
    });
});

// ---------------------------------------------------------------------------
// 2. service.streamText facade — basic happy path
// ---------------------------------------------------------------------------

describe('service.streamText facade', () => {
    it('should exist on the AiService interface', () => {
        // Arrange + Act
        const service = makeService({});

        // Assert
        expect(typeof service.streamText).toBe('function');
    });

    it('should return { stream, meta } with stream yielding 3 chunks and meta resolving after drain', async () => {
        // Arrange
        const service = makeService({});

        // Act
        const result = await service.streamText({
            feature: 'chat',
            prompt: 'Tell me about Concepción del Uruguay'
        });

        // Assert — result has the correct shape
        expect(result).toHaveProperty('stream');
        expect(result).toHaveProperty('meta');

        // Collect all chunks
        const chunks: string[] = [];
        for await (const chunk of result.stream) {
            chunks.push(chunk.delta);
        }

        // StubProvider splits into exactly 3 chunks
        expect(chunks).toHaveLength(3);

        // Concatenated text equals the stub echo
        const fullText = chunks.join('');
        expect(fullText).toContain('[stub:chat]');
        expect(fullText).toContain('Tell me about Concepción del Uruguay');

        // meta resolves with stub usage after drain
        const meta = await result.meta;
        expect(meta.usage.promptTokens).toBe(10);
        expect(meta.usage.completionTokens).toBe(20);
        expect(meta.usage.totalTokens).toBe(30);
        expect(meta.provider).toBe('stub');
        expect(meta.model).toBe('stub-model-v1');
        expect(meta.finishReason).toBe('stop');
    });

    it('should use defaultLocale when request.locale is omitted', async () => {
        // Arrange
        const service = makeService({ defaultLocale: 'pt' });
        const engineSpy = vi.spyOn(service.engine, 'streamText');

        // Act
        await service.streamText({ feature: 'chat', prompt: 'Olá' });

        // Assert
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'pt' }));
    });

    it('should preserve explicit locale when provided', async () => {
        // Arrange
        const service = makeService({ defaultLocale: 'es' });
        const engineSpy = vi.spyOn(service.engine, 'streamText');

        // Act
        await service.streamText({ feature: 'chat', prompt: 'Hello', locale: 'en' });

        // Assert
        expect(engineSpy).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
    });
});

// ---------------------------------------------------------------------------
// 3. Flagged INPUT → AiModerationBlockedError before stream opens
// ---------------------------------------------------------------------------

describe('when streamText input is flagged by moderation', () => {
    it('should throw AiModerationBlockedError direction "input" before streamText is called on the provider', async () => {
        // Arrange
        const streamTextSpy = vi.fn();
        const generationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'stub',
            streamText: streamTextSpy
        };
        // StubProvider flags any input containing '[stub:flagged]'
        const moderationProvider = new StubProvider();
        const events: AiEngineEvent[] = [];
        const service = makeService({ generationProvider, moderationProvider, events });

        // Act + Assert
        await expect(
            service.streamText({
                feature: 'chat',
                prompt: 'bad content [stub:flagged]'
            })
        ).rejects.toThrow(AiModerationBlockedError);

        // Generation provider's streamText was NEVER called
        expect(streamTextSpy).not.toHaveBeenCalled();

        // A moderation_blocked event was recorded for direction 'input'
        const blocked = events.find((e) => e.type === 'moderation_blocked');
        expect(blocked).toBeDefined();
        expect(blocked).toMatchObject({
            type: 'moderation_blocked',
            feature: 'chat',
            direction: 'input'
        });
    });

    it('should set engineCode MODERATION_BLOCKED and direction "input" on the thrown error', async () => {
        // Arrange
        const service = makeService({ moderationProvider: new StubProvider() });

        // Act
        let caught: AiModerationBlockedError | undefined;
        try {
            await service.streamText({
                feature: 'chat',
                prompt: '[stub:flagged] offensive input'
            });
        } catch (err) {
            caught = err as AiModerationBlockedError;
        }

        // Assert
        expect(caught).toBeInstanceOf(AiModerationBlockedError);
        expect(caught?.engineCode).toBe('MODERATION_BLOCKED');
        expect(caught?.direction).toBe('input');
        expect(caught?.feature).toBe('chat');
    });
});

// ---------------------------------------------------------------------------
// 4. Flagged OUTPUT → chunks yielded, then throws from generator
// ---------------------------------------------------------------------------

describe('when streamText output is flagged by moderation', () => {
    it('should yield all chunks first, then throw AiModerationBlockedError direction "output"', async () => {
        // Arrange: moderation provider flags only output text (text containing 'FLAGME')
        const flaggingModerateSpy = vi.fn().mockImplementation(async (req: { input: string }) => ({
            flagged: req.input.includes('FLAGME'),
            categories: req.input.includes('FLAGME') ? { test: true } : {}
        }));
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: flaggingModerateSpy
        };

        // Generation provider produces output containing the FLAGME marker
        const flaggedFullText = 'chunk1 FLAGME rest';
        const third = Math.ceil(flaggedFullText.length / 3);
        const flaggedChunks = [
            { delta: flaggedFullText.slice(0, third) },
            { delta: flaggedFullText.slice(third, third * 2) },
            { delta: flaggedFullText.slice(third * 2) }
        ];
        async function* makeStream() {
            for (const c of flaggedChunks) {
                yield c;
            }
        }
        const streamTextSpy = vi.fn().mockResolvedValue({
            stream: makeStream(),
            meta: Promise.resolve({
                usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
                provider: 'stub',
                model: 'stub-model-v1',
                finishReason: 'stop'
            })
        } satisfies StreamTextResult);

        const generationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'stub',
            streamText: streamTextSpy
        };

        const events: AiEngineEvent[] = [];
        const service = makeService({ generationProvider, moderationProvider, events });

        // Act — stream with clean input
        const result = await service.streamText({
            feature: 'chat',
            prompt: 'clean input, output will be flagged'
        });

        // Collect chunks and catch the final throw
        const collected: string[] = [];
        let caught: AiModerationBlockedError | undefined;

        try {
            for await (const chunk of result.stream) {
                collected.push(chunk.delta);
            }
        } catch (err) {
            caught = err as AiModerationBlockedError;
        }

        // Assert — all 3 chunks were yielded BEFORE the error
        expect(collected).toHaveLength(3);
        expect(collected.join('')).toContain('FLAGME');

        // Generator threw AiModerationBlockedError with direction 'output'
        expect(caught).toBeInstanceOf(AiModerationBlockedError);
        expect(caught?.direction).toBe('output');
        expect(caught?.engineCode).toBe('MODERATION_BLOCKED');

        // moderation_blocked event was recorded
        const blocked = events.find((e) => e.type === 'moderation_blocked');
        expect(blocked).toBeDefined();
        expect(blocked).toMatchObject({
            type: 'moderation_blocked',
            direction: 'output'
        });
    });
});

// ---------------------------------------------------------------------------
// 5. Output moderation fail-open → stream completes, moderation_error event
// ---------------------------------------------------------------------------

describe('when output moderation provider throws after stream ends', () => {
    it('should complete the stream without throwing and record a moderation_error event', async () => {
        // Arrange: input moderation passes; output moderation throws
        let callCount = 0;
        const conditionalModerateSpy = vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount >= 2) {
                // Second call = output moderation → throw to simulate provider failure
                throw new Error('Output moderation network failure');
            }
            // First call = input moderation → clean
            return { flagged: false, categories: {} };
        });

        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: conditionalModerateSpy
        };

        const events: AiEngineEvent[] = [];
        const service = makeService({ moderationProvider, events });

        // Act
        const result = await service.streamText({ feature: 'chat', prompt: 'hello' });

        // Drain the stream — should NOT throw despite output moderation failure
        let threw = false;
        const chunks: string[] = [];
        try {
            for await (const chunk of result.stream) {
                chunks.push(chunk.delta);
            }
        } catch {
            threw = true;
        }

        // Assert — stream completed normally (fail-open)
        expect(threw).toBe(false);
        expect(chunks.length).toBeGreaterThan(0);

        // moderation_error event was recorded for output direction
        const errorEvents = events.filter((e) => e.type === 'moderation_error');
        expect(errorEvents.length).toBeGreaterThanOrEqual(1);
        expect(errorEvents[0]).toMatchObject({
            type: 'moderation_error',
            direction: 'output'
        });
    });
});

// ---------------------------------------------------------------------------
// 6. Clean run → moderate called exactly twice (input + output)
// ---------------------------------------------------------------------------

describe('when streamText input and output are both clean', () => {
    it('should call moderate exactly twice (input + output) on a clean run', async () => {
        // Arrange
        const moderateSpy = vi.fn().mockResolvedValue({ flagged: false, categories: {} });
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderateSpy
        };
        const service = makeService({ moderationProvider });

        // Act
        const result = await service.streamText({ feature: 'chat', prompt: 'clean prompt' });
        await drainStream(result.stream);

        // Assert — exactly 2 moderation calls
        expect(moderateSpy).toHaveBeenCalledTimes(2);

        // First call = input moderation
        expect(moderateSpy.mock.calls[0]?.[0]).toMatchObject({ input: 'clean prompt' });
        // Second call = output moderation (the stub echo)
        expect(moderateSpy.mock.calls[1]?.[0].input).toContain('[stub:chat]');
    });
});

// ---------------------------------------------------------------------------
// 7. Fallback + moderation active → primary rejects → fallback serves stream
// ---------------------------------------------------------------------------

describe('when the primary provider streamText rejects with a retryable error', () => {
    it('should fall back to the secondary provider and serve the stream with chunks from the fallback', async () => {
        // Arrange — feature config with primary=stub + fallback=stub2
        const FEATURE_CONFIG_WITH_FALLBACK: AiFeatureConfig = {
            enabled: true,
            primaryProvider: 'stub',
            fallbackChain: ['stub2' as AiFeature],
            model: 'stub-model-v1',
            params: {}
        };
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_WITH_FALLBACK);
        mockGetProviderOrder.mockImplementation(
            ({ featureConfig }: { featureConfig: AiFeatureConfig }) => ({
                providers: [featureConfig.primaryProvider, ...featureConfig.fallbackChain]
            })
        );

        // Primary provider always rejects with a retryable error (rate-limit-style)
        const primaryStreamTextSpy = vi
            .fn()
            .mockRejectedValue(Object.assign(new Error('rate_limit_exceeded'), { status: 429 }));
        const primaryProvider: AiProvider = {
            ...new StubProvider(),
            id: 'stub',
            streamText: primaryStreamTextSpy
        };

        // Fallback provider serves a real stream
        const fallbackProvider: AiProvider = new StubProvider();

        const events: AiEngineEvent[] = [];

        const engine = createAiEngine({
            getProvider: (id) => {
                if (id === 'openai') return new StubProvider();
                if (id === 'stub') return primaryProvider;
                if (id === 'stub2') return fallbackProvider;
                throw new Error(`Unknown provider: ${id}`);
            },
            moderationProviderId: 'openai',
            recordEvent: (e) => events.push(e)
        });

        // Act
        const result = await engine.streamText({
            feature: 'chat',
            locale: 'es',
            prompt: 'fallback test prompt'
        });

        // Drain the stream
        const text = await drainStream(result.stream);

        // Assert — chunks came from the fallback (StubProvider echo)
        expect(text).toContain('[stub:chat]');
        expect(text).toContain('fallback test prompt');

        // A fallback event was recorded
        const fallbackEvent = events.find((e) => e.type === 'fallback');
        expect(fallbackEvent).toBeDefined();
        expect(fallbackEvent).toMatchObject({
            type: 'fallback',
            feature: 'chat',
            fromProvider: 'stub',
            toProvider: 'stub2'
        });
    });
});

// ---------------------------------------------------------------------------
// 8. Ceiling-first order → checkCeiling throws → moderation never called
// ---------------------------------------------------------------------------

describe('when checkCeiling throws before moderation runs', () => {
    it('should throw AiCeilingHitError and never call the moderation provider', async () => {
        // Arrange
        const ceilingErr = new AiCeilingHitError({
            scope: 'global',
            spentMicroUsd: 500_000_000,
            ceilingMicroUsd: 500_000_000
        });
        const checkCeiling = vi.fn().mockRejectedValue(ceilingErr);
        const getNow = () => new Date();

        const moderateSpy = vi.fn().mockResolvedValue({ flagged: false, categories: {} });
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderateSpy
        };

        const engine = makeEngine({ moderationProvider, checkCeiling, getNow });

        // Act + Assert
        await expect(
            engine.streamText({ feature: 'chat', locale: 'es', prompt: 'hello' })
        ).rejects.toThrow(AiCeilingHitError);

        // Moderation was NEVER called — ceiling fires first
        expect(moderateSpy).not.toHaveBeenCalled();
    });
});
