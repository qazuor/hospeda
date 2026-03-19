import { describe, expect, it } from 'vitest';
import { getRandomFutureDate } from '../../src/utils/utils.js';

describe('getRandomFutureDate', () => {
    it('returns a Date instance', () => {
        const result = getRandomFutureDate();
        expect(result).toBeInstanceOf(Date);
    });

    it('returns a date in the future (at least minDays ahead)', () => {
        const minDays = 10;
        const now = new Date();
        const result = getRandomFutureDate(minDays, 60);

        const minExpected = new Date(now.getTime() + minDays * 24 * 60 * 60 * 1000 - 1000); // -1s tolerance
        expect(result.getTime()).toBeGreaterThanOrEqual(minExpected.getTime());
    });

    it('returns a date no further than maxDays ahead', () => {
        const maxDays = 10;
        const now = new Date();
        const result = getRandomFutureDate(5, maxDays);

        const maxExpected = new Date(now.getTime() + (maxDays + 1) * 24 * 60 * 60 * 1000);
        expect(result.getTime()).toBeLessThan(maxExpected.getTime());
    });

    it('uses default values when no arguments are passed (10-60 days)', () => {
        const now = new Date();
        const result = getRandomFutureDate();

        const minExpected = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000); // slight tolerance
        const maxExpected = new Date(now.getTime() + 61 * 24 * 60 * 60 * 1000);

        expect(result.getTime()).toBeGreaterThan(minExpected.getTime());
        expect(result.getTime()).toBeLessThan(maxExpected.getTime());
    });

    it('returns different dates on consecutive calls (non-deterministic)', () => {
        // Run multiple times - statistically extremely unlikely to get same date twice
        const dates = new Set(
            Array.from({ length: 10 }, () => getRandomFutureDate(1, 365).getTime())
        );
        expect(dates.size).toBeGreaterThan(1);
    });
});
