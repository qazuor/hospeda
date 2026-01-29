import { describe, expect, it } from 'vitest';
import {
    addDaysToDate,
    addMonthsToDate,
    addYearsToDate,
    areDatesEqual,
    formatDate,
    formatDateDistance,
    formatRelativeDate,
    getDaysDifference,
    getHoursDifference,
    getMinutesDifference,
    isDateAfter,
    isDateBefore,
    parseDate
} from '../src/date';

describe('Date Utilities', () => {
    describe('formatDate', () => {
        it('formats date with default format', () => {
            const date = new Date('2024-01-15');
            expect(formatDate(date)).toBe('2024-01-15');
        });

        it('formats date with custom format', () => {
            const date = new Date('2024-01-15');
            expect(formatDate(date, 'dd/MM/yyyy')).toBe('15/01/2024');
        });

        it('handles ISO string input', () => {
            expect(formatDate('2024-01-15T00:00:00.000Z')).toBe('2024-01-15');
        });

        it('returns error message for invalid date', () => {
            expect(formatDate('not-a-date')).toBe('Invalid date');
        });
    });

    describe('formatRelativeDate', () => {
        it('returns relative date string', () => {
            const date = new Date();
            const result = formatRelativeDate(date);
            expect(result).toBeTruthy();
        });
    });

    describe('formatDateDistance', () => {
        it('returns distance string', () => {
            const date = new Date();
            date.setDate(date.getDate() - 5);
            const result = formatDateDistance(date);
            expect(result).toContain('5');
            expect(result).toContain('day');
        });
    });

    describe('parseDate', () => {
        it('parses date string with format', () => {
            const result = parseDate('15/01/2024', 'dd/MM/yyyy');
            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(0); // January
            expect(result.getDate()).toBe(15);
        });
    });

    describe('isDateBefore', () => {
        it('returns true when first date is before second', () => {
            expect(isDateBefore('2024-01-01', '2024-01-15')).toBe(true);
        });

        it('returns false when first date is after second', () => {
            expect(isDateBefore('2024-01-15', '2024-01-01')).toBe(false);
        });
    });

    describe('isDateAfter', () => {
        it('returns true when first date is after second', () => {
            expect(isDateAfter('2024-01-15', '2024-01-01')).toBe(true);
        });

        it('returns false when first date is before second', () => {
            expect(isDateAfter('2024-01-01', '2024-01-15')).toBe(false);
        });
    });

    describe('areDatesEqual', () => {
        it('returns true for equal dates', () => {
            expect(areDatesEqual('2024-01-15', '2024-01-15')).toBe(true);
        });

        it('returns false for different dates', () => {
            expect(areDatesEqual('2024-01-15', '2024-01-16')).toBe(false);
        });
    });

    describe('getDaysDifference', () => {
        it('returns difference in days', () => {
            expect(getDaysDifference('2024-01-15', '2024-01-10')).toBe(5);
        });

        it('returns negative for earlier dates', () => {
            expect(getDaysDifference('2024-01-10', '2024-01-15')).toBe(-5);
        });
    });

    describe('getHoursDifference', () => {
        it('returns difference in hours', () => {
            const date1 = new Date('2024-01-15T12:00:00');
            const date2 = new Date('2024-01-15T08:00:00');
            expect(getHoursDifference(date1, date2)).toBe(4);
        });
    });

    describe('getMinutesDifference', () => {
        it('returns difference in minutes', () => {
            const date1 = new Date('2024-01-15T12:30:00');
            const date2 = new Date('2024-01-15T12:00:00');
            expect(getMinutesDifference(date1, date2)).toBe(30);
        });
    });

    describe('addDaysToDate', () => {
        it('adds days to a date', () => {
            const date = new Date('2024-01-15');
            const result = addDaysToDate(date, 5);
            expect(result.getDate()).toBe(20);
        });

        it('handles string input', () => {
            const result = addDaysToDate('2024-01-15', 5);
            expect(result.getDate()).toBe(20);
        });
    });

    describe('addMonthsToDate', () => {
        it('adds months to a date', () => {
            const date = new Date('2024-01-15');
            const result = addMonthsToDate(date, 2);
            expect(result.getMonth()).toBe(2); // March
        });
    });

    describe('addYearsToDate', () => {
        it('adds years to a date', () => {
            const date = new Date('2024-01-15');
            const result = addYearsToDate(date, 1);
            expect(result.getFullYear()).toBe(2025);
        });
    });
});
