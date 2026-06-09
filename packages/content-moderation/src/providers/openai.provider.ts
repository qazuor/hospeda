import {
    type InternalModerationResult,
    type ModerationProvider,
    ProviderError,
    ProviderRateLimitedError,
    ProviderTimeoutError
} from '../engine/provider.js';
import { createModerationResult, createZeroCategories } from '../engine/shared.js';

/**
 * Maximum number of UTF-16 code units sent to the OpenAI Moderations API.
 *
 * Requests above this limit trigger a 400 error which is treated as a
 * `ProviderError` and causes an unwanted fallback to local moderation —
 * a quality downgrade that could be forced by an attacker sending oversized
 * payloads. Truncating (rather than throwing) ensures moderation still runs
 * on the leading content.
 */
const MAX_OPENAI_INPUT_CHARS = 20_000;

type OpenAIProviderOptions = {
    apiKey: string;
    timeoutMs: number;
    apiUrl?: string;
    fetchImpl?: typeof fetch;
};

type OpenAIResponse = {
    results?: Array<{
        category_scores?: Record<string, number>;
    }>;
};

export class OpenAIProvider implements ModerationProvider {
    readonly name = 'openai' as const;
    private readonly apiUrl: string;
    private readonly fetchImpl: typeof fetch;

    constructor(private readonly options: OpenAIProviderOptions) {
        this.apiUrl = options.apiUrl ?? 'https://api.openai.com/v1/moderations';
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    async classify(input: { text: string }): Promise<InternalModerationResult> {
        const safeText = input.text.slice(0, MAX_OPENAI_INPUT_CHARS);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

        try {
            const response = await this.fetchImpl(this.apiUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.options.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ input: safeText }),
                signal: controller.signal
            });

            if (response.status === 429) {
                throw new ProviderRateLimitedError();
            }

            if (!response.ok) {
                throw new ProviderError(
                    `OpenAI moderation request failed with status ${response.status}`
                );
            }

            const body = (await response.json()) as OpenAIResponse;
            return this.mapResponse(body);
        } catch (error) {
            if (error instanceof ProviderError) throw error;
            if (error instanceof Error && error.name === 'AbortError') {
                throw new ProviderTimeoutError();
            }
            throw new ProviderError(
                error instanceof Error ? error.message : 'Unknown OpenAI moderation error'
            );
        } finally {
            clearTimeout(timeout);
        }
    }

    private mapResponse(body: OpenAIResponse): InternalModerationResult {
        const scores = body.results?.[0]?.category_scores ?? {};
        const categories = { ...createZeroCategories() };

        categories.hate = this.pickMax(scores, ['hate', 'hate/threatening']);
        categories.sexual = this.pickMax(scores, ['sexual', 'sexual/minors']);
        categories.violence = this.pickMax(scores, ['violence', 'violence/graphic']);
        categories.harassment = this.pickMax(scores, ['harassment', 'harassment/threatening']);
        categories.other = this.pickMax(scores, [
            'self-harm',
            'self-harm/intent',
            'self-harm/instructions'
        ]);

        const score = Math.max(...Object.values(categories));

        return {
            ...createModerationResult({
                score,
                categories,
                matchedTerms: []
            }),
            source: 'openai'
        };
    }

    private pickMax(scores: Record<string, number>, keys: string[]): number {
        return keys.reduce((max, key) => Math.max(max, scores[key] ?? 0), 0);
    }
}
