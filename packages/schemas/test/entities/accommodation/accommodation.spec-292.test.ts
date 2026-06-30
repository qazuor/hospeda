/**
 * Tests for SPEC-292: owner-leak closure and admin-path regression guard.
 *
 * Coverage:
 * 1. AccommodationCreateHttpSchema.shape has NO `isFeatured` key.
 * 2. AccommodationUpdateHttpSchema.shape has NO `isFeatured` key.
 * 3. httpToDomainAccommodationCreate always returns isFeatured===false,
 *    even when the caller passes isFeatured:true in the raw payload
 *    (the schema strips it and the mapper hardcodes false).
 * 4. httpToDomainAccommodationUpdate does NOT carry isFeatured in the
 *    returned domain object.
 * 5. AccommodationPatchInputSchema (admin crud) STILL accepts isFeatured
 *    (regression: admin path must remain unaffected).
 * 6. AccommodationSearchHttpSchema still accepts isFeatured as a query
 *    param (search filter is read-only, not write; must remain unaffected).
 *
 * @module test/entities/accommodation/accommodation.spec-292
 */

import { describe, expect, it } from 'vitest';
import {
    AccommodationPatchInputSchema,
    AccommodationUpdateInputSchema
} from '../../../src/entities/accommodation/accommodation.crud.schema.js';
import {
    AccommodationCreateHttpSchema,
    AccommodationSearchHttpSchema,
    AccommodationUpdateHttpSchema,
    httpToDomainAccommodationCreate,
    httpToDomainAccommodationUpdate
} from '../../../src/entities/accommodation/accommodation.http.schema.js';
import { AccommodationTypeEnum, PriceCurrencyEnum } from '../../../src/enums/index.js';

// ---------------------------------------------------------------------------
// Minimal valid HTTP create payload (mirrors base payload in existing tests)
// ---------------------------------------------------------------------------

const validCreatePayload = {
    name: 'Test Hotel SPEC-292',
    description: 'A detailed description for the test hotel that is long enough for validation.',
    type: AccommodationTypeEnum.HOTEL,
    address: '123 Main St, Concepcion del Uruguay',
    latitude: -32.0,
    longitude: -58.0,
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    basePrice: 100,
    currency: PriceCurrencyEnum.USD,
    isAvailable: true,
    allowsPets: false,
    destinationId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    ownerId: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f'
};

// ---------------------------------------------------------------------------
// Group 1 — Schema shape: isFeatured must NOT be declared in owner HTTP schemas
// ---------------------------------------------------------------------------

describe('SPEC-292 — AccommodationCreateHttpSchema schema shape', () => {
    it('does NOT have an isFeatured key in its shape', () => {
        // Arrange & Act
        const shapeKeys = Object.keys(AccommodationCreateHttpSchema.shape);

        // Assert
        expect(shapeKeys).not.toContain('isFeatured');
    });

    it('silently strips isFeatured when the caller provides it', () => {
        // Arrange — caller tries to pass isFeatured:true (e.g. from a crafted request)
        const payload = { ...validCreatePayload, isFeatured: true };

        // Act
        const result = AccommodationCreateHttpSchema.safeParse(payload);

        // Assert — parse succeeds (extra keys are stripped, not rejected)
        expect(result.success).toBe(true);
        if (result.success) {
            // The parsed output must NOT contain isFeatured
            expect(result.data).not.toHaveProperty('isFeatured');
        }
    });
});

describe('SPEC-292 — AccommodationUpdateHttpSchema schema shape', () => {
    it('does NOT have an isFeatured key in its shape', () => {
        // Arrange & Act — AccommodationUpdateHttpSchema is derived from CreateHttpSchema
        // so it inherits the same omission.
        const shapeKeys = Object.keys(AccommodationUpdateHttpSchema.shape);

        // Assert
        expect(shapeKeys).not.toContain('isFeatured');
    });

    it('silently strips isFeatured when the caller provides it in a PATCH payload', () => {
        // Arrange
        const patchPayload = { isFeatured: true, name: 'Updated Hotel Name Here' };

        // Act
        const result = AccommodationUpdateHttpSchema.safeParse(patchPayload);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('isFeatured');
        }
    });
});

// ---------------------------------------------------------------------------
// Group 2 — Mapper: isFeatured hardcoded to false on owner create path
// ---------------------------------------------------------------------------

