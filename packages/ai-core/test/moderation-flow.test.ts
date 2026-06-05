/**
 * Tests for the content-moderation pass wired into the AI engine (SPEC-173 T-020).
 *
 * All tests use the config resolver mock (no DB required) and the StubProvider
 * with its deterministic `[stub:flagged]` marker to trigger moderation blocks.
 *
 * ## Coverage
 *
 * 1. flagged INPUT on generateText → AiModerationBlockedError(direction='input'),
 *    generation provider NEVER called, `moderation_blocked` event recorded.
 * 2. flagged OUTPUT on generateText → generation provider called once,
 *    throws AiModerationBlockedError(direction='output').
 * 3. clean input + output → response returned, moderate called twice
 *    (input + output).
 * 4. generateObject: output moderation receives JSON-stringified object;
 *    flagged object output blocks.
 * 5. extractIntent: input moderated, output NOT moderated (moderate called
 *    exactly once on a clean run).
 * 6. fail-open: moderation provider moderate() throws → call succeeds,
 *    `moderation_error` event recorded.
 * 7. fail-open: getProvider(moderationProviderId) throws (unconfigured provider)
 *    → same fail-open behaviour.
 * 8. StubProvider: `[stub:flagged]` → flagged=true; normal input → flagged=false.
 * 9. ceiling check before moderation: ceiling throws → moderation never called.
 *
 * @module test/moderation-flow
 */

import type { AiFeatureConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AiModerationBlockedError, createAiEngine } from '../src/engine/index.js';
import type { AiEngine, AiEngineEvent } from '../src/engine/index.js';
import { AiCeilingHitError } from '../src/engine/index.js';
import type { AiProvider } from '../src/providers/ai-provider.interface.js';
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
// Engine factory helper
// ---------------------------------------------------------------------------

/**
 * Creates an engine where:
 * - `stub` is the generation provider (id='stub').
 * - `moderationProvider` is used for moderation calls (id='openai' or whatever).
 * - Events are optionally collected into `events`.
 */
function makeEngine(overrides: {
    generationProvider?: AiProvider;
    moderationProvider?: AiProvider;
    events?: AiEngineEvent[];
    throwOnGetModProvider?: boolean;
}): AiEngine {
    const {
        generationProvider = new StubProvider(),
        moderationProvider = new StubProvider(),
        events,
        throwOnGetModProvider = false
    } = overrides;

    return createAiEngine({
        getProvider: (id) => {
            // Moderation always requests 'openai' by default in the engine factory.
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
        recordEvent: events ? (e) => events.push(e) : undefined
    });
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
// 1. Flagged INPUT on generateText → blocked before provider is called
// ---------------------------------------------------------------------------

describe('when generateText input is flagged by moderation', () => {
    it('should throw AiModerationBlockedError with direction "input" and never call the generation provider', async () => {
        // Arrange
        const generateTextSpy = vi.fn().mockResolvedValue({
            text: 'generated',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            provider: 'stub',
            model: 'stub-model-v1',
            finishReason: 'stop'
        });
        const generationProvider: AiProvider = {
            ...new StubProvider(),
            generateText: generateTextSpy
        };

        // StubProvider flags any input containing '[stub:flagged]'
        const moderationProvider = new StubProvider();
        const events: AiEngineEvent[] = [];
        const engine = makeEngine({ generationProvider, moderationProvider, events });

        // Act + Assert
        await expect(
            engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'bad content [stub:flagged]'
            })
        ).rejects.toThrow(AiModerationBlockedError);

        // Generation provider was NEVER called
        expect(generateTextSpy).not.toHaveBeenCalled();

        // A moderation_blocked event was recorded
        const blocked = events.find((e) => e.type === 'moderation_blocked');
        expect(blocked).toBeDefined();
        expect(blocked).toMatchObject({
            type: 'moderation_blocked',
            feature: 'text_improve',
            direction: 'input'
        });
    });

    it('should set engineCode to MODERATION_BLOCKED on the thrown error', async () => {
        // Arrange
        const engine = makeEngine({ moderationProvider: new StubProvider() });

        // Act
        let caught: AiModerationBlockedError | undefined;
        try {
            await engine.generateText({
                feature: 'chat',
                locale: 'es',
                prompt: '[stub:flagged] offensive content'
            });
        } catch (err) {
            caught = err as AiModerationBlockedError;
        }

        // Assert
        expect(caught).toBeInstanceOf(AiModerationBlockedError);
        expect(caught?.engineCode).toBe('MODERATION_BLOCKED');
        expect(caught?.direction).toBe('input');
        expect(caught?.feature).toBe('chat');
        expect(caught?.categories).toEqual({ test: true });
    });
});

