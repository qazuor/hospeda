/**
 * @file thin-destination.test.ts
 * @description Unit tests for the shared thin/empty destination predicate used by
 * both the destination detail page (noindex) and the dynamic sitemap (exclusion).
 *
 * Tasks: HOS-117 T-006 (US-3).
 */

import { describe, expect, it } from 'vitest';
import { isThinDestination } from '../../../src/lib/seo/thin-destination';

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

    it('treats null/undefined counts as 0 (sitemap eventsCount is nullable)', () => {
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
