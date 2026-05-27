import { describe, expect, it } from 'vitest';
import { OwnerPromotionAdminSchema } from '../../../src/entities/ownerPromotion/index.js';
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
