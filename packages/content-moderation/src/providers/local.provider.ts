import {
    type InternalModerationResult,
    type ModerationProvider,
    ProviderError
} from '../engine/provider.js';
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

    /**
     * Scores the text against the blocklist.
     *
     * @throws {ProviderError} When the blocklist is EMPTY. An empty list is not
     * a clean verdict, it is the absence of one, and the difference decides
     * whether the text gets published (HOS-1069). This provider's job is to be
     * the fallback when OpenAI cannot be reached; with nothing to compare
     * against it has no opinion, and reporting `score: 0` would hand the
     * caller a clean bill of health issued by a judge holding no law. Throwing
     * routes the orchestrator to its degraded result instead, which is the
     * fail-closed path it always had.
     *
     * A list that HAS terms and matches none of them is the opposite case and
     * returns 0 as before: there the text was judged, and it is clean.
     */
    async classify(input: { text: string }): Promise<InternalModerationResult> {
        const terms = await this.termLoader();

        if (terms.length === 0) {
            throw new ProviderError(
                'local blocklist is empty — no terms to classify against, so no verdict can be given'
            );
        }

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
