/**
 * Tests for the AI routing engine (SPEC-173 T-014).
 *
 * The config resolver is stubbed via `vi.mock` so no DB connection is needed.
 * All provider calls use `StubProvider` (happy path) or small fake providers
 * that throw classified errors (failure paths).
 *
 * ## Scenarios covered
 *
 * 1. Primary provider succeeds → result returned, no fallback event emitted.
 * 2. Primary throws a retryable 5xx → engine retries then falls back to the
 *    second provider → SUCCESS via fallback, fallback event WAS recorded (AC-2).
 * 3. All providers fail with retryable errors → `AiEngineExhaustedError`.
 * 4. Primary throws a non-retryable 4xx → no fallback, error surfaced immediately.
 * 5. Kill-switched feature → `AiFeatureDisabledError`, no provider called (AC-9).
 * 6. Unconfigured feature → `AiFeatureNotConfiguredError` from config.
 * 7. streamText routes through fallback correctly.
 * 8. generateObject routes through fallback correctly.
 * 9. extractIntent routes through fallback correctly.
 * 10. moderate bypasses feature-config, calls moderation provider directly.
 * 11. defaultProviderOrderStrategy returns primary + fallback in correct order.
 * 12. isRetryableError correctly classifies errors (unit test).
 */

import type { AiFeatureConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiFeatureNotConfiguredError } from '../src/config/index.js';
import {
    type AiEngine,
    type AiEngineEvent,
    AiEngineExhaustedError,
    AiFeatureDisabledError,
    MAX_ATTEMPTS_PER_PROVIDER,
    createAiEngine,
    defaultProviderOrderStrategy,
    isRetryableError
} from '../src/engine/index.js';
import type { AiProvider } from '../src/providers/ai-provider.interface.js';
import { StubProvider } from '../src/providers/index.js';

// ---------------------------------------------------------------------------
// Mock the config resolver — no DB required
// ---------------------------------------------------------------------------

// The mock replaces the module but must re-export the real error class so that
// `new AiFeatureNotConfiguredError(...)` still works in test bodies.
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

const FEATURE_CONFIG_NO_FALLBACK: AiFeatureConfig = {
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: [],
    model: 'gpt-4o-mini',
    params: {}
};

// ---------------------------------------------------------------------------
// Fake provider helpers
// ---------------------------------------------------------------------------

/**
 * Creates a fake provider that throws the given error on every method call.
 */
function makeFailingProvider(id: AiProvider['id'], error: Error): AiProvider {
    return {
        id,
        generateText: () => Promise.reject(error),
        streamText: () => Promise.reject(error),
        generateObject: () => Promise.reject(error),
        extractIntent: () => Promise.reject(error),
        moderate: () => Promise.reject(error),
        embed: () => Promise.reject(error)
    };
}

/**
 * Creates a retryable 5xx error (message-based heuristic).
 */
function retryableError(): Error {
    return new Error('503 Service Unavailable');
}

/**
 * Creates a non-retryable 4xx error (message-based heuristic, not 429).
 */
function nonRetryableError(): Error {
    return new Error('400 Bad Request - invalid prompt');
}

// ---------------------------------------------------------------------------
// Engine factory helper
// ---------------------------------------------------------------------------

function makeEngine(providers: Map<string, AiProvider>, events?: AiEngineEvent[]): AiEngine {
    return createAiEngine({
        getProvider: (id) => {
            const p = providers.get(id);
            if (!p) throw new Error(`No provider registered for id: ${id}`);
            return p;
        },
        recordEvent: events
            ? (e) => {
                  events.push(e);
              }
            : undefined
    });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    // Default: feature is enabled, provider order = [openai, anthropic]
    // resolveConfig returns an empty providers map so no provider kill-switches
    // are active — preserving all existing test expectations.
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
// 1. Happy path: primary provider succeeds
// ---------------------------------------------------------------------------

describe('happy path — primary provider succeeds', () => {
    it('should return the result without emitting a fallback event', async () => {
        // Arrange
        const stub = new StubProvider();
        const providers = new Map<string, AiProvider>([['openai', stub]]);
        const events: AiEngineEvent[] = [];
        const engine = makeEngine(providers, events);

        // Act
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'Mejorar este texto'
        });

        // Assert — result is the stub echo
        expect(result.text).toContain('[stub:text_improve]');
        // Success event recorded, NO fallback event
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: 'success', providerId: 'openai' });
    });
});

