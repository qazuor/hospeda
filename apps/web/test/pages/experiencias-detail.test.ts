/**
 * @file experiencias-detail.test.ts
 * @description Source-read tests for the experience detail page (SPEC-240 T-030).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/experiencias/[slug].astro'),
    'utf8'
);

describe('experiencias/[slug].astro', () => {
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
        it('fetches the listing via experiencesApi.getBySlug', () => {
            expect(src).toContain('experiencesApi.getBySlug');
        });

        it('uses Promise.allSettled for parallel reviews + faqs fetch', () => {
            expect(src).toContain('Promise.allSettled');
            expect(src).toContain('experiencesApi.getReviews');
            expect(src).toContain('experiencesApi.getFaqs');
        });
    });

    describe('transform', () => {
        it('transforms raw API response via toExperienceDetailPageProps', () => {
            expect(src).toContain('toExperienceDetailPageProps');
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
            expect(src).toContain("visibility !== 'PUBLIC'");
        });
    });

    describe('detail blocks', () => {
        it('renders ExperienceHero with hero, type, pricing, rating', () => {
            expect(src).toContain('ExperienceHero');
        });

        it('renders ExperienceInfo with description, hours, social', () => {
            expect(src).toContain('ExperienceInfo');
        });

        it('renders ExperienceContactCTA with WhatsApp link', () => {
            expect(src).toContain('ExperienceContactCTA');
        });

        it('renders ExperienceReviews as an interactive island', () => {
            expect(src).toContain('ExperienceReviews');
            expect(src).toContain('client:visible');
        });

        it('renders ExperienceFaqs as a static SSR accordion', () => {
            expect(src).toContain('ExperienceFaqs');
        });

        it('renders ImageGallery for the photo gallery', () => {
            expect(src).toContain('ImageGallery');
        });
    });

    describe('gallery images', () => {
        it('extracts gallery from media.gallery on the raw API response', () => {
            expect(src).toContain('media');
            expect(src).toContain('gallery');
        });
    });

    describe('reviews island props', () => {
        it('passes experienceId to ExperienceReviews', () => {
            expect(src).toContain('experienceId={experience.id}');
        });

        it('passes initialReviews to ExperienceReviews', () => {
            expect(src).toContain('initialReviews={reviews}');
        });

        it('passes isAuthenticated flag to ExperienceReviews', () => {
            expect(src).toContain('isAuthenticated={isAuthenticated}');
        });
    });

    describe('FAQs', () => {
        it('prefers inline entity FAQs over standalone endpoint', () => {
            expect(src).toContain('experience.faqs.length > 0');
        });
    });

    describe('layout', () => {
        it('uses DetailLayout', () => {
            expect(src).toContain('DetailLayout');
        });

        it('uses Breadcrumbs with experiencias link', () => {
            expect(src).toContain('Breadcrumbs');
            expect(src).toContain('experiencias/');
        });
    });

    describe('SEO', () => {
        it('builds canonical path with experiencias segment', () => {
            expect(src).toContain('buildUrl');
            expect(src).toContain('experiencias/');
        });

        it('falls back to experience.summary for SEO description', () => {
            expect(src).toContain('experience.summary');
        });
    });
});
