/**
 * `fitPageToBudget` (HOS-2332 review, MEDIUM-2): the floor is measured, and a
 * page never leaves over budget.
 *
 * @module test/mcp/tools/host-trade/fit-page-to-budget
 */

import { describe, expect, it } from 'vitest';
import {
    type BudgetedPage,
    fitPageToBudget
} from '../../../../src/mcp/tools/host-trade/fit-page-to-budget';
import { measureResultChars } from '../../../../src/mcp/tools/response-budget';

const MAX = 1000;

/** A page of `count` items, each `chars` long at a given step. */
const pageOf =
    (count: number, perItem: (step: number) => string) =>
    (step: number): BudgetedPage<string> => ({
        items: Array.from({ length: count }, () => perItem(step)),
        hasMore: false
    });

describe('fitPageToBudget', () => {
    it('returns the longest step that fits, untouched', () => {
        // Act
        const page = fitPageToBudget({
            steps: [100, 10],
            build: pageOf(5, (step) => 'a'.repeat(step)),
            maxChars: MAX
        });

        // Assert
        expect(page.items[0]).toHaveLength(100);
        expect(page).not.toHaveProperty('omittedItems');
    });

    it('steps down when the first step overflows', () => {
        // Act
        const page = fitPageToBudget({
            steps: [400, 100],
            build: pageOf(5, (step) => 'a'.repeat(step)),
            maxChars: MAX
        });

        // Assert
        expect(page.items[0]).toHaveLength(100);
        expect(page.hasMore).toBe(false);
    });

    it('measures the floor and drops trailing items until it fits', () => {
        // Arrange: JSON escapes a control character as six characters.
        const build = pageOf(10, (step) => '\u0001'.repeat(step));

        // Act
        const page = fitPageToBudget({ steps: [100, 30], build, maxChars: MAX });

        // Assert
        expect(measureResultChars({ value: page })).toBeLessThanOrEqual(MAX);
        expect(page.items.length).toBeGreaterThan(0);
        expect(page.items.length).toBeLessThan(10);
        expect(page.hasMore).toBe(true);
        expect(page.omittedItems).toBe(10 - page.items.length);
    });

    it('keeps the floor when it fits, without measuring it away', () => {
        // Act
        const page = fitPageToBudget({
            steps: [400, 30],
            build: pageOf(5, (step) => 'a'.repeat(step)),
            maxChars: MAX
        });

        // Assert
        expect(page.items).toHaveLength(5);
        expect(page.hasMore).toBe(false);
    });
});
