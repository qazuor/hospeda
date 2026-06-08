import { describe, expect, it, vi } from 'vitest';
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
