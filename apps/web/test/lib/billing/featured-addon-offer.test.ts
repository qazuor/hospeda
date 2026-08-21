/**
 * @file featured-addon-offer.test.ts
 * @description Unit tests for the featured-listing add-on offer (HOS-728).
 *
 * The two properties under test are the ones a regression would silently
 * break:
 *
 * 1. **Which add-ons are offered.** Both visibility boosts, and only those —
 *    the expected slugs are written out BY HAND here rather than spread from
 *    `FEATURED_LISTING_ADDON_SLUGS`, because a test that reuses the constant
 *    the code reads is blind to its value and would stay green if the offer
 *    silently pointed at `extra-photos-20`.
 * 2. **How the link is built.** Through `buildAddonFocusUrl` (HOS-729), which
 *    carries the `?focus=` param AND the `#addon-<slug>` fragment, on a path
 *    that has a TRAILING SLASH. Hand-concatenating the URL loses one of those
 *    three and the add-ons page opens unfocused.
 */

import { describe, expect, it } from 'vitest';
import { buildAddonFocusUrl } from '../../../src/lib/billing/addon-focus';
import {
    buildFeaturedAddonOffers,
    FEATURED_LISTING_ADDON_SLUGS
} from '../../../src/lib/billing/featured-addon-offer';

describe('FEATURED_LISTING_ADDON_SLUGS', () => {
    it('is exactly the two visibility boosts, shortest first', () => {
        // Literals on purpose: see the file header.
        expect([...FEATURED_LISTING_ADDON_SLUGS]).toEqual([
            'visibility-boost-7d',
            'visibility-boost-30d'
        ]);
    });
});

describe('buildFeaturedAddonOffers', () => {
    it('offers both visibility add-ons, each with its own focus URL', () => {
        const offers = buildFeaturedAddonOffers({ locale: 'es' });

        expect(offers).toHaveLength(2);
        expect(offers[0]?.slug).toBe('visibility-boost-7d');
        expect(offers[0]?.href).toBe(
            '/es/mi-cuenta/addons/?focus=visibility-boost-7d#addon-visibility-boost-7d'
        );
        expect(offers[1]?.slug).toBe('visibility-boost-30d');
        expect(offers[1]?.href).toBe(
            '/es/mi-cuenta/addons/?focus=visibility-boost-30d#addon-visibility-boost-30d'
        );
    });

    it('does not offer an add-on that grants something other than featuring', () => {
        const slugs = buildFeaturedAddonOffers({ locale: 'es' }).map((offer) => offer.slug);

        expect(slugs).not.toContain('extra-photos-20');
        expect(slugs).not.toContain('extra-accommodations-5');
        expect(slugs).not.toContain('extra-properties-5');
        expect(slugs).not.toContain('ai-support-monthly');
    });

    it('builds every href through buildAddonFocusUrl, not by concatenation', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const offers = buildFeaturedAddonOffers({ locale });

            for (const offer of offers) {
                expect(offer.href).toBe(buildAddonFocusUrl({ locale, slug: offer.slug }));
            }
        }
    });

    it('keeps the locale segment of the requested locale', () => {
        expect(buildFeaturedAddonOffers({ locale: 'en' })[0]?.href).toMatch(
            /^\/en\/mi-cuenta\/addons\//
        );
        expect(buildFeaturedAddonOffers({ locale: 'pt' })[0]?.href).toMatch(
            /^\/pt\/mi-cuenta\/addons\//
        );
    });

    it('carries an English name fallback for each add-on', () => {
        const offers = buildFeaturedAddonOffers({ locale: 'es' });

        expect(offers[0]?.nameFallback).toBe('Visibility Boost (7 days)');
        expect(offers[1]?.nameFallback).toBe('Visibility Boost (30 days)');
    });
});