describe('SPEC-292 — httpToDomainAccommodationCreate mapper', () => {
    it('hardcodes isFeatured=false in the returned domain object', () => {
        // Arrange — parse a valid payload first (schema strips extra keys)
        const parseResult = AccommodationCreateHttpSchema.safeParse(validCreatePayload);
        expect(parseResult.success).toBe(true);
        const httpData = parseResult.data!;

        // Act
        const domain = httpToDomainAccommodationCreate(httpData);

        // Assert — mapper enforces isFeatured=false regardless of caller input
        expect(domain.isFeatured).toBe(false);
    });

    it('returns isFeatured=false even when the original raw payload had isFeatured:true', () => {
        // Arrange — caller injects isFeatured:true but schema strips it before mapper sees it
        const rawPayload = { ...validCreatePayload, isFeatured: true };
        const parseResult = AccommodationCreateHttpSchema.safeParse(rawPayload);
        expect(parseResult.success).toBe(true);
        const httpData = parseResult.data!;

        // Act
        const domain = httpToDomainAccommodationCreate(httpData);

        // Assert — mapper output still has isFeatured=false (injected by the mapper itself)
        expect(domain.isFeatured).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Group 3 — Mapper: isFeatured absent from owner update domain output
// ---------------------------------------------------------------------------

describe('SPEC-292 — httpToDomainAccommodationUpdate mapper', () => {
    it('does NOT include isFeatured in the returned domain update object', () => {
        // Arrange — minimal PATCH payload (name update only)
        const patchPayload = { name: 'Updated Name For Test' };
        const parseResult = AccommodationUpdateHttpSchema.safeParse(patchPayload);
        expect(parseResult.success).toBe(true);
        const httpData = parseResult.data!;

        // Act
        const domain = httpToDomainAccommodationUpdate(httpData);

        // Assert — the update domain object must not carry isFeatured (no instruction to flip)
        expect(domain).not.toHaveProperty('isFeatured');
    });

    it('produces a clean partial object with only the provided fields', () => {
        // Arrange
        const patchPayload = { name: 'Partial Update Hotel' };
        const parseResult = AccommodationUpdateHttpSchema.safeParse(patchPayload);
        expect(parseResult.success).toBe(true);
        const httpData = parseResult.data!;

        // Act
        const domain = httpToDomainAccommodationUpdate(httpData);

        // Assert — isFeatured is explicitly absent (not just undefined)
        expect(Object.prototype.hasOwnProperty.call(domain, 'isFeatured')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Group 4 — Admin crud schema regression: isFeatured must REMAIN in PatchInputSchema
// ---------------------------------------------------------------------------

describe('SPEC-292 regression — AccommodationPatchInputSchema (admin crud) still accepts isFeatured', () => {
    it('has isFeatured in its shape (admin keeps manual featured control)', () => {
        // Arrange & Act
        const shapeKeys = Object.keys(AccommodationPatchInputSchema.shape);

        // Assert — admin schema MUST still include isFeatured
        expect(shapeKeys).toContain('isFeatured');
    });

    it('parses isFeatured:true without error', () => {
        // Arrange
        const adminPatch = { isFeatured: true };

        // Act
        const result = AccommodationPatchInputSchema.safeParse(adminPatch);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isFeatured).toBe(true);
        }
    });

    it('parses isFeatured:false without error', () => {
        // Arrange
        const adminPatch = { isFeatured: false };

        // Act
        const result = AccommodationPatchInputSchema.safeParse(adminPatch);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isFeatured).toBe(false);
        }
    });

    it('AccommodationUpdateInputSchema also accepts isFeatured (same underlying schema)', () => {
        // Both AccommodationPatchInputSchema and AccommodationUpdateInputSchema are the same schema.
        const result = AccommodationUpdateInputSchema.safeParse({ isFeatured: true });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Group 5 — Search filter schema regression: isFeatured query param untouched
// ---------------------------------------------------------------------------

describe('SPEC-292 regression — AccommodationSearchHttpSchema still accepts isFeatured filter', () => {
    it('has isFeatured in its shape (search filter for featured listings)', () => {
        // Arrange & Act
        const shapeKeys = Object.keys(AccommodationSearchHttpSchema.shape);

        // Assert — search filter must still include isFeatured
        expect(shapeKeys).toContain('isFeatured');
    });

    it('parses isFeatured=true as a boolean query param', () => {
        // Arrange — in HTTP context this arrives as a string; coerce.boolean handles it
        const searchParams = { isFeatured: 'true' };

        // Act
        const result = AccommodationSearchHttpSchema.safeParse(searchParams);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isFeatured).toBe(true);
        }
    });
});
