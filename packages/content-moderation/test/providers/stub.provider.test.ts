import { afterEach, describe, expect, it, vi } from 'vitest';
import { StubProvider } from '../../src/providers/stub.provider.js';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('StubProvider', () => {
    it('preserves the v1 blocked word behavior', async () => {
        const provider = new StubProvider({ blockedWords: ['badword'], blockedDomains: [] });

        const result = await provider.classify({ text: 'Contains badword here.' });

        expect(result.source).toBe('stub');
        expect(result.score).toBe(1);
        expect(result.categories.other).toBe(1);
        expect(result.matchedTerms).toEqual(['badword']);
    });

    it('matches blocked domains by hostname and subdomain', async () => {
        const provider = new StubProvider({ blockedWords: [], blockedDomains: ['spam.com'] });

        const result = await provider.classify({ text: 'Visit https://sub.spam.com/deals now' });

        expect(result.score).toBe(1);
        expect(result.matchedTerms).toEqual(['spam.com']);
    });

    it('reads legacy env vars when no overrides are provided', async () => {
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'legacyword');

        const provider = new StubProvider();
        const result = await provider.classify({ text: 'legacyword is present' });

        expect(result.matchedTerms).toEqual(['legacyword']);
    });
});
