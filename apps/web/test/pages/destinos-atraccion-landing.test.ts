/**
 * @file destinos-atraccion-landing.test.ts
 * @description Source-based assertions for the attraction facet landing.
 *
 * Astro components cannot be rendered in Vitest, so these read the page source.
 * The behavioural half (which slugs reach the sitemap) is covered by real
 * handler tests in `sitemap-dynamic.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE = resolve(__dirname, '../../src/pages/[lang]/destinos/atraccion/[slug]/index.astro');
const HEADER = resolve(__dirname, '../../src/components/destination/DestinationDetailHeader.astro');

const pageSrc = readFileSync(PAGE, 'utf8');
const headerSrc = readFileSync(HEADER, 'utf8');

describe('attraction landing page', () => {
    it('lists the destinations offering the attraction', () => {
        expect(pageSrc).toContain('attractionsApi.getDestinations');
        expect(pageSrc).toContain('<DestinationCard');
        expect(pageSrc).toContain('toDestinationCardProps');
    });

    it('does not resurrect the fields the attractions table never had', () => {
        // The page used to read `featuredImage` and `contentHtml`, neither of
        // which exists as a column, so it rendered a placeholder plus a
        // one-line string.
        expect(pageSrc).not.toContain('attraction.featuredImage');
        expect(pageSrc).not.toContain('attraction.contentHtml');
    });

    it('emits BreadcrumbList and ItemList structured data', () => {
        expect(pageSrc).toContain('<Breadcrumbs');
        expect(pageSrc).not.toContain('BreadcrumbJsonLd');
        expect(pageSrc).toContain('<ItemListJsonLd');
    });

    it('mounts the complete breadcrumb trail through the layout slot', () => {
        expect(pageSrc).toMatch(/<Breadcrumbs\s+slot="breadcrumbs"/);
        expect(pageSrc).toContain("breadcrumbLabel({ t, key: 'destinations' })");
        expect(pageSrc).toContain("path: 'destinos'");
        expect(pageSrc).toContain('{ label: name }');
    });

    it('stays indexable — it carries real data, unlike the amenity stub', () => {
        expect(pageSrc).not.toContain('noindex={true}');
    });

    it('degrades to an empty state instead of a blank page', () => {
        expect(pageSrc).toContain('<EmptyState');
        expect(pageSrc).toContain('<ErrorBanner');
    });

    it('titles the page after the question it answers', () => {
        expect(pageSrc).toContain("t('destinations.byAttraction.heading'");
    });
});

describe('inbound links from the destination header', () => {
    it('links each attraction badge to its landing', () => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting the Astro source expression
        expect(headerSrc).toContain('destinos/atraccion/${a.slug}');
    });

    it('falls back to plain text when the payload carries no slug', () => {
        // The embedded attraction shape only gained `slug` alongside this
        // landing; a badge must never become a dead link if it is missing.
        expect(headerSrc).toContain('a.slug ?');
    });
});
