import { describe, expect, it } from 'vitest';
import {
    ListingTrafficStatsParamsSchema,
    ListingTrafficStatsQuerySchema,
    ListingTrafficStatsResponseSchema
} from '../../../src/entities/analytics/listing-traffic-stats.schema.js';

const ID = '550e8400-e29b-41d4-a716-446655440000';

const validResponse = {
    window: '30d',
    available: true,
    referrers: [{ value: 'google.com', count: 12 }],
    countries: [{ value: 'AR', count: 9 }],
    devices: [{ value: 'mobile', count: 7 }],
    contactFunnel: { views: 100, contactStarted: 10, contactCompleted: 3 }
};

describe('ListingTrafficStatsResponseSchema', () => {
    it('should parse a valid payload', () => {
        expect(ListingTrafficStatsResponseSchema.safeParse(validResponse).success).toBe(true);
    });

    it('should parse available:false with empty arrays', () => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            window: '7d',
            available: false,
            referrers: [],
            countries: [],
            devices: [],
            contactFunnel: null
        });
        expect(result.success).toBe(true);
    });

    it('should parse a null contactFunnel', () => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            ...validResponse,
            contactFunnel: null
        });
        expect(result.success).toBe(true);
    });

    it.each(['1d', '365d', '', 'all'])('should reject window %s', (window) => {
        expect(
            ListingTrafficStatsResponseSchema.safeParse({ ...validResponse, window }).success
        ).toBe(false);
    });

    it('should accept 90d', () => {
        expect(
            ListingTrafficStatsResponseSchema.safeParse({ ...validResponse, window: '90d' }).success
        ).toBe(true);
    });

    it('should reject negative item counts', () => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            ...validResponse,
            referrers: [{ value: 'google.com', count: -1 }]
        });
        expect(result.success).toBe(false);
    });

    it('should reject non-integer item counts', () => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            ...validResponse,
            devices: [{ value: 'mobile', count: 1.5 }]
        });
        expect(result.success).toBe(false);
    });

    it.each([
        'views',
        'contactStarted',
        'contactCompleted'
    ])('should reject a negative contactFunnel.%s', (key) => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            ...validResponse,
            contactFunnel: { ...validResponse.contactFunnel, [key]: -5 }
        });
        expect(result.success).toBe(false);
    });

    it('should reject a contactFunnel missing a field', () => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            ...validResponse,
            contactFunnel: { views: 1, contactStarted: 1 }
        });
        expect(result.success).toBe(false);
    });
});

describe('ListingTrafficStatsResponseSchema available=false invariant', () => {
    const unavailable = {
        window: '7d',
        available: false,
        referrers: [],
        countries: [],
        devices: [],
        contactFunnel: null
    };
    const row = [{ value: 'google.com', count: 3 }];

    it('should accept available=false with empty arrays and null funnel', () => {
        expect(ListingTrafficStatsResponseSchema.safeParse(unavailable).success).toBe(true);
    });

    it('should accept available=false with an all-zero funnel', () => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            ...unavailable,
            contactFunnel: { views: 0, contactStarted: 0, contactCompleted: 0 }
        });
        expect(result.success).toBe(true);
    });

    it.each([
        'referrers',
        'countries',
        'devices'
    ])('should reject available=false with a non-empty %s', (key) => {
        expect(
            ListingTrafficStatsResponseSchema.safeParse({ ...unavailable, [key]: row }).success
        ).toBe(false);
    });

    it('should reject available=false with a non-zero funnel', () => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            ...unavailable,
            contactFunnel: { views: 1, contactStarted: 0, contactCompleted: 0 }
        });
        expect(result.success).toBe(false);
    });

    it('should accept available=true with data', () => {
        const result = ListingTrafficStatsResponseSchema.safeParse({
            ...unavailable,
            available: true,
            referrers: row
        });
        expect(result.success).toBe(true);
    });
});

describe('ListingTrafficStatsParamsSchema', () => {
    it.each([
        'ACCOMMODATION',
        'VENUE',
        'EXPERIENCE',
        'PARTNER'
    ])('should accept entityType %s', (entityType) => {
        expect(
            ListingTrafficStatsParamsSchema.safeParse({ entityType, entityId: ID }).success
        ).toBe(true);
    });

    it.each([
        'POST',
        'EVENT',
        'DESTINATION',
        'venue'
    ])('should reject entityType %s', (entityType) => {
        expect(
            ListingTrafficStatsParamsSchema.safeParse({ entityType, entityId: ID }).success
        ).toBe(false);
    });

    it('should reject a non-uuid entityId', () => {
        const result = ListingTrafficStatsParamsSchema.safeParse({
            entityType: 'VENUE',
            entityId: 'nope'
        });
        expect(result.success).toBe(false);
    });
});

describe('ListingTrafficStatsQuerySchema', () => {
    it('should accept 7d, 30d and 90d', () => {
        for (const window of ['7d', '30d', '90d']) {
            expect(ListingTrafficStatsQuerySchema.safeParse({ window }).success).toBe(true);
        }
    });

    it('should reject a window outside the set', () => {
        expect(ListingTrafficStatsQuerySchema.safeParse({ window: '14d' }).success).toBe(false);
    });
});
