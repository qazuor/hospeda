import { describe, expect, it } from 'vitest';
import {
    OwnerPromotionAdminSchema,
    OwnerPromotionProtectedSchema,
    OwnerPromotionPublicSchema
} from '../../../src/entities/ownerPromotion/index.js';
import { createMinimalOwnerPromotion } from '../../fixtures/ownerPromotion.fixtures.js';

/**
 * Regression coverage for SPEC-143 smoke finding F-ADMIN-OWNERPROMO.
 *
 * A promotion can target ALL of the owner's accommodations (`accommodationId`
 * is nullable), in which case the admin relation loader returns
 * `accommodation: null`. The admin list response is validated against
 * {@link OwnerPromotionAdminSchema}; when the relation fields were declared
 * `.optional()` (undefined-only) the null relation failed validation and the
 * admin endpoint returned 500 "Response payload does not match declared
 * schema". The fields are now `.nullable().optional()`.
 */
describe('OwnerPromotionAdminSchema — nullable relations (F-ADMIN-OWNERPROMO)', () => {
    it('accepts a null accommodation relation (promotion not tied to a specific accommodation)', () => {
        const data = { ...createMinimalOwnerPromotion(), accommodation: null };
        const result = OwnerPromotionAdminSchema.safeParse(data);
        expect(result.success).toBe(true);
    });

    it('accepts a null owner relation', () => {
        const data = { ...createMinimalOwnerPromotion(), owner: null };
        const result = OwnerPromotionAdminSchema.safeParse(data);
        expect(result.success).toBe(true);
    });

    it('accepts omitted relations (undefined)', () => {
        const result = OwnerPromotionAdminSchema.safeParse(createMinimalOwnerPromotion());
        expect(result.success).toBe(true);
    });
});

/**
 * Regression tests for bug #6 — nullable accommodation relation in public and
 * protected access schemas.
 *
 * Before this fix both schemas declared `accommodation` as `.optional()` only
 * (allowing undefined but NOT null). A promotion targeting ALL of an owner's
 * accommodations has `accommodationId = null`, so the relation loader returns
 * `accommodation: null`; the schema rejected it, causing a 500 on list
 * endpoints. The fix changes both schemas to `.nullable().optional()`.
 */
describe('OwnerPromotionPublicSchema — nullable accommodation relation (bug #6 regression)', () => {
    // Minimal public-tier shape: only the fields the Public schema picks
    const minimalPublicPayload = () => ({
        id: createMinimalOwnerPromotion().id,
        slug: createMinimalOwnerPromotion().slug,
        accommodationId: null,
        title: 'Summer Special Discount',
        discountType: 'percentage' as const,
        discountValue: 20,
        validFrom: new Date('2024-06-01')
    });

    it('accepts accommodation: null (owner-wide promotion, no specific accommodation)', () => {
        // Arrange
        const data = { ...minimalPublicPayload(), accommodation: null };

        // Act
        const result = OwnerPromotionPublicSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts accommodation omitted (undefined)', () => {
        // Arrange — no accommodation key at all
        const data = minimalPublicPayload();

        // Act
        const result = OwnerPromotionPublicSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });
});

describe('OwnerPromotionProtectedSchema — nullable accommodation relation (bug #6 regression)', () => {
    // Minimal protected-tier shape: public fields + ownerId + lifecycle + audit
    const minimalProtectedPayload = () => {
        const base = createMinimalOwnerPromotion();
        return {
            id: base.id,
            slug: base.slug,
            accommodationId: null,
            title: base.title,
            discountType: 'percentage' as const,
            discountValue: 20,
            validFrom: new Date('2024-06-01'),
            ownerId: base.ownerId,
            currentRedemptions: 0,
            lifecycleState: 'ACTIVE' as const,
            createdAt: base.createdAt,
            updatedAt: base.updatedAt,
            createdById: base.createdById,
            updatedById: base.updatedById
        };
    };

    it('accepts accommodation: null (owner-wide promotion, no specific accommodation)', () => {
        // Arrange
        const data = { ...minimalProtectedPayload(), accommodation: null };

        // Act
        const result = OwnerPromotionProtectedSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts accommodation omitted (undefined)', () => {
        // Arrange
        const data = minimalProtectedPayload();

        // Act
        const result = OwnerPromotionProtectedSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
    });
});
