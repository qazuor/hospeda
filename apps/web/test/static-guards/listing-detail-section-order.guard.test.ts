/**
 * @file listing-detail-section-order.guard.test.ts
 * @description HOS-2579 AC-1 (§6.1): the three public listing detail pages
 * render their body as the 13 canonical slots of `LISTING_DETAIL_SLOTS`, in
 * that order.
 *
 * ## What it checks
 *
 * - Each page wraps its blocks in `<ListingDetailSlot name="…">`, and the
 *   names, read in source order, are a strictly increasing subsequence of
 *   `LISTING_DETAIL_SLOTS` (a vertical may skip a slot, never reorder or
 *   repeat one).
 * - Every name is a canonical slot.
 * - The sticky `ListingSectionTabs` sits between slot wrappers, never inside
 *   one (a sticky element sticks inside its parent, so inside a slot it would
 *   stop scrolling with the page).
 * - No page writes a slot id by hand: the ids come from
 *   `LISTING_DETAIL_SLOT_IDS` through the wrapper.
 * - The page `<h1>` is the shared header's, never one of the page's own
 *   (AC-25, the source half).
 * - On the venue page, the agenda CTA is a block of the `venueEvents` section
 *   (slot 4 «Lo que ofrece», D-3), not of `amenities` or `promotions`.
 *
 * ## What it does NOT see, so a green run is not mistaken for more
 *
 * - **Rendered order.** It reads source order. A slot whose blocks are chosen
 *   at runtime (the venue's `blocksInSlot`) is covered by the unit tests of
 *   `venue-detail-sections.ts`; the DOM order on a real page is the E2E
 *   `apps/e2e/tests/guest/guest-13-listing-detail-order-tabs.spec.ts` (AC-4).
 * - **Blocks outside a wrapper.** A block placed between two wrappers renders
 *   in that position without a slot id; review is the control for that, and
 *   the trackers / panels / bars that legitimately sit outside are not slots.
 * - **Headings inside components.** «The first heading of every slot is an
 *   `<h2>`» is asserted on the rendered pages by the E2E suite.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    LISTING_DETAIL_SLOT_IDS,
    LISTING_DETAIL_SLOTS,
    type ListingDetailSlot
} from '@/lib/listing-detail/listing-detail-order';

const SRC = resolve(__dirname, '../../src');
const read = (file: string): string => readFileSync(join(SRC, file), 'utf8');

const PAGES = [
    'pages/[lang]/alojamientos/[slug].astro',
    'pages/[lang]/comer-y-salir/[slug].astro',
    'pages/[lang]/experiencias/[slug].astro'
] as const;

/** Drops HTML and JS comments, so prose about a slot is never read as a slot. */
function withoutComments(source: string): string {
    return source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

/** The slot names of every `<ListingDetailSlot name="…">`, in source order. */
function slotNames(source: string): readonly string[] {
    return [...source.matchAll(/<ListingDetailSlot\b[^>]*?\bname="([^"]+)"/g)].map(
        ([, name]) => name as string
    );
}

/**
 * Slot ids written as literals on an `id` attribute: `id="…"`, `id='…'`,
 * `id={'…'}`, `id={"…"}` or `` id={`…`} ``. An id built from an expression
 * (other than a bare literal) is not read; the wrapper is the only writer.
 */
function handWrittenSlotIds(source: string): readonly string[] {
    const slotIds = new Set<string>(Object.values(LISTING_DETAIL_SLOT_IDS));
    return [...source.matchAll(/\bid=(?:\{\s*)?(["'`])([^"'`]+)\1(?:\s*\})?/g)]
        .map(([, , id]) => id as string)
        .filter((id) => slotIds.has(id));
}

/** True when `names` is a strictly increasing subsequence of the canonical slots. */
function isCanonicalSubsequence(names: readonly string[]): boolean {
    const indexes = names.map((name) => LISTING_DETAIL_SLOTS.indexOf(name as ListingDetailSlot));
    return indexes.every((index, i) => index >= 0 && (i === 0 || index > (indexes[i - 1] ?? -1)));
}

describe('isCanonicalSubsequence (the predicate this guard trusts)', () => {
    it('accepts a skipped slot and rejects a swap, a repeat and an unknown name', () => {
        expect(isCanonicalSubsequence(['galleryHeader', 'description', 'faq'])).toBe(true);
        expect(isCanonicalSubsequence(['reviews', 'location'])).toBe(false);
        expect(isCanonicalSubsequence(['offers', 'offers'])).toBe(false);
        expect(isCanonicalSubsequence(['offers', 'menu'])).toBe(false);
    });
});

describe('listing detail pages follow the 13-slot order (HOS-2579 AC-1)', () => {
    it.each(PAGES)('%s renders its slot wrappers in LISTING_DETAIL_SLOTS order', (page) => {
        // Arrange
        const names = slotNames(withoutComments(read(page)));

        // Assert: the core slots every vertical has are there…
        for (const slot of ['summary', 'location', 'reviews', 'contact'] as const) {
            expect(names).toContain(slot);
        }
        // …and the whole list is a strictly increasing subsequence.
        expect(names, `slot order of ${page}: ${names.join(' → ')}`).toSatisfy(
            isCanonicalSubsequence
        );
    });

    it.each(PAGES)('%s mounts the section tabs between slots, never inside one', (page) => {
        const source = withoutComments(read(page));
        const tabs = source.indexOf('<ListingSectionTabs');
        const before = source.slice(0, tabs);

        expect(tabs).toBeGreaterThan(-1);
        expect((before.match(/<ListingDetailSlot\b/g) ?? []).length).toBe(
            (before.match(/<\/ListingDetailSlot>/g) ?? []).length
        );
    });

    it.each(PAGES)('%s writes no slot id by hand', (page) => {
        const source = withoutComments(read(page));
        expect(handWrittenSlotIds(source)).toEqual([]);
    });

    it('catches every literal form of a hand-written slot id', () => {
        expect(
            handWrittenSlotIds(
                [
                    '<div id="listing-offers">',
                    "<div id='listing-hours'>",
                    "<div id={'listing-faq'}>",
                    '<div id={"listing-contact"}>',
                    '<div id={`listing-reviews`}>',
                    '<div id={ `listing-summary` }>',
                    '<div id={LISTING_SECTION_IDS.photos}>'
                ].join('\n')
            )
        ).toEqual([
            'listing-offers',
            'listing-hours',
            'listing-faq',
            'listing-contact',
            'listing-reviews',
            'listing-summary'
        ]);
    });

    it.each(PAGES)('%s has no <h1> of its own (the header owns it, AC-25)', (page) => {
        expect(withoutComments(read(page))).not.toMatch(/<h1\b/);
        const header = read('components/listing/header/ListingHeader.astro');
        const markup = header.slice(header.indexOf('---', 3) + 3);
        expect(markup.match(/<h1\b/g)).toHaveLength(1);
    });

    it('keeps the venue agenda CTA in the venueEvents blocks, i.e. «Lo que ofrece» (D-3)', () => {
        const venue = withoutComments(read('pages/[lang]/comer-y-salir/[slug].astro'));
        const events = venue.slice(venue.indexOf('venueEvents: ['), venue.indexOf('promotions:'));
        const amenities = venue.slice(venue.indexOf('amenities: ['), venue.indexOf('contact: ['));

        expect(events).toContain('Component: VenueEventsCta');
        expect(amenities).not.toContain('VenueEventsCta');
    });
});