// ---------------------------------------------------------------------------
// 2. Primary retryable failure → fallback → success (AC-2)
// ---------------------------------------------------------------------------

describe('retryable primary failure → fallback to secondary', () => {
    it('should fall back to the second provider and record a fallback event', async () => {
        // Arrange
        const failingProvider = makeFailingProvider('openai', retryableError());
        // Build a working anthropic provider via object literal (not spread from class instance)
        const stub = new StubProvider();
        const anthropicProvider: AiProvider = {
            id: 'anthropic',
            generateText: (req) => stub.generateText(req),
            streamText: (req) => stub.streamText(req),
            generateObject: (req, schema) => stub.generateObject(req, schema),
            extractIntent: (req) => stub.extractIntent(req),
            moderate: (req) => stub.moderate(req),
            embed: (req) => stub.embed(req)
        };

        const providers = new Map<string, AiProvider>([
            ['openai', failingProvider],
            ['anthropic', anthropicProvider]
        ]);
        const events: AiEngineEvent[] = [];
        const engine = makeEngine(providers, events);

        // Act
        const result = await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'test'
        });

        // Assert — result came from the fallback provider
        expect(result).toBeDefined();
        expect(result.text).toContain('[stub:text_improve]');

        // A fallback event was recorded
        const fallbackEvents = events.filter((e) => e.type === 'fallback');
        expect(fallbackEvents).toHaveLength(1);
        expect(fallbackEvents[0]).toMatchObject({
            type: 'fallback',
            feature: 'text_improve',
            fromProvider: 'openai',
            toProvider: 'anthropic'
        });
    });

    it('should exhaust retry budget on primary before falling back', async () => {
        // Arrange — track how many times openai is called
        let openaiCallCount = 0;
        const failingProvider: AiProvider = {
            id: 'openai',
            generateText: () => {
                openaiCallCount++;
                return Promise.reject(retryableError());
            },
            streamText: () => Promise.reject(retryableError()),
            generateObject: () => Promise.reject(retryableError()),
            extractIntent: () => Promise.reject(retryableError()),
            moderate: () => Promise.reject(retryableError()),
            embed: () => Promise.reject(retryableError())
        };
        const stub = new StubProvider();
        const anthropicProvider: AiProvider = {
            id: 'anthropic',
            generateText: (req) => stub.generateText(req),
            streamText: (req) => stub.streamText(req),
            generateObject: (req, schema) => stub.generateObject(req, schema),
            extractIntent: (req) => stub.extractIntent(req),
            moderate: (req) => stub.moderate(req),
            embed: (req) => stub.embed(req)
        };

        const providers = new Map<string, AiProvider>([
            ['openai', failingProvider],
            ['anthropic', anthropicProvider]
        ]);

        const engine = makeEngine(providers);

        // Act
        await engine.generateText({
            feature: 'text_improve',
            locale: 'es',
            prompt: 'test'
        });

        // Assert — openai called MAX_ATTEMPTS_PER_PROVIDER times before falling back
        expect(openaiCallCount).toBe(MAX_ATTEMPTS_PER_PROVIDER);
    });
});

// ---------------------------------------------------------------------------
// 3. All providers fail → AiEngineExhaustedError
// ---------------------------------------------------------------------------

