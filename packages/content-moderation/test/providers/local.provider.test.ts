import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../src/engine/provider.js';
import type { LocalModerationTerm } from '../../src/providers/local.provider.js';
import { LocalProvider } from '../../src/providers/local.provider.js';

function createTerm(overrides: Partial<LocalModerationTerm>): LocalModerationTerm {
    return {
        term: 'default',
        kind: 'word',
        category: 'other',
        severity: 1,
        ...overrides
    };
}

describe('LocalProvider', () => {
    it('scores the max severity per category and returns matched terms', async () => {
        const termModel = {
            termLoader: vi.fn().mockResolvedValue([
                createTerm({ term: 'badword', category: 'harassment', severity: 0.6 }),
                createTerm({
                    term: 'spam.com',
                    kind: 'domain',
                    category: 'spam',
                    severity: 0.9
                })
            ])
        };
        const provider = new LocalProvider({ termLoader: termModel.termLoader });

        const result = await provider.classify({
            text: 'badword here and https://www.spam.com/path'
        });

        expect(result.source).toBe('local');
        expect(result.score).toBe(0.9);
        expect(result.categories.harassment).toBe(0.6);
        expect(result.categories.spam).toBe(0.9);
        expect(result.matchedTerms).toEqual(['badword', 'spam.com']);
    });

    /**
     * REGRESSION — HOS-1069.
     *
     * An empty blocklist is not a verdict. The provider exists to be the
     * FALLBACK when OpenAI cannot be reached, and with nothing to compare
     * against it has no opinion to offer — so it must say so instead of
     * reporting the clean score that publishes the text.
     *
     * Measured in production before the fix: the table is empty in all three
     * environments, so every OpenAI timeout fell through to a `score: 0` and
     * the content went straight out, `APPROVED`.
     */
    it('refuses to score at all when the blocklist is empty', async () => {
        const termModel = { termLoader: vi.fn().mockResolvedValue([]) };
        const provider = new LocalProvider({ termLoader: termModel.termLoader });

        await expect(provider.classify({ text: 'anything at all' })).rejects.toThrow(ProviderError);
    });

    /**
     * The other side of that line, and the reason it is drawn where it is: a
     * list that HAS terms and matches none of them IS a verdict. The text was
     * judged and came back clean.
     */
    it('returns a clean result when no term matches', async () => {
        const termModel = {
            termLoader: vi.fn().mockResolvedValue([createTerm({ term: 'blocked' })])
        };
        const provider = new LocalProvider({ termLoader: termModel.termLoader });

        const result = await provider.classify({ text: 'perfectly clean text' });

        expect(result.score).toBe(0);
        expect(result.matchedTerms).toEqual([]);
        expect(Object.values(result.categories).every((value) => value === 0)).toBe(true);
    });
});
