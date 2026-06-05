import { describe, expect, it } from 'vitest';
import {
    type AdminAddonListQuery,
    AdminAddonListQuerySchema,
    type AdminAddonResponse,
    AdminAddonResponseSchema,
    type CreateAddon,
    CreateAddonSchema,
    type UpdateAddon,
    UpdateAddonSchema
} from '../../../src/api/billing/addon.schema.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Minimal valid CreateAddon payload */
const validCreateAddon: CreateAddon = {
    slug: 'extra-listings-10',
    name: 'Extra 10 Listings',
    description: 'Add 10 more listing slots to your plan.',
    billingType: 'one_time',
    priceArs: 150000,
    durationDays: 30,
    affectsLimitKey: 'maxListings',
    limitIncrease: 10,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

/** Minimal valid AdminAddonResponse payload */
const validAdminAddonResponse: AdminAddonResponse = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'extra-listings-10',
    name: 'Extra 10 Listings',
    description: 'Add 10 more listing slots to your plan.',
    billingType: 'one_time',
    priceArs: 150000,
    durationDays: 30,
    affectsLimitKey: 'maxListings',
    limitIncrease: 10,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: null
};

// ─── CreateAddonSchema ────────────────────────────────────────────────────────

describe('CreateAddonSchema', () => {
    describe('when given valid input', () => {
        it('should pass for a complete valid payload', () => {
            // Arrange
            const input = { ...validCreateAddon };

            // Act
            const result = CreateAddonSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.slug).toBe('extra-listings-10');
                expect(result.data.priceArs).toBe(150000);
                expect(result.data.targetCategories).toEqual(['owner']);
            }
        });

        it('should pass when nullable fields are null', () => {
            // Arrange
            const input: CreateAddon = {
                ...validCreateAddon,
                durationDays: null,
                affectsLimitKey: null,
                limitIncrease: null,
                grantsEntitlement: null
            };

            // Act
            const result = CreateAddonSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should pass for a recurring addon with complex targetCategories', () => {
            // Arrange
            const input: CreateAddon = {
                ...validCreateAddon,
                slug: 'featured-badge',
                billingType: 'recurring',
                durationDays: null,
                grantsEntitlement: 'featured_listing',
                affectsLimitKey: null,
                limitIncrease: null,
                targetCategories: ['owner', 'complex']
            };

            // Act
            const result = CreateAddonSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should pass with sortOrder of 0', () => {
            const result = CreateAddonSchema.safeParse({ ...validCreateAddon, sortOrder: 0 });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should fail when billingType is an invalid enum value', () => {
            // Arrange
            const input = { ...validCreateAddon, billingType: 'monthly' };

            // Act
            const result = CreateAddonSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should fail when priceArs is negative', () => {
            // Arrange
            const input = { ...validCreateAddon, priceArs: -100 };

            // Act
            const result = CreateAddonSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should fail when priceArs is zero (must be positive)', () => {
            const result = CreateAddonSchema.safeParse({ ...validCreateAddon, priceArs: 0 });
            expect(result.success).toBe(false);
        });

        it('should fail when priceArs is a float', () => {
            const result = CreateAddonSchema.safeParse({ ...validCreateAddon, priceArs: 99.99 });
            expect(result.success).toBe(false);
        });

        it('should fail when slug is missing', () => {
            // Arrange
            const { slug: _slug, ...inputWithoutSlug } = validCreateAddon;

            // Act
            const result = CreateAddonSchema.safeParse(inputWithoutSlug);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should fail when slug contains uppercase letters', () => {
            const result = CreateAddonSchema.safeParse({
                ...validCreateAddon,
                slug: 'ExtraListings'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when name is missing', () => {
            const { name: _name, ...inputWithoutName } = validCreateAddon;
            const result = CreateAddonSchema.safeParse(inputWithoutName);
            expect(result.success).toBe(false);
        });

        it('should fail when targetCategories is empty array', () => {
            const result = CreateAddonSchema.safeParse({
                ...validCreateAddon,
                targetCategories: []
            });
            expect(result.success).toBe(false);
        });

        it('should fail when targetCategories contains an invalid category', () => {
            const result = CreateAddonSchema.safeParse({
                ...validCreateAddon,
                targetCategories: ['tourist']
            });
            expect(result.success).toBe(false);
        });

        it('should fail when sortOrder is negative', () => {
            const result = CreateAddonSchema.safeParse({ ...validCreateAddon, sortOrder: -1 });
            expect(result.success).toBe(false);
        });

        it('should reject unknown fields (strict mode)', () => {
            const result = CreateAddonSchema.safeParse({ ...validCreateAddon, unknownField: 'x' });
            expect(result.success).toBe(false);
        });
    });
});

// ─── UpdateAddonSchema ────────────────────────────────────────────────────────

