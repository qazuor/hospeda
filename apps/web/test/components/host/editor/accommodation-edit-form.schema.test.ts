/**
 * @file accommodation-edit-form.schema.test.ts
 * @description Guards the per-section validation slices (HOS-318 T-004).
 *
 * Two things matter here. First, that the split lost no field — a dropped field
 * silently stops being validated, which is invisible until bad data reaches the
 * API. Second, that the slices are still sliceable in Zod 4: composing them must
 * not depend on `.pick()`/`.omit()`, which HOS-425 showed can be rejected.
 */

import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_SECTION_SCHEMAS,
    AccommodationBasicsSchema,
    AccommodationCapacityPricingSchema,
    AccommodationContactSchema,
    AccommodationEditFormSchema,
    AccommodationLocationSchema,
    AccommodationSeoSchema,
    AccommodationServicesSchema
} from '@/components/host/editor/accommodation-edit-form.schema';

describe('slice composition', () => {
    it('should cover every field of the merged schema across the six slices', () => {
        const merged = Object.keys(AccommodationEditFormSchema.shape).sort();
        const fromSlices = [
            ...Object.keys(AccommodationBasicsSchema.shape),
            ...Object.keys(AccommodationCapacityPricingSchema.shape),
            ...Object.keys(AccommodationLocationSchema.shape),
            ...Object.keys(AccommodationServicesSchema.shape),
            ...Object.keys(AccommodationContactSchema.shape),
            ...Object.keys(AccommodationSeoSchema.shape)
        ].sort();

        expect(fromSlices).toEqual(merged);
    });

    it('should not repeat a field across two slices', () => {
        const fromSlices = [
            ...Object.keys(AccommodationBasicsSchema.shape),
            ...Object.keys(AccommodationCapacityPricingSchema.shape),
            ...Object.keys(AccommodationLocationSchema.shape),
            ...Object.keys(AccommodationServicesSchema.shape),
            ...Object.keys(AccommodationContactSchema.shape),
            ...Object.keys(AccommodationSeoSchema.shape)
        ];

        expect(new Set(fromSlices).size).toBe(fromSlices.length);
    });

    it('should validate the exact field set the pre-split editor did, plus the G7 smoke additions', () => {
        // Hand-written on purpose, and load-bearing: the "cover every field"
        // assertion above CANNOT catch a dropped field, because the merged
        // schema is itself composed from the slices — remove `summary` from a
        // slice and both sides lose it in step, so that test still passes.
        // Mutation-verified: this is the only assertion that fails.
        const expected = [
            'amenityIds',
            'apartment',
            'basePrice',
            'bathrooms',
            'bedrooms',
            'currency',
            'description',
            'destinationId',
            'email',
            'facebook',
            'featureIds',
            'floor',
            'instagram',
            'latitude',
            'linkedin',
            'longitude',
            'maxGuests',
            'minNights',
            'name',
            'number',
            'phone',
            'seoDescription',
            'seoTitle',
            'street',
            'summary',
            'tiktok',
            'twitter',
            'type',
            'website',
            'whatsapp',
            'youtube'
        ];

        expect(Object.keys(AccommodationEditFormSchema.shape).sort()).toEqual(expected.sort());
    });

    it('should expose a slice for every form-owning section id', () => {
        expect(Object.keys(ACCOMMODATION_SECTION_SCHEMAS).sort()).toEqual(
            ['amenities', 'basicInfo', 'capacityPricing', 'contact', 'location', 'seo'].sort()
        );
    });
});

describe('AccommodationBasicsSchema', () => {
    it('should accept a valid name', () => {
        expect(AccommodationBasicsSchema.safeParse({ name: 'Casa del Sol' }).success).toBe(true);
    });

    it('should reject a name under the domain minimum', () => {
        const result = AccommodationBasicsSchema.safeParse({ name: 'ab' });

        expect(result.success).toBe(false);
    });

    it('should reject a name over 100 chars (the domain cap, not the HTTP 200)', () => {
        const result = AccommodationBasicsSchema.safeParse({ name: 'x'.repeat(101) });

        expect(result.success).toBe(false);
    });

    it('should reject a description under 30 chars', () => {
        // The HTTP schema has no minimum at all — this bound is the domain's.
        const result = AccommodationBasicsSchema.safeParse({ name: 'Casa', description: 'corta' });

        expect(result.success).toBe(false);
    });
});

