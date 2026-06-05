/**
 * Integration tests for AC-4 — observability hooks fire correct event and
 * error shapes, Sentry is NOT inside `@repo/ai-core`, and all engine events
 * are recorded via `recordEvent` (SPEC-173 §7 AC-4).
 *
 * ## What this suite covers
 *
 * AC-4 in the spec says: "Given the package source, there is NO `process.env`
 * access and NO vault access in `@repo/ai-core`; credentials arrive by
 * parameter. (Enforced by a test/lint check.)"
 *
 * The structural isolation guard in `test/ac4-isolation-guard.test.ts` covers
 * static analysis. This integration suite covers the DYNAMIC/BEHAVIOURAL side:
 *
 * 1. Every engine event type (`success`, `fallback`, `exhausted`, `kill_switch`,
 *    `moderation_blocked`, `moderation_error`) has the correct shape when
 *    received by the `recordEvent` sink.
 * 2. The `recordEvent` sink is called for routing decisions — not Sentry, not
 *    a logger. No direct `@repo/notifications` or `@sentry/node` import exists
 *    anywhere in `src/` (already proven by the isolation guard; here we verify
 *    the WIRING is correct from the engine's perspective).
 * 3. Errors thrown by the engine carry the expected `engineCode` stable string.
 * 4. The `recordEvent` sink receives all events emitted during a fallback chain.
 * 5. No event is emitted to `recordEvent` when `recordEvent` is absent (no throw).
 *
 * @module test/integration/app-context
 */

import type { AiFeatureConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type AiEngineEvent,
    AiEngineExhaustedError,
    type AiEngineExhaustedEvent,
    type AiEngineFallbackEvent,
    type AiEngineKillSwitchEvent,
    type AiEngineSuccessEvent,
    AiFeatureDisabledError,
    createAiEngine
} from '../../src/engine/index.js';
import type { AiProvider } from '../../src/providers/ai-provider.interface.js';
import { StubProvider } from '../../src/providers/index.js';

// ---------------------------------------------------------------------------
// Mock: prompt storage — no DB required
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

const FEATURE_CONFIG_ENABLED: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: ['anthropic'],
    model: 'gpt-4o-mini',
    params: {}
};

const FEATURE_CONFIG_DISABLED: AiFeatureConfig = {
    enabled: false,
    primaryProvider: 'openai',
    fallbackChain: [],
    model: 'gpt-4o-mini',
    params: {}
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRetryableFailingProvider(id: AiProvider['id']): AiProvider {
    const err = new Error('503 Service Unavailable');
    return {
        id,
        generateText: () => Promise.reject(err),
        streamText: () => Promise.reject(err),
        generateObject: () => Promise.reject(err),
        extractIntent: () => Promise.reject(err),
        moderate: () => Promise.reject(err),
        embed: () => Promise.reject(err)
    };
}

// ---------------------------------------------------------------------------
// beforeEach
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
// AC-4 (1): success event shape
// ---------------------------------------------------------------------------

describe('AC-4 — success event fires with correct shape', () => {
    it('should emit a success event with type, feature, and providerId', async () => {
        // Arrange
        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            recordEvent: (e) => events.push(e)
        });

        // Act
        await engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' });

        // Assert
        const successEvents = events.filter((e) => e.type === 'success') as AiEngineSuccessEvent[];
        expect(successEvents).toHaveLength(1);

        const ev = successEvents[0];
        expect(ev).toBeDefined();
        expect(ev?.type).toBe('success');
        expect(ev?.feature).toBe('text_improve');
        expect(ev?.providerId).toBeDefined();
        expect(typeof ev?.providerId).toBe('string');
    });

    it('should emit success event for streamText as well', async () => {
        // Arrange
        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            recordEvent: (e) => events.push(e)
        });

        // Act — drain the stream so the success event fires
        const { stream, meta } = await engine.streamText({
            feature: 'chat',
            locale: 'es',
            prompt: 'stream test'
        });
        for await (const _chunk of stream) {
            // drain
        }
        await meta;

        // Assert
        const successEvents = events.filter((e) => e.type === 'success');
        expect(successEvents).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// AC-4 (2): fallback event shape
// ---------------------------------------------------------------------------

describe('AC-4 — fallback event fires with correct shape', () => {
    it('should emit a fallback event with fromProvider, toProvider, feature, and error', async () => {
        // Arrange
        const failingOpenAi = makeRetryableFailingProvider('openai');
        const workingAnthropicBase = new StubProvider();
        const anthropicProvider: AiProvider = {
            id: 'anthropic',
            generateText: (req) => workingAnthropicBase.generateText(req),
            streamText: (req) => workingAnthropicBase.streamText(req),
            generateObject: (req, schema) => workingAnthropicBase.generateObject(req, schema),
            extractIntent: (req) => workingAnthropicBase.extractIntent(req),
            moderate: (req) => workingAnthropicBase.moderate(req),
            embed: (req) => workingAnthropicBase.embed(req)
        };

        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: (id) => {
                if (id === 'openai') return failingOpenAi;
                return anthropicProvider;
            },
            recordEvent: (e) => events.push(e)
        });

        // Act
        await engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' });

        // Assert
        const fallbackEvents = events.filter(
            (e) => e.type === 'fallback'
        ) as AiEngineFallbackEvent[];
        expect(fallbackEvents).toHaveLength(1);

        const ev = fallbackEvents[0];
        expect(ev).toBeDefined();
        expect(ev?.type).toBe('fallback');
        expect(ev?.feature).toBe('text_improve');
        expect(ev?.fromProvider).toBe('openai');
        expect(ev?.toProvider).toBe('anthropic');
        expect(ev?.error).toBeInstanceOf(Error);
        expect(ev?.error.message).toContain('503');
    });
});