describe('all providers fail → AiEngineExhaustedError', () => {
    it('should throw AiEngineExhaustedError with attempt details', async () => {
        // Arrange
        const failOpenAi = makeFailingProvider('openai', retryableError());
        const failAnthropic = makeFailingProvider('anthropic', retryableError());

        const providers = new Map<string, AiProvider>([
            ['openai', failOpenAi],
            ['anthropic', failAnthropic]
        ]);
        const events: AiEngineEvent[] = [];
        const engine = makeEngine(providers, events);

        // Act + Assert
        await expect(
            engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            })
        ).rejects.toThrow(AiEngineExhaustedError);

        // An exhausted event was emitted
        expect(events.some((e) => e.type === 'exhausted')).toBe(true);
    });

    it('should include both provider IDs in AiEngineExhaustedError.attempts', async () => {
        // Arrange
        const failOpenAi = makeFailingProvider('openai', retryableError());
        const failAnthropic = makeFailingProvider('anthropic', retryableError());

        const providers = new Map<string, AiProvider>([
            ['openai', failOpenAi],
            ['anthropic', failAnthropic]
        ]);
        const engine = makeEngine(providers);

        // Act
        let caughtError: AiEngineExhaustedError | undefined;
        try {
            await engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            });
        } catch (err) {
            caughtError = err as AiEngineExhaustedError;
        }

        // Assert
        expect(caughtError).toBeInstanceOf(AiEngineExhaustedError);
        expect(caughtError?.feature).toBe('text_improve');
        const attemptIds = caughtError?.attempts.map((a) => a.providerId);
        expect(attemptIds).toContain('openai');
        expect(attemptIds).toContain('anthropic');
    });

    it('should include wasRetryable=true in exhausted attempts for retryable errors', async () => {
        // Arrange
        const failOpenAi = makeFailingProvider('openai', retryableError());
        const failAnthropic = makeFailingProvider('anthropic', retryableError());

        const providers = new Map<string, AiProvider>([
            ['openai', failOpenAi],
            ['anthropic', failAnthropic]
        ]);
        const engine = makeEngine(providers);

        // Act
        let caughtError: AiEngineExhaustedError | undefined;
        try {
            await engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            });
        } catch (err) {
            caughtError = err as AiEngineExhaustedError;
        }

        expect(caughtError?.attempts.every((a) => a.wasRetryable)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 4. Non-retryable error → no fallback, error surfaced immediately
// ---------------------------------------------------------------------------

describe('non-retryable primary error → no fallback', () => {
    it('should throw the original error without calling the fallback provider', async () => {
        // Arrange — openai throws 400 (non-retryable), anthropic is available
        const failOpenAi = makeFailingProvider('openai', nonRetryableError());
        const stub = new StubProvider();
        const anthropicStub: AiProvider = { ...stub, id: 'anthropic' };

        const anthropicCallSpy = vi.fn().mockResolvedValue(
            await stub.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'p'
            })
        );
        const anthropicProvider: AiProvider = {
            ...anthropicStub,
            generateText: anthropicCallSpy
        };

        const providers = new Map<string, AiProvider>([
            ['openai', failOpenAi],
            ['anthropic', anthropicProvider]
        ]);
        const engine = makeEngine(providers);

        // Act + Assert — the 400 error surfaces; no fallback
        await expect(
            engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            })
        ).rejects.toThrow('400 Bad Request');

        // anthropic was never called
        expect(anthropicCallSpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 5. Kill-switched feature → AiFeatureDisabledError, no provider called (AC-9)
// ---------------------------------------------------------------------------

describe('kill-switched feature → AiFeatureDisabledError', () => {
    it('should throw AiFeatureDisabledError without calling any provider', async () => {
        // Arrange — feature is disabled
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_DISABLED);

        const providerCallSpy = vi.fn();
        const fakeProvider: AiProvider = {
            ...makeFailingProvider('openai', new Error('should not be called')),
            generateText: providerCallSpy
        };

        const providers = new Map<string, AiProvider>([['openai', fakeProvider]]);
        const events: AiEngineEvent[] = [];
        const engine = makeEngine(providers, events);

        // Act + Assert
        await expect(
            engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            })
        ).rejects.toThrow(AiFeatureDisabledError);

        // Provider was never called
        expect(providerCallSpy).not.toHaveBeenCalled();

        // A kill_switch event was recorded
        expect(events.some((e) => e.type === 'kill_switch')).toBe(true);
    });

    it('should set the correct feature name on AiFeatureDisabledError', async () => {
        // Arrange
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_DISABLED);
        const engine = createAiEngine({
            getProvider: () => new StubProvider()
        });

        // Act
        let caught: AiFeatureDisabledError | undefined;
        try {
            await engine.generateText({
                feature: 'chat',
                locale: 'es',
                prompt: 'test'
            });
        } catch (err) {
            caught = err as AiFeatureDisabledError;
        }

        // Assert
        expect(caught).toBeInstanceOf(AiFeatureDisabledError);
        expect(caught?.feature).toBe('chat');
        expect(caught?.engineCode).toBe('FEATURE_DISABLED');
    });
});

