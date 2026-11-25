/**
 * HOS-2589 §7.4 / D-5: a locked item never carries what the reader may not see
 * (AC-8, AC-29). The serialized items are searched for every hidden value.
 */
import {
    type OwnerPromotion,
    OwnerPromotionDiscountTypeEnum,
    OwnerPromotionEntityTypeEnum,
    PromotionLockedItemSchema,
    PromotionVisibilityItemSchema,
    TouristAudienceEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildPromotionVisibilityItems,
    type PromotionPlaces
} from '../../../src/services/owner-promotion/ownerPromotion.visibility-items';

/** Stands for the catalog value of `max_free_visible_promotions` (fixture). */
const FREE_QUOTA = 3;

let counter = 0;
function row(overrides: Partial<OwnerPromotion>): OwnerPromotion {
    counter += 1;
    const n = String(counter).padStart(12, '0');
    return {
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${n}`,
        slug: `secret-slug-${counter}`,
        ownerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        accommodationId: null,
        entityType: OwnerPromotionEntityTypeEnum.VENUE,
        entityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        title: `Secret title ${counter}`,
        description: `Secret description ${counter}`,
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 10 + counter,
        minNights: 7,
        validFrom: new Date('2026-11-01T00:00:00Z'),
        validUntil: new Date('2027-01-15T00:00:00Z'),
        windowWeekdays: [1, 2],
        windowStart: '19:00:00',
        windowEnd: '21:00:00',
        maxRedemptions: 99,
        currentRedemptions: 42,
        lifecycleState: 'ACTIVE',
        touristAudience: TouristAudienceEnum.PLUS,
        firstActivatedAt: null,
        vipPausedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        ...overrides
    } as OwnerPromotion;
}

const REAL_NAME = 'Parrilla Don Secreto';
const places: PromotionPlaces = {
    accommodations: new Map(),
    venues: new Map([
        [
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            {
                id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                slug: 'parrilla-secreta',
                name: REAL_NAME
            }
        ]
    ])
};

const PAGE = [
    ...Array.from({ length: 5 }, () => row({ touristAudience: TouristAudienceEnum.PLUS })),
    ...Array.from({ length: 2 }, () => row({ touristAudience: TouristAudienceEnum.VIP }))
];

describe('buildPromotionVisibilityItems', () => {
    it('AC-5: a free reader gets the quota visible and the rest locked', () => {
        const items = buildPromotionVisibilityItems({
            promotions: PAGE,
            places,
            isVip: false,
            freeQuota: FREE_QUOTA,
            seed: 'seed-1234'
        });
        expect(items.filter((i) => i.kind === 'visible')).toHaveLength(FREE_QUOTA);
        const locked = items.filter((i) => i.kind === 'locked');
        expect(locked).toHaveLength(4);
        expect(locked.filter((i) => i.audience === 'vip')).toHaveLength(2);
        for (const item of items)
            expect(PromotionVisibilityItemSchema.safeParse(item).success).toBe(true);
    });

    it('AC-8/AC-29: the serialized locked items contain none of the hidden values', () => {
        const items = buildPromotionVisibilityItems({
            promotions: PAGE,
            places,
            isVip: false,
            freeQuota: FREE_QUOTA,
            seed: 'seed-1234'
        });
        const locked = items.filter((i) => i.kind === 'locked');
        const body = JSON.stringify(locked);
        const visibleIds = new Set(items.flatMap((i) => (i.kind === 'visible' ? [i.id] : [])));
        const hidden = PAGE.filter((p) => !visibleIds.has(p.id));

        expect(body).not.toContain(REAL_NAME);
        expect(body).not.toContain('parrilla-secreta');
        expect(body).not.toContain('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
        expect(body).not.toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
        for (const promotion of hidden) {
            expect(body).not.toContain(promotion.id);
            expect(body).not.toContain(promotion.slug);
            expect(body).not.toContain(promotion.title);
            expect(body).not.toContain(promotion.description ?? '§');
        }
        expect(body).not.toContain('2027-01-15');
        expect(body).not.toContain('19:00');
        for (const item of locked) {
            expect(PromotionLockedItemSchema.safeParse(item).success).toBe(true);
            if (item.kind !== 'locked') continue;
            expect(Math.abs(item.placeholderName.length - REAL_NAME.length)).toBeLessThanOrEqual(1);
            expect(item.placeholderName).not.toBe(REAL_NAME);
        }
    });

    it('a visible item keeps the full card and its place link', () => {
        const items = buildPromotionVisibilityItems({
            promotions: PAGE,
            places,
            isVip: true,
            freeQuota: 0,
            seed: 'vip-seed'
        });
        expect(items.every((i) => i.kind === 'visible')).toBe(true);
        const first = items[0];
        expect(first?.kind === 'visible' && first.place?.name).toBe(REAL_NAME);
        expect(first?.kind === 'visible' && first.window).toEqual({
            weekdays: [1, 2],
            startTime: '19:00',
            endTime: '21:00'
        });
    });

    it('AC-11: a zero quota locks every item', () => {
        const items = buildPromotionVisibilityItems({
            promotions: PAGE,
            places,
            isVip: false,
            freeQuota: 0,
            seed: 'seed-1234'
        });
        expect(items.every((i) => i.kind === 'locked')).toBe(true);
    });
});
