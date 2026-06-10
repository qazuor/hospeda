/**
 * Tests for range filter params in admin search schemas (SPEC-185 Phase 1).
 *
 * Verifies that:
 * - AccommodationAdminSearchSchema accepts minPrice/maxPrice (number-range bounds)
 * - AdminSearchBaseSchema accepts createdAfter/createdBefore (date-range bounds inherited by all)
 * - EventAdminSearchSchema accepts startDateAfter/startDateBefore (event date range)
 * - All bounds are optional — absent bounds are omitted, not defaulted
 * - Inverted range is not rejected at schema level (returns empty set at query time by design)
 * - Unknown range params are rejected by strict Zod schemas
 *
 * Note: createAdminListRoute uses z.ZodObject.strict() under the hood to reject unknown
 * params. The tests below use .strict() to simulate that behavior.
 */

import { describe, expect, it } from 'vitest';
import {
    AccommodationAdminSearchSchema,
    AdminSearchBaseSchema,
    EventAdminSearchSchema
} from '../../../src/index.js';

// ---------------------------------------------------------------------------
// AccommodationAdminSearchSchema — price range
// ---------------------------------------------------------------------------

describe('AccommodationAdminSearchSchema — price range (number-range)', () => {
    it('accepts minPrice as an optional number', () => {
        const result = AccommodationAdminSearchSchema.parse({ minPrice: 1000 });
        expect(result.minPrice).toBe(1000);
        expect(result.maxPrice).toBeUndefined();
    });

    it('accepts maxPrice as an optional number', () => {
        const result = AccommodationAdminSearchSchema.parse({ maxPrice: 5000 });
        expect(result.maxPrice).toBe(5000);
        expect(result.minPrice).toBeUndefined();
    });

    it('accepts both minPrice and maxPrice (full range)', () => {
        const result = AccommodationAdminSearchSchema.parse({ minPrice: 1000, maxPrice: 5000 });
        expect(result.minPrice).toBe(1000);
        expect(result.maxPrice).toBe(5000);
    });

    it('coerces string minPrice to number', () => {
        const result = AccommodationAdminSearchSchema.parse({ minPrice: '1000' });
        expect(result.minPrice).toBe(1000);
    });

    it('coerces string maxPrice to number', () => {
        const result = AccommodationAdminSearchSchema.parse({ maxPrice: '5000' });
        expect(result.maxPrice).toBe(5000);
    });

    it('accepts minPrice=0 (inclusive lower bound)', () => {
        const result = AccommodationAdminSearchSchema.parse({ minPrice: 0 });
        expect(result.minPrice).toBe(0);
    });

    it('rejects negative minPrice', () => {
        expect(() => AccommodationAdminSearchSchema.parse({ minPrice: -1 })).toThrow();
    });

    it('rejects negative maxPrice', () => {
        expect(() => AccommodationAdminSearchSchema.parse({ maxPrice: -1 })).toThrow();
    });

    it('does NOT reject inverted range (minPrice > maxPrice) at schema level', () => {
        // The service returns empty results for inverted ranges — not a schema error
        expect(() =>
            AccommodationAdminSearchSchema.parse({ minPrice: 5000, maxPrice: 1000 })
        ).not.toThrow();
    });

    it('omits both price bounds when neither is provided', () => {
        const result = AccommodationAdminSearchSchema.parse({});
        expect(result.minPrice).toBeUndefined();
        expect(result.maxPrice).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// AdminSearchBaseSchema — createdAt range (date-range, inherited by all entities)
// ---------------------------------------------------------------------------

describe('AdminSearchBaseSchema — createdAt range (date-range)', () => {
    it('accepts createdAfter as an ISO date string and coerces to Date', () => {
        const result = AdminSearchBaseSchema.parse({ createdAfter: '2026-01-01' });
        expect(result.createdAfter).toBeInstanceOf(Date);
        expect(result.createdAfter?.toISOString()).toContain('2026-01-01');
    });

    it('accepts createdBefore as an ISO date string and coerces to Date', () => {
        const result = AdminSearchBaseSchema.parse({ createdBefore: '2026-03-31' });
        expect(result.createdBefore).toBeInstanceOf(Date);
        expect(result.createdBefore?.toISOString()).toContain('2026-03-31');
    });

    it('accepts both createdAfter and createdBefore (full date range)', () => {
        const result = AdminSearchBaseSchema.parse({
            createdAfter: '2026-01-01',
            createdBefore: '2026-03-31'
        });
        expect(result.createdAfter).toBeInstanceOf(Date);
        expect(result.createdBefore).toBeInstanceOf(Date);
    });

    it('accepts only createdAfter (open-ended upper bound)', () => {
        const result = AdminSearchBaseSchema.parse({ createdAfter: '2026-01-01' });
        expect(result.createdAfter).toBeDefined();
        expect(result.createdBefore).toBeUndefined();
    });

    it('accepts only createdBefore (open-ended lower bound)', () => {
        const result = AdminSearchBaseSchema.parse({ createdBefore: '2026-12-31' });
        expect(result.createdBefore).toBeDefined();
        expect(result.createdAfter).toBeUndefined();
    });

    it('omits both date bounds when neither is provided', () => {
        const result = AdminSearchBaseSchema.parse({});
        expect(result.createdAfter).toBeUndefined();
        expect(result.createdBefore).toBeUndefined();
    });

    it('does NOT reject inverted date range at schema level', () => {
        // Inverted range returns empty set at query time — not a schema error
        expect(() =>
            AdminSearchBaseSchema.parse({
                createdAfter: '2026-12-31',
                createdBefore: '2026-01-01'
            })
        ).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// EventAdminSearchSchema — startDate range
// ---------------------------------------------------------------------------

describe('EventAdminSearchSchema — startDate range (date-range)', () => {
    it('accepts startDateAfter as an ISO date string and coerces to Date', () => {
        const result = EventAdminSearchSchema.parse({ startDateAfter: '2026-06-01' });
        expect(result.startDateAfter).toBeInstanceOf(Date);
    });

    it('accepts startDateBefore as an ISO date string and coerces to Date', () => {
        const result = EventAdminSearchSchema.parse({ startDateBefore: '2026-12-31' });
        expect(result.startDateBefore).toBeInstanceOf(Date);
    });

    it('accepts both startDateAfter and startDateBefore', () => {
        const result = EventAdminSearchSchema.parse({
            startDateAfter: '2026-06-01',
            startDateBefore: '2026-12-31'
        });
        expect(result.startDateAfter).toBeInstanceOf(Date);
        expect(result.startDateBefore).toBeInstanceOf(Date);
    });

    it('omits startDate bounds when neither is provided', () => {
        const result = EventAdminSearchSchema.parse({});
        expect(result.startDateAfter).toBeUndefined();
        expect(result.startDateBefore).toBeUndefined();
    });

    it('also inherits createdAfter/createdBefore from the base schema', () => {
        const result = EventAdminSearchSchema.parse({
            createdAfter: '2026-01-01',
            createdBefore: '2026-06-30'
        });
        expect(result.createdAfter).toBeInstanceOf(Date);
        expect(result.createdBefore).toBeInstanceOf(Date);
    });
});

// ---------------------------------------------------------------------------
// Strict schema: unknown range params are rejected
// ---------------------------------------------------------------------------

describe('Range param strict rejection (createAdminListRoute behavior)', () => {
    it('strict AccommodationAdminSearchSchema rejects an unknown range param', () => {
        const strictSchema = AccommodationAdminSearchSchema.strict();
        expect(() => strictSchema.parse({ unknownRangeParam: '999' })).toThrow();
    });

    it('strict AdminSearchBaseSchema rejects an unknown range param', () => {
        const strictSchema = AdminSearchBaseSchema.strict();
        expect(
            () => strictSchema.parse({ createdAtFrom: '2026-01-01' }) // wrong name (should be createdAfter)
        ).toThrow();
    });

    it('strict EventAdminSearchSchema rejects an unknown event range param', () => {
        const strictSchema = EventAdminSearchSchema.strict();
        expect(
            () => strictSchema.parse({ startDateFrom: '2026-01-01' }) // wrong name (should be startDateAfter)
        ).toThrow();
    });
});
