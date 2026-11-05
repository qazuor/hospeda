/**
 * @file menu-qr-tour-anchor.test.ts
 * @description TEST:5.4:1 — the venue welcome tour only gets its `venue-qr`
 * anchor when the menu QR widget will render something (HOS-1856, AC:5:3).
 */

import type { ListingSectionState } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import { shouldAnchorMenuQrTour } from '../../../src/lib/venue/menu-qr-tour-anchor';

/** Builds the slice of a section-state response the helper reads. */
function venueStates(menu: ListingSectionState) {
    return { sections: { menu: { state: menu } } };
}

describe('shouldAnchorMenuQrTour', () => {
    it('does not anchor when the only venue has its menu section absent (a BOLICHE)', () => {
        expect(shouldAnchorMenuQrTour({ sectionStates: [venueStates('absent')] })).toBe(false);
    });

    it('anchors when a venue has its menu section available', () => {
        expect(shouldAnchorMenuQrTour({ sectionStates: [venueStates('available')] })).toBe(true);
    });

    it('anchors when a BOLICHE and a RESTAURANT are both present', () => {
        expect(
            shouldAnchorMenuQrTour({
                sectionStates: [venueStates('absent'), venueStates('available')]
            })
        ).toBe(true);
    });

    it('anchors a locked menu too — the widget renders its upsell', () => {
        expect(shouldAnchorMenuQrTour({ sectionStates: [venueStates('locked')] })).toBe(true);
    });

    it('does not anchor an empty list', () => {
        expect(shouldAnchorMenuQrTour({ sectionStates: [] })).toBe(false);
    });

    it('does not anchor when the section map read failed', () => {
        expect(shouldAnchorMenuQrTour({ sectionStates: [null] })).toBe(false);
    });

    it('does not anchor when any read failed, even if another venue has a menu', () => {
        expect(
            shouldAnchorMenuQrTour({
                sectionStates: [venueStates('available'), null]
            })
        ).toBe(false);
    });
});
