/**
 * @file listing-editor-registry.test.ts
 * @description TEST:5.1:3 — the venue/experience registry is derived from the
 * catalog and filtered by the resolved state map (HOS-1787 leaf 5.1,
 * DEC-FAC-033).
 *
 * The vertical split used to be two hand-written arrays. These cases pin the
 * replacement: the catalog decides order and group, the state map only decides
 * presence, and `locked` is every bit as present as `available` (its UI
 * treatment is leaf 5.2's job).
 */

import { describe, expect, it } from 'vitest';
import { findEditorSectionBySlug } from '@/lib/editor/editor-registry';
import {
    buildListingEditorRegistry,
    buildListingEditorSections,
    type ListingSectionStates
} from '@/lib/editor/listing-editor-registry';

/** BAR: a nightlife profile with a menu, daily specials and night info. */
const BAR_STATES: ListingSectionStates = {
    menu: { state: 'available' },
    dailySpecials: { state: 'available' },
    nightInfo: { state: 'available' }
};

/** BOLICHE: a nightclub with no kitchen — the two food sections are absent. */
const BOLICHE_STATES: ListingSectionStates = {
    menu: { state: 'absent' },
    dailySpecials: { state: 'absent' }
};

/** RESTAURANT: food only — no nightlife section at all. */
const RESTAURANT_STATES: ListingSectionStates = {
    nightInfo: { state: 'absent' }
};

const idsOf = (vertical: 'venue' | 'experience', sectionStates: ListingSectionStates) =>
    buildListingEditorSections({ vertical, sectionStates }).map((section) => section.id);

describe('TEST:5.1:3 derived listing editor registry', () => {
    it('gives a BAR the catalog sections in catalog order', () => {
        const ids = idsOf('venue', BAR_STATES);

        expect(ids).toContain('menu');
        expect(ids).toContain('dailySpecials');
        expect(ids).toContain('venueEvents');
        expect(ids).toContain('nightInfo');
        // Catalog order (venue): menu 7, dailySpecials 8, venueEvents 9,
        // faqs 10, nightInfo 11.
        expect(ids.indexOf('menu')).toBeLessThan(ids.indexOf('dailySpecials'));
        expect(ids.indexOf('dailySpecials')).toBeLessThan(ids.indexOf('venueEvents'));
        expect(ids.indexOf('venueEvents')).toBeLessThan(ids.indexOf('faqs'));
        expect(ids.indexOf('faqs')).toBeLessThan(ids.indexOf('nightInfo'));
    });

    it('drops the sections the state map marks absent', () => {
        const ids = idsOf('venue', BOLICHE_STATES);

        expect(ids).not.toContain('menu');
        expect(ids).not.toContain('dailySpecials');

        const registry = buildListingEditorRegistry({
            vertical: 'venue',
            sectionStates: BOLICHE_STATES
        });
        expect(findEditorSectionBySlug({ registry, slug: 'carta' })).toBeUndefined();
        expect(findEditorSectionBySlug({ registry, slug: 'menu-del-dia' })).toBeUndefined();
    });

    it('drops nightInfo for a food-only restaurant', () => {
        const ids = idsOf('venue', RESTAURANT_STATES);

        expect(ids).not.toContain('nightInfo');
        expect(ids).toContain('menu');
    });

    it('derives an experience from the experience catalog, with no venue sections', () => {
        const ids = idsOf('experience', {});
        const registry = buildListingEditorRegistry({
            vertical: 'experience',
            sectionStates: {}
        });

        expect(ids).toContain('meetingPoint');
        expect(ids).toContain('practicalInfo');
        expect(ids).not.toContain('carta');
        expect(ids).not.toContain('menu');
        expect(ids).not.toContain('nightInfo');
        expect(findEditorSectionBySlug({ registry, slug: 'carta' })).toBeUndefined();
    });

    it('keeps a locked section in the registry', () => {
        const ids = idsOf('venue', { nightInfo: { state: 'locked' } });

        expect(ids).toContain('nightInfo');
    });

    it('uses the catalog group, not a hand-written one', () => {
        const nightInfo = buildListingEditorSections({
            vertical: 'venue',
            sectionStates: BAR_STATES
        }).find((section) => section.id === 'nightInfo');

        expect(nightInfo?.group).toBe('property');
        expect(nightInfo?.slug).toBe('de-noche');
    });
});