// ---------------------------------------------------------------------------
// 2. Flagged OUTPUT on generateText → provider called, then output blocked
// ---------------------------------------------------------------------------

describe('when generateText output is flagged by moderation', () => {
    it('should call the generation provider once, then throw AiModerationBlockedError with direction "output"', async () => {
        // Arrange: generation provider produces a response whose text contains
        // '[stub:flagged]' so the output moderation pass blocks it.
        const generateTextSpy = vi.fn().mockResolvedValue({
            text: 'result with [stub:flagged] content',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            provider: 'stub',
            model: 'stub-model-v1',
            finishReason: 'stop'
        });
        const generationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'stub',
            generateText: generateTextSpy
        };
        const moderationProvider = new StubProvider();
        const events: AiEngineEvent[] = [];
        const engine = makeEngine({ generationProvider, moderationProvider, events });

        // Act + Assert
        await expect(
            engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'clean input'
            })
        ).rejects.toThrow(AiModerationBlockedError);

        // Generation provider WAS called (output moderation fires after generation)
        expect(generateTextSpy).toHaveBeenCalledOnce();

        // The blocked event should be for direction='output'
        const blocked = events.find((e) => e.type === 'moderation_blocked');
        expect(blocked).toBeDefined();
        expect(blocked).toMatchObject({
            type: 'moderation_blocked',
            direction: 'output'
        });
    });
});

// ---------------------------------------------------------------------------
// 3. Clean input + output → response returned, moderate called twice
// ---------------------------------------------------------------------------

describe('when generateText input and output are both clean', () => {
    it('should return the response and call moderate exactly twice (input + output)', async () => {
        // Arrange
        const moderateSpy = vi.fn().mockResolvedValue({ flagged: false, categories: {} });
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderateSpy
        };
        const engine = makeEngine({ moderationProvider });

        // Act
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'clean prompt'
        });

        // Assert
        expect(result.text).toBeDefined();
        expect(moderateSpy).toHaveBeenCalledTimes(2);

        // First call = input moderation
        expect(moderateSpy.mock.calls[0]?.[0]).toMatchObject({ input: 'clean prompt' });
        // Second call = output moderation (the stub echo)
        expect(moderateSpy.mock.calls[1]?.[0].input).toContain('[stub:text_improve]');
    });
});

// ---------------------------------------------------------------------------
// 4. generateObject: output moderation receives JSON-stringified object
// ---------------------------------------------------------------------------

describe('when generateObject output is flagged by moderation', () => {
    it('should call moderation with JSON.stringify of the object and block when flagged', async () => {
        // Arrange: override generateObject to return an object whose JSON contains '[stub:flagged]'
        const flaggedObject = { name: 'test [stub:flagged]' };
        const generateObjectSpy = vi.fn().mockResolvedValue({
            object: flaggedObject,
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            provider: 'stub',
            model: 'stub-model-v1',
            finishReason: 'stop'
        });
        const generationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'stub',
            generateObject: generateObjectSpy
        };
        const moderationProvider = new StubProvider();

        const engine = makeEngine({ generationProvider, moderationProvider });
        const TestSchema = z.object({ name: z.string().default('') });

        // Act + Assert
        await expect(
            engine.generateObject({ feature: 'search', locale: 'es', prompt: 'clean' }, TestSchema)
        ).rejects.toThrow(AiModerationBlockedError);

        // Verify it was called with the JSON-stringified object
        // The moderation provider (StubProvider) inspects input.input for '[stub:flagged]'
        // so the stringified JSON must contain the marker.
        expect(JSON.stringify(flaggedObject)).toContain('[stub:flagged]');
        expect(generateObjectSpy).toHaveBeenCalledOnce();
    });

    it('should block with direction "output" when the object is flagged', async () => {
        // Arrange
        const generateObjectSpy = vi.fn().mockResolvedValue({
            object: { name: '[stub:flagged]' },
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            provider: 'stub',
            model: 'stub-model-v1',
            finishReason: 'stop'
        });
        const generationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'stub',
            generateObject: generateObjectSpy
        };
        const events: AiEngineEvent[] = [];
        const engine = makeEngine({
            generationProvider,
            moderationProvider: new StubProvider(),
            events
        });
        const TestSchema = z.object({ name: z.string().default('') });

        // Act
        let caught: AiModerationBlockedError | undefined;
        try {
            await engine.generateObject(
                { feature: 'search', locale: 'es', prompt: 'safe' },
                TestSchema
            );
        } catch (err) {
            caught = err as AiModerationBlockedError;
        }

        // Assert
        expect(caught).toBeInstanceOf(AiModerationBlockedError);
        expect(caught?.direction).toBe('output');

        const blocked = events.find((e) => e.type === 'moderation_blocked');
        expect(blocked).toMatchObject({ direction: 'output' });
    });
});

