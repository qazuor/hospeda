import { describe, expect, it, vi } from 'vitest';
import {
    getCachedModerationResult,
    initializeModerationCache,
    invalidateModerationCache
} from '../../src/engine/cache.js';
import {
    ModerationOrchestrator,
    getModerationEngineHealth,
    registerModerationMonitoringHooks,
    resetModerationEngineHealth,
    setModerationEngineProvider
} from '../../src/engine/orchestrator.js';
import {
    ProviderError,
    ProviderRateLimitedError,
    ProviderTimeoutError,
    isFallbackEligibleError
} from '../../src/engine/provider.js';
import type { ModerationProvider } from '../../src/engine/provider.js';

function createProvider(overrides: Partial<ModerationProvider>): ModerationProvider {
    return {
        name: 'stub',
        classify: vi.fn(),
        ...overrides
    };
}

const STUB_OK_RESULT = Object.freeze({
    source: 'local' as const,
    score: 0.1,
    categories: Object.freeze({
        spam: 0,
        sexual: 0,
        violence: 0,
        hate: 0,
        harassment: 0.1,
        other: 0
    }),
    matchedTerms: Object.freeze([])
});

describe('isFallbackEligibleError', () => {
    it('returns true for ProviderError', () => {
        expect(isFallbackEligibleError(new ProviderError('provider failed'))).toBe(true);
    });

    it('returns true for ProviderTimeoutError (extends ProviderError)', () => {
        expect(isFallbackEligibleError(new ProviderTimeoutError())).toBe(true);
    });

    it('returns true for ProviderRateLimitedError (extends ProviderError)', () => {
        expect(isFallbackEligibleError(new ProviderRateLimitedError())).toBe(true);
    });

    it('returns false for a plain Error — programming bugs must not be swallowed', () => {
        expect(isFallbackEligibleError(new Error('generic error'))).toBe(false);
    });

    it('returns false for a TypeError — programming bugs must not be swallowed', () => {
        expect(isFallbackEligibleError(new TypeError('type error'))).toBe(false);
    });

    it('returns false for a non-Error thrown value', () => {
        expect(isFallbackEligibleError('string error')).toBe(false);
        expect(isFallbackEligibleError(null)).toBe(false);
        expect(isFallbackEligibleError(42)).toBe(false);
    });
});

describe('ModerationOrchestrator', () => {
    it('falls back from openai to local and records degraded state when needed', async () => {
        initializeModerationCache(300);
        resetModerationEngineHealth();
        setModerationEngineProvider('openai');

        const onFallbackLocal = vi.fn();
        const onDegraded = vi.fn();
        registerModerationMonitoringHooks({ onFallbackLocal, onDegraded });

        const orchestrator = new ModerationOrchestrator(
            createProvider({
                name: 'openai',
                classify: vi.fn().mockRejectedValue(new ProviderError('openai down'))
            }),
            createProvider({
                name: 'local',
                classify: vi.fn().mockResolvedValue({
                    source: 'local',
                    score: 0.7,
                    categories: Object.freeze({
                        spam: 0,
                        sexual: 0,
                        violence: 0,
                        hate: 0,
                        harassment: 0.7,
                        other: 0
                    }),
                    matchedTerms: Object.freeze(['badword'])
                })
            })
        );

        const fallbackResult = await orchestrator.classify({ text: 'badword' });
        expect(fallbackResult.source).toBe('local');
        expect(onFallbackLocal).toHaveBeenCalledOnce();
        expect(onDegraded).not.toHaveBeenCalled();

        const degradedOrchestrator = new ModerationOrchestrator(
            createProvider({
                name: 'openai',
                classify: vi.fn().mockRejectedValue(new ProviderError('openai down'))
            }),
            createProvider({
                name: 'local',
                classify: vi.fn().mockRejectedValue(new ProviderError('db down'))
            })
        );

        const degradedResult = await degradedOrchestrator.classify({ text: 'still badword' });

        expect(degradedResult.source).toBe('degraded');
        expect(degradedResult.score).toBe(0.5);
        expect(onDegraded).toHaveBeenCalledOnce();

        const health = getModerationEngineHealth();
        expect(health.lastProviderErrorAt).not.toBeNull();
        expect(health.lastDegradedAt).not.toBeNull();
        expect(health.degradedCountLast24Hours).toBeGreaterThanOrEqual(1);
    });

    it('re-throws a non-ProviderError from the provider instead of returning degraded', async () => {
        initializeModerationCache(300);
        resetModerationEngineHealth();
        setModerationEngineProvider('openai');

        const typeError = new TypeError('unexpected null');

        const orchestrator = new ModerationOrchestrator(
            createProvider({
                name: 'openai',
                classify: vi.fn().mockRejectedValue(typeError)
            }),
            createProvider({
                name: 'local',
                classify: vi.fn().mockResolvedValue(STUB_OK_RESULT)
            })
        );

        // Must propagate the TypeError, not swallow it as degraded.
        await expect(orchestrator.classify({ text: 'test rethrow' })).rejects.toBeInstanceOf(
            TypeError
        );
    });

    it('does not cache a degraded result — second call re-invokes the provider', async () => {
        initializeModerationCache(300);
        invalidateModerationCache();
        resetModerationEngineHealth();
        setModerationEngineProvider('openai');

        const providerClassify = vi.fn().mockRejectedValue(new ProviderError('down'));
        const localClassify = vi.fn().mockRejectedValue(new ProviderError('local down too'));

        const orchestrator = new ModerationOrchestrator(
            createProvider({ name: 'openai', classify: providerClassify }),
            createProvider({ name: 'local', classify: localClassify })
        );

        const uniqueText = `degraded-no-cache-${Date.now()}`;

        const first = await orchestrator.classify({ text: uniqueText });
        expect(first.source).toBe('degraded');

        // The result should NOT be in the cache after a degraded response.
        expect(getCachedModerationResult(uniqueText)).toBeNull();

        const second = await orchestrator.classify({ text: uniqueText });
        expect(second.source).toBe('degraded');

        // Provider must have been called twice — degraded results are never cached.
        expect(providerClassify).toHaveBeenCalledTimes(2);
    });
});
