/**
 * @file ExperienceCard.test.ts
 * @description Source-read tests for ExperienceCard.astro (SPEC-240 T-030).
 * Astro components cannot be rendered in Vitest; we read the source and assert
 * on its structural content — the documented web app approach for .astro coverage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/experience/ExperienceCard.astro'),
    'utf8'
);

describe('ExperienceCard.astro', () => {
    describe('locale access', () => {
        it('uses Astro.locals.locale via createTranslations(locale), not Astro.params.lang', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
            expect(src).not.toContain('Astro.params.lang');
        });
    });

    describe('routing', () => {
        it('builds the detail link with buildUrl and experiencias path', () => {
            expect(src).toContain('buildUrl');
            expect(src).toContain('experiencias/');
        });

        it('uses the slug from data.slug for the detail URL', () => {
            expect(src).toContain('data.slug');
        });
    });

    describe('type badge', () => {
        it('resolves type label via t() with experience.type namespace', () => {
            expect(src).toContain('experience.type.');
        });
    });

    describe('price tag', () => {
        it('renders ExperiencePriceTag for price display', () => {
            expect(src).toContain('ExperiencePriceTag');
        });

        it('passes priceFrom and isPriceOnRequest to ExperiencePriceTag', () => {
            expect(src).toContain('priceFrom={data.priceFrom}');
            expect(src).toContain('isPriceOnRequest={data.isPriceOnRequest}');
        });
    });

    describe('rating', () => {
        it('renders star icons when averageRating is present', () => {
            expect(src).toContain('data.averageRating > 0');
        });

        it('shows reviewsCount alongside the rating', () => {
            expect(src).toContain('data.reviewsCount');
        });
    });

    describe('destination', () => {
        it('renders the destination name from data.destinationName', () => {
            expect(src).toContain('data.destinationName');
        });

        it('has a location bar with a LocationIcon', () => {
            expect(src).toContain('LocationIcon');
        });
    });

    describe('featured badge', () => {
        it('renders the featured badge when data.isFeatured is true', () => {
            expect(src).toContain('data.isFeatured');
            expect(src).toContain('featured-badge');
        });
    });

    describe('new badge', () => {
        it('renders a "new" badge for recently created listings', () => {
            expect(src).toContain('isNew');
        });
    });

    describe('view transition', () => {
        it('uses a view transition name keyed to the experience slug', () => {
            expect(src).toContain('transition:name');
        });
    });

    describe('accessibility', () => {
        it('has an aria-label on the card link', () => {
            expect(src).toContain('aria-label={data.name}');
        });

        it('marks decorative elements as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });
    });

    describe('CSS tokens', () => {
        it('uses CSS custom properties (no Tailwind utility classes)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/class="[^"]*\b(bg-|text-|p-|m-|flex-|grid-)\w/);
        });
    });
});
