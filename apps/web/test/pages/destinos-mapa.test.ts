import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/mapa.astro'),
    'utf8'
);

describe('destination map layout integration', () => {
    it('routes breadcrumbs and the page header through ListingLayout slots', () => {
        expect(source).toContain('<ListingLayout');
        expect(source).toMatch(/<Breadcrumbs\s+slot="breadcrumbs"/);
        expect(source).toMatch(/<ListingPageHeader\s+slot="page-header"/);
        expect(source).toContain("breadcrumbLabel({ t, key: 'destinations' })");
        expect(source).toContain("breadcrumbLabel({ t, key: 'map' })");
        expect(source).not.toContain('dest-listing__header');
    });

    it('keeps the map noindex and opts out of breadcrumb structured data', () => {
        expect(source).toContain('noindex={true}');
        const trail = source.match(/<Breadcrumbs[\s\S]*?\/>/)?.[0];
        expect(trail).toContain('jsonLd={false}');
    });

    it('delegates result counts to the layout without reporting zero on failed reads', () => {
        // D34 (HOS-2655): the count lives on the List/Map selector line and is
        // rendered only inside the successful-read branch, never as a zero.
        expect(source).not.toContain('totalCount=');
        expect(source).toMatch(
            /\{!hasError && cards\.length > 0 && \(\s*<div class="map-toolbar">\s*<p>\{tPlural\('ui\.listing\.resultsFound', total\)\}<\/p>/
        );
        expect(source).not.toContain('class="listing-results-summary"');
        expect(source).toContain('<ErrorBanner');
        expect(source).toContain('<EmptyState');
        expect(source).toContain('<ListingMap');
    });
});
