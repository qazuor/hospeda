/**
 * @file summarize-items.test.ts
 * @description HOS-2528: summarise only when at least 5 items would be hidden.
 */
import { describe, expect, it } from 'vitest';
import { summarizeItems } from '../../../src/lib/listing-items/summarize-items';

const base = { visibleMobile: 6, visibleDesktop: 8 } as const;

describe('summarizeItems', () => {
    it.each([
        [0, true, true],
        [6, true, true],
        [9, true, true],
        [10, true, true],
        [11, false, true],
        [12, false, true],
        [13, false, false],
        [86, false, false]
    ])('total %i -> showAllMobile=%s showAllDesktop=%s', (total, showAllMobile, showAllDesktop) => {
        expect(summarizeItems({ total, ...base })).toEqual({ showAllMobile, showAllDesktop });
    });

    it('honours a custom minHidden', () => {
        expect(summarizeItems({ total: 9, ...base, minHidden: 3 }).showAllMobile).toBe(false);
    });
});