// ---------------------------------------------------------------------------
// 6. Unconfigured feature → AiFeatureNotConfiguredError
// ---------------------------------------------------------------------------

describe('unconfigured feature → AiFeatureNotConfiguredError', () => {
    it('should throw AiFeatureNotConfiguredError when config is missing', async () => {
        // Arrange
        mockResolveFeatureConfig.mockRejectedValue(new AiFeatureNotConfiguredError('search'));

        const engine = createAiEngine({
            getProvider: () => new StubProvider()
        });

        // Act + Assert
        await expect(
            engine.generateText({
                feature: 'search',
                locale: 'es',
                prompt: 'hoteles'
            })
        ).rejects.toThrow(AiFeatureNotConfiguredError);
    });
});

// ---------------------------------------------------------------------------
// 7. streamText routes through fallback
// ---------------------------------------------------------------------------

describe('streamText routing', () => {
    it('should fall back to secondary provider on retryable primary failure', async () => {
        // Arrange
        const failOpenAi = makeFailingProvider('openai', retryableError());
        const stub = new StubProvider();
        const anthropicProvider: AiProvider = {
            id: 'anthropic',
            generateText: (req) => stub.generateText(req),
            streamText: (req) => stub.streamText(req),
            generateObject: (req, schema) => stub.generateObject(req, schema),
            extractIntent: (req) => stub.extractIntent(req),
            moderate: (req) => stub.moderate(req),
            embed: (req) => stub.embed(req)
        };

        const providers = new Map<string, AiProvider>([
            ['openai', failOpenAi],
            ['anthropic', anthropicProvider]
        ]);
        const events: AiEngineEvent[] = [];
        const engine = makeEngine(providers, events);

        // Act
        const result = await engine.streamText({
            feature: 'chat',
            locale: 'es',
            prompt: 'test'
        });

        // Assert — we got a StreamTextResult back
        expect(result.stream).toBeDefined();
        expect(result.meta).toBeDefined();

        // Fallback event emitted
        expect(events.some((e) => e.type === 'fallback')).toBe(true);
    });

    it('should throw AiFeatureDisabledError on kill-switched feature', async () => {
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_DISABLED);
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        await expect(
            engine.streamText({ feature: 'chat', locale: 'es', prompt: 'hi' })
        ).rejects.toThrow(AiFeatureDisabledError);
    });
});

// ---------------------------------------------------------------------------
// 8. generateObject routes through fallback
// ---------------------------------------------------------------------------

import { z } from 'zod';

