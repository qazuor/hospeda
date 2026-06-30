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

// ---------------------------------------------------------------------------
// Bug B7a regression — GastronomyPublicSchema exposes destination relation
// Fixes: destinationName always empty on card (schema must allow the joined
// destination object so stripWithSchema does not drop it from the response).
// ---------------------------------------------------------------------------

describe('GastronomyPublicSchema — B7a regression (destination relation field)', () => {
    it('should include destination in its shape', () => {
        const keys = Object.keys(GastronomyPublicSchema.shape ?? {});
        expect(keys).toContain('destination');
    });

    it('should accept a valid destination object on parse', () => {
        const data = {
            ...createMinimalGastronomy(),
            destination: {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Concepción del Uruguay',
                slug: 'concepcion-del-uruguay'
            }
        };
        const result = GastronomyPublicSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.destination?.name).toBe('Concepción del Uruguay');
        }
    });

    it('should accept null destination (nullish — FK may not resolve in edge cases)', () => {
        const data = { ...createMinimalGastronomy(), destination: null };
        const result = GastronomyPublicSchema.safeParse(data);
        expect(result.success).toBe(true);
    });

    it('should NOT include ownerId (still excluded from public schema)', () => {
        const keys = Object.keys(GastronomyPublicSchema.shape ?? {});
        expect(keys).not.toContain('ownerId');
    });
});
