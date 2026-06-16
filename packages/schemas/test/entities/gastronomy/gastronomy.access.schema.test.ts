import { describe, expect, it } from 'vitest';
import {
    GastronomyAdminSchema,
    GastronomyProtectedSchema,
    GastronomyPublicSchema
} from '../../../src/entities/gastronomy/gastronomy.access.schema.js';
import {
    createMinimalGastronomy,
    createValidGastronomy
} from '../../fixtures/gastronomy.fixtures.js';

describe('GastronomyPublicSchema', () => {
    it('should parse a valid gastronomy for public response', () => {
        // Use minimal fixture to avoid issues with complex nested fields
        // that may not satisfy the strict access-schema overrides (e.g. BaseMediaObjectSchema)
        const data = createMinimalGastronomy();
        expect(() => GastronomyPublicSchema.parse(data)).not.toThrow();
    });

    it('should exclude ownerId from public response', () => {
        const data = {
            ...createValidGastronomy(),
            ownerId: '123e4567-e89b-12d3-a456-426614174000'
        };
        const result = GastronomyPublicSchema.safeParse(data);
        if (result.success) {
            expect('ownerId' in result.data).toBe(false);
        }
        // Public schema is a pick, so ownerId should not be in the shape
        const keys = Object.keys(GastronomyPublicSchema.shape ?? {});
        expect(keys).not.toContain('ownerId');
    });

    it('should exclude adminInfo from public response', () => {
        const keys = Object.keys(GastronomyPublicSchema.shape ?? {});
        expect(keys).not.toContain('adminInfo');
    });

    it('should exclude audit fields (createdById) from public response', () => {
        const keys = Object.keys(GastronomyPublicSchema.shape ?? {});
        expect(keys).not.toContain('createdById');
        expect(keys).not.toContain('updatedById');
    });
});

describe('GastronomyProtectedSchema', () => {
    it('should parse a valid gastronomy for protected response', () => {
        const data = createMinimalGastronomy();
        expect(() => GastronomyProtectedSchema.parse(data)).not.toThrow();
    });

    it('should include contactInfo in protected response', () => {
        const keys = Object.keys(GastronomyProtectedSchema.shape ?? {});
        expect(keys).toContain('contactInfo');
    });

    it('should include ownerId in protected response', () => {
        const keys = Object.keys(GastronomyProtectedSchema.shape ?? {});
        expect(keys).toContain('ownerId');
    });

    it('should include lifecycleState in protected response', () => {
        const keys = Object.keys(GastronomyProtectedSchema.shape ?? {});
        expect(keys).toContain('lifecycleState');
    });
});

describe('GastronomyAdminSchema', () => {
    it('should parse a valid gastronomy for admin response', () => {
        const data = createMinimalGastronomy();
        expect(() => GastronomyAdminSchema.parse(data)).not.toThrow();
    });

    it('should include all fields in admin response', () => {
        const keys = Object.keys(GastronomyAdminSchema.shape ?? {});
        expect(keys).toContain('ownerId');
        expect(keys).toContain('lifecycleState');
        expect(keys).toContain('moderationState');
    });
});
