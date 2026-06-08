import type { InternalModerationResult, ModerationProvider } from '../engine/provider.js';
import {
    createModerationResult,
    createZeroCategories,
    extractHostnames,
    parseBlocklist,
    uniquePush
} from '../engine/shared.js';

type StubProviderOptions = {
    blockedWords?: readonly string[];
    blockedDomains?: readonly string[];
};

export class StubProvider implements ModerationProvider {
    readonly name = 'stub' as const;

    private readonly blockedWords: readonly string[];
    private readonly blockedDomains: readonly string[];

    constructor(options: StubProviderOptions = {}) {
        this.blockedWords =
            options.blockedWords ?? parseBlocklist(process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS);
        this.blockedDomains =
            options.blockedDomains ?? parseBlocklist(process.env.HOSPEDA_MESSAGING_BLOCKED_DOMAINS);
    }

    async classify(input: { text: string }): Promise<InternalModerationResult> {
        const matchedTerms: string[] = [];
        const lowerText = input.text.toLowerCase();

        for (const word of this.blockedWords) {
            if (lowerText.includes(word)) {
                uniquePush(matchedTerms, word);
            }
        }

        const hostnames = extractHostnames(input.text);
        for (const hostname of hostnames) {
            for (const domain of this.blockedDomains) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    uniquePush(matchedTerms, domain);
                }
            }
        }

        const categories = { ...createZeroCategories() };
        const score = matchedTerms.length > 0 ? 1 : 0;
        if (score === 1) {
            categories.other = 1;
        }

        return {
            ...createModerationResult({ score, categories, matchedTerms }),
            source: 'stub'
        };
    }
}