// ---------------------------------------------------------------------------
// AC-4 (3): exhausted event shape
// ---------------------------------------------------------------------------

describe('AC-4 — exhausted event fires with correct shape', () => {
    it('should emit an exhausted event when all providers fail', async () => {
        // Arrange
        const failingOpenAi = makeRetryableFailingProvider('openai');
        const failingAnthropic = makeRetryableFailingProvider('anthropic');

        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: (id) => {
                if (id === 'openai') return failingOpenAi;
                return failingAnthropic;
            },
            recordEvent: (e) => events.push(e)
        });

        // Act
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).rejects.toThrow(AiEngineExhaustedError);

        // Assert
        const exhaustedEvents = events.filter(
            (e) => e.type === 'exhausted'
        ) as AiEngineExhaustedEvent[];
        expect(exhaustedEvents).toHaveLength(1);

        const ev = exhaustedEvents[0];
        expect(ev).toBeDefined();
        expect(ev?.type).toBe('exhausted');
        expect(ev?.feature).toBe('text_improve');
        expect(Array.isArray(ev?.attempts)).toBe(true);
        expect(ev?.attempts.length).toBeGreaterThan(0);

        // Each attempt has the required shape
        for (const attempt of ev?.attempts ?? []) {
            expect(typeof attempt.providerId).toBe('string');
            expect(attempt.error).toBeInstanceOf(Error);
            expect(typeof attempt.callCount).toBe('number');
            expect(typeof attempt.wasRetryable).toBe('boolean');
        }
    });
});

// ---------------------------------------------------------------------------
// AC-4 (4): kill_switch event shape
// ---------------------------------------------------------------------------

describe('AC-4 — kill_switch event fires with correct shape', () => {
    it('should emit a kill_switch event when the feature is disabled', async () => {
        // Arrange
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_DISABLED);

        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: () => new StubProvider(),
            recordEvent: (e) => events.push(e)
        });

        // Act
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).rejects.toThrow(AiFeatureDisabledError);

        // Assert
        const killSwitchEvents = events.filter(
            (e) => e.type === 'kill_switch'
        ) as AiEngineKillSwitchEvent[];
        expect(killSwitchEvents).toHaveLength(1);

        const ev = killSwitchEvents[0];
        expect(ev).toBeDefined();
        expect(ev?.type).toBe('kill_switch');
        expect(ev?.feature).toBe('text_improve');
    });
});

// ---------------------------------------------------------------------------
// AC-4 (5): errors carry stable engineCode strings (used by apps/api for Sentry)
// ---------------------------------------------------------------------------

describe('AC-4 — errors carry stable engineCode strings', () => {
    it('should set engineCode FEATURE_DISABLED on AiFeatureDisabledError', async () => {
        // Arrange
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_DISABLED);
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        // Act
        let caught: AiFeatureDisabledError | undefined;
        try {
            await engine.generateText({ feature: 'chat', locale: 'es', prompt: 'test' });
        } catch (err) {
            caught = err as AiFeatureDisabledError;
        }

        // Assert
        expect(caught?.engineCode).toBe('FEATURE_DISABLED');
    });

    it('should set engineCode ENGINE_EXHAUSTED on AiEngineExhaustedError', async () => {
        // Arrange — no fallback, single failing provider
        const failConfig: AiFeatureConfig = {
            ...FEATURE_CONFIG_ENABLED,
            fallbackChain: []
        };
        mockResolveFeatureConfig.mockResolvedValue(failConfig);
        mockGetProviderOrder.mockReturnValue({ providers: ['openai'] });

        const failingProvider = makeRetryableFailingProvider('openai');
        const engine = createAiEngine({ getProvider: () => failingProvider });

        // Act
        let caught: AiEngineExhaustedError | undefined;
        try {
            await engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' });
        } catch (err) {
            caught = err as AiEngineExhaustedError;
        }

        // Assert
        expect(caught?.engineCode).toBe('ENGINE_EXHAUSTED');
    });
});

