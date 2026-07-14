/**
 * Tests for point-of-interest nearby schemas (HOS-145 T-001).
 *
 * Verifies:
 * - NearbyPoiQuerySchema applies defaults (radius=5, limit=12) when absent
 * - NearbyPoiQuerySchema rejects out-of-bounds radius/limit values
 * - NearbyPoiQuerySchema coerces string query params to numbers
 * - NearbyPoiSchema requires a non-negative distanceKm
 * - NearbyPoiSchema preserves the base public POI fields
 */
import { describe, expect, it } from 'vitest';
import {
    NearbyPoiQuerySchema,
    NearbyPoiSchema
} from '../../../src/entities/point-of-interest/point-of-interest.nearby.schema.js';
import { createValidPointOfInterest } from '../../fixtures/point-of-interest.fixtures.js';

// ---------------------------------------------------------------------------
// NearbyPoiQuerySchema
// ---------------------------------------------------------------------------

describe('NearbyPoiQuerySchema — safeParse', () => {
    it('should apply default radius=5 and limit=12 when params are absent', () => {
        const result = NearbyPoiQuerySchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.radius).toBe(5);
            expect(result.data.limit).toBe(12);
        }
    });

    it('should coerce string radius/limit inputs to numbers', () => {
        const result = NearbyPoiQuerySchema.safeParse({ radius: '5', limit: '12' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.radius).toBe(5);
            expect(result.data.limit).toBe(12);
        }
    });

    it('should accept a custom radius/limit within bounds', () => {
        const result = NearbyPoiQuerySchema.safeParse({ radius: '10', limit: '25' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.radius).toBe(10);
            expect(result.data.limit).toBe(25);
        }
    });

    it('should reject radius=0 (below the 0.1km minimum)', () => {
        const result = NearbyPoiQuerySchema.safeParse({ radius: 0 });

        expect(result.success).toBe(false);
    });

    it('should reject radius=21 (above the 20km maximum)', () => {
        const result = NearbyPoiQuerySchema.safeParse({ radius: 21 });

        expect(result.success).toBe(false);
    });

    it('should reject limit=0 (below the minimum of 1)', () => {
        const result = NearbyPoiQuerySchema.safeParse({ limit: 0 });

        expect(result.success).toBe(false);
    });

    it('should reject limit=51 (above the maximum of 50)', () => {
        const result = NearbyPoiQuerySchema.safeParse({ limit: 51 });

        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// NearbyPoiSchema
// ---------------------------------------------------------------------------

describe('NearbyPoiSchema — safeParse', () => {
    it('should require distanceKm as a non-negative number', () => {
        const data = { ...createValidPointOfInterest(), distanceKm: 1.5 };

        const result = NearbyPoiSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.distanceKm).toBe(1.5);
        }
    });

    it('should reject a missing distanceKm', () => {
        const data = createValidPointOfInterest();

        const result = NearbyPoiSchema.safeParse(data);

        expect(result.success).toBe(false);
    });

    it('should reject a negative distanceKm', () => {
        const data = { ...createValidPointOfInterest(), distanceKm: -1 };

        const result = NearbyPoiSchema.safeParse(data);

        expect(result.success).toBe(false);
    });

    it('should accept distanceKm=0 (accommodation right at the POI)', () => {
        const data = { ...createValidPointOfInterest(), distanceKm: 0 };

        const result = NearbyPoiSchema.safeParse(data);

        expect(result.success).toBe(true);
    });

    it('should preserve the base public POI fields (id, slug, lat, long)', () => {
        const data = { ...createValidPointOfInterest(), distanceKm: 2.3 };

        const result = NearbyPoiSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe(data.id);
            expect(result.data.slug).toBe(data.slug);
            expect(result.data.lat).toBe(data.lat);
            expect(result.data.long).toBe(data.long);
        }
    });
});
