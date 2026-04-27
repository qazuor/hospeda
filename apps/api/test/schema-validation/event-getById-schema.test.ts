/**
 * GAP-031: Validates that the public getById route for Event
 * returns data conforming to EventPublicSchema when relations
 * are populated.
 *
 * Post SPEC-095: the embedded `location` relation projects via
 * EventLocationPublicSchema, which carries only `id`, `slug`,
 * `destinationId`, `placeName`, `coordinates`, plus an optional
 * `cityDestination` projection. Geographic context (city/state/
 * country/neighborhood) is no longer on the eventLocation row.
 *
 * @module test/schema-validation/event-getById-schema
 */

import { EventPublicSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';
import { validateResponseAgainstSchema } from '../helpers/relation-schema-validator';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

/** Reusable media object that satisfies the image schema (moderationState is required). */
const VALID_MEDIA = {
    featuredImage: {
        url: 'https://example.com/event.jpg',
        moderationState: 'APPROVED'
    }
};

/**
 * Mock event data with all relation fields populated
 * to match EventPublicSchema expectations.
 */
const EVENT_WITH_RELATIONS = {
    id: VALID_UUID,
    slug: 'event-schema-test',
    name: 'Test Event for Schema Validation',
    category: 'MUSIC',
    summary: 'A test event summary that is long enough for validation.',
    description:
        'This is a sufficiently long event description. It needs to exceed the 50 character minimum requirement set in the Zod schema for event descriptions.',
    isFeatured: true,
    media: VALID_MEDIA,
    date: { start: '2024-06-01T00:00:00.000Z', end: '2024-06-02T00:00:00.000Z' },
    pricing: { isFree: false, price: 50, currency: 'ARS' },
    locationId: '22222222-2222-4222-8222-222222222222',
    organizerId: '33333333-3333-4333-8333-333333333333',
    authorId: '33333333-3333-4333-8333-333333333333',
    visibility: 'PUBLIC',
    moderationState: 'APPROVED',
    lifecycleState: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdById: '33333333-3333-4333-8333-333333333333',
    updatedById: '33333333-3333-4333-8333-333333333333',
    seo: {
        title: 'Test Event SEO Title Long Enough Here',
        description:
            'This is a long enough SEO description for the test event. It must be at least 70 characters long to pass validation.'
    },
    tags: [],
    // Relation: organizer (EventOrganizerPublicSchema)
    organizer: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Test Organizer',
        slug: 'test-organizer',
        description: 'An event organizer for testing',
        logo: 'https://example.com/organizer-logo.png',
        contactInfo: { mobilePhone: '+5493442000000' },
        socialNetworks: {}
    },
    // Relation: location (EventLocationPublicSchema, post SPEC-095)
    location: {
        id: '22222222-2222-4222-8222-222222222222',
        slug: 'test-venue',
        destinationId: '44444444-4444-4444-8444-444444444444',
        placeName: 'Teatro Municipal',
        coordinates: { lat: '-32.4847', long: '-58.2322' },
        cityDestination: {
            id: '44444444-4444-4444-8444-444444444444',
            slug: 'concepcion-del-uruguay',
            name: 'Concepcion del Uruguay',
            summary: 'A beautiful city in Entre Rios province of Argentina.',
            destinationType: 'CITY',
            level: 4,
            path: '/argentina/litoral/entre-rios/concepcion-del-uruguay',
            pathIds:
                '99999999-9999-4999-8999-999999999991,99999999-9999-4999-8999-999999999992,99999999-9999-4999-8999-999999999993,44444444-4444-4444-8444-444444444444'
        }
    }
};

describe('GAP-031: Event getById schema validation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        validateApiEnv();

        vi.spyOn(EventService.prototype, 'getById').mockResolvedValue({
            data: EVENT_WITH_RELATIONS
        } as never);

        app = initApp();
    });

    it('response data with populated relations passes EventPublicSchema validation', async () => {
        const res = await app.request(`${base}/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('data');

        const validation = validateResponseAgainstSchema({
            responseData: body.data,
            schema: EventPublicSchema
        });

        if (!validation.success) {
            throw new Error(
                `EventPublicSchema validation failed:\n${validation.errors.join('\n')}`
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
            schema: EventPublicSchema
        });

        expect(validation.success).toBe(true);

        const parsed = validation.data as Record<string, unknown>;
        expect(parsed).toHaveProperty('organizer');
        expect(parsed).toHaveProperty('location');

        const location = parsed.location as Record<string, unknown> | undefined;
        expect(location).toBeDefined();
        expect(location).toHaveProperty('cityDestination');
        expect(location).toHaveProperty('destinationId');
        // SPEC-095: stripped legacy fields must not appear on the projection.
        expect(location).not.toHaveProperty('city');
        expect(location).not.toHaveProperty('state');
        expect(location).not.toHaveProperty('country');
        expect(location).not.toHaveProperty('neighborhood');
    });
});
