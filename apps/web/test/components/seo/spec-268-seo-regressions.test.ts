/**
 * @file spec-268-seo-regressions.test.ts
 * @description Source-based regression coverage for SPEC-268 SEO fixes.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../../src');
const gastronomyDetail = readFileSync(
    resolve(ROOT, 'pages/[lang]/gastronomia/[slug].astro'),
    'utf8'
);
const experienceDetail = readFileSync(
    resolve(ROOT, 'pages/[lang]/experiencias/[slug].astro'),
    'utf8'
);
const mapsAccommodation = readFileSync(
    resolve(ROOT, 'pages/[lang]/alojamientos/mapa.astro'),
    'utf8'
);
const mapsDestination = readFileSync(resolve(ROOT, 'pages/[lang]/destinos/mapa.astro'), 'utf8');
const photosPage = readFileSync(
    resolve(ROOT, 'pages/[lang]/alojamientos/[slug]/fotos.astro'),
    'utf8'
);
const attractionLanding = readFileSync(
    resolve(ROOT, 'pages/[lang]/destinos/atraccion/[slug]/index.astro'),
    'utf8'
);
const robotsPage = readFileSync(resolve(ROOT, 'pages/robots.txt.ts'), 'utf8');
const seoHead = readFileSync(resolve(ROOT, 'components/seo/SEOHead.astro'), 'utf8');

describe('SPEC-268 SEO regressions', () => {
    it('gastronomy detail treats empty SEO fields as absent and falls back', () => {
        expect(gastronomyDetail).toContain('seo?.title?.trim() || gastronomy.name');
        expect(gastronomyDetail).toContain('seo?.description?.trim() ||');
    });

    it('experience detail treats empty SEO fields as absent and falls back', () => {
        expect(experienceDetail).toContain('seo?.title?.trim() || experience.name');
        expect(experienceDetail).toContain('seo?.description?.trim() ||');
    });

    it('map pages are noindex', () => {
        expect(mapsAccommodation).toContain('noindex={true}');
        expect(mapsDestination).toContain('noindex={true}');
    });

    it('photos page is noindex and canonicalizes to the parent detail page', () => {
        expect(photosPage).toContain('noindex={true}');
        expect(photosPage).toContain('canonicalPath={backUrl}');
    });

    it('attraction landing anchors its structured data on its canonical path', () => {
        // This used to assert `TouristAttractionJsonLd`. That page is no longer
        // an attraction DETAIL page: it now answers "which destinations offer
        // this?" and renders a list of destination cards, so BreadcrumbList +
        // ItemList are its correct schema and TouristAttraction would misdescribe
        // it. Its own shape is covered by `destinos-atraccion-landing.test.ts`;
        // what SPEC-268 still owns here is that the structured data points at
        // the page's canonical URL rather than at the request URL.
        expect(attractionLanding).toContain('const canonicalPath = buildUrl(');
        expect(attractionLanding).toContain('${siteOrigin}${canonicalPath}');
    });

    it('robots disallows reset-password and verify-email routes', () => {
        expect(robotsPage).toContain("'/*/reset-password'");
        expect(robotsPage).toContain("'/*/verify-email'");
        expect(robotsPage).toContain("'/*/verify-email-sent'");
    });

    it('SEOHead emits positive robots with max-image-preview on indexable pages', () => {
        expect(seoHead).toContain('index,follow,max-image-preview:large');
    });
});
