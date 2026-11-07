/**
 * @file VenueCard.test.ts
 * @description Source-read tests for VenueCard.astro (SPEC-239 T-053).
 * Astro components cannot be rendered in Vitest; we read the source and assert
 * on its structural content — the documented web app approach for .astro coverage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTITY_PUBLIC_PATHS } from '../../../src/lib/seo/entity-public-urls';
import { buildUrl } from '../../../src/lib/urls';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenueCard.astro'),
    'utf8'
);

/**
 * The badge now lives in a React island, so its styles moved to a CSS Module.
 * These tests read that file to keep the BETA-117 contrast guarantees.
 */
const badgeCss = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenueOpenNowBadge.module.css'),
    'utf8'
);

describe('VenueCard.astro', () => {
    describe('locale access', () => {
        it('uses Astro.locals.locale via createTranslations(locale), not Astro.params.lang', () => {
            // Must import SupportedLocale and accept locale as a Prop
            expect(src).toContain('readonly locale: SupportedLocale');
            // Must NOT read Astro.params.lang
            expect(src).not.toContain('Astro.params.lang');
        });
    });

    describe('routing', () => {
        it('TEST:6.1:6 links the card to the canonical /<lang>/comer-y-salir/<slug>/ page', () => {
            // The card composes the public path from the shared entity registry
            // and prefixes the locale; the retired `/gastronomia/` route is gone.
            expect(buildUrl({ locale: 'es', path: ENTITY_PUBLIC_PATHS.venue('la-parrilla') })).toBe(
                '/es/comer-y-salir/la-parrilla/'
            );
            expect(src).toContain('ENTITY_PUBLIC_PATHS.venue(data.slug)');
            expect(src).toContain('buildUrl');
            expect(src).not.toContain('gastronomia/');
        });

        it('uses the slug from data.slug for the detail URL', () => {
            expect(src).toContain('data.slug');
        });
    });

    describe('type badge', () => {
        it('resolves type label via t() with venue.types namespace', () => {
            expect(src).toContain('venue.types.');
        });

        it('renders the type label in a badge element', () => {
            expect(src).toContain('venue-card__type-badge');
        });
    });

    describe('price range badge', () => {
        it('resolves price range label via t() with venue.card.priceRange namespace', () => {
            expect(src).toContain('venue.card.priceRange.');
        });
    });

    describe('rating', () => {
        it('renders star icons when averageRating is present', () => {
            expect(src).toContain('data.averageRating > 0');
            expect(src).toContain('venue-card__stars');
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
            expect(src).toContain('venue-card__location-bar');
        });
    });

    describe('featured badge', () => {
        it('renders the featured badge when data.isFeatured is true', () => {
            expect(src).toContain('data.isFeatured');
            expect(src).toContain('featured-badge');
        });
    });

    describe('open-now badge', () => {
        it('TEST:6.3:3 mounts the badge island with client:idle only when openingHours is present', () => {
            expect(src).toMatch(
                /\{data\.openingHours && \(\s*<VenueOpenNowBadge\s+client:idle\s+locale=\{locale\}\s+openingHours=\{data\.openingHours\}\s*\/>\s*\)\}/
            );
        });

        it('TEST:6.3:3 leaves the server-side calculation and badge markup out of the card', () => {
            expect(src).not.toContain('computeOpenNowStatus');
            expect(src).not.toContain('venue-hours');
            expect(src).not.toContain('venue-card__open-badge');
            expect(src).not.toContain('venue.card.openNow');
            expect(src).not.toContain('venue.card.closedNow');
        });

        // BETA-117: the badge was illegible over photos because it used
        // near-transparent alpha tints. It must use solid/opaque fills.
        it('uses the green brand fill for the open state', () => {
            expect(badgeCss).toContain('.open {\n    background-color: var(--hospeda-forest);');
        });

        it('darkens the red fill for the closed state (dark-mode contrast)', () => {
            expect(badgeCss).toContain('.closed {\n');
            expect(badgeCss).toContain(
                'background-color: color-mix(in oklab, var(--destructive) 85%, black);'
            );
        });

        // BETA-117 dark-mode a11y: both badges need a theme-CONSTANT light
        // foreground, because the per-theme `*-foreground` tokens flip to
        // near-black in dark and fail WCAG AA (< 4.5:1) on the badge fills.
        it('uses a theme-constant white foreground on the badge base', () => {
            expect(badgeCss).toMatch(
                /\.badge \{[\s\S]*?color: var\(--destructive-foreground\);[\s\S]*?\}/
            );
        });

        it('does not use the theme-flipping --primary-foreground on the badges', () => {
            expect(badgeCss).not.toContain('color: var(--primary-foreground);');
        });

        it('does not use low-alpha accent tints for the badge (regression guard)', () => {
            expect(badgeCss).not.toContain('--brand-accent-a15');
            expect(badgeCss).not.toContain('--brand-accent-a05');
        });

        // The move kept every value: the badge stays absolutely positioned over
        // the image area (late appearance therefore causes no layout shift) and
        // keeps its mobile corner swap.
        it('keeps the original absolute geometry', () => {
            expect(badgeCss).toContain('position: absolute;');
            expect(badgeCss).toContain('bottom: 48px;');
            expect(badgeCss).toContain('left: 12px;');
        });

        it('keeps the mobile bottom-right swap', () => {
            expect(badgeCss).toMatch(
                /@media \(max-width: 767px\)[\s\S]*?\.badge \{[\s\S]*?left: auto;[\s\S]*?right: 12px;/
            );
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
        // HOS-369: the name was removed. See the shared guard
        // test/static-guards/card-view-transition-names.test.ts for the reason
        // and the byte measurements; this local assertion keeps the file honest.
        it('declares no view transition name', () => {
            expect(src).not.toContain('transition:name');
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

        it('uses --brand-accent-text for the price range color', () => {
            expect(src).toContain('var(--brand-accent-text)');
        });

        it('does not contain Tailwind utility class patterns', () => {
            // Tailwind classes have the form `text-{size}`, `bg-{color}`, etc.
            expect(src).not.toMatch(/class="[^"]*\b(bg-|text-|p-|m-|flex-|grid-)\w/);
        });
    });
});
