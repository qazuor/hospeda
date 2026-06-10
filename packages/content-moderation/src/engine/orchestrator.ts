import {
    getCachedModerationResult,
    getModerationCacheHealth,
    setCachedModerationResult
} from './cache.js';
import {
    type InternalModerationResult,
    type ModerationProvider,
    type ModerationProviderName,
    isFallbackEligibleError
} from './provider.js';
import { createModerationResult, createZeroCategories } from './shared.js';

type ModerationMonitoringHooks = {
    onFallbackLocal?: (details: { error: Error; context?: string }) => void;
    onDegraded?: (details: { error: Error; context?: string }) => void;
};

type ModerationEngineHealth = {
    provider: ModerationProviderName;
    cacheSize: number;
    hitRatioLastHour: number;
    degradedCountLast24Hours: number;
    lastProviderErrorAt: string | null;
    lastDegradedAt: string | null;
};

type EngineState = {
    provider: ModerationProviderName;
    lastProviderErrorAt: number | null;
    lastDegradedAt: number | null;
    degradedEvents: number[];
    hooks: ModerationMonitoringHooks;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const engineState: EngineState = {
    provider: 'stub',
    lastProviderErrorAt: null,
    lastDegradedAt: null,
    degradedEvents: [],
    hooks: {}
};

function pruneDegradedEvents(now: number): void {
    const threshold = now - TWENTY_FOUR_HOURS_MS;
    while (engineState.degradedEvents.length > 0) {
        const oldest = engineState.degradedEvents[0];
        if (oldest === undefined) break;
        if (oldest >= threshold) break;
        engineState.degradedEvents.shift();
    }
}

export function registerModerationMonitoringHooks(hooks: ModerationMonitoringHooks): void {
    engineState.hooks = hooks;
}

export function setModerationEngineProvider(provider: ModerationProviderName): void {
    engineState.provider = provider;
}

export function resetModerationEngineHealth(): void {
    engineState.lastProviderErrorAt = null;
    engineState.lastDegradedAt = null;
    engineState.degradedEvents = [];
    engineState.hooks = {};
    engineState.provider = 'stub';
}

export function getModerationEngineHealth(): ModerationEngineHealth {
    const now = Date.now();
    pruneDegradedEvents(now);
    const cacheHealth = getModerationCacheHealth();

    return {
        provider: engineState.provider,
        cacheSize: cacheHealth.cacheSize,
        hitRatioLastHour: cacheHealth.hitRatioLastHour,
        degradedCountLast24Hours: engineState.degradedEvents.length,
        lastProviderErrorAt:
            engineState.lastProviderErrorAt === null
                ? null
                : new Date(engineState.lastProviderErrorAt).toISOString(),
        lastDegradedAt:
            engineState.lastDegradedAt === null
                ? null
                : new Date(engineState.lastDegradedAt).toISOString()
    };
}

export class ModerationOrchestrator {
    constructor(
        private readonly provider: ModerationProvider,
        private readonly localProvider: ModerationProvider
    ) {}

    async classify(input: { text: string; context?: string }): Promise<InternalModerationResult> {
        const cached = getCachedModerationResult(input.text, input.context);
        if (cached) return cached;

        const result = await this.execute(input);

        // Do not cache degraded results — the provider may recover before the
        // TTL expires and a cached degraded score would mask the recovery.
        if (result.source !== 'degraded') {
            setCachedModerationResult(input.text, result, input.context);
        }

        return result;
    }

    private async execute(input: {
        text: string;
        context?: string;
    }): Promise<InternalModerationResult> {
        if (this.provider.name === 'stub') {
            return this.provider.classify(input);
        }

        try {
            return await this.provider.classify(input);
        } catch (error) {
            if (!isFallbackEligibleError(error)) {
                throw error;
            }

            const providerError = error instanceof Error ? error : new Error(String(error));
            const now = Date.now();
            engineState.lastProviderErrorAt = now;

            if (this.provider.name === 'openai') {
                engineState.hooks.onFallbackLocal?.({
                    error: providerError,
                    context: input.context
                });

                try {
                    return await this.localProvider.classify(input);
                } catch (localError) {
                    return this.createDegradedResult(
                        localError instanceof Error ? localError : providerError,
                        input.context
                    );
                }
            }

            return this.createDegradedResult(providerError, input.context);
        }
    }

    private createDegradedResult(error: Error, context?: string): InternalModerationResult {
        const now = Date.now();
        engineState.lastDegradedAt = now;
        engineState.degradedEvents.push(now);
        pruneDegradedEvents(now);
        engineState.hooks.onDegraded?.({ error, context });

        const degraded = {
            ...createModerationResult({
                score: 0.5,
                categories: { ...createZeroCategories() },
                matchedTerms: []
            }),
            source: 'degraded' as const,
            note: error.message
        };

        return degraded;
    }
}
