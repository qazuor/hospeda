/** Fixtures of the HOS-2589 promotion islands' tests. */
import type { PromotionLockedItem, PromotionVisibleItem } from '@repo/schemas';

export function visibleItem(overrides: Partial<PromotionVisibleItem> = {}): PromotionVisibleItem {
    return {
        kind: 'visible',
        audience: 'plus',
        entityType: 'accommodation',
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'finde-largo',
        title: 'Finde largo',
        description: null,
        discountType: 'percentage',
        discountValue: 20,
        minNights: 2,
        validFrom: new Date('2026-11-01T00:00:00Z'),
        validUntil: null,
        window: null,
        place: {
            id: '22222222-2222-4222-8222-222222222222',
            slug: 'casa-rio',
            name: 'Casa Río'
        },
        ...overrides
    };
}

export function lockedItem(overrides: Partial<PromotionLockedItem> = {}): PromotionLockedItem {
    return {
        kind: 'locked',
        key: 'k1',
        audience: 'vip',
        entityType: 'venue',
        discountType: 'percentage',
        discountValue: 30,
        placeholderName: 'Lorem ipsu',
        ...overrides
    };
}

/** A JSON envelope response. */
export function envelope(data: unknown): Response {
    return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
