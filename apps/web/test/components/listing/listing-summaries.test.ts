/**
 * @file listing-summaries.test.ts
 * @description Source-level wiring tests for the venue and experience price
 * cards in the shared detail summary slot (HOS-2579 §6.1.1).
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
const SUMMARY_ACTIONS = read('components/listing/contact/ListingSummaryActions.client.tsx');
const HEADER_FILES = [
    read('components/listing/header/ListingHeader.astro'),
    read('components/listing/header/ListingHeaderBadges.astro'),
    read('lib/listing-header/build-listing-header.ts')
].join('\n');

describe('ListingSummaryActions', () => {
    it('is a .client.tsx island, so the client-graph guards sweep it', () => {
        for (const summary of [VENUE_SUMMARY, EXPERIENCE_SUMMARY]) {
            expect(summary).toContain(
                "from '@/components/listing/contact/ListingSummaryActions.client'"
            );
            expect(summary).not.toMatch(/import \{ ListingContactActions \}/);
        }
    });

    it('pins the shared contact actions to origin summary', () => {
        expect(SUMMARY_ACTIONS).toMatch(
            /<ListingContactActions\s+\{\.\.\.props\}\s+origin="summary"\s*\/>/
        );
        expect(SUMMARY_ACTIONS).toContain("Omit<ListingContactActionsProps, 'origin'>");
    });
});

describe('VenueSummary', () => {
    it('shows the price-range label (moved out of the header)', () => {
        expect(VENUE_SUMMARY).toMatch(/venue\.card\.priceRange\.\$\{priceRange\}/);
        expect(HEADER_FILES).not.toContain('priceRange');
    });

    it('uses the shared contact actions with origin summary', () => {
        const actions = VENUE_SUMMARY.match(/<ListingSummaryActions[\s\S]*?\/>/)?.[0] ?? '';
        expect(actions).toContain('client:idle');
        expect(actions).toContain('vertical="venue"');
        expect(actions).toContain('fallbackHref={fallbackHref}');
    });

    it('CARD-055 H-2: passes the safe menu and public phone/email into the primary channel resolver', () => {
        expect(VENUE_SUMMARY).toContain('resolvePriceCardAction({');
        expect(VENUE_SUMMARY).toContain(
            "menuHref: contactMode.kind === 'menu' ? contactMode.href : undefined"
        );
        expect(VENUE_SUMMARY).toContain('phoneHref,');
        expect(VENUE_SUMMARY).toContain('email,');
        expect(VENUE_SUMMARY).toContain('action={primary}');
    });

    it('renders no action without a channel, and nothing at all without price or action', () => {
        expect(VENUE_SUMMARY).toMatch(/\{\(priceRangeLabel \|\| primary\.kind !== 'none'\) && \(/);
        expect(VENUE_SUMMARY).toMatch(
            /\{primary\.kind === 'inquire' && \(\s*<ListingSummaryActions/
        );
    });

    it('is mounted by the venue page with the page contact decision', () => {
        const mount = VENUE_PAGE.match(/<VenueSummary[\s\S]*?\/>/)?.[0] ?? '';
        expect(mount).toContain('priceRange={venue.priceRange}');
        expect(mount).toContain('contactMode={contactMode}');
        expect(mount).toContain('phoneHref={barPhoneHref}');
        expect(mount).toContain('email={venue.contactInfo?.workEmail}');
        expect(mount).toMatch(/fallbackHref=\{`#\$\{VENUE_CONTACT_ANCHOR_ID\}`\}/);
        // Right after the gallery and videos, before the catalog body.
        expect(VENUE_PAGE.indexOf('<VenueSummary')).toBeLessThan(
            VENUE_PAGE.indexOf('descriptionBlocks.map')
        );
    });
});

describe('ExperienceSummary', () => {
    it('renders the price tag and the optional duration (moved out of the header)', () => {
        expect(EXPERIENCE_SUMMARY).toMatch(/<ListingPriceCard[\s\S]*?price=\{price\}/);
        expect(EXPERIENCE_SUMMARY).toContain('formatDurationMinutes({');
        expect(EXPERIENCE_SUMMARY).toMatch(/\{durationLabel && \(/);
        expect(HEADER_FILES).not.toContain('ExperiencePriceTag');
        expect(HEADER_FILES).not.toContain('durationMinutes');
    });

    it('offers the inquiry panel only when it is the selected action (HOS-363)', () => {
        expect(EXPERIENCE_SUMMARY).toMatch(
            /\{primary\.kind === 'inquire' && \(\s*<ListingSummaryActions/
        );
        const actions = EXPERIENCE_SUMMARY.match(/<ListingSummaryActions[\s\S]*?\/>/)?.[0] ?? '';
        expect(actions).toContain('vertical="experience"');
        expect(actions).toContain('hasWhatsapp={false}');
    });

    it('carries no entitlement check (ficha data from the basic tier)', () => {
        expect(EXPERIENCE_SUMMARY).not.toContain('Entitlement');
    });

    it('CARD-058 H-1: is mounted with the converted price and the dialable phone', () => {
        const mount = EXPERIENCE_PAGE.match(/<ExperienceSummary[\s\S]*?\/>/)?.[0] ?? '';
        expect(mount).toContain('price={contactPrice}');
        expect(mount).toContain('durationMinutes={experience.durationMinutes}');
        expect(mount).toContain('phoneHref={barPhoneHref}');
        expect(mount).toMatch(/fallbackHref=\{`#\$\{EXPERIENCE_CONTACT_ANCHOR_ID\}`\}/);
    });

    it('CARD-061 H-1: passes the published email to the price card through the shared resolver', () => {
        const mount = EXPERIENCE_PAGE.match(/<ExperienceSummary[\s\S]*?\/>/)?.[0] ?? '';
        expect(mount).toContain('email={experience.contactInfo?.workEmail}');
        expect(EXPERIENCE_SUMMARY).toContain('resolvePriceCardAction({');
        expect(EXPERIENCE_SUMMARY).toContain('action={primary}');
    });
});
