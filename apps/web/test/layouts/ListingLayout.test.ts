/**
 * @file ListingLayout.test.ts
 * @description Source-based tests for ListingLayout.astro (Astro components
 * cannot be rendered in Vitest, so we assert on the component source — the
 * project's documented approach for .astro coverage).
 *
 * SPEC-157 follow-up:
 *  - ListingLayout must expose a `noindex` prop and forward it to SEOHead so
 *    facet/filter sub-pages can opt into `noindex,follow`.
 *  - Mirrors DefaultLayout's existing `noindex` handling.
 *
 * BETA-22 follow-up:
 *  - The results-summary sentence ("Mostrando N de M ...") moved out of the
 *    sticky page header (ListingPageHeader) and into ListingLayout, at the
 *    top of the content column. These tests guard the new placement AND
 *    guard against the summary silently reappearing in the header.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUTS_DIR = resolve(__dirname, '../../src/layouts');
const COMPONENTS_DIR = resolve(__dirname, '../../src/components/shared/layout');
const src = readFileSync(resolve(LAYOUTS_DIR, 'ListingLayout.astro'), 'utf8');

describe('ListingLayout.astro (noindex support)', () => {
    it('declares a readonly noindex prop defaulting to false', () => {
        expect(src).toContain('readonly noindex?: boolean');
        expect(src).toContain('noindex = false');
    });

    it('forwards noindex to SEOHead', () => {
        expect(src).toContain('noindex={noindex}');
    });

    it('mirrors DefaultLayout, which already forwards noindex to SEOHead', () => {
        const defaultLayoutSrc = readFileSync(resolve(LAYOUTS_DIR, 'DefaultLayout.astro'), 'utf8');
        expect(defaultLayoutSrc).toContain('readonly noindex?: boolean');
        expect(defaultLayoutSrc).toContain('noindex={noindex}');
    });
});

describe('ListingLayout.astro (BETA-22 results summary placement)', () => {
    it('declares totalCount and filterSummary props', () => {
        // Arrange: source already loaded at module scope.
        // Act / Assert
        expect(src).toContain('readonly totalCount?: number');
        expect(src).toContain('readonly filterSummary?: string');
    });

    it('computes the summary label with filterSummary taking precedence over totalCount', () => {
        // Arrange
        const computationSnippet = 'filterSummary ??\n\t(totalCount !== undefined';

        // Act / Assert: `??` means filterSummary wins whenever it is provided,
        // falling back to the generic "N resultados encontrados" built from
        // totalCount only when filterSummary is absent.
        expect(src).toContain(computationSnippet);
    });

    it('renders .listing-results-summary inside the data-listing-swap="content" region', () => {
        // Arrange
        const contentRegionStart = src.indexOf('data-listing-swap="content"');
        const summaryIdx = src.indexOf('class="listing-results-summary"');
        const slotIdx = src.indexOf('<slot />', contentRegionStart);
        const closingContentDiv = src.indexOf(
            '<div class="listing-pagination">',
            contentRegionStart
        );

        // Act / Assert: the summary must sit after the content region opens,
        // and before both the default slot (the results grid) and the
        // pagination block — i.e. as a leading caption above the results.
        expect(contentRegionStart).toBeGreaterThan(-1);
        expect(summaryIdx).toBeGreaterThan(contentRegionStart);
        expect(summaryIdx).toBeLessThan(slotIdx);
        expect(summaryIdx).toBeLessThan(closingContentDiv);
    });

    it('marks the summary as a live region for screen readers', () => {
        // Arrange
        const summaryLineStart = src.indexOf('<p class="listing-results-summary"');
        const summaryLineEnd = src.indexOf('>', summaryLineStart);
        const summaryTag = src.slice(summaryLineStart, summaryLineEnd);

        // Act / Assert
        expect(summaryTag).toContain('role="status"');
        expect(summaryTag).toContain('aria-live="polite"');
    });
});

describe('ListingPageHeader.astro (BETA-22 regression guard)', () => {
    const headerSrc = readFileSync(resolve(COMPONENTS_DIR, 'ListingPageHeader.astro'), 'utf8');

    it('no longer declares totalCount or filterSummary props', () => {
        // Arrange: headerSrc loaded above.
        // Act / Assert: guards against the summary silently reappearing in
        // the sticky page header instead of the content column.
        expect(headerSrc).not.toContain('totalCount');
        expect(headerSrc).not.toContain('filterSummary');
    });

    it('no longer renders the .listing-page-header__count element or its styles', () => {
        expect(headerSrc).not.toContain('listing-page-header__count');
    });
});
