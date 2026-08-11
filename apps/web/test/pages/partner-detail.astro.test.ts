/**
 * HOS-294 T-019 / T-021 — source guards for the partner detail page.
 *
 * ⚠️ Scope, stated plainly: Vitest cannot render `.astro`, so these assertions
 * read the SOURCE. They prove what the page DECLARES, not what it renders — a
 * distinction that matters, and the reason the interesting behaviour (the three
 * status codes, the indexability verdict) is unit-tested where it actually
 * lives, in `partner-indexable.test.ts` and the API's `get-by-slug.test.ts`.
 *
 * What source guards ARE good for is exactly what is pinned below: properties
 * that are invisible at runtime until they are already wrong in production — a
 * hardcoded `noindex`, a session read on an edge-cached page, the tier leaking
 * into public markup.
 *
 * @module test/pages/partner-detail.astro
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/partners/[slug].astro'),
    'utf8'
);

describe('the partner detail page declares its indexability, never hardcodes it', () => {
    it('derives noindex from the shared predicate', () => {
        // Assert — AC-7: the page and the sitemap must decide with the same
        // function, so the sitemap can never advertise a URL served `noindex`.
        expect(src).toContain('evaluatePartnerIndexability');
        expect(src).toContain('noindex={!isIndexable}');
    });

    it('never writes a literal noindex value', () => {
        // Assert — a literal would silently decouple this page from the
        // sitemap, which is the one failure the shared predicate exists for.
        expect(src).not.toContain('noindex={true}');
        expect(src).not.toContain('noindex={false}');
    });
});

describe('the page distinguishes a retired URL from one that never existed', () => {
    it('propagates 410 and falls back to 404', () => {
        // Assert — D-3b. Collapsing these into a single 404 renders identically
        // in a browser and throws away the deindex signal.
        expect(src).toContain('result.error.status === 410 ? 410 : 404');
    });
});

describe('the page is actor-blind, because it is edge-cached', () => {
    it('never reads the session in the frontmatter', () => {
        // Assert — AC-13. The response is stored in a shared bucket keyed with
        // no actor component, so one visitor's render is replayed to everyone.
        expect(src).not.toContain('Astro.locals.user');
    });
});

describe('the tier decides the page but is never rendered on it', () => {
    it('reads the tier only to feed the indexability predicate', () => {
        // Arrange — the tier is mentioned on exactly ONE line: `tier: raw.tier`,
        // the predicate input. Counting lines rather than tokens, because that
        // single line legitimately names it twice. Any OTHER line touching the
        // tier would be internal commercial state heading for a public page.
        const tierLines = src.split('\n').filter((line) => /\btier\b/.test(line));

        // Assert
        expect(tierLines).toHaveLength(1);
        expect(tierLines[0]).toContain('tier: raw.tier as string | null');
    });

    it('does not render the tier in the markup', () => {
        // Arrange — everything after the frontmatter fence.
        const markup = src.split('---')[2] ?? '';

        // Assert
        expect(markup).not.toContain('tier');
        expect(markup).not.toContain('partners.tiers');
    });
});
