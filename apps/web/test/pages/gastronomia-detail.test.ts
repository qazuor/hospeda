/**
 * @file gastronomia-detail.test.ts
 * @description Source-read tests for the gastronomy detail page (SPEC-239 T-054).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/gastronomia/[slug].astro'),
    'utf8'
);

describe('gastronomia/[slug].astro', () => {
    describe('locale', () => {
        it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
            expect(src).toContain('Astro.locals.locale');
            expect(src).not.toContain('Astro.params.lang');
        });
    });

    describe('rendering strategy', () => {
        it('sets prerender = false (SSR on-demand)', () => {
            expect(src).toContain('prerender = false');
        });
    });

    describe('API calls', () => {
        it('fetches the listing via gastronomyApi.getBySlug', () => {
            expect(src).toContain('gastronomyApi.getBySlug');
        });

        it('uses Promise.allSettled for parallel reviews + faqs fetch', () => {
            expect(src).toContain('Promise.allSettled');
            expect(src).toContain('gastronomyApi.getReviews');
            expect(src).toContain('gastronomyApi.getFaqs');
        });
    });

    describe('transform', () => {
        it('transforms raw API response via toGastronomyDetailPageProps', () => {
            expect(src).toContain('toGastronomyDetailPageProps');
        });
    });

    describe('404 handling', () => {
        it('returns 404 when slug is missing', () => {
            expect(src).toContain('if (!slug)');
            expect(src).toContain('return new Response(null, { status: 404 })');
        });

        it('returns 404 when API call fails (result.ok is false)', () => {
            expect(src).toContain('if (!result.ok)');
        });

        it('returns 404 for non-PUBLIC visibility values', () => {
            // The visibility check must exclude PRIVATE and RESTRICTED
            expect(src).toContain("visibility !== 'PUBLIC'");
        });
    });

    describe('detail blocks', () => {
        it('renders GastronomyDetailHeader', () => {
            expect(src).toContain('GastronomyDetailHeader');
        });

        it('renders GastronomyDescription', () => {
            expect(src).toContain('GastronomyDescription');
        });

        it('renders OpeningHoursSection when openingHours is present', () => {
            expect(src).toContain('OpeningHoursSection');
            expect(src).toContain('gastronomy.openingHours');
        });

        it('renders GastronomyContactBlock for menu + social', () => {
            expect(src).toContain('GastronomyContactBlock');
        });

        it('reuses FaqAccordion from accommodation components', () => {
            expect(src).toContain('FaqAccordion');
        });

        it('renders ImageGallery for the photo gallery', () => {
            expect(src).toContain('ImageGallery');
        });
    });

    describe('richDescription', () => {
        it('passes richDescription to GastronomyDescription', () => {
            expect(src).toContain('richDescription={gastronomy.richDescription}');
        });
    });

    describe('description rendering', () => {
        it('uses renderPlain for the plain-text description', () => {
            expect(src).toContain('renderPlain');
        });
    });

    describe('layout', () => {
        it('uses DetailLayout', () => {
            expect(src).toContain('DetailLayout');
        });

        it('uses Breadcrumbs with gastronomia link', () => {
            expect(src).toContain('Breadcrumbs');
            expect(src).toContain('gastronomia/');
        });
    });

    describe('FAQs', () => {
        it('prefers inline entity FAQs over standalone endpoint', () => {
            expect(src).toContain('gastronomy.faqs.length > 0');
        });
    });
});
