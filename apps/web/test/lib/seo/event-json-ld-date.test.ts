/**
 * @file event-json-ld-date.test.ts
 * @description Unit tests for the JSON-LD date-precision truncation helper
 * (HOS-280 — month-only event date precision).
 */

import { describe, expect, it } from 'vitest';
import { toJsonLdEventDate } from '../../../src/lib/seo/event-json-ld-date';

describe('toJsonLdEventDate', () => {
    it('returns the ISO string unchanged when precision is EXACT', () => {
        const result = toJsonLdEventDate({
            isoDate: '2027-02-15T18:00:00.000Z',
            precision: 'EXACT'
        });
        expect(result).toBe('2027-02-15T18:00:00.000Z');
    });

    it('defaults to EXACT (unchanged) when precision is omitted', () => {
        const result = toJsonLdEventDate({ isoDate: '2027-02-15T18:00:00.000Z' });
        expect(result).toBe('2027-02-15T18:00:00.000Z');
    });

    it('truncates to YYYY-MM when precision is MONTH', () => {
        const result = toJsonLdEventDate({
            isoDate: '2027-02-01T00:00:00.000Z',
            precision: 'MONTH'
        });
        expect(result).toBe('2027-02');
    });

    it('never fabricates a day component for MONTH precision', () => {
        const result = toJsonLdEventDate({
            isoDate: '2027-02-01T00:00:00.000Z',
            precision: 'MONTH'
        });
        expect(result).not.toMatch(/-\d{2}T/);
        expect(result).toHaveLength(7);
    });

    it('truncates consistently regardless of the placeholder day stored', () => {
        // Storage convention: MONTH-precision dates always store the 1st of
        // the month, but the helper must not assume that — it just truncates.
        const result = toJsonLdEventDate({
            isoDate: '2027-02-01T15:30:00.000Z',
            precision: 'MONTH'
        });
        expect(result).toBe('2027-02');
    });
});
