/**
 * @file Pagination.test.ts
 * @description Source-based tests for Pagination.astro (Astro components cannot
 * be rendered in Vitest, so we assert on the component source — the project's
 * documented approach for .astro coverage).
 *
 * SPEC-157 follow-up (pagination SEO): Google deprecated rel="prev"/rel="next"
 * as an indexing signal, so the prev/next links must NOT emit them.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/feedback/Pagination.astro'),
    'utf8'
);

describe('Pagination.astro (pagination SEO)', () => {
    it('does NOT emit rel="prev" on the previous link', () => {
        expect(src).not.toContain('rel="prev"');
    });

    it('does NOT emit rel="next" on the next link', () => {
        expect(src).not.toContain('rel="next"');
    });

    it('still renders prev/next anchors with their accessible labels', () => {
        // Sanity check that removing rel didn't strip the controls themselves.
        expect(src).toContain('pagination__link--prev');
        expect(src).toContain('pagination__link--next');
        expect(src).toContain('aria-label={labels.previous}');
        expect(src).toContain('aria-label={labels.next}');
    });
});
