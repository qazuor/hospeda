/**
 * @file GastronomyCard.test.ts
 * @description Source-read tests for GastronomyCard.astro (SPEC-239 T-053).
 * Astro components cannot be rendered in Vitest; we read the source and assert
 * on its structural content — the documented web app approach for .astro coverage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/gastronomy/GastronomyCard.astro'),
    'utf8'
);

describe('GastronomyCard.astro', () => {
    describe('locale access', () => {
        it('uses Astro.locals.locale via createTranslations(locale), not Astro.params.lang', () => {
            // Must import SupportedLocale and accept locale as a Prop
            expect(src).toContain('readonly locale: SupportedLocale');
            // Must NOT read Astro.params.lang
            expect(src).not.toContain('Astro.params.lang');
        });
    });

    describe('routing', () => {
        it('builds the detail link with buildUrl and gastronomia path', () => {
            expect(src).toContain('buildUrl');
            expect(src).toContain('gastronomia/');
        });

        it('uses the slug from data.slug for the detail URL', () => {
            expect(src).toContain('data.slug');
        });
    });

    describe('type badge', () => {
        it('resolves type label via t() with gastronomy.types namespace', () => {
            expect(src).toContain('gastronomy.types.');
        });

        it('renders the type label in a badge element', () => {
            expect(src).toContain('gastro-card__type-badge');
        });
    });

    describe('price range badge', () => {
        it('resolves price range label via t() with gastronomy.card.priceRange namespace', () => {
            expect(src).toContain('gastronomy.card.priceRange.');
        });
    });

    describe('rating', () => {
        it('renders star icons when averageRating is present', () => {
            expect(src).toContain('data.averageRating > 0');
            expect(src).toContain('gastro-card__stars');
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
            expect(src).toContain('gastro-card__location-bar');
        });
    });

    describe('featured badge', () => {
        it('renders the featured badge when data.isFeatured is true', () => {
            expect(src).toContain('data.isFeatured');
            expect(src).toContain('featured-badge');
        });
    });

    describe('open-now badge', () => {
        it('imports computeOpenNowStatus from the hours helper', () => {
            expect(src).toContain('computeOpenNowStatus');
            expect(src).toContain('gastronomy-hours');
        });

        it('only renders the badge when openNowStatus is non-null', () => {
            expect(src).toContain('openNowStatus !== null');
        });

        it('uses gastronomy.card.openNow i18n key', () => {
            expect(src).toContain('gastronomy.card.openNow');
        });

        it('uses gastronomy.card.closedNow i18n key', () => {
            expect(src).toContain('gastronomy.card.closedNow');
        });
    });

    describe('eager image loading', () => {
        it('declares an optional readonly eager prop with false default', () => {
            expect(src).toContain('readonly eager?: boolean');
            expect(src).toMatch(/eager\s*=\s*false/);
        });

        it('uses conditional loading expression on both image branches', () => {
            const matches = src.match(/loading=\{eager \? 'eager' : 'lazy'\}/g);
            expect(matches).not.toBeNull();
            expect(matches!.length).toBeGreaterThanOrEqual(2);
        });

        it('sets fetchpriority conditionally on both image branches', () => {
            const matches = src.match(/fetchpriority=\{eager \? 'high' : undefined\}/g);
            expect(matches).not.toBeNull();
            expect(matches!.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('image area', () => {
        it('uses a view transition name keyed to the gastronomy slug', () => {
            expect(src).toContain('transition:name={`gastronomy-');
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
        it('uses --core-card for background color', () => {
            expect(src).toContain('var(--core-card)');
        });

        it('uses --radius-md for border radius', () => {
            expect(src).toContain('var(--radius-md');
        });

        it('uses --brand-accent for the CTA / price range color', () => {
            expect(src).toContain('var(--brand-accent)');
        });

        it('does not contain Tailwind utility class patterns', () => {
            // Tailwind classes have the form `text-{size}`, `bg-{color}`, etc.
            expect(src).not.toMatch(/class="[^"]*\b(bg-|text-|p-|m-|flex-|grid-)\w/);
        });
    });
});