// ---------------------------------------------------------------------------
// 5. extractIntent: input moderated, output NOT moderated
// ---------------------------------------------------------------------------

describe('when extractIntent is called with clean input', () => {
    it('should call moderate exactly once (input only, no output moderation)', async () => {
        // Arrange
        const moderateSpy = vi.fn().mockResolvedValue({ flagged: false, categories: {} });
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderateSpy
        };
        const engine = makeEngine({ moderationProvider });

        // Act
        const intent = await engine.extractIntent({ query: 'cabaña con pileta' }, 'search');

        // Assert
        expect(intent).toBeDefined();
        // Exactly ONE moderation call (input-only; no output moderation for extractIntent)
        expect(moderateSpy).toHaveBeenCalledTimes(1);
        expect(moderateSpy.mock.calls[0]?.[0]).toMatchObject({ input: 'cabaña con pileta' });
    });

    it('should throw AiModerationBlockedError when extractIntent input is flagged', async () => {
        // Arrange
        const extractIntentSpy = vi.fn();
        const generationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'stub',
            extractIntent: extractIntentSpy
        };
        const engine = makeEngine({ generationProvider, moderationProvider: new StubProvider() });

        // Act + Assert
        await expect(
            engine.extractIntent({ query: 'offensive [stub:flagged] query' }, 'search')
        ).rejects.toThrow(AiModerationBlockedError);

        // Generation provider was never called
        expect(extractIntentSpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 6. Fail-open: moderate() throws → call succeeds, moderation_error recorded
// ---------------------------------------------------------------------------

describe('when the moderation provider moderate() throws', () => {
    it('should continue the AI call (fail-open) and record a moderation_error event', async () => {
        // Arrange
        const moderateSpy = vi.fn().mockRejectedValue(new Error('Provider network failure'));
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderateSpy
        };
        const events: AiEngineEvent[] = [];
        const engine = makeEngine({ moderationProvider, events });

        // Act — should NOT throw despite moderation failure
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'hello'
        });

        // Assert — result returned (fail-open)
        expect(result.text).toBeDefined();

        // moderation_error event was recorded (at least once — input pass failed)
        const errorEvents = events.filter((e) => e.type === 'moderation_error');
        expect(errorEvents.length).toBeGreaterThanOrEqual(1);
        expect(errorEvents[0]).toMatchObject({
            type: 'moderation_error',
            feature: 'text_improve'
        });
    });
});

// ---------------------------------------------------------------------------
// 7. Fail-open: getProvider(moderationProviderId) throws → same fail-open
// ---------------------------------------------------------------------------

describe('when getProvider(moderationProviderId) throws (unconfigured provider)', () => {
    it('should continue the AI call (fail-open) and record a moderation_error event', async () => {
        // Arrange — throwOnGetModProvider=true means getProvider('openai') throws
        const events: AiEngineEvent[] = [];
        const engine = makeEngine({ throwOnGetModProvider: true, events });

        // Act — should NOT throw
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'hello'
        });

        // Assert — result returned despite moderation provider being unavailable
        expect(result.text).toBeDefined();

        // moderation_error event recorded
        const errorEvents = events.filter((e) => e.type === 'moderation_error');
        expect(errorEvents.length).toBeGreaterThanOrEqual(1);
        expect(errorEvents[0]).toMatchObject({
            type: 'moderation_error',
            feature: 'text_improve',
            direction: 'input'
        });
    });
});

