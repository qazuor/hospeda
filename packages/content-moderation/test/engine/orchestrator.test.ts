import { describe, expect, it, vi } from 'vitest';
import { initializeModerationCache } from '../../src/engine/cache.js';
import {
    ModerationOrchestrator,
    getModerationEngineHealth,
    registerModerationMonitoringHooks,
    resetModerationEngineHealth,
    setModerationEngineProvider
} from '../../src/engine/orchestrator.js';
import type { ModerationProvider } from '../../src/engine/provider.js';

function createProvider(overrides: Partial<ModerationProvider>): ModerationProvider {
    return {
        name: 'stub',
        classify: vi.fn(),
        ...overrides
    };
}

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
                classify: vi.fn().mockRejectedValue(new Error('openai down'))
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
                classify: vi.fn().mockRejectedValue(new Error('openai down'))
            }),
            createProvider({
                name: 'local',
                classify: vi.fn().mockRejectedValue(new Error('db down'))
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
});
