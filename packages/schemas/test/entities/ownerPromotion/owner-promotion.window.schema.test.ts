import { describe, expect, it } from 'vitest';
import { OwnerPromotionCreateRequestSchema } from '../../../src/entities/ownerPromotion/owner-promotion.schema.js';
import {
    fromPromotionWindow,
    PromotionWindowSchema,
    toPromotionWindow,
    VenuePromotionCreateRequestSchema
} from '../../../src/entities/ownerPromotion/owner-promotion.venue.schema.js';

describe('promotion windows', () => {
    it('accepts an overnight weekly range and maps database columns both ways', () => {
        const window = { weekdays: [4, 5, 6], startTime: '23:00', endTime: '00:30' };
        expect(PromotionWindowSchema.parse(window)).toEqual(window);
        expect(fromPromotionWindow(window)).toEqual({
            windowWeekdays: [4, 5, 6],
            windowStart: '23:00',
            windowEnd: '00:30'
        });
        expect(
            toPromotionWindow({
                windowWeekdays: [4, 5, 6],
                windowStart: '23:00:00',
                windowEnd: '00:30:00'
            })
        ).toEqual(window);
    });

    it.each([
        { weekdays: [], startTime: '18:00', endTime: '20:00' },
        { weekdays: [1, 1], startTime: '18:00', endTime: '20:00' },
        { weekdays: [7], startTime: '18:00', endTime: '20:00' },
        { weekdays: [1], startTime: '18:00', endTime: '18:00' }
    ])('rejects invalid or ambiguous windows: %o', (window) => {
        expect(
            VenuePromotionCreateRequestSchema.safeParse({
                title: 'Happy hour',
                discountType: 'percentage',
                discountValue: 10,
                validFrom: '2026-11-18',
                window
            }).success
        ).toBe(false);
    });

    it('rejects a window on an accommodation promotion request', () => {
        expect(
            OwnerPromotionCreateRequestSchema.safeParse({
                title: 'Happy hour',
                discountType: 'percentage',
                discountValue: 10,
                validFrom: '2026-11-18',
                window: { weekdays: [4], startTime: '18:00', endTime: '20:00' }
            }).success
        ).toBe(false);
    });
});
