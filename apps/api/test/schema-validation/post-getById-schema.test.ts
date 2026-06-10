/**
 * GAP-031: Validates that the public getById route for Post
 * returns data conforming to PostPublicSchema when relations
 * are populated.
 *
 * @module test/schema-validation/post-getById-schema
 */

import { PostPublicSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';
import { validateResponseAgainstSchema } from '../helpers/relation-schema-validator';

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
    title: 'Test Post SEO Title Long Enough Here',
    description:
        'This is a long enough SEO description for the test post. It must be at least 70 characters long to pass validation.'
};

/**
 * Mock post data with all relation fields populated
 * to match PostPublicSchema expectations.
 */
const POST_WITH_RELATIONS = {
    id: VALID_UUID,
    slug: 'post-schema-test',
    title: 'Test Post for Schema Validation',
    summary: 'A summary that is long enough for validation testing purposes.',
    content:
        'This is a very long content string that needs to be at least 100 characters to pass the Zod schema validation. Adding more text to make sure we exceed the minimum content length requirement.',
    category: 'TOURISM',
    authorId: '22222222-2222-4222-8222-222222222222',
    media: VALID_MEDIA,
    isFeatured: true,
    isFeaturedInWebsite: false,
    isNews: false,
    likes: 10,
    comments: 3,
    shares: 1,
    publishedAt: '2024-01-15T00:00:00.000Z',
    readingTimeMinutes: 5,
    relatedDestinationId: '33333333-3333-4333-8333-333333333333',
    relatedAccommodationId: '44444444-4444-4444-8444-444444444444',
    relatedEventId: '55555555-5555-4555-8555-555555555555',
    visibility: 'PUBLIC',
    moderationState: 'APPROVED',
    lifecycleState: 'ACTIVE',
    seo: VALID_SEO,
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdById: '22222222-2222-4222-8222-222222222222',
    updatedById: '22222222-2222-4222-8222-222222222222',
    // Relation: author (UserPublicSchema)
    author: {
        id: '22222222-2222-4222-8222-222222222222',
        displayName: 'Author Name',
        slug: 'author-name',
        role: 'EDITOR'
    },
    // Relation: relatedAccommodation (AccommodationPublicSchema - minimal)
    relatedAccommodation: {
        id: '44444444-4444-4444-8444-444444444444',
        slug: 'related-hotel',
        name: 'Related Hotel',
        type: 'HOTEL',
        summary: 'A related accommodation for testing purposes.',
        description:
            'Description of the related accommodation. This needs to be at least 30 characters long.',
        isFeatured: false,
        destinationId: '33333333-3333-4333-8333-333333333333',
        visibility: 'PUBLIC',
        averageRating: 3.5,
        reviewsCount: 5,
        media: VALID_MEDIA,
        location: { city: 'Test City', country: 'Argentina' }
    },
    // Relation: relatedDestination (DestinationPublicSchema - minimal)
    relatedDestination: {
        id: '33333333-3333-4333-8333-333333333333',
        slug: 'test-destination',
        name: 'Test Destination',
        summary: 'A destination for testing purposes in the schema tests.',
        description:
            'Detailed description of the test destination. This needs to be long enough for the schema.',
        isFeatured: false,
        destinationType: 'CITY',
        level: 4,
        path: '/argentina/test',
        visibility: 'PUBLIC',
        averageRating: 4.0,
        reviewsCount: 8,
        accommodationsCount: 20,
        media: VALID_MEDIA,
        location: { city: 'Test', country: 'Argentina' }
    },
    // Relation: relatedEvent (EventPublicSchema - minimal)
    relatedEvent: {
        id: '55555555-5555-4555-8555-555555555555',
        slug: 'test-event',
        name: 'Test Event',
        category: 'MUSIC',
        summary: 'A test event for schema validation purposes.',
        isFeatured: false,
        date: { start: '2024-06-01T00:00:00.000Z' },
        visibility: 'PUBLIC',
        media: VALID_MEDIA,
        locationId: '66666666-6666-4666-8666-666666666666',
        organizerId: '77777777-7777-4777-8777-777777777777'
    },
    // Relation: sponsorship (inline public tier schema)
    sponsorship: {
        id: '88888888-8888-4888-8888-888888888888',
        postId: VALID_UUID,
        sponsorId: '99999999-9999-4999-8999-999999999999',
        description: 'Sponsored by Test Corp',
        isHighlighted: true,
        // PostSponsorPublicSchema is { id, name, type (ClientType), description, logo },
        // not a user-shaped object — the sponsor is a Client entity.
        sponsor: {
            id: '99999999-9999-4999-8999-999999999999',
            name: 'Test Corp',
            type: 'POST_SPONSOR',
            description: 'Sponsored by Test Corp'
        }
    }
};

describe('GAP-031: Post getById schema validation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        validateApiEnv();

        vi.spyOn(PostService.prototype, 'getById').mockResolvedValue({
            data: POST_WITH_RELATIONS
        } as never);

        app = initApp();
    });

    it('response data with populated relations passes PostPublicSchema validation', async () => {
        const res = await app.request(`${base}/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('data');

        const validation = validateResponseAgainstSchema({
            responseData: body.data,
            schema: PostPublicSchema
        });

        if (!validation.success) {
            throw new Error(`PostPublicSchema validation failed:\n${validation.errors.join('\n')}`);
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
            schema: PostPublicSchema
        });

        expect(validation.success).toBe(true);

        const parsed = validation.data as Record<string, unknown>;
        expect(parsed).toHaveProperty('author');
        expect(parsed).toHaveProperty('relatedAccommodation');
        expect(parsed).toHaveProperty('relatedDestination');
        expect(parsed).toHaveProperty('relatedEvent');
        expect(parsed).toHaveProperty('sponsorship');
    });
});
