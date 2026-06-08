import type { InternalModerationResult, ModerationProvider } from '../engine/provider.js';
import {
    createModerationResult,
    createZeroCategories,
    extractHostnames,
    uniquePush
} from '../engine/shared.js';
import type { ModerationCategory } from '../types.js';

export type LocalModerationTerm = {
    readonly term: string;
    readonly kind: 'word' | 'domain';
    readonly category: ModerationCategory;
    readonly severity: number;
};

type LocalProviderOptions = {
    termLoader?: () => Promise<readonly LocalModerationTerm[]>;
};

export class LocalProvider implements ModerationProvider {
    readonly name = 'local' as const;
    private readonly termLoader: () => Promise<readonly LocalModerationTerm[]>;

    constructor(options: LocalProviderOptions = {}) {
        this.termLoader = options.termLoader ?? (async () => []);
    }

    async classify(input: { text: string }): Promise<InternalModerationResult> {
        const terms = await this.termLoader();
        const matchedTerms: string[] = [];
        const categories = { ...createZeroCategories() };
        const lowerText = input.text.toLowerCase();
        const hostnames = extractHostnames(input.text);

        for (const term of terms) {
            const normalizedTerm = term.term.trim().toLowerCase();
            const matched =
                term.kind === 'domain'
                    ? this.matchesDomain(hostnames, normalizedTerm)
                    : lowerText.includes(normalizedTerm);

            if (!matched) continue;

            uniquePush(matchedTerms, normalizedTerm);
            const category = term.category;
            categories[category] = Math.max(categories[category], term.severity);
        }

        const score = Math.max(...Object.values(categories));

        return {
            ...createModerationResult({ score, categories, matchedTerms }),
            source: 'local'
        };
    }

    private matchesDomain(hostnames: string[], domain: string): boolean {
        return hostnames.some((hostname) => hostname === domain || hostname.endsWith(`.${domain}`));
    }
}
