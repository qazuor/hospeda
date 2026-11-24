/**
 * @file listing-summaries.test.ts
 * @description Source-level tests of the slot-2 summaries of the venue and
 * experience pages (HOS-2579 §6.1.1): `VenueSummary` (price range + «Ver
 * carta»/«Consultar») and `ExperienceSummary` (price + duration +
 * «Consultar»), which took the price out of the old vertical headers.
 *
 * Vitest cannot render `.astro` here, so these read the SOURCE. The contact
 * decision they consume (`resolveVenueContactMode`) is unit tested in
 * `test/lib/listing-contact/listing-channels.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../src');
const read = (relative: string): string => readFileSync(resolve(SRC, relative), 'utf8');

const VENUE_SUMMARY = read('components/venue/VenueSummary.astro');
const EXPERIENCE_SUMMARY = read('components/experience/ExperienceSummary.astro');
const VENUE_PAGE = read('pages/[lang]/comer-y-salir/[slug].astro');
const EXPERIENCE_PAGE = read('pages/[lang]/experiencias/[slug].astro');
const HEADER_FILES = [
    read('components/listing/header/ListingHeader.astro'),
    read('components/listing/header/ListingHeaderBadges.astro'),
    read('lib/listing-header/build-listing-header.ts')
].join('\n');

describe('VenueSummary', () => {
    it('shows the price-range label (moved out of the header)', () => {
        expect(VENUE_SUMMARY).toContain('venue.card.priceRange.${priceRange}');
        expect(HEADER_FILES).not.toContain('priceRange');
    });

    it('uses the shared contact actions with origin summary', () => {
        const actions = VENUE_SUMMARY.match(/<ListingContactActions[\s\S]*?\/>/)?.[0] ?? '';
        expect(actions).toContain('client:idle');
        expect(actions).toContain('origin="summary"');
        expect(actions).toContain('vertical="venue"');
        expect(actions).toContain('fallbackHref={fallbackHref}');
    });

    it('makes «Ver carta» the action when the venue has a menu (D-1), «Consultar» otherwise', () => {
        expect(VENUE_SUMMARY).toContain("'accommodations.detail.listingContact.bar.viewMenu'");
        expect(VENUE_SUMMARY).toContain("'accommodations.detail.listingContact.bar.contact'");
        expect(VENUE_SUMMARY).toContain(
            "primaryLink={contactMode.kind === 'menu' ? { href: contactMode.href, channel: 'menu' } : undefined}"
        );
    });

    it('renders no action without a channel, and nothing at all without price or action', () => {
        expect(VENUE_SUMMARY).toContain("const hasAction = contactMode.kind !== 'none';");
        expect(VENUE_SUMMARY).toMatch(/\{\(priceRangeLabel \|\| hasAction\) && \(/);
        expect(VENUE_SUMMARY).toMatch(/\{hasAction && \(\s*<ListingContactActions/);
    });

    it('is mounted by the venue page with the page contact decision', () => {
        const mount = VENUE_PAGE.match(/<VenueSummary[\s\S]*?\/>/)?.[0] ?? '';
        expect(mount).toContain('priceRange={venue.priceRange}');
        expect(mount).toContain('contactMode={contactMode}');
        expect(mount).toContain('fallbackHref={`#${VENUE_CONTACT_ANCHOR_ID}`}');
        // Right after the gallery and videos, before the catalog body.
        expect(VENUE_PAGE.indexOf('<VenueSummary')).toBeLessThan(
            VENUE_PAGE.indexOf('orderVenueDetailSections().map')
        );
    });
});

describe('ExperienceSummary', () => {
    it('renders the price tag and the optional duration (moved out of the header)', () => {
        expect(EXPERIENCE_SUMMARY).toMatch(/<ExperiencePriceTag[\s\S]*?priceFrom=\{priceFrom\}/);
        expect(EXPERIENCE_SUMMARY).toContain('formatDurationMinutes({');
        expect(EXPERIENCE_SUMMARY).toMatch(/\{durationLabel && \(/);
        expect(HEADER_FILES).not.toContain('ExperiencePriceTag');
        expect(HEADER_FILES).not.toContain('durationMinutes');
    });

    it('offers «Consultar» only when a public channel exists (HOS-363)', () => {
        expect(EXPERIENCE_SUMMARY).toMatch(/\{hasContactChannel && \(\s*<ListingContactActions/);
        const actions = EXPERIENCE_SUMMARY.match(/<ListingContactActions[\s\S]*?\/>/)?.[0] ?? '';
        expect(actions).toContain('origin="summary"');
        expect(actions).toContain('vertical="experience"');
        expect(actions).toContain('hasWhatsapp={false}');
    });

    it('carries no entitlement check (ficha data from the basic tier)', () => {
        expect(EXPERIENCE_SUMMARY).not.toContain('Entitlement');
    });

    it('is mounted by the experience page with the price and the channel flag', () => {
        const mount = EXPERIENCE_PAGE.match(/<ExperienceSummary[\s\S]*?\/>/)?.[0] ?? '';
        expect(mount).toContain('priceFrom={experience.priceFrom}');
        expect(mount).toContain('durationMinutes={experience.durationMinutes}');
        expect(mount).toContain('hasContactChannel={contactChannels.length > 0}');
        expect(mount).toContain('fallbackHref={`#${EXPERIENCE_CONTACT_ANCHOR_ID}`}');
    });
});
