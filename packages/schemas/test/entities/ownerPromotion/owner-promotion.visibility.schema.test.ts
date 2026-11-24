import { describe, expect, it } from 'vitest';
import {
    PromotionListingQuerySchema,
    PromotionLockedItemSchema,
    PromotionModelInfoSchema,
    PromotionVisibilityItemSchema,
    PromotionVisibleItemSchema,
    PromotionVisibleQuerySchema
} from '../../../src/entities/ownerPromotion/owner-promotion.visibility.schema.js';

const locked = {
    kind: 'locked',
    key: 'l0',
    audience: 'vip',
    entityType: 'accommodation',
    discountType: 'percentage',
    discountValue: 30,
    placeholderName: 'Xqzvlm Bnrt'
} as const;

const visible = {
    kind: 'visible',
    audience: 'plus',
    entityType: 'venue',
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'promo-2x1',
    title: '2x1 en tragos',
    description: null,
    discountType: 'special_offer',
    discountValue: 0,
    minNights: null,
    validFrom: '2026-11-01T00:00:00.000Z',
    validUntil: null,
    window: null,
    place: { id: '22222222-2222-4222-8222-222222222222', slug: 'bar-x', name: 'Bar X' }
} as const;

describe('PromotionLockedItemSchema (HOS-2589 AC-8)', () => {
    it('accepts the value, type, audience and placeholder only', () => {
        expect(PromotionLockedItemSchema.safeParse(locked).success).toBe(true);
    });

    it.each([
        ['id', '11111111-1111-4111-8111-111111111111'],
        ['slug', 'promo'],
        ['title', 'Real title'],
        ['description', 'Real description'],
        ['minNights', 2],
        ['validFrom', '2026-11-01'],
        ['validUntil', '2026-12-01'],
        ['window', null],
        ['code', 'ABC'],
        ['currentRedemptions', 0],
        ['maxRedemptions', 3],
        ['ownerId', '33333333-3333-4333-8333-333333333333'],
        ['place', null],
        ['entityId', '22222222-2222-4222-8222-222222222222']
    ])('rejects a locked item carrying %s', (field, value) => {
        expect(PromotionLockedItemSchema.safeParse({ ...locked, [field]: value }).success).toBe(
            false
        );
    });
});

describe('PromotionVisibilityItemSchema', () => {
    it('discriminates visible and locked items by kind', () => {
        const parsedVisible = PromotionVisibilityItemSchema.parse(visible);
        const parsedLocked = PromotionVisibilityItemSchema.parse(locked);

        expect(parsedVisible.kind).toBe('visible');
        expect(parsedLocked.kind).toBe('locked');
    });

    it('a visible item keeps its full card, including the place link', () => {
        const parsed = PromotionVisibleItemSchema.parse(visible);
        expect(parsed.place?.slug).toBe('bar-x');
        expect(parsed.validFrom).toBeInstanceOf(Date);
    });

    it('a locked kind with visible fields is rejected', () => {
        expect(
            PromotionVisibilityItemSchema.safeParse({ ...visible, kind: 'locked' }).success
        ).toBe(false);
    });
});

describe('seed handling (D-7)', () => {
    it('keeps a well-formed seed', () => {
        const parsed = PromotionVisibleQuerySchema.parse({
            entityType: 'accommodation',
            entityId: '22222222-2222-4222-8222-222222222222',
            seed: 'abcDEF12-_x'
        });
        expect(parsed.seed).toBe('abcDEF12-_x');
    });

    it.each([
        'short',
        'has spaces in it',
        '<script>alert(1)</script>',
        'x'.repeat(65)
    ])('drops a malformed seed %s instead of failing', (seed) => {
        const parsed = PromotionListingQuerySchema.parse({ seed });
        expect(parsed.seed).toBeUndefined();
        expect(parsed.page).toBe(1);
    });
});

describe('PromotionModelInfoSchema', () => {
    it('carries the quota and the plan name, nothing else', () => {
        expect(
            PromotionModelInfoSchema.safeParse({ freeQuota: 2, vipPlanName: 'VIP' }).success
        ).toBe(true);
        expect(
            PromotionModelInfoSchema.safeParse({ freeQuota: 2, vipPlanName: 'VIP', price: 1 })
                .success
        ).toBe(false);
    });
});
