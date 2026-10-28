/**
 * @file gastronomia-detail.test.ts
 * @description Source-read tests for the venue detail page (SPEC-239 T-054).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/comer-y-salir/[slug].astro'),
    'utf8'
);

describe('comer-y-salir/[slug].astro', () => {
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
        it('fetches the listing via venueApi.getBySlug', () => {
            expect(src).toContain('venueApi.getBySlug');
        });

        it('uses Promise.allSettled for parallel reviews + faqs fetch', () => {
            expect(src).toContain('Promise.allSettled');
            expect(src).toContain('venueApi.getReviews');
            expect(src).toContain('venueApi.getFaqs');
        });
    });

    describe('transform', () => {
        it('transforms raw API response via toVenueDetailPageProps', () => {
            expect(src).toContain('toVenueDetailPageProps');
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

        it('propagates 410 (GONE) for soft-deleted entities, 404 otherwise (HOS-117 T-022)', () => {
            expect(src).toContain(
                'return new Response(null, { status: result.error.status === 410 ? 410 : 404 });'
            );
        });

        it('reads no old publication column: a non-PUBLISHED listing 404s through the public read (HOS-1641)', () => {
            // The public read answers only PUBLISHED (AC:V5:5); every other state
            // is the same 404 as an unknown slug, already returned by `!result.ok`.
            expect(src).not.toMatch(/raw\.(visibility|lifecycleState|moderationState)/);
            expect(src).toContain('if (!result.ok)');
        });
    });

    describe('detail blocks', () => {
        it('renders VenueDetailHeader', () => {
            expect(src).toContain('VenueDetailHeader');
        });

        it('renders VenueDescription', () => {
            expect(src).toContain('VenueDescription');
        });

        it('renders OpeningHoursSection when openingHours is present', () => {
            expect(src).toContain('OpeningHoursSection');
            expect(src).toContain('venue.openingHours');
        });

        it('renders VenueContactBlock for menu + social', () => {
            expect(src).toContain('VenueContactBlock');
        });

        it('reuses FaqAccordion from accommodation components', () => {
            expect(src).toContain('FaqAccordion');
        });

        it('renders ImageGallery for the photo gallery', () => {
            expect(src).toContain('ImageGallery');
        });
    });

    describe('richDescription', () => {
        it('passes richDescription to VenueDescription', () => {
            expect(src).toContain('richDescription={venue.richDescription}');
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
            expect(src).toContain('comer-y-salir/');
        });
    });

    describe('FAQs', () => {
        it('prefers inline entity FAQs over standalone endpoint', () => {
            expect(src).toContain('venue.faqs.length > 0');
        });
    });

    describe('view tracking (HOS-734)', () => {
        it('mounts EntityViewTracker with entityType VENUE, client:idle', () => {
            expect(src).toContain(
                "import { EntityViewTracker } from '@/components/analytics/EntityViewTracker.client';"
            );
            expect(src).toContain('<EntityViewTracker');
            expect(src).toContain('client:idle');
            expect(src).toContain('entityType="VENUE"');
            expect(src).toContain('entityId={venue.id}');
        });
    });
});