describe('UpdateAddonSchema', () => {
    describe('when given valid input', () => {
        it('should pass for a complete partial update', () => {
            // Arrange
            const input: UpdateAddon = {
                name: 'Updated Name',
                priceArs: 200000,
                isActive: false
            };

            // Act
            const result = UpdateAddonSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should pass for an empty object (all fields optional)', () => {
            // Arrange
            const input: UpdateAddon = {};

            // Act
            const result = UpdateAddonSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should pass when updating a single field', () => {
            const result = UpdateAddonSchema.safeParse({ sortOrder: 5 });
            expect(result.success).toBe(true);
        });

        it('should pass when setting nullable fields to null', () => {
            const result = UpdateAddonSchema.safeParse({
                durationDays: null,
                affectsLimitKey: null,
                limitIncrease: null,
                grantsEntitlement: null
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should fail when billingType is an invalid enum value', () => {
            const result = UpdateAddonSchema.safeParse({ billingType: 'annual' });
            expect(result.success).toBe(false);
        });

        it('should fail when priceArs is not a positive integer', () => {
            const result = UpdateAddonSchema.safeParse({ priceArs: -500 });
            expect(result.success).toBe(false);
        });

        it('should reject slug field (immutable — strict mode)', () => {
            const result = UpdateAddonSchema.safeParse({ slug: 'new-slug' });
            expect(result.success).toBe(false);
        });

        it('should fail when targetCategories is an empty array', () => {
            const result = UpdateAddonSchema.safeParse({ targetCategories: [] });
            expect(result.success).toBe(false);
        });
    });
});

// ─── AdminAddonListQuerySchema ────────────────────────────────────────────────

describe('AdminAddonListQuerySchema', () => {
    describe('when given valid input', () => {
        it('should parse with defaults when no params provided', () => {
            // Arrange
            const input = {};

            // Act
            const result = AdminAddonListQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
            }
        });

        it('should parse page and pageSize as coerced numbers from strings', () => {
            // Arrange
            const input = { page: '3', pageSize: '50' };

            // Act
            const result = AdminAddonListQuerySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(3);
                expect(result.data.pageSize).toBe(50);
            }
        });

        it('should parse billingType filter', () => {
            const result = AdminAddonListQuerySchema.safeParse({ billingType: 'recurring' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billingType).toBe('recurring');
            }
        });

        it('should parse targetCategory filter', () => {
            const result = AdminAddonListQuerySchema.safeParse({ targetCategory: 'complex' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.targetCategory).toBe('complex');
            }
        });

        it('should parse search filter', () => {
            const result = AdminAddonListQuerySchema.safeParse({ search: 'extra listings' });
            expect(result.success).toBe(true);
        });

        it('should accept page=1 and pageSize=100 (boundary)', () => {
            const result = AdminAddonListQuerySchema.safeParse({ page: 1, pageSize: 100 });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should fail when pageSize exceeds 100', () => {
            const result = AdminAddonListQuerySchema.safeParse({ pageSize: 101 });
            expect(result.success).toBe(false);
        });

        it('should fail when billingType is invalid enum value', () => {
            const result = AdminAddonListQuerySchema.safeParse({ billingType: 'weekly' });
            expect(result.success).toBe(false);
        });

        it('should fail when targetCategory is invalid enum value', () => {
            const result = AdminAddonListQuerySchema.safeParse({ targetCategory: 'tourist' });
            expect(result.success).toBe(false);
        });

        it('should fail when page is zero', () => {
            const result = AdminAddonListQuerySchema.safeParse({ page: 0 });
            expect(result.success).toBe(false);
        });
    });
});

// ─── AdminAddonResponseSchema ─────────────────────────────────────────────────

describe('AdminAddonResponseSchema', () => {
    describe('when given valid input', () => {
        it('should pass for a complete valid admin response', () => {
            // Arrange
            const input = { ...validAdminAddonResponse };

            // Act
            const result = AdminAddonResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe('11111111-1111-4111-8111-111111111111');
                expect(result.data.deletedAt).toBeNull();
            }
        });

        it('should pass when deletedAt is a valid datetime (soft-deleted addon)', () => {
            // Arrange
            const input: AdminAddonResponse = {
                ...validAdminAddonResponse,
                deletedAt: '2026-03-15T12:00:00.000Z'
            };

            // Act
            const result = AdminAddonResponseSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.deletedAt).toBe('2026-03-15T12:00:00.000Z');
            }
        });

        it('should include all public AddonResponse fields plus admin-only fields', () => {
            const result = AdminAddonResponseSchema.safeParse(validAdminAddonResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                // Public fields
                expect(result.data.slug).toBeDefined();
                expect(result.data.name).toBeDefined();
                expect(result.data.billingType).toBeDefined();
                expect(result.data.priceArs).toBeDefined();
                // Admin-only fields
                expect(result.data.id).toBeDefined();
                expect(result.data.createdAt).toBeDefined();
                expect(result.data.updatedAt).toBeDefined();
                expect('deletedAt' in result.data).toBe(true);
            }
        });
    });

    describe('when given invalid input', () => {
        it('should fail when id is not a valid UUID', () => {
            const result = AdminAddonResponseSchema.safeParse({
                ...validAdminAddonResponse,
                id: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when createdAt is not a valid ISO datetime', () => {
            const result = AdminAddonResponseSchema.safeParse({
                ...validAdminAddonResponse,
                createdAt: '2026-01-01'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when id is missing', () => {
            const { id: _id, ...inputWithoutId } = validAdminAddonResponse;
            const result = AdminAddonResponseSchema.safeParse(inputWithoutId);
            expect(result.success).toBe(false);
        });

        it('should fail when deletedAt is an invalid datetime string', () => {
            const result = AdminAddonResponseSchema.safeParse({
                ...validAdminAddonResponse,
                deletedAt: 'not-a-date'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('type inference', () => {
        it('should infer correct TypeScript type for AdminAddonResponse', () => {
            const response: AdminAddonResponse = { ...validAdminAddonResponse };
            expect(response.id).toBeDefined();
            expect(response.deletedAt).toBeNull();
        });

        it('should infer correct TypeScript type for AdminAddonListQuery', () => {
            const query: AdminAddonListQuery = { page: 2, pageSize: 10 };
            expect(query.page).toBe(2);
            expect(query.pageSize).toBe(10);
        });
    });
});
