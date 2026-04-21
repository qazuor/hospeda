/**
 * SPEC-062 T-017 — Public tier runtime field enforcement.
 *
 * Verifies that public endpoints enforce tier-appropriate field exposure at
 * runtime. A service that leaks admin-only fields (`createdById`,
 * `updatedById`, `deletedById`, `deletedAt`, `adminInfo`, `lifecycleState`)
 * must still produce a public response envelope with those fields stripped by
 * `stripWithSchema` inside `createResponse`.
 *
 * Test location note: this file sits under `test/schema-validation/` rather
 * than `test/integration/` because it mocks the service layer and does not
 * require a running Postgres instance.
 */

import { AccommodationService } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

const VALID_MEDIA = {
    featuredImage: {
        url: 'https://example.com/image.jpg',
        moderationState: 'APPROVED'
    }
};

const VALID_SEO = {
    title: 'Hotel Test Accommodation SEO Title',
    description:
        'This is a long SEO description for the hotel test accommodation. It must be at least 70 characters long.'
};

/**
 * Accommodation payload as a service might return it — includes admin-only
 * fields that MUST be stripped from the public response.
 */
const ACCOMMODATION_WITH_ADMIN_FIELDS = {
    id: VALID_UUID,
    slug: 'hotel-strip-test',
    name: 'Hotel Strip Test',
    type: 'HOTEL',
    summary: 'Accommodation used for public-tier field enforcement tests.',
    description:
        'Long enough description to pass the minimum character requirements set on the schema validation layer.',
    isFeatured: true,
    destinationId: '22222222-2222-4222-8222-222222222222',
    media: VALID_MEDIA,
    location: { city: 'Concepcion del Uruguay', country: 'Argentina' },
    averageRating: 4.5,
    reviewsCount: 42,
    visibility: 'PUBLIC',
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
    // Admin-only fields that MUST NOT leak to the public tier.
    createdById: '99999999-9999-4999-8999-999999999999',
    updatedById: '99999999-9999-4999-8999-999999999999',
    deletedById: null,
    deletedAt: null,
    adminInfo: { notes: 'internal notes', favorite: false },
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
    updatedAt: '2024-01-15T00:00:00.000Z'
};

describe('SPEC-062 T-017 — public tier runtime field enforcement', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/v1/public/accommodations/:id', () => {
        beforeEach(() => {
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: ACCOMMODATION_WITH_ADMIN_FIELDS
            } as unknown as Awaited<ReturnType<AccommodationService['getById']>>);
        });

        it('strips admin-only fields from the response body', async () => {
            const res = await app.request(`/api/v1/public/accommodations/${VALID_UUID}`, {
                headers: { 'user-agent': 'vitest' }
            });
            expect(res.status).toBe(200);

            const body = (await res.json()) as { data: Record<string, unknown> };
            const data = body.data;

            expect(data).not.toHaveProperty('createdById');
            expect(data).not.toHaveProperty('updatedById');
            expect(data).not.toHaveProperty('deletedById');
            expect(data).not.toHaveProperty('deletedAt');
            expect(data).not.toHaveProperty('adminInfo');
            expect(data).not.toHaveProperty('lifecycleState');
        });

        it('preserves public fields in the response body', async () => {
            const res = await app.request(`/api/v1/public/accommodations/${VALID_UUID}`, {
                headers: { 'user-agent': 'vitest' }
            });
            const body = (await res.json()) as { data: Record<string, unknown> };
            const data = body.data;

            expect(data).toHaveProperty('id', VALID_UUID);
            expect(data).toHaveProperty('slug', 'hotel-strip-test');
            expect(data).toHaveProperty('name');
            expect(data).toHaveProperty('summary');
            expect(data).toHaveProperty('visibility', 'PUBLIC');
        });
    });
});
