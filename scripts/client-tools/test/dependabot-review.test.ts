import { describe, expect, it } from 'bun:test';
import {
    extractReleaseNotesUrls,
    versionImpact
} from '../src/commands/dependabot-review/dependabot-review.ts';

describe('dependabot review evidence', () => {
    it('extracts bounded release links without HTML or trailing prose', () => {
        const urls = extractReleaseNotesUrls(
            'See https://github.com/vitest-dev/vitest/releases/tag/v5.0.0">@vitest/ui\'s notes and https://npmjs.com/package/foo#readme.'
        );

        expect(urls).toEqual([
            'https://github.com/vitest-dev/vitest/releases/tag/v5.0.0',
            'https://npmjs.com/package/foo'
        ]);
    });

    it('deduplicates links and ignores unrelated URLs', () => {
        const urls = extractReleaseNotesUrls(
            'https://example.com/issue/1 https://github.com/a/b/compare/v1...v2 https://github.com/a/b/compare/v1...v2'
        );

        expect(urls).toEqual(['https://github.com/a/b/compare/v1...v2']);
    });

    it('keeps semver classification independent from evidence parsing', () => {
        expect(versionImpact('Bump foo from 1.2.3 to 1.3.0')).toBe('minor');
    });
});