describe('generateObject routing', () => {
    const TestSchema = z.object({ name: z.string().default('stub') });

    it('should succeed on primary provider', async () => {
        // Arrange
        const stub = new StubProvider();
        const providers = new Map<string, AiProvider>([['openai', stub]]);
        const engine = makeEngine(providers);

        // Act
        const result = await engine.generateObject(
            { feature: 'search', locale: 'es', prompt: 'test' },
            TestSchema
        );

        // Assert
        expect(result.object).toBeDefined();
        expect(result.provider).toBe('stub');
    });

    it('should fall back on retryable primary failure', async () => {
        // Arrange
        const failOpenAi = makeFailingProvider('openai', retryableError());
        const stub = new StubProvider();
        const anthropicProvider: AiProvider = {
            id: 'anthropic',
            generateText: (req) => stub.generateText(req),
            streamText: (req) => stub.streamText(req),
            generateObject: (req, schema) => stub.generateObject(req, schema),
            extractIntent: (req) => stub.extractIntent(req),
            moderate: (req) => stub.moderate(req),
            embed: (req) => stub.embed(req)
        };

        const providers = new Map<string, AiProvider>([
            ['openai', failOpenAi],
            ['anthropic', anthropicProvider]
        ]);
        const events: AiEngineEvent[] = [];
        const engine = makeEngine(providers, events);

        // Act
        const result = await engine.generateObject(
            { feature: 'search', locale: 'es', prompt: 'test' },
            TestSchema
        );

        expect(result).toBeDefined();
        expect(events.some((e) => e.type === 'fallback')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 9. extractIntent routes through fallback
// ---------------------------------------------------------------------------

describe('extractIntent routing', () => {
    it('should succeed on primary provider and return an intent', async () => {
        // Arrange
        const stub = new StubProvider();
        const providers = new Map<string, AiProvider>([['openai', stub]]);
        const engine = makeEngine(providers);

        // Act
        const intent = await engine.extractIntent({ query: 'cabaña con pileta' }, 'search');

        // Assert
        expect(intent.kind).toBe('stub');
        expect(intent.confidence).toBe(0.99);
        expect(intent.rawQuery).toBe('cabaña con pileta');
    });

    it('should fall back on retryable primary failure', async () => {
        // Arrange
        const failOpenAi = makeFailingProvider('openai', retryableError());
        const stub = new StubProvider();
        const anthropicProvider: AiProvider = {
            id: 'anthropic',
            generateText: (req) => stub.generateText(req),
            streamText: (req) => stub.streamText(req),
            generateObject: (req, schema) => stub.generateObject(req, schema),
            extractIntent: (req) => stub.extractIntent(req),
            moderate: (req) => stub.moderate(req),
            embed: (req) => stub.embed(req)
        };

        const providers = new Map<string, AiProvider>([
            ['openai', failOpenAi],
            ['anthropic', anthropicProvider]
        ]);
        const events: AiEngineEvent[] = [];
        const engine = makeEngine(providers, events);

        // Act
        const intent = await engine.extractIntent({ query: 'hoteles' }, 'search');

        expect(intent).toBeDefined();
        expect(events.some((e) => e.type === 'fallback')).toBe(true);
    });

    it('should throw AiFeatureDisabledError on kill-switched feature', async () => {
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_DISABLED);
        const engine = createAiEngine({ getProvider: () => new StubProvider() });

        await expect(engine.extractIntent({ query: 'test' }, 'chat')).rejects.toThrow(
            AiFeatureDisabledError
        );
    });
});

// ---------------------------------------------------------------------------
// 10. moderate bypasses feature-config routing
// ---------------------------------------------------------------------------

describe('moderate routing', () => {
    it('should call the moderation provider directly without feature config', async () => {
        // Arrange — DO NOT mock resolveFeatureConfig for this test (it should not be called)
        const moderationCallSpy = vi.fn().mockResolvedValue({ flagged: false, categories: {} });
        const moderationProvider: AiProvider = {
            ...new StubProvider(),
            id: 'openai',
            moderate: moderationCallSpy
        };

        const engine = createAiEngine({
            getProvider: () => moderationProvider,
            moderationProviderId: 'openai'
        });

        // Act
        const result = await engine.moderate({ input: 'some user content' });

        // Assert
        expect(result.flagged).toBe(false);
        expect(moderationCallSpy).toHaveBeenCalledOnce();
        expect(mockResolveFeatureConfig).not.toHaveBeenCalled();
    });

    it('should use the custom moderationProviderId when specified', async () => {
        // Arrange
        const anthropicModerateSpy = vi
            .fn()
            .mockResolvedValue({ flagged: true, categories: { hate: true } });
        const anthropicProvider: AiProvider = {
            ...new StubProvider(),
            id: 'anthropic',
            moderate: anthropicModerateSpy
        };

        const engine = createAiEngine({
            getProvider: () => anthropicProvider,
            moderationProviderId: 'anthropic'
        });

        // Act
        const result = await engine.moderate({ input: 'bad content' });

        // Assert
        expect(result.flagged).toBe(true);
        expect(anthropicModerateSpy).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// 11. defaultProviderOrderStrategy
// ---------------------------------------------------------------------------

describe('defaultProviderOrderStrategy', () => {
    it('should return primary provider first, then fallback chain', () => {
        // Arrange
        const featureConfig: AiFeatureConfig = {
            enabled: true,
            primaryProvider: 'openai',
            fallbackChain: ['anthropic', 'stub'],
            model: 'gpt-4o',
            params: {}
        };

        // Act — real getProviderOrder call, not mocked
        // We use the real implementation here via a direct import
        const result = defaultProviderOrderStrategy({ feature: 'chat', featureConfig });

        // Assert
        expect(result).toEqual(['openai', 'anthropic', 'stub']);
    });

    it('should return only the primary when fallback chain is empty', () => {
        const featureConfig: AiFeatureConfig = {
            enabled: true,
            primaryProvider: 'anthropic',
            fallbackChain: [],
            model: 'claude-3-5-sonnet-20241022',
            params: {}
        };

        const result = defaultProviderOrderStrategy({ feature: 'text_improve', featureConfig });

        expect(result).toEqual(['anthropic']);
    });
});

// ---------------------------------------------------------------------------
// 12. isRetryableError classification (unit test)
// ---------------------------------------------------------------------------

describe('isRetryableError', () => {
    it('should classify 429 errors as retryable', () => {
        expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('should classify 503 errors as retryable', () => {
        expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    });

    it('should classify 502/504 errors as retryable', () => {
        expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
        expect(isRetryableError(new Error('504 Gateway Timeout'))).toBe(true);
    });

    it('should classify timeout errors as retryable', () => {
        expect(isRetryableError(new Error('Request timed out'))).toBe(true);
        expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
        expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    });

    it('should classify rate limit errors as retryable', () => {
        expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
        expect(isRetryableError(new Error('rate_limit'))).toBe(true);
    });

    it('should classify 400 errors as non-retryable', () => {
        expect(isRetryableError(new Error('400 Bad Request'))).toBe(false);
    });

    it('should classify 401 errors as non-retryable', () => {
        expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
    });

    it('should classify 422 validation errors as non-retryable', () => {
        expect(isRetryableError(new Error('422 Unprocessable Entity'))).toBe(false);
    });

    it('should classify generic errors as non-retryable', () => {
        expect(isRetryableError(new Error('unknown error'))).toBe(false);
    });

    it('should use statusCode property when present', () => {
        const err = new Error('some error') as Error & { statusCode: number };
        err.statusCode = 429;
        expect(isRetryableError(err)).toBe(true);

        err.statusCode = 503;
        expect(isRetryableError(err)).toBe(true);

        err.statusCode = 400;
        expect(isRetryableError(err)).toBe(false);
    });

    it('should use status property when statusCode absent', () => {
        const err = new Error('some error') as Error & { status: number };
        err.status = 500;
        expect(isRetryableError(err)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 13. Single-provider exhaustion (no fallback chain)
// ---------------------------------------------------------------------------

describe('single-provider config with retryable failure', () => {
    it('should throw AiEngineExhaustedError when only provider fails', async () => {
        // Arrange
        mockResolveFeatureConfig.mockResolvedValue(FEATURE_CONFIG_NO_FALLBACK);
        const failOpenAi = makeFailingProvider('openai', retryableError());
        const providers = new Map<string, AiProvider>([['openai', failOpenAi]]);
        const engine = makeEngine(providers);

        // Act + Assert
        await expect(
            engine.generateText({
                feature: 'text_improve',
                locale: 'es',
                prompt: 'test'
            })
        ).rejects.toThrow(AiEngineExhaustedError);
    });
});