describe('AccommodationCapacityPricingSchema', () => {
    it('should accept an explicit null (host clearing the field)', () => {
        // The inherited z.coerce.number() would turn null into 0, which then
        // passes bounds checks it should not.
        const result = AccommodationCapacityPricingSchema.safeParse({ maxGuests: null });

        expect(result.success).toBe(true);
        if (result.success) expect(result.data.maxGuests).toBeNull();
    });

    it('should reject a zero base price', () => {
        // The HTTP schema accepts 0; the domain requires strictly positive.
        expect(AccommodationCapacityPricingSchema.safeParse({ basePrice: 0 }).success).toBe(false);
    });

    it('should reject a fractional base price with the integer message key (H-111)', () => {
        // Before this fix, 1234.56 passed validation, was stored verbatim, and
        // the public sidebar's `Intl.NumberFormat({ maximumFractionDigits: 0 })`
        // rounded it UP to $1.235 — the host set less than what the guest saw.
        const result = AccommodationCapacityPricingSchema.safeParse({ basePrice: 1234.56 });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('zodError.common.price.price.integer');
        }
    });

    it('should reject maxGuests above the cap', () => {
        expect(AccommodationCapacityPricingSchema.safeParse({ maxGuests: 201 }).success).toBe(
            false
        );
    });

    it('should reject a fractional bedroom count', () => {
        expect(AccommodationCapacityPricingSchema.safeParse({ bedrooms: 2.5 }).success).toBe(false);
    });

    it('should accept a valid minNights (G7 smoke, H-112)', () => {
        expect(AccommodationCapacityPricingSchema.safeParse({ minNights: 3 }).success).toBe(true);
    });

    it('should reject minNights below 1', () => {
        expect(AccommodationCapacityPricingSchema.safeParse({ minNights: 0 }).success).toBe(false);
    });

    it('should accept an explicit null minNights (host clearing the field)', () => {
        const result = AccommodationCapacityPricingSchema.safeParse({ minNights: null });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.minNights).toBeNull();
    });
});

describe('AccommodationLocationSchema', () => {
    it('should accept coordinates in range', () => {
        const result = AccommodationLocationSchema.safeParse({
            latitude: -32.48,
            longitude: -58.23
        });

        expect(result.success).toBe(true);
    });

    it.each([
        ['latitude', 91],
        ['latitude', -91],
        ['longitude', 181],
        ['longitude', -181]
    ])('should reject %s out of range (%i)', (field, value) => {
        expect(AccommodationLocationSchema.safeParse({ [field]: value }).success).toBe(false);
    });

    it('should accept street/number/floor/apartment independently of coordinates (G7 smoke, H-117)', () => {
        const result = AccommodationLocationSchema.safeParse({
            street: 'Av. Belgrano',
            number: '123',
            floor: '4',
            apartment: 'B'
        });

        expect(result.success).toBe(true);
    });

    it('should reject a street under the domain minimum (2 chars)', () => {
        expect(AccommodationLocationSchema.safeParse({ street: 'A' }).success).toBe(false);
    });
});

describe('AccommodationSeoSchema (G7 smoke, H-121)', () => {
    it('should accept a valid seoTitle/seoDescription pair', () => {
        const result = AccommodationSeoSchema.safeParse({
            seoTitle: 'A'.repeat(30),
            seoDescription: 'B'.repeat(70)
        });
        expect(result.success).toBe(true);
    });

    it('should reject a seoTitle under 30 chars', () => {
        expect(AccommodationSeoSchema.safeParse({ seoTitle: 'too short' }).success).toBe(false);
    });

    it('should reject a seoDescription under 70 chars', () => {
        expect(AccommodationSeoSchema.safeParse({ seoDescription: 'too short' }).success).toBe(
            false
        );
    });
});

describe('AccommodationContactSchema', () => {
    it('should accept an empty phone so the host can clear it', () => {
        expect(AccommodationContactSchema.safeParse({ phone: '' }).success).toBe(true);
    });

    it('should reject a phone that is not E.164', () => {
        // The HTTP schema types this as a bare string with no format check, so
        // "asdasd" used to pass both the client gate and the server.
        expect(AccommodationContactSchema.safeParse({ phone: 'asdasd' }).success).toBe(false);
    });

    it('should reject a whatsapp that is not E.164', () => {
        expect(AccommodationContactSchema.safeParse({ whatsapp: 'no-es-un-numero' }).success).toBe(
            false
        );
    });

    it('should carry all six social fields', () => {
        const keys = Object.keys(AccommodationContactSchema.shape);

        for (const social of [
            'facebook',
            'instagram',
            'twitter',
            'linkedin',
            'tiktok',
            'youtube'
        ]) {
            expect(keys).toContain(social);
        }
    });
});

describe('Zod 4 slicing safety (HOS-425)', () => {
    it('should let every slice be extended without throwing', () => {
        // If a slice were built on a schema carrying `.refine()`, Zod 4 would
        // reject this. Composing off `.shape` is what keeps it safe.
        for (const [id, schema] of Object.entries(ACCOMMODATION_SECTION_SCHEMAS)) {
            expect(() => schema.extend({ probe: undefined as never }), id).not.toThrow();
        }
    });

    it('should expose a plain object shape on every slice', () => {
        for (const [id, schema] of Object.entries(ACCOMMODATION_SECTION_SCHEMAS)) {
            expect(typeof schema.shape, id).toBe('object');
            expect(Object.keys(schema.shape).length, id).toBeGreaterThan(0);
        }
    });
});
