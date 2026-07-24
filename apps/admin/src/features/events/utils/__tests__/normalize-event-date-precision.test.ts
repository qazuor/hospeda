/**
 * Tests for the HOS-280 month-only date normalization helper.
 *
 * Coverage:
 * - MONTH precision snaps a mid-month `start` to day 01, UTC midnight,
 *   preserving year/month — using a value that would shift month under
 *   naive local-time (`getMonth`/`setDate`) handling, to prove the fix.
 * - EXACT precision (and missing/other precision) leaves values untouched.
 * - `end` is handled symmetrically to `start`.
 * - A missing `end` does not throw and is left absent.
 */

import { EventDatePrecisionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { normalizeEventDatePrecision } from '../normalize-event-date-precision';

/**
 * Shape used for test fixtures — all fields optional so a literal that omits
 * `end` (or `precision`) still lets assertions read it back as `undefined`
 * without a TS2339 "property does not exist" error.
 */
interface TestEventDate {
    start?: string;
    end?: string;
    precision?: EventDatePrecisionEnum;
}

describe('normalizeEventDatePrecision', () => {
    it('snaps start to the first day of the month at UTC midnight when precision is MONTH', () => {
        // Arrange
        const date: TestEventDate = {
            start: '2026-04-15T14:30:00.000Z',
            precision: EventDatePrecisionEnum.MONTH
        };

        // Act
        const result = normalizeEventDatePrecision(date);

        // Assert
        expect(result.start).toBe('2026-04-01T00:00:00.000Z');
    });

    it('does not shift the month for a UTC-midnight boundary value that would flip under local-time getters', () => {
        // Arrange: `2026-04-01T00:00:00.000Z` is `2026-03-31T21:00:00` in any
        // timezone behind UTC (e.g. Argentina, UTC-3). A naive
        // `new Date(value).setDate(1)` / `.getMonth()` implementation reading
        // LOCAL time in such a timezone would wrongly resolve this to March.
        const date: TestEventDate = {
            start: '2026-04-01T00:00:00.000Z',
            precision: EventDatePrecisionEnum.MONTH
        };

        // Act
        const result = normalizeEventDatePrecision(date);

        // Assert — must stay April, not regress to March.
        expect(result.start).toBe('2026-04-01T00:00:00.000Z');
    });

    it('leaves start/end untouched when precision is EXACT', () => {
        // Arrange
        const date: TestEventDate = {
            start: '2026-04-15T14:30:00.000Z',
            end: '2026-04-16T18:00:00.000Z',
            precision: EventDatePrecisionEnum.EXACT
        };

        // Act
        const result = normalizeEventDatePrecision(date);

        // Assert
        expect(result.start).toBe('2026-04-15T14:30:00.000Z');
        expect(result.end).toBe('2026-04-16T18:00:00.000Z');
    });

    it('leaves start/end untouched when precision is missing (defaults to EXACT behavior)', () => {
        // Arrange
        const date: TestEventDate = { start: '2026-04-15T14:30:00.000Z' };

        // Act
        const result = normalizeEventDatePrecision(date);

        // Assert
        expect(result.start).toBe('2026-04-15T14:30:00.000Z');
    });

    it('normalizes end symmetrically to start when both are present', () => {
        // Arrange
        const date: TestEventDate = {
            start: '2026-04-15T14:30:00.000Z',
            end: '2026-04-28T09:00:00.000Z',
            precision: EventDatePrecisionEnum.MONTH
        };

        // Act
        const result = normalizeEventDatePrecision(date);

        // Assert
        expect(result.start).toBe('2026-04-01T00:00:00.000Z');
        expect(result.end).toBe('2026-04-01T00:00:00.000Z');
    });

    it('does not error and leaves end absent when end is missing, even under MONTH precision', () => {
        // Arrange
        const date: TestEventDate = {
            start: '2026-04-15T14:30:00.000Z',
            precision: EventDatePrecisionEnum.MONTH
        };

        // Act
        const result = normalizeEventDatePrecision(date);

        // Assert
        expect(result.start).toBe('2026-04-01T00:00:00.000Z');
        expect(result.end).toBeUndefined();
    });

    it('leaves a non-string start untouched (defensive)', () => {
        // Arrange
        const date: TestEventDate = {
            start: undefined,
            precision: EventDatePrecisionEnum.MONTH
        };

        // Act
        const result = normalizeEventDatePrecision(date);

        // Assert
        expect(result.start).toBeUndefined();
    });
});
