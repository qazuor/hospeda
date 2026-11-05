// @vitest-environment jsdom
/**
 * @file venue-business-lines.test.ts
 * Unit tests for the catalog-count guard that decides whether the admin shows
 * the business-line surfaces at all (HOS-1873).
 */

import { describe, expect, it } from 'vitest';
import { hasBusinessLineChoice } from '../config/venue-business-lines';

describe('hasBusinessLineChoice', () => {
    it('is false when the vertical has a single line', () => {
        expect(hasBusinessLineChoice({ options: [{ value: 'standard' }] })).toBe(false);
    });

    it('is true when the vertical has more than one line', () => {
        expect(
            hasBusinessLineChoice({ options: [{ value: 'food' }, { value: 'nightlife' }] })
        ).toBe(true);
    });
});
