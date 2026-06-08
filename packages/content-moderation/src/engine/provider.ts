import type { ModerationResult } from '../types.js';

export type ModerationProviderName = 'openai' | 'local' | 'stub';
export type InternalModerationSource = ModerationProviderName | 'degraded';

export type InternalModerationResult = ModerationResult & {
    readonly source: InternalModerationSource;
    readonly note?: string;
};

export interface ModerationProvider {
    readonly name: ModerationProviderName;
    classify(input: { text: string; context?: string }): Promise<InternalModerationResult>;
}

export class EngineConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EngineConfigError';
    }
}

export class ProviderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProviderError';
    }
}

export class ProviderTimeoutError extends ProviderError {
    constructor(message = 'Moderation provider timed out') {
        super(message);
        this.name = 'ProviderTimeoutError';
    }
}

export class ProviderRateLimitedError extends ProviderError {
    constructor(message = 'Moderation provider rate limited the request') {
        super(message);
        this.name = 'ProviderRateLimitedError';
    }
}

export function isFallbackEligibleError(error: unknown): boolean {
    return (
        error instanceof ProviderError ||
        error instanceof ProviderTimeoutError ||
        error instanceof ProviderRateLimitedError ||
        error instanceof Error
    );
}
