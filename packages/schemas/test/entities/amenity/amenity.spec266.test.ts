/**
 * SPEC-266: Amenity/Feature catalog-by-vertical — schema contract tests.
 *
 * Covers:
 * - Slug regex accepts underscores and hyphens, rejects uppercase, spaces, double separators
 * - applicableVerticals requires at least one valid vertical on create
 * - applicableVerticals rejects empty arrays and unknown vertical values
 * - Feature schema shares the same slug regex and applicableVerticals rules
 */
import { describe, expect, it } from 'vitest';
import { AmenitySchema } from '../../../src/entities/amenity/amenity.schema.js';
import { FeatureSchema } from '../../../src/entities/feature/feature.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal required fields for a valid amenity entity (without slug or name). */
const baseAmenity = () => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    type: 'CONNECTIVITY',
    applicableVerticals: ['accommodation'] as ('accommodation' | 'gastronomy' | 'experience')[],
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '550e8400-e29b-41d4-a716-446655440001',
    updatedById: '550e8400-e29b-41d4-a716-446655440002'
});

/** Minimal required fields for a valid feature entity. */
const baseFeature = () => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'base-feature',
    applicableVerticals: ['accommodation'] as ('accommodation' | 'gastronomy' | 'experience')[],
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '550e8400-e29b-41d4-a716-446655440001',
    updatedById: '550e8400-e29b-41d4-a716-446655440002'
});

// ---------------------------------------------------------------------------
// Amenity slug regex (SPEC-266: underscores allowed as separator)
// ---------------------------------------------------------------------------

describe('AmenitySchema — slug regex (SPEC-266)', () => {
    it('should ACCEPT slug with hyphens (original format)', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'air-conditioning' });
        expect(result.success).toBe(true);
    });

    it('should ACCEPT slug with underscores (SPEC-266 addition)', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'air_conditioning' });
        expect(result.success).toBe(true);
    });

    it('should ACCEPT simple slug without separators', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'wifi' });
        expect(result.success).toBe(true);
    });

    it('should ACCEPT slug mixing hyphens and underscores', () => {
        const result = AmenitySchema.safeParse({
            ...baseAmenity(),
            slug: 'air_conditioning-split'
        });
        expect(result.success).toBe(true);
    });

    it('should REJECT slug with uppercase letters', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'Air_conditioning' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug with spaces', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'air conditioning' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug with double hyphens', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'air--conditioning' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug with double underscores', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'air__conditioning' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug with leading hyphen', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: '-wifi' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug with trailing underscore', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'wifi_' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug shorter than 3 characters', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'ab' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug longer than 100 characters', () => {
        const result = AmenitySchema.safeParse({ ...baseAmenity(), slug: 'a'.repeat(101) });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Amenity applicableVerticals (SPEC-266)
// ---------------------------------------------------------------------------

describe('AmenitySchema — applicableVerticals (SPEC-266)', () => {
    it('should ACCEPT a single valid vertical', () => {
        const result = AmenitySchema.safeParse({
            ...baseAmenity(),
            applicableVerticals: ['accommodation'] as (
                | 'accommodation'
                | 'gastronomy'
                | 'experience'
            )[]
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.applicableVerticals).toEqual(['accommodation']);
        }
    });

    it('should ACCEPT all three valid verticals', () => {
        const result = AmenitySchema.safeParse({
            ...baseAmenity(),
            applicableVerticals: ['accommodation', 'gastronomy', 'experience'] as (
                | 'accommodation'
                | 'gastronomy'
                | 'experience'
            )[]
        });
        expect(result.success).toBe(true);
    });

    it('should ACCEPT gastronomy vertical', () => {
        const result = AmenitySchema.safeParse({
            ...baseAmenity(),
            applicableVerticals: ['gastronomy'] as ('accommodation' | 'gastronomy' | 'experience')[]
        });
        expect(result.success).toBe(true);
    });

    it('should ACCEPT experience vertical', () => {
        const result = AmenitySchema.safeParse({
            ...baseAmenity(),
            applicableVerticals: ['experience'] as ('accommodation' | 'gastronomy' | 'experience')[]
        });
        expect(result.success).toBe(true);
    });

    it('should REJECT empty applicableVerticals array (min 1)', () => {
        const result = AmenitySchema.safeParse({
            ...baseAmenity(),
            applicableVerticals: [] as ('accommodation' | 'gastronomy' | 'experience')[]
        });
        expect(result.success).toBe(false);
    });

    it('should REJECT unknown vertical value', () => {
        const result = AmenitySchema.safeParse({
            ...baseAmenity(),
            applicableVerticals: ['invalid_vertical'] as any
        });
        expect(result.success).toBe(false);
    });

    it('should REJECT missing applicableVerticals field', () => {
        const { applicableVerticals: _av, ...withoutVerticals } = baseAmenity();
        const result = AmenitySchema.safeParse(withoutVerticals);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Feature slug regex (SPEC-266: same rules as amenity)
// ---------------------------------------------------------------------------

describe('FeatureSchema — slug regex (SPEC-266)', () => {
    it('should ACCEPT slug with hyphens', () => {
        const result = FeatureSchema.safeParse({ ...baseFeature(), slug: 'real-time-booking' });
        expect(result.success).toBe(true);
    });

    it('should ACCEPT slug with underscores (SPEC-266 addition)', () => {
        const result = FeatureSchema.safeParse({ ...baseFeature(), slug: 'real_time_booking' });
        expect(result.success).toBe(true);
    });

    it('should REJECT slug with uppercase', () => {
        const result = FeatureSchema.safeParse({ ...baseFeature(), slug: 'Real_time' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug with spaces', () => {
        const result = FeatureSchema.safeParse({ ...baseFeature(), slug: 'real time' });
        expect(result.success).toBe(false);
    });

    it('should REJECT slug with double separators', () => {
        const result = FeatureSchema.safeParse({ ...baseFeature(), slug: 'real--time' });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Feature applicableVerticals (SPEC-266)
// ---------------------------------------------------------------------------

describe('FeatureSchema — applicableVerticals (SPEC-266)', () => {
    it('should ACCEPT valid vertical array', () => {
        const result = FeatureSchema.safeParse({
            ...baseFeature(),
            applicableVerticals: ['accommodation', 'gastronomy'] as (
                | 'accommodation'
                | 'gastronomy'
                | 'experience'
            )[]
        });
        expect(result.success).toBe(true);
    });

    it('should REJECT empty applicableVerticals array', () => {
        const result = FeatureSchema.safeParse({
            ...baseFeature(),
            applicableVerticals: [] as ('accommodation' | 'gastronomy' | 'experience')[]
        });
        expect(result.success).toBe(false);
    });

    it('should REJECT unknown vertical', () => {
        const result = FeatureSchema.safeParse({
            ...baseFeature(),
            applicableVerticals: ['hotel'] as any
        });
        expect(result.success).toBe(false);
    });
});
