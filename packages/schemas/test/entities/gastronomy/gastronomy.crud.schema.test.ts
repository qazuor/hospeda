import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    GastronomyAdminCreateInputSchema,
    GastronomyDeleteInputSchema,
    GastronomyOwnerUpdateInputSchema,
    GastronomyRestoreInputSchema,
    GastronomyUpdateInputSchema
} from '../../../src/entities/gastronomy/gastronomy.crud.schema.js';
import { createMinimalGastronomy } from '../../fixtures/gastronomy.fixtures.js';

// Helper: build a minimal admin-create payload
const buildCreatePayload = () => {
    const base = createMinimalGastronomy();
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

describe('GastronomyAdminCreateInputSchema', () => {
    it('should validate a valid create payload', () => {
        const data = buildCreatePayload();
        expect(() => GastronomyAdminCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should allow optional slug (admin may omit; service generates one)', () => {
        const { slug: _s, ...data } = buildCreatePayload();
        expect(() => GastronomyAdminCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject when name is missing', () => {
        const { name: _n, ...data } = buildCreatePayload();
        expect(() => GastronomyAdminCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject when type is missing', () => {
        const { type: _t, ...data } = buildCreatePayload();
        expect(() => GastronomyAdminCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject non-HTTPS menuUrl in create payload', () => {
        const data = { ...buildCreatePayload(), menuUrl: 'http://insecure.com/menu' };
        expect(() => GastronomyAdminCreateInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('GastronomyOwnerUpdateInputSchema', () => {
    // The owner-update schema must NOT contain identity fields (name/slug/type/destinationId)
    // Those are admin-controlled. Unknown keys are silently stripped by Zod.

    it('should validate a valid owner-update payload with operational fields', () => {
        const data = {
            priceRange: 'MID',
            menuUrl: 'https://example.com/new-menu'
        };
        expect(() => GastronomyOwnerUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should allow an empty object (all fields optional)', () => {
        expect(() => GastronomyOwnerUpdateInputSchema.parse({})).not.toThrow();
    });

    it('should strip identity field "name" (unknown key)', () => {
        const data = { name: 'New Name', priceRange: 'HIGH' };
        const result = GastronomyOwnerUpdateInputSchema.parse(data);
        expect('name' in result).toBe(false);
    });

    it('should strip identity field "slug" (unknown key)', () => {
        const data = { slug: 'new-slug', menuUrl: 'https://example.com/menu' };
        const result = GastronomyOwnerUpdateInputSchema.parse(data);
        expect('slug' in result).toBe(false);
    });

    it('should strip identity field "type" (unknown key)', () => {
        const data = { type: 'BAR', priceRange: 'BUDGET' };
        const result = GastronomyOwnerUpdateInputSchema.parse(data);
        expect('type' in result).toBe(false);
    });

    it('should strip identity field "destinationId" (unknown key)', () => {
        const data = { destinationId: faker.string.uuid(), priceRange: 'PREMIUM' };
        const result = GastronomyOwnerUpdateInputSchema.parse(data);
        expect('destinationId' in result).toBe(false);
    });

    it('should accept amenityIds and featureIds arrays', () => {
        const data = {
            amenityIds: [faker.string.uuid(), faker.string.uuid()],
            featureIds: [faker.string.uuid()]
        };
        expect(() => GastronomyOwnerUpdateInputSchema.parse(data)).not.toThrow();
    });
});

describe('GastronomyUpdateInputSchema (admin update)', () => {
    it('should allow partial updates', () => {
        const data = { name: 'Updated Name' };
        expect(() => GastronomyUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should allow empty update object', () => {
        expect(() => GastronomyUpdateInputSchema.parse({})).not.toThrow();
    });

    it('should reject non-HTTPS menuUrl', () => {
        const data = { menuUrl: 'ftp://bad.url' };
        expect(() => GastronomyUpdateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject an invalid type value on update (enum validation enforced on entity schema)', () => {
        // GastronomyUpdateInputSchema.type is derived from GastronomyTypeEnumSchema — invalid values are rejected.
        const data = { type: 'TAQUERIA' };
        expect(() => GastronomyUpdateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should NOT inject default visibility when field is absent (PATCH semantics)', () => {
        // A PATCH with only `name` must NOT silently inject visibility:'PUBLIC'
        const result = GastronomyUpdateInputSchema.parse({ name: 'Foo' });
        expect('visibility' in result).toBe(false);
    });

    it('should NOT inject default moderationState when field is absent (PATCH semantics)', () => {
        const result = GastronomyUpdateInputSchema.parse({ name: 'Foo' });
        expect('moderationState' in result).toBe(false);
    });

    it('should NOT inject default isFeatured when field is absent (PATCH semantics)', () => {
        const result = GastronomyUpdateInputSchema.parse({ name: 'Foo' });
        expect('isFeatured' in result).toBe(false);
    });

    it('should NOT include ownerId (server-managed — requires dedicated admin action)', () => {
        const keys = Object.keys(GastronomyUpdateInputSchema.shape);
        expect(keys).not.toContain('ownerId');
    });

    it('should NOT include reviewsCount (server-computed aggregate)', () => {
        const keys = Object.keys(GastronomyUpdateInputSchema.shape);
        expect(keys).not.toContain('reviewsCount');
    });

    it('should NOT include averageRating (server-computed aggregate)', () => {
        const keys = Object.keys(GastronomyUpdateInputSchema.shape);
        expect(keys).not.toContain('averageRating');
    });
});

describe('GastronomyDeleteInputSchema', () => {
    it('should validate a valid delete input', () => {
        const data = { id: faker.string.uuid() };
        expect(() => GastronomyDeleteInputSchema.parse(data)).not.toThrow();
    });

    it('should default force to false', () => {
        const result = GastronomyDeleteInputSchema.parse({ id: faker.string.uuid() });
        expect(result.force).toBe(false);
    });

    it('should accept force: true', () => {
        const result = GastronomyDeleteInputSchema.parse({ id: faker.string.uuid(), force: true });
        expect(result.force).toBe(true);
    });

    it('should reject invalid id', () => {
        expect(() => GastronomyDeleteInputSchema.parse({ id: 'not-a-uuid' })).toThrow(ZodError);
    });
});

describe('GastronomyRestoreInputSchema', () => {
    it('should validate a valid restore input', () => {
        const data = { id: faker.string.uuid() };
        expect(() => GastronomyRestoreInputSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid id', () => {
        expect(() => GastronomyRestoreInputSchema.parse({ id: 'bad' })).toThrow(ZodError);
    });
});
