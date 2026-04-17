/**
 * GAP-031: Validates that the public getById route for OwnerPromotion
 * returns data conforming to OwnerPromotionPublicSchema when relations
 * are populated.
 *
 * @module test/schema-validation/owner-promotion-getById-schema
 */

import { LifecycleStatusEnum, OwnerPromotionPublicSchema } from '@repo/schemas';
import { OwnerPromotionService } from '@repo/service-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';
import { validateResponseAgainstSchema } from '../helpers/relation-schema-validator';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

/** Reusable media object that satisfies the image schema (moderationState is required). */
const VALID_MEDIA = {
    featuredImage: {
        url: 'https://example.com/hotel.jpg',
        moderationState: 'APPROVED'
    }
};

/**
 * Mock owner promotion data with all relation fields populated
 * to match OwnerPromotionPublicSchema expectations.
 */
const OWNER_PROMOTION_WITH_RELATIONS = {
    id: VALID_UUID,
    slug: 'promo-schema-test',
    accommodationId: '22222222-2222-4222-8222-222222222222',
    title: 'Summer Special Discount',
    description: 'Get 20% off during the summer season.',
    discountType: 'percentage',
    discountValue: 20,
    minNights: 2,
    validFrom: '2024-01-01T00:00:00.000Z',
    validUntil: '2024-03-31T00:00:00.000Z',
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    // Relation: owner (UserPublicSchema)
    owner: {
        id: '33333333-3333-4333-8333-333333333333',
        displayName: 'Hotel Owner',
        slug: 'hotel-owner',
        role: 'HOST'
    },
    // Relation: accommodation (AccommodationPublicSchema - minimal)
    accommodation: {
        id: '22222222-2222-4222-8222-222222222222',
        slug: 'hotel-promo-target',
        name: 'Hotel Promo Target',
        type: 'HOTEL',
        summary: 'An accommodation targeted by this promotion test.',
        description:
            'Description of the hotel targeted by the promotion. This needs to be at least 30 characters.',
        isFeatured: false,
        destinationId: '44444444-4444-4444-8444-444444444444',
        visibility: 'PUBLIC',
        averageRating: 4.0,
        reviewsCount: 15,
        media: VALID_MEDIA,
        location: { city: 'Test City', country: 'Argentina' }
    }
};

describe('GAP-031: OwnerPromotion getById schema validation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/owner-promotions';

    beforeAll(() => {
        validateApiEnv();

        // Override mock getById to return relation-populated data
        vi.spyOn(OwnerPromotionService.prototype, 'getById').mockResolvedValue({
            data: OWNER_PROMOTION_WITH_RELATIONS
        });

        app = initApp();
    });

    it('response data with populated relations passes OwnerPromotionPublicSchema validation', async () => {
        const res = await app.request(`${base}/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('data');

        const validation = validateResponseAgainstSchema({
            responseData: body.data,
            schema: OwnerPromotionPublicSchema
        });

        if (!validation.success) {
            throw new Error(
                `OwnerPromotionPublicSchema validation failed:\n${validation.errors.join('\n')}`
            );
        }

        expect(validation.success).toBe(true);
    });

    it('validated data preserves all relation fields', async () => {
        const res = await app.request(`${base}/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });
        const body = await res.json();

        const validation = validateResponseAgainstSchema({
            responseData: body.data,
            schema: OwnerPromotionPublicSchema
        });

        expect(validation.success).toBe(true);

        const parsed = validation.data as Record<string, unknown>;
        expect(parsed).toHaveProperty('owner');
        expect(parsed).toHaveProperty('accommodation');
    });
});
