/**
 * GAP-031: Validates that the public getById route for Accommodation
 * returns data conforming to AccommodationPublicSchema when relations
 * are populated.
 *
 * Post SPEC-095: the heavy `destination` relation projection has been
 * replaced by a lightweight `cityDestination` ref projection on the
 * response, and `location` carries postal address only.
 *
 * @module test/schema-validation/accommodation-getById-schema
 */

import { AccommodationPublicSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';
import { validateResponseAgainstSchema } from '../helpers/relation-schema-validator';

/** Valid UUID for the test entity. */
const VALID_UUID = '11111111-1111-4111-8111-111111111111';

/** Reusable media object that satisfies the image schema (moderationState is required). */
const VALID_MEDIA = {
    featuredImage: {
        url: 'https://example.com/image.jpg',
        moderationState: 'APPROVED'
    }
};

/** Reusable SEO object (title min 30, description min 70). */
const VALID_SEO = {
    title: 'Hotel Test Accommodation SEO Title',
    description:
        'This is a long SEO description for the hotel test accommodation. It must be at least 70 characters long.'
};

/**
 * Mock accommodation data with all relation fields populated
 * to match AccommodationPublicSchema expectations.
 */
const ACCOMMODATION_WITH_RELATIONS = {
    id: VALID_UUID,
    slug: 'hotel-test-schema',
    name: 'Hotel Test Schema',
    type: 'HOTEL',
    summary: 'A test accommodation for schema validation testing.',
    description:
        'This is a long enough description for schema validation. It needs to pass the minimum character requirements set in the Zod schema.',
    isFeatured: true,
    ownerId: '33333333-3333-4333-8333-333333333333',
    destinationId: '22222222-2222-4222-8222-222222222222',
    media: VALID_MEDIA,
    location: { street: 'Av. Costanera', number: '123' },
    averageRating: 4.5,
    reviewsCount: 42,
    visibility: 'PUBLIC',
    moderationState: 'APPROVED',
    lifecycleState: 'ACTIVE',
    seo: VALID_SEO,
    price: { price: 150, currency: 'ARS' },
    tags: [],
    extraInfo: {
        capacity: 4,
        minNights: 1,
        bedrooms: 2,
        bathrooms: 1
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdById: '33333333-3333-4333-8333-333333333333',
    updatedById: '33333333-3333-4333-8333-333333333333',
    // Relation: owner (public tier uses inline object, not UserPublicSchema)
    owner: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Juan Propietario',
        image: null,
        createdAt: '2024-01-01T00:00:00.000Z'
    },
    // Relation: amenities (junction table shape)
    amenities: [
        {
            amenityId: '44444444-4444-4444-8444-444444444444',
            // SPEC-266: catalog `name` was dropped; `slug` is the canonical
            // identifier and the i18n key (`accommodations.amenityNames.<slug>`).
            slug: 'wifi',
            icon: 'wifi',
            isOptional: false,
            additionalCost: null
        }
    ],
    // Relation: features (junction table shape)
    features: [
        {
            featureId: '55555555-5555-4555-8555-555555555555',
            // SPEC-266: catalog `name` was dropped; `slug` is the canonical
            // identifier and the i18n key (`accommodations.featureNames.<slug>`).
            slug: 'parking',
            icon: 'parking',
            hostReWriteName: null,
            comments: null
        }
    ],
    // Relation: faqs
    faqs: [
        {
            id: '66666666-6666-4666-8666-666666666666',
            question: 'What time is check-in?',
            answer: 'Check-in is at 3pm',
            category: null
        }
    ],
    // Relation: cityDestination (CityDestinationRefSchema — SPEC-095 lightweight projection)
    cityDestination: {
        id: '22222222-2222-4222-8222-222222222222',
        slug: 'concepcion-del-uruguay',
        name: 'Concepcion del Uruguay',
        summary: 'A beautiful city in Entre Rios province of Argentina.',
        destinationType: 'CITY',
        level: 4,
        path: '/argentina/litoral/entre-rios/concepcion-del-uruguay',
        pathIds:
            '99999999-9999-4999-8999-999999999991,99999999-9999-4999-8999-999999999992,99999999-9999-4999-8999-999999999993,22222222-2222-4222-8222-222222222222'
    }
};

describe('GAP-031: Accommodation getById schema validation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';

    beforeAll(() => {
        validateApiEnv();

        // Override the mock getById to return relation-populated data
        vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
            data: ACCOMMODATION_WITH_RELATIONS
        } as never);

        app = initApp();
    });

    it('response data with populated relations passes AccommodationPublicSchema validation', async () => {
        const res = await app.request(`${base}/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('data');

        const validation = validateResponseAgainstSchema({
            responseData: body.data,
            schema: AccommodationPublicSchema
        });

        if (!validation.success) {
            throw new Error(
                `AccommodationPublicSchema validation failed:\n${validation.errors.join('\n')}`
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
            schema: AccommodationPublicSchema
        });

        expect(validation.success).toBe(true);

        const parsed = validation.data as Record<string, unknown>;
        expect(parsed).toHaveProperty('owner');
        expect(parsed).toHaveProperty('amenities');
        expect(parsed).toHaveProperty('features');
        expect(parsed).toHaveProperty('faqs');
        expect(parsed).toHaveProperty('cityDestination');
        expect((parsed.cityDestination as { destinationType?: string })?.destinationType).toBe(
            'CITY'
        );
    });
});
