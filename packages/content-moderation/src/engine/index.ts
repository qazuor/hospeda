import { LocalProvider } from '../providers/local.provider.js';
import type { LocalModerationTerm } from '../providers/local.provider.js';
import { OpenAIProvider } from '../providers/openai.provider.js';
import { StubProvider } from '../providers/stub.provider.js';
import {
    initializeModerationCache,
    invalidateModerationCache,
    invalidateModerationCacheByTermPattern
} from './cache.js';
import {
    ModerationOrchestrator,
    getModerationEngineHealth,
    registerModerationMonitoringHooks,
    resetModerationEngineHealth,
    setModerationEngineProvider
} from './orchestrator.js';
import { EngineConfigError, type ModerationProvider } from './provider.js';

type ModerationEnv = {
    provider?: string;
    openaiApiKey?: string;
    timeoutMs?: number;
    cacheTtlSeconds?: number;
    apiUrl?: string;
};

type InitializeModerationEngineOptions = {
    env?: ModerationEnv;
    fetchImpl?: typeof fetch;
    termLoader?: () => Promise<readonly LocalModerationTerm[]>;
};

let moderationEngine: ModerationOrchestrator | null = null;

function readEnv(overrides?: ModerationEnv): Required<ModerationEnv> {
    return {
        provider: overrides?.provider ?? process.env.HOSPEDA_MODERATION_PROVIDER ?? 'stub',
        openaiApiKey:
            overrides?.openaiApiKey ?? process.env.HOSPEDA_MODERATION_OPENAI_API_KEY ?? '',
        timeoutMs:
            overrides?.timeoutMs ??
            Number.parseInt(process.env.HOSPEDA_MODERATION_TIMEOUT_MS ?? '1500', 10),
        cacheTtlSeconds:
            overrides?.cacheTtlSeconds ??
            Number.parseInt(process.env.HOSPEDA_MODERATION_CACHE_TTL_SECONDS ?? '300', 10),
        apiUrl: overrides?.apiUrl ?? 'https://api.openai.com/v1/moderations'
    };
}

export function createProviderFromEnv(options: InitializeModerationEngineOptions = {}): {
    provider: ModerationProvider;
    localProvider: LocalProvider;
} {
    const env = readEnv(options.env);
    const localProvider = new LocalProvider({ termLoader: options.termLoader });

    switch (env.provider) {
        case 'stub':
            return { provider: new StubProvider(), localProvider };
        case 'local':
            return { provider: localProvider, localProvider };
        case 'openai':
            if (env.openaiApiKey.trim().length === 0) {
                throw new EngineConfigError(
                    'HOSPEDA_MODERATION_OPENAI_API_KEY is required when HOSPEDA_MODERATION_PROVIDER=openai'
                );
            }
            return {
                provider: new OpenAIProvider({
                    apiKey: env.openaiApiKey,
                    timeoutMs: env.timeoutMs,
                    apiUrl: env.apiUrl,
                    fetchImpl: options.fetchImpl
                }),
                localProvider
            };
        default:
            throw new EngineConfigError(`Unsupported moderation provider: ${env.provider}`);
    }
}

export function initializeModerationEngine(
    options: InitializeModerationEngineOptions = {}
): ModerationOrchestrator {
    const env = readEnv(options.env);
    const { provider, localProvider } = createProviderFromEnv({ ...options, env });

    initializeModerationCache(env.cacheTtlSeconds);
    setModerationEngineProvider(provider.name);
    moderationEngine = new ModerationOrchestrator(provider, localProvider);
    return moderationEngine;
}

export function getModerationEngine(): ModerationOrchestrator {
    return moderationEngine ?? initializeModerationEngine();
}

export function resetModerationEngineForTests(
    options: InitializeModerationEngineOptions = {}
): void {
    moderationEngine = null;
    invalidateModerationCache();
    resetModerationEngineHealth();
    initializeModerationEngine(options);
}

export {
    getModerationEngineHealth,
    invalidateModerationCache,
    invalidateModerationCacheByTermPattern,
    registerModerationMonitoringHooks
};
