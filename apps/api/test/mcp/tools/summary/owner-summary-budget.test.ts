/**
 * HOS-2331 (AC-C32) — `fitSummaryToBudget`: the serialized summary is never
 * over the limit. Attention items give way from the least urgent end and are
 * counted; a summary that cannot fit is refused, never returned.
 *
 * @module test/mcp/tools/summary/owner-summary-budget
 */

import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { measureResultChars } from '../../../../src/mcp/tools/response-budget';
import { fitSummaryToBudget } from '../../../../src/mcp/tools/summary/owner-summary-budget';
import type {
    AttentionItem,
    OwnerSummary,
    VerticalListingCounts
} from '../../../../src/mcp/tools/summary/owner-summary-types';

const zero: VerticalListingCounts = {
    total: 0,
    byStatus: { DRAFT: 0, PUBLISHED: 0, UNPUBLISHED_BY_BILLING: 0, ARCHIVED: 0, MODERATED: 0 }
};

const item = (n: number): AttentionItem => ({
    kind: 'incomplete',
    listing: { id: `id-${n}`, vertical: VerticalEnum.VENUE, name: 'x'.repeat(200) },
    missing: ['summary'],
    actionUrl: `http://localhost:4321/es/mi-cuenta/comercio/venue/id-${n}/editar/`
});

const summaryWith = (count: number): OwnerSummary => ({
    listings: { accommodation: zero, venue: zero, experience: zero },
    metrics: {},
    attention: Array.from({ length: count }, (_, n) => item(n)),
    more: 2
});

describe('fitSummaryToBudget', () => {
    it('returns a summary within the limit unchanged', () => {
        // Arrange
        const summary = summaryWith(3);

        // Act
        const fitted = fitSummaryToBudget({ summary });

        // Assert
        expect(fitted).toBe(summary);
    });

    it('drops attention from the least urgent end until the serialized result fits', () => {
        // Arrange
        const summary = summaryWith(10);
        const maxChars = measureResultChars({ value: summaryWith(4) }) + 50;

        // Act
        const fitted = fitSummaryToBudget({ summary, maxChars });

        // Assert
        expect(fitted).toBeDefined();
        expect(measureResultChars({ value: fitted })).toBeLessThanOrEqual(maxChars);
        expect(fitted?.attention.map((i) => i.listing?.id)).toEqual([
            'id-0',
            'id-1',
            'id-2',
            'id-3'
        ]);
        expect(fitted?.more).toBe(2 + 6);
    });

    it('refuses a summary that is over the limit even with no attention left', () => {
        // Arrange
        const summary = summaryWith(2);
        const maxChars = measureResultChars({ value: summaryWith(0) }) - 1;

        // Act
        const fitted = fitSummaryToBudget({ summary, maxChars });

        // Assert
        expect(fitted).toBeUndefined();
    });
});
