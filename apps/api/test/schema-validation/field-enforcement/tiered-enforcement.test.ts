/**
 * SPEC-062 T-018 — tiered field enforcement across Public / Protected / Admin.
 *
 * Tier invariants exercised through `stripWithSchema` (the same helper the
 * route factories use via `createResponse` / `createPaginatedResponse`):
 *
 *   - Public tier  → admin-only fields are stripped.
 *   - Protected   → protected fields are retained; admin-only fields stripped.
 *   - Admin tier   → ALL fields are retained, including admin-only ones.
 *
 * These assertions stand even for nullable admin fields (`deletedById: null`),
 * which must still appear in admin responses because the client relies on
 * their presence to distinguish "not deleted" from "not queried".
 */

import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { stripWithSchema } from '../../../src/utils/response-helpers';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

const FULL_ACCOMMODATION = {
    id: VALID_UUID,
    slug: 'hotel-tiered-strip',
    name: 'Tiered Strip Hotel',
    type: 'HOTEL',
    summary: 'Accommodation used for tiered field enforcement tests.',
    description:
        'Long enough description to pass the minimum character requirements set on the schema validation layer.',
    isFeatured: true,
    destinationId: '22222222-2222-4222-8222-222222222222',
    ownerId: '33333333-3333-4333-8333-333333333333',
    media: {
        featuredImage: {
            url: 'https://example.com/image.jpg',
            moderationState: 'APPROVED'
        }
    },
    location: { city: 'Concepcion del Uruguay', country: 'Argentina' },
    averageRating: 4.5,
    reviewsCount: 42,
    visibility: 'PUBLIC',
    seo: {
        title: 'Hotel Test Accommodation SEO Title',
        description:
            'This is a long SEO description for the hotel test accommodation. It must be at least 70 characters long.'
    },
    price: { price: 150, currency: 'ARS' },
    tags: [],
    extraInfo: {
        capacity: 4,
        minNights: 1,
        bedrooms: 2,
        bathrooms: 1
    },
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    // Admin-only fields
    createdById: '99999999-9999-4999-8999-999999999999',
    updatedById: '99999999-9999-4999-8999-999999999999',
    deletedById: null,
    deletedAt: null,
    adminInfo: { notes: 'internal notes', favorite: false }
};

describe('SPEC-062 T-018 — tiered enforcement via stripWithSchema', () => {
    describe('Public tier', () => {
        it('strips every admin-only field', () => {
            const result = stripWithSchema(FULL_ACCOMMODATION, AccommodationPublicSchema) as Record<
                string,
                unknown
            >;

            expect(result).not.toHaveProperty('createdById');
            expect(result).not.toHaveProperty('updatedById');
            expect(result).not.toHaveProperty('deletedById');
            expect(result).not.toHaveProperty('deletedAt');
            expect(result).not.toHaveProperty('adminInfo');
            expect(result).not.toHaveProperty('lifecycleState');
        });

        it('keeps public fields', () => {
            const result = stripWithSchema(FULL_ACCOMMODATION, AccommodationPublicSchema) as Record<
                string,
                unknown
            >;
            expect(result.id).toBe(VALID_UUID);
            expect(result.slug).toBe('hotel-tiered-strip');
            expect(result.name).toBe('Tiered Strip Hotel');
            expect(result.visibility).toBe('PUBLIC');
        });
    });

    describe('Protected tier', () => {
        it('strips admin-only fields', () => {
            const result = stripWithSchema(
                FULL_ACCOMMODATION,
                AccommodationProtectedSchema
            ) as Record<string, unknown>;

            expect(result).not.toHaveProperty('adminInfo');
            expect(result).not.toHaveProperty('deletedById');
            expect(result).not.toHaveProperty('deletedAt');
        });

        it('retains protected fields not present in the public tier', () => {
            const result = stripWithSchema(
                FULL_ACCOMMODATION,
                AccommodationProtectedSchema
            ) as Record<string, unknown>;
            expect(result).toHaveProperty('id', VALID_UUID);
            expect(result).toHaveProperty('ownerId');
        });
    });

    describe('Admin tier', () => {
        it('retains all admin-only fields including nullable ones', () => {
            const result = stripWithSchema(FULL_ACCOMMODATION, AccommodationAdminSchema) as Record<
                string,
                unknown
            >;

            expect(result).toHaveProperty('createdById');
            expect(result).toHaveProperty('updatedById');
            expect(result).toHaveProperty('adminInfo');
            expect(result).toHaveProperty('lifecycleState', 'ACTIVE');
            // Nullable admin fields must STILL be present (value === null is OK,
            // absence is NOT).
            expect(Object.hasOwn(result, 'deletedById')).toBe(true);
            expect(Object.hasOwn(result, 'deletedAt')).toBe(true);
            expect(result.deletedById).toBeNull();
            expect(result.deletedAt).toBeNull();
        });

        it('retains public and protected fields as well', () => {
            const result = stripWithSchema(FULL_ACCOMMODATION, AccommodationAdminSchema) as Record<
                string,
                unknown
            >;
            expect(result).toHaveProperty('id', VALID_UUID);
            expect(result).toHaveProperty('slug', 'hotel-tiered-strip');
            expect(result).toHaveProperty('ownerId');
        });
    });
});
