import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    VenueAdminCreateInputSchema,
    VenueDeleteInputSchema,
    VenueOwnerUpdateInputSchema,
    VenueRestoreInputSchema,
    VenueUpdateInputSchema
} from '../../../src/entities/venue/venue.crud.schema.js';
import { createMinimalVenue } from '../../fixtures/venue.fixtures.js';

// Helper: build a minimal admin-create payload
const buildCreatePayload = () => {
    const base = createMinimalVenue();
    return {
        name: base.name,
        slug: base.slug,
        summary: base.summary,
        description: base.description,
        type: base.type,
        destinationId: base.destinationId,
        ownerId: base.ownerId
    };
};

describe('VenueAdminCreateInputSchema', () => {
    it('should validate a valid create payload', () => {
        const data = buildCreatePayload();
        expect(() => VenueAdminCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should allow optional slug (admin may omit; service generates one)', () => {
        const { slug: _s, ...data } = buildCreatePayload();
        expect(() => VenueAdminCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject when name is missing', () => {
        const { name: _n, ...data } = buildCreatePayload();
        expect(() => VenueAdminCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject when type is missing', () => {
        const { type: _t, ...data } = buildCreatePayload();
        expect(() => VenueAdminCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject non-HTTPS menuUrl in create payload', () => {
        const data = { ...buildCreatePayload(), menuUrl: 'http://insecure.com/menu' };
        expect(() => VenueAdminCreateInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('VenueOwnerUpdateInputSchema', () => {
    // HOS-166 D-1: the owner now controls identity fields (name/description/destinationId).
    // `slug` remains admin-only (immutable post-create, derived from name — OQ-3).

    it('should validate a valid owner-update payload with operational fields', () => {
        const data = {
            priceRange: 'MID',
            menuUrl: 'https://example.com/new-menu'
        };
        expect(() => VenueOwnerUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should allow an empty object (all fields optional)', () => {
        expect(() => VenueOwnerUpdateInputSchema.parse({})).not.toThrow();
    });

    it('should accept identity field "name" (HOS-166 D-1: owner now controls identity)', () => {
        const data = { name: 'New Name', priceRange: 'HIGH' };
        const result = VenueOwnerUpdateInputSchema.parse(data);
        expect(result.name).toBe('New Name');
    });

    it('should strip identity field "slug" (unknown key)', () => {
        const data = { slug: 'new-slug', menuUrl: 'https://example.com/menu' };
        const result = VenueOwnerUpdateInputSchema.parse(data);
        expect('slug' in result).toBe(false);
    });

    it('should preserve editable field "type" (SPEC-253: owner may change listing type)', () => {
        const data = { type: 'BAR', priceRange: 'BUDGET' };
        const result = VenueOwnerUpdateInputSchema.parse(data);
        expect('type' in result).toBe(true);
        expect(result.type).toBe('BAR');
    });

    it('should accept identity field "destinationId" (HOS-166 D-1: owner now controls identity)', () => {
        const destinationId = faker.string.uuid();
        const data = { destinationId, priceRange: 'PREMIUM' };
        const result = VenueOwnerUpdateInputSchema.parse(data);
        expect(result.destinationId).toBe(destinationId);
    });

    it('should accept amenityIds and featureIds arrays', () => {
        const data = {
            amenityIds: [faker.string.uuid(), faker.string.uuid()],
            featureIds: [faker.string.uuid()]
        };
        expect(() => VenueOwnerUpdateInputSchema.parse(data)).not.toThrow();
    });
});

describe('VenueUpdateInputSchema (admin update)', () => {
    it('should allow partial updates', () => {
        const data = { name: 'Updated Name' };
        expect(() => VenueUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should allow empty update object', () => {
        expect(() => VenueUpdateInputSchema.parse({})).not.toThrow();
    });

    it('should reject non-HTTPS menuUrl', () => {
        const data = { menuUrl: 'ftp://bad.url' };
        expect(() => VenueUpdateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject an invalid type value on update (enum validation enforced on entity schema)', () => {
        // venueUpdateInputSchema.type is derived from venueTypeEnumSchema — invalid values are rejected.
        const data = { type: 'TAQUERIA' };
        expect(() => VenueUpdateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should NOT carry publicationStatus when field is absent (PATCH semantics)', () => {
        // A PATCH with only `name` must NOT carry a publication state (HOS-1641)
        const result = VenueUpdateInputSchema.parse({ name: 'Foo' });
        expect('publicationStatus' in result).toBe(false);
    });

    it('should NOT inject default isFeatured when field is absent (PATCH semantics)', () => {
        const result = VenueUpdateInputSchema.parse({ name: 'Foo' });
        expect('isFeatured' in result).toBe(false);
    });

    it('should NOT include ownerId (server-managed — requires dedicated admin action)', () => {
        const keys = Object.keys(VenueUpdateInputSchema.shape);
        expect(keys).not.toContain('ownerId');
    });

    it('should NOT include reviewsCount (server-computed aggregate)', () => {
        const keys = Object.keys(VenueUpdateInputSchema.shape);
        expect(keys).not.toContain('reviewsCount');
    });

    it('should NOT include averageRating (server-computed aggregate)', () => {
        const keys = Object.keys(VenueUpdateInputSchema.shape);
        expect(keys).not.toContain('averageRating');
    });
});

describe('VenueDeleteInputSchema', () => {
    it('should validate a valid delete input', () => {
        const data = { id: faker.string.uuid() };
        expect(() => VenueDeleteInputSchema.parse(data)).not.toThrow();
    });

    it('should default force to false', () => {
        const result = VenueDeleteInputSchema.parse({ id: faker.string.uuid() });
        expect(result.force).toBe(false);
    });

    it('should accept force: true', () => {
        const result = VenueDeleteInputSchema.parse({ id: faker.string.uuid(), force: true });
        expect(result.force).toBe(true);
    });

    it('should reject invalid id', () => {
        expect(() => VenueDeleteInputSchema.parse({ id: 'not-a-uuid' })).toThrow(ZodError);
    });
});

describe('VenueRestoreInputSchema', () => {
    it('should validate a valid restore input', () => {
        const data = { id: faker.string.uuid() };
        expect(() => VenueRestoreInputSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid id', () => {
        expect(() => VenueRestoreInputSchema.parse({ id: 'bad' })).toThrow(ZodError);
    });
});