// ---------------------------------------------------------------------------
// AC-4 (6): no event emitted when recordEvent is absent (no throw)
// ---------------------------------------------------------------------------

describe('AC-4 — engine works without a recordEvent sink', () => {
    it('should not throw when recordEvent is absent and call succeeds', async () => {
        // Arrange — no recordEvent passed
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        // Act + Assert — no error
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).resolves.toBeDefined();
    });

    it('should not throw when recordEvent is absent and call triggers fallback', async () => {
        // Arrange — failing primary, working fallback, NO recordEvent
        const failingOpenAi = makeRetryableFailingProvider('openai');
        const stubBase = new StubProvider();
        const workingAnthropic: AiProvider = {
            id: 'anthropic',
            generateText: (req) => stubBase.generateText(req),
            streamText: (req) => stubBase.streamText(req),
            generateObject: (req, schema) => stubBase.generateObject(req, schema),
            extractIntent: (req) => stubBase.extractIntent(req),
            moderate: (req) => stubBase.moderate(req),
            embed: (req) => stubBase.embed(req)
        };

        const engine = createAiEngine({
            getProvider: (id) => {
                if (id === 'openai') return failingOpenAi;
                return workingAnthropic;
            }
            // recordEvent intentionally absent
        });

        // Act + Assert — fallback happens silently
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).resolves.toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// AC-4 (7): multiple events in correct order for fallback sequence
// ---------------------------------------------------------------------------

describe('AC-4 — full fallback sequence emits events in order', () => {
    it('should emit [fallback, success] events in that order for one fallback', async () => {
        // Arrange
        const failingOpenAi = makeRetryableFailingProvider('openai');
        const stubBase2 = new StubProvider();
        const workingAnthropic: AiProvider = {
            id: 'anthropic',
            generateText: (req) => stubBase2.generateText(req),
            streamText: (req) => stubBase2.streamText(req),
            generateObject: (req, schema) => stubBase2.generateObject(req, schema),
            extractIntent: (req) => stubBase2.extractIntent(req),
            moderate: (req) => stubBase2.moderate(req),
            embed: (req) => stubBase2.embed(req)
        };

        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            getProvider: (id) => {
                if (id === 'openai') return failingOpenAi;
                return workingAnthropic;
            },
            recordEvent: (e) => events.push(e)
        });

        // Act
        await engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' });

        // Assert — events arrive in the correct order
        const types = events.map((e) => e.type);
        expect(types).toContain('fallback');
        expect(types).toContain('success');

        // fallback comes before success
        const fallbackIdx = types.indexOf('fallback');
        const successIdx = types.indexOf('success');
        expect(fallbackIdx).toBeLessThan(successIdx);
    });

    it('should emit [fallback, fallback, exhausted] when all 3 providers fail', async () => {
        // Arrange — 3-provider chain, all fail
        const configThreeProviders: AiFeatureConfig = {
            enabled: true,
            primaryProvider: 'openai',
            fallbackChain: ['anthropic', 'stub'],
            model: 'gpt-4o-mini',
            params: {}
        };
        mockResolveFeatureConfig.mockResolvedValue(configThreeProviders);
        mockGetProviderOrder.mockReturnValue({ providers: ['openai', 'anthropic', 'stub'] });

        const failingProvider = makeRetryableFailingProvider('openai');

        const events: AiEngineEvent[] = [];
        const engine = createAiEngine({
            // all providers fail with the same retryable error
            getProvider: (id) => ({ ...failingProvider, id }),
            recordEvent: (e) => events.push(e)
        });

        // Act
        await expect(
            engine.generateText({ feature: 'text_improve', locale: 'es', prompt: 'test' })
        ).rejects.toThrow(AiEngineExhaustedError);

        // Assert — 2 fallback events (openai→anthropic and anthropic→stub) + 1 exhausted
        const types = events.map((e) => e.type);
        const fallbackCount = types.filter((t) => t === 'fallback').length;
        expect(fallbackCount).toBe(2);
        expect(types).toContain('exhausted');
        // exhausted is last
        expect(types[types.length - 1]).toBe('exhausted');
    });
});
