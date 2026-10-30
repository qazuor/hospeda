import { AdminPromoCodeAvailabilitySchema, AdminPromoCodeRejectionSchema } from '@repo/schemas';
import { PROMO_CODE_ADMIN_REJECTIONS, PROMO_CODE_AVAILABILITIES } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import { PROMO_CODE_REJECTION_ANSWERS } from '../../../src/routes/billing-promo/admin/rejections';

describe('AC:B9b:9 HOS-1591 admin promo code rejection contract (support)', () => {
    it('maps exactly the service rejection reasons and never labels a 4xx INTERNAL_ERROR', () => {
        expect(Object.keys(PROMO_CODE_REJECTION_ANSWERS).sort()).toEqual(
            [...PROMO_CODE_ADMIN_REJECTIONS].sort()
        );
        for (const answer of Object.values(PROMO_CODE_REJECTION_ANSWERS)) {
            expect(answer.status).toBeGreaterThanOrEqual(400);
            expect(answer.status).toBeLessThan(500);
            expect(answer.code).not.toBe('INTERNAL_ERROR');
        }
    });

    it('keeps the public availability and rejection enums aligned with service-core', () => {
        expect(AdminPromoCodeAvailabilitySchema.options).toEqual(PROMO_CODE_AVAILABILITIES);
        expect(AdminPromoCodeRejectionSchema.options).toEqual(PROMO_CODE_ADMIN_REJECTIONS);
    });
});
