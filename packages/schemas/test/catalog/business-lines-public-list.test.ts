/**
 * @file business-lines-public-list.test.ts
 * @description Behaviour tests for `listPublicBusinessLines` (HOS-1787 leaf
 * 6.9).
 *
 * The function is the read-only bridge consumers use to enumerate the public
 * collections without importing `BUSINESS_LINES` (G-FAC-03). These tests pin
 * the two properties the sitemap depends on: only public lines are listed, and
 * their slugs are the ones the catalog map resolves.
 */
import { describe, expect, it } from 'vitest';
import {
    BUSINESS_LINES,
    businessLineToUrlSlug,
    listPublicBusinessLines
} from '../../src/catalog/business-lines.js';

describe('listPublicBusinessLines', () => {
    it('lists the venue public lines in catalog order with their catalog slugs', () => {
        const lines = listPublicBusinessLines({ vertical: 'venue' });
        const expected = BUSINESS_LINES.venue
            .filter((line) => line.public && 'urlSlug' in line)
            .map((line) => line.value);

        expect(lines.map((line) => line.value)).toEqual(expected);
        expect(lines.length).toBeGreaterThan(0);

        for (const line of lines) {
            expect(line.urlSlug).toBe(businessLineToUrlSlug({ value: line.value }).urlSlug);
        }
    });

    it('returns an empty list for verticals without a public line', () => {
        expect(listPublicBusinessLines({ vertical: 'accommodation' })).toEqual([]);
        expect(listPublicBusinessLines({ vertical: 'experience' })).toEqual([]);
    });

    it('lists only lines the catalog marks public', () => {
        const publicValues = new Set(
            Object.values(BUSINESS_LINES)
                .flat()
                .filter((line) => line.public)
                .map((line) => `${line.vertical}:${line.value}`)
        );

        for (const vertical of ['venue', 'accommodation', 'experience'] as const) {
            for (const line of listPublicBusinessLines({ vertical })) {
                expect(publicValues.has(`${vertical}:${line.value}`)).toBe(true);
            }
        }
    });
});