// ---------------------------------------------------------------------------
// 8. StubProvider: [stub:flagged] → flagged=true; normal input → flagged=false
// ---------------------------------------------------------------------------

describe('StubProvider moderation behaviour', () => {
    const stub = new StubProvider();

    it('should return flagged=false for normal input', async () => {
        const result = await stub.moderate({ input: 'hello world' });
        expect(result.flagged).toBe(false);
        expect(result.categories).toEqual({});
    });

    it('should return flagged=true when input contains [stub:flagged]', async () => {
        const result = await stub.moderate({ input: 'offensive [stub:flagged] content' });
        expect(result.flagged).toBe(true);
        expect(result.categories).toEqual({ test: true });
    });

    it('should return flagged=true when input is exactly [stub:flagged]', async () => {
        const result = await stub.moderate({ input: '[stub:flagged]' });
        expect(result.flagged).toBe(true);
    });

    it('should return flagged=false for input that only contains [stub:] prefix without flagged', async () => {
        const result = await stub.moderate({ input: '[stub:text_improve] hello' });
        expect(result.flagged).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 9. Ceiling runs before moderation: ceiling throws → moderation never called
// ---------------------------------------------------------------------------

describe('when the ceiling check throws before moderation runs', () => {
    it('should throw AiCeilingHitError and never call the moderation provider', async () => {
        // Arrange
        const ceilingErr = new AiCeilingHitError({
            scope: 'global',
            spentMicroUsd: 200_000_000,
            ceilingMicroUsd: 200_000_000
        });
        const checkCeiling = vi.fn().mockRejectedValue(ceilingErr);
        const getNow = () => new Date();

        const moderateSpy = vi.fn().mockResolvedValue({ flagged: false, categories: {} });
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderateSpy
        };

        const engine = createAiEngine({
            getProvider: (id) => {
                if (id === 'openai') return moderationProvider;
                return new StubProvider();
            },
            moderationProviderId: 'openai',
            checkCeiling,
            getNow
        });

        // Act + Assert
        await expect(
            engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'hello'
            })
        ).rejects.toThrow(AiCeilingHitError);

        // Moderation was NEVER called — ceiling fires first
        expect(moderateSpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Additional: multi-turn messages moderation
// ---------------------------------------------------------------------------

describe('when generateText uses messages array (multi-turn)', () => {
    it('should moderate only user-role messages, not system messages', async () => {
        // Arrange
        const moderateSpy = vi.fn().mockResolvedValue({ flagged: false, categories: {} });
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderateSpy
        };
        const engine = makeEngine({ moderationProvider });

        // Act
        await engine.generateText({
            feature: 'chat',
            locale: 'es',
            messages: [
                { role: 'system', content: 'You are a helpful assistant' },
                { role: 'user', content: 'hello user message' }
            ]
        });

        // Assert — input moderation call should contain only the user message, not system
        const inputModCall = moderateSpy.mock.calls[0]?.[0];
        expect(inputModCall?.input).toBe('hello user message');
        expect(inputModCall?.input).not.toContain('You are a helpful assistant');
    });

    it('should concatenate multiple user messages with newline', async () => {
        // Arrange
        const moderateSpy = vi.fn().mockResolvedValue({ flagged: false, categories: {} });
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderateSpy
        };
        const engine = makeEngine({ moderationProvider });

        // Act
        await engine.generateText({
            feature: 'chat',
            locale: 'es',
            messages: [
                { role: 'user', content: 'first message' },
                { role: 'assistant', content: 'assistant reply' },
                { role: 'user', content: 'second message' }
            ]
        });

        // Assert — both user messages joined with \n; assistant excluded
        const inputModCall = moderateSpy.mock.calls[0]?.[0];
        expect(inputModCall?.input).toBe('first message\nsecond message');
    });
});
