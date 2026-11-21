/**
 * HOS-2403: the catalog's "unlimited" limit sentinel and its at-or-above check.
 */
import { describe, expect, it } from 'vitest';
import { isUnlimitedLimit, UNLIMITED_LIMIT_VALUE } from '../../src/catalog/unlimited-limit';

describe('isUnlimitedLimit', () => {
    it('is the int4 maximum', () => {
        expect(UNLIMITED_LIMIT_VALUE).toBe(2147483647);
    });

    it.each([
        [2147483647, true],
        [2147483652, true],
        [Number.POSITIVE_INFINITY, true],
        [2147483646, false],
        [210, false],
        [0, false]
    ] as const)('%d is unlimited: %s', (value, expected) => {
        expect(isUnlimitedLimit({ value })).toBe(expected);
    });
});
