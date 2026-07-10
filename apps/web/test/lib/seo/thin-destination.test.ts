/**
 * @file thin-destination.test.ts
 * @description Unit tests for the shared thin/empty destination predicate used by
 * both the destination detail page (noindex) and the dynamic sitemap (exclusion).
 *
 * Tasks: HOS-117 T-006 (US-3).
 */

import { describe, expect, it } from 'vitest';
import {
    destinationListItemCounts,
    isThinDestination
} from '../../../src/lib/seo/thin-destination';

describe('isThinDestination', () => {
    it('is thin when accommodations, events, and attractions are all 0', () => {
        expect(
            isThinDestination({ accommodationsCount: 0, attractionsCount: 0, eventsCount: 0 })
        ).toBe(true);
    });

    it('is NOT thin when there is at least one accommodation', () => {
        expect(
            isThinDestination({ accommodationsCount: 3, attractionsCount: 0, eventsCount: 0 })
        ).toBe(false);
    });

    it('is NOT thin when there is at least one event', () => {
        expect(
            isThinDestination({ accommodationsCount: 0, attractionsCount: 0, eventsCount: 2 })
        ).toBe(false);
    });

    it('is NOT thin when there is at least one attraction', () => {
        expect(
            isThinDestination({ accommodationsCount: 0, attractionsCount: 1, eventsCount: 0 })
        ).toBe(false);
    });

    it('treats null/undefined counts as 0', () => {
        expect(
            isThinDestination({
                accommodationsCount: 0,
                attractionsCount: undefined,
                eventsCount: null
            })
        ).toBe(true);
        expect(isThinDestination({})).toBe(true);
        expect(isThinDestination({ eventsCount: null, accommodationsCount: 5 })).toBe(false);
    });
});

describe('destinationListItemCounts (sitemap list-item bridge)', () => {
    it('derives attractionsCount from the attractions array', () => {
        expect(
            destinationListItemCounts({
                accommodationsCount: 0,
                attractions: [{}, {}, {}],
                eventsCount: 0
            })
        ).toEqual({ accommodationsCount: 0, attractionsCount: 3, eventsCount: 0 });
    });

    it('maps a fully-populated list item', () => {
        expect(
            destinationListItemCounts({
                accommodationsCount: 4,
                attractions: [{}],
                eventsCount: 2
            })
        ).toEqual({ accommodationsCount: 4, attractionsCount: 1, eventsCount: 2 });
    });

    it('yields undefined counts when fields are absent (empty list item)', () => {
        expect(destinationListItemCounts({})).toEqual({
            accommodationsCount: undefined,
            attractionsCount: undefined,
            eventsCount: undefined
        });
    });

    // Regression for the review blocker: a destination with 0 accommodations but
    // real attractions/events must NOT be classified thin (it stays in the sitemap,
    // matching the indexable detail page). The list endpoint gives attractions as
    // an array + eventsCount via includeEventCount — the bridge must surface both.
    it('does NOT classify a 0-accommodation destination with attractions/events as thin', () => {
        const colon = destinationListItemCounts({
            accommodationsCount: 0,
            attractions: [{}, {}, {}],
            eventsCount: 5
        });
        expect(isThinDestination(colon)).toBe(false);
    });

    it('classifies a genuinely empty list item as thin', () => {
        const empty = destinationListItemCounts({
            accommodationsCount: 0,
            attractions: [],
            eventsCount: 0
        });
        expect(isThinDestination(empty)).toBe(true);
    });
});
