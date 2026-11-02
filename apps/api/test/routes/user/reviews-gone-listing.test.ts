import { PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockAccommodationRows, mockAccommodationReviews, mockDestinationReviews } = vi.hoisted(
    () => ({
        mockAccommodationRows: vi.fn(),
        mockAccommodationReviews: vi.fn(),
        mockDestinationReviews: vi.fn()
    })
);

vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findByIds: mockAccommodationRows };
        }),
        DestinationModel: vi.fn().mockImplementation(function () {
            return {
                findByIds: vi
                    .fn()
                    .mockResolvedValue([{ id: DESTINATION_ID, name: 'Río', slug: 'rio' }])
            };
        })
    };
});

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationReviewService: vi.fn().mockImplementation(function () {
            return { listByUser: mockAccommodationReviews };
        }),
        DestinationReviewService: vi.fn().mockImplementation(function () {
            return { listByUser: mockDestinationReviews };
        })
    };
});

const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';
const ACCOMMODATION_ID = '22222222-2222-4222-8222-222222222222';
const DESTINATION_ID = '33333333-3333-4333-8333-333333333333';
const REVIEW_ID = '44444444-4444-4444-8444-444444444444';
const actor = { id: AUTHOR_ID, roles: [RoleEnum.HOST], permissions: [] };

const review = (id = REVIEW_ID, accommodationId = ACCOMMODATION_ID) => ({
    id,
    accommodationId,
    userId: AUTHOR_ID,
    rating: {
        cleanliness: 5,
        hospitality: 5,
        services: 5,
        accuracy: 5,
        communication: 5,
        location: 5
    },
    title: 'Review title',
    content: 'Review body',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: AUTHOR_ID,
    updatedById: AUTHOR_ID,
    moderationState: 'APPROVED'
});

const listing = (
    publicationStatus: PublicationStatusEnum,
    overrides: Record<string, unknown> = {}
) => ({
    id: ACCOMMODATION_ID,
    name: 'Casa del Río',
    slug: 'casa-del-rio',
    deletedAt: null,
    publicationStatus,
    ...overrides
});

async function requestReviews() {
    const { userReviewsRoute } = await import('../../../src/routes/user/protected/reviews.js');
    const app = new Hono<AppBindings>();
    app.use((context, next) => {
        context.set('actor', actor);
        return next();
    });
    app.route('/', userReviewsRoute);
    const response = await app.request('/me/reviews?type=all');
    const json = await response.json();
    if (response.status !== 200) throw new Error(JSON.stringify(json));
    return json as {
        data: {
            accommodationReviews: Array<Record<string, unknown>>;
            destinationReviews: Array<Record<string, unknown>>;
            totals: Record<string, number>;
        };
    };
}

function accommodationFields(item: Record<string, unknown>) {
    return {
        id: item.id,
        accommodationName: item.accommodationName,
        accommodationSlug: item.accommodationSlug,
        accommodationGone: item.accommodationGone
    };
}

beforeEach(() => {
    mockAccommodationRows.mockResolvedValue([]);
    mockAccommodationReviews.mockResolvedValue({
        data: { accommodationReviews: [], total: 0 },
        error: undefined
    });
    mockDestinationReviews.mockResolvedValue({
        data: { data: [], pagination: { total: 0 } },
        error: undefined
    });
});

