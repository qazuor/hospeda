import { describe, expect, it } from 'vitest';
import { OwnerPromotionListItemSchema } from '../../../src/entities/ownerPromotion/owner-promotion.query.schema.js';
import { TouristAudienceEnum } from '../../../src/enums/tourist-audience.enum.js';
import { createMinimalOwnerPromotion } from '../../fixtures/ownerPromotion.fixtures.js';

describe('OwnerPromotionListItemSchema — touristAudience (HOS-21 D1)', () => {
    it('exposes touristAudience on the public list item shape', () => {
        // Arrange
        const data = {
            ...createMinimalOwnerPromotion(),
            touristAudience: TouristAudienceEnum.VIP
        };

        // Act
        const result = OwnerPromotionListItemSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.touristAudience).toBe(TouristAudienceEnum.VIP);
        }
    });

    it("defaults touristAudience to 'plus' when omitted", () => {
        // Arrange
        const { touristAudience: _omitted, ...data } = createMinimalOwnerPromotion() as ReturnType<
            typeof createMinimalOwnerPromotion
        > & {
            touristAudience?: string;
        };

        // Act
        const result = OwnerPromotionListItemSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.touristAudience).toBe(TouristAudienceEnum.PLUS);
        }
    });
});