describe('TEST:1706:1 AC:1706:1 AC:1706:3 the author review list marks a review whose listing is gone', () => {
    it('marks a PURGED listing and preserves its name and review', async () => {
        mockAccommodationRows.mockResolvedValue([listing(PublicationStatusEnum.PURGED)]);
        mockAccommodationReviews.mockResolvedValue({
            data: { accommodationReviews: [review()], total: 1 },
            error: undefined
        });

        const body = await requestReviews();

        expect(accommodationFields(body.data.accommodationReviews[0]!)).toEqual({
            id: REVIEW_ID,
            accommodationName: 'Casa del Río',
            accommodationSlug: null,
            accommodationGone: true
        });
    });

    it('marks a soft-deleted published listing as gone', async () => {
        mockAccommodationRows.mockResolvedValue([
            listing(PublicationStatusEnum.PUBLISHED, { deletedAt: new Date() })
        ]);
        mockAccommodationReviews.mockResolvedValue({
            data: { accommodationReviews: [review()], total: 1 },
            error: undefined
        });

        const body = await requestReviews();
        expect(accommodationFields(body.data.accommodationReviews[0]!)).toEqual({
            id: REVIEW_ID,
            accommodationName: 'Casa del Río',
            accommodationSlug: null,
            accommodationGone: true
        });
    });

    it('keeps a live published listing link', async () => {
        mockAccommodationRows.mockResolvedValue([listing(PublicationStatusEnum.PUBLISHED)]);
        mockAccommodationReviews.mockResolvedValue({
            data: { accommodationReviews: [review()], total: 1 },
            error: undefined
        });

        const body = await requestReviews();
        expect(accommodationFields(body.data.accommodationReviews[0]!)).toEqual({
            id: REVIEW_ID,
            accommodationName: 'Casa del Río',
            accommodationSlug: 'casa-del-rio',
            accommodationGone: false
        });
    });

    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    ])('does not call %s gone', async (status) => {
        mockAccommodationRows.mockResolvedValue([listing(status)]);
        mockAccommodationReviews.mockResolvedValue({
            data: { accommodationReviews: [review()], total: 1 },
            error: undefined
        });

        const body = await requestReviews();
        expect(accommodationFields(body.data.accommodationReviews[0]!)).toEqual({
            id: REVIEW_ID,
            accommodationName: 'Casa del Río',
            accommodationSlug: 'casa-del-rio',
            accommodationGone: false
        });
    });

    it('marks a missing listing as gone with no name or slug', async () => {
        mockAccommodationReviews.mockResolvedValue({
            data: { accommodationReviews: [review()], total: 1 },
            error: undefined
        });

        const body = await requestReviews();
        expect(accommodationFields(body.data.accommodationReviews[0]!)).toEqual({
            id: REVIEW_ID,
            accommodationName: null,
            accommodationSlug: null,
            accommodationGone: true
        });
    });

    it('preserves all reviews in input order and leaves totals unchanged', async () => {
        const liveListingId = ACCOMMODATION_ID;
        const purgedListingId = '55555555-5555-4555-8555-555555555555';
        const deletedListingId = '66666666-6666-4666-8666-666666666666';
        const reviews = [
            review('77777777-7777-4777-8777-777777777777', liveListingId),
            review('88888888-8888-4888-8888-888888888888', purgedListingId),
            review('99999999-9999-4999-8999-999999999999', deletedListingId)
        ];
        mockAccommodationRows.mockResolvedValue([
            listing(PublicationStatusEnum.PUBLISHED, { id: liveListingId }),
            listing(PublicationStatusEnum.PURGED, { id: purgedListingId }),
            listing(PublicationStatusEnum.PUBLISHED, {
                id: deletedListingId,
                deletedAt: new Date()
            })
        ]);
        mockAccommodationReviews.mockResolvedValue({
            data: { accommodationReviews: reviews, total: 3 },
            error: undefined
        });

        const body = await requestReviews();
        expect(body.data.accommodationReviews.map((item) => item.id)).toEqual(
            reviews.map((item) => item.id)
        );
        expect(body.data.totals).toEqual({
            accommodationReviews: 3,
            destinationReviews: 0,
            total: 3
        });
    });

    it('does not add accommodationGone to destination reviews', async () => {
        const destinationReview = {
            id: REVIEW_ID,
            destinationId: DESTINATION_ID,
            userId: AUTHOR_ID,
            rating: {
                landscape: 5,
                attractions: 5,
                accessibility: 5,
                safety: 5,
                cleanliness: 5,
                hospitality: 5,
                culturalOffer: 5,
                gastronomy: 5,
                affordability: 5,
                nightlife: 5,
                infrastructure: 5,
                environmentalCare: 5,
                wifiAvailability: 5,
                shopping: 5,
                beaches: 5,
                greenSpaces: 5,
                localEvents: 5,
                weatherSatisfaction: 5
            },
            averageRating: 5,
            title: 'Destination title',
            content: 'Destination review content',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            createdById: AUTHOR_ID,
            updatedById: AUTHOR_ID,
            isVerified: false,
            isPublished: true,
            isRecommended: true,
            helpfulVotes: 0,
            totalVotes: 0,
            hasOwnerResponse: false
        };
        mockDestinationReviews.mockResolvedValue({
            data: { data: [destinationReview], pagination: { total: 1 } },
            error: undefined
        });

        const body = await requestReviews();
        expect(body.data.destinationReviews[0]).toEqual({
            id: REVIEW_ID,
            destinationId: DESTINATION_ID,
            userId: AUTHOR_ID,
            rating: destinationReview.rating,
            title: 'Destination title',
            content: 'Destination review content',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            isVerified: false,
            isPublished: true,
            isRecommended: true,
            helpfulVotes: 0,
            totalVotes: 0,
            hasOwnerResponse: false,
            destinationName: 'Río',
            destinationSlug: 'rio'
        });
    });
});
