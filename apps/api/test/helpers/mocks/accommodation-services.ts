/**
 * Mock implementations for accommodation-related services.
 *
 * Provides happy-path mock classes for AccommodationService, AmenityService,
 * and AccommodationReviewService used in unit tests.
 *
 * @module test/helpers/mocks/accommodation-services
 */

import { ServiceErrorCode } from '@repo/schemas';

/**
 * Minimal ServiceError used within mock implementations.
 */
class ServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'ServiceError';
    }
}

/** Non-existent UUID used to trigger 404 responses in tests. */
const NOT_FOUND_UUID = '87654321-4321-4321-8765-876543218765';

/** UUID that simulates an accommodation with zero reviews. */
const ZERO_REVIEWS_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * Mock AccommodationService - returns predictable happy-path data.
 */
export class AccommodationService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'acc_mock_id',
                slug: String((body as Record<string, unknown>).slug || 'hotel-azul'),
                name: String((body as Record<string, unknown>).name || 'Hotel Azul'),
                summary: (body as Record<string, unknown>).summary || 'Nice place',
                description: (body as Record<string, unknown>).description || 'Long description',
                isFeatured: false,
                isActive: true,
                isPublished: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: 'user_mock',
                updatedById: 'user_mock',
                ownerId: 'owner_mock',
                destinationId: 'dest_mock'
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                slug: String((body as Record<string, unknown>).slug || 'hotel-updated'),
                name: String((body as Record<string, unknown>).name || 'Hotel Updated')
            }
        };
    }

    async list(_actor: unknown, _opts: { page: number; pageSize: number }) {
        return { data: { items: [], total: 0 } };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async searchForList(
        _actor: unknown,
        _opts: {
            pagination: { page: number; pageSize: number };
            filters?: { destinationId?: string };
        }
    ) {
        return { items: [], total: 0 };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }

        return {
            data: {
                id,
                slug: 'mock-slug',
                name: 'Test Accommodation',
                summary: 'This is a lovely test accommodation perfect for your stay.',
                type: 'HOTEL',
                reviewsCount: 42,
                averageRating: 4.5,
                isFeatured: true,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null,
                ownerId: '12345678-1234-4567-8901-123456789013',
                destinationId: '12345678-1234-4567-8901-123456789014',
                media: { featuredImage: { url: 'https://example.com/image.jpg' } },
                location: { city: 'Test City', country: 'Test Country' }
            }
        };
    }

    async getBySlug(_actor: unknown, slug: string) {
        return { data: { id: 'acc_by_slug', slug, name: 'By Slug' } };
    }

    async softDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }

        return {
            data: {
                id,
                slug: 'mock-slug',
                name: 'Test Accommodation',
                summary: 'This is a lovely test accommodation perfect for your stay.',
                type: 'HOTEL',
                reviewsCount: 42,
                averageRating: 4.5,
                isFeatured: true,
                visibility: 'PUBLIC',
                lifecycleState: 'DELETED',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: new Date().toISOString(),
                ownerId: '12345678-1234-4567-8901-123456789013',
                destinationId: '12345678-1234-4567-8901-123456789014',
                media: { featuredImage: { url: 'https://example.com/image.jpg' } },
                location: { city: 'Test City', country: 'Test Country' }
            }
        };
    }

    async restore(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }

        return {
            data: {
                id,
                slug: 'mock-slug',
                name: 'Test Accommodation',
                summary: 'This is a lovely test accommodation perfect for your stay.',
                type: 'HOTEL',
                reviewsCount: 42,
                averageRating: 4.5,
                isFeatured: true,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                ownerId: '12345678-1234-4567-8901-123456789013',
                destinationId: '12345678-1234-4567-8901-123456789014',
                media: { featuredImage: { url: 'https://example.com/image.jpg' } },
                location: { city: 'Test City', country: 'Test Country' }
            }
        };
    }

    async hardDelete(_actor: unknown, _id: string) {
        if (_id === NOT_FOUND_UUID) {
            return { data: null };
        }

        return {
            data: {
                id: _id,
                deleted: true,
                deletedAt: new Date().toISOString(),
                count: 1,
                message: 'Accommodation permanently deleted'
            }
        };
    }

    async getFaqs(_actor: unknown, _params: { accommodationId: string }) {
        if (_params.accommodationId === NOT_FOUND_UUID) {
            return { data: null };
        }

        return {
            data: {
                faqs: [
                    {
                        id: '12345678-1234-4567-8901-123456789013',
                        question: 'Existing question?',
                        answer: 'Existing answer',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00.000Z',
                        updatedAt: '2024-01-01T00:00:00.000Z'
                    }
                ]
            }
        };
    }

    async addFaq(
        _actor: unknown,
        _params: { accommodationId: string; faq: Record<string, unknown> }
    ) {
        const faqData = _params.faq as { question: string; answer: string };

        return {
            data: {
                faq: {
                    id: '12345678-1234-4567-8901-123456789017',
                    question: faqData.question || 'Default question',
                    answer: faqData.answer || 'Default answer',
                    order: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }
        };
    }

    async updateFaq(
        _actor: unknown,
        _params: { accommodationId: string; faqId: string; faq: Record<string, unknown> }
    ) {
        if (_params.accommodationId === NOT_FOUND_UUID) {
            return {
                error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found')
            };
        }

        if (_params.faqId === '87654321-4321-4321-8765-876543218766') {
            return {
                error: new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'FAQ not found for this accommodation'
                )
            };
        }

        return {
            data: {
                faq: {
                    id: _params.faqId,
                    question: _params.faq.question || 'Updated question?',
                    answer: _params.faq.answer || 'Updated answer',
                    order: _params.faq.order || 0,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: new Date().toISOString()
                }
            }
        };
    }

    async removeFaq(_actor: unknown, _params: { accommodationId: string; faqId: string }) {
        return { data: { count: 1 } };
    }

    async getSummary(_actor: unknown, _params: { id: string }) {
        if (_params.id === ZERO_REVIEWS_UUID) {
            return {
                data: {
                    id: ZERO_REVIEWS_UUID,
                    slug: 'zero-reviews-accommodation',
                    name: 'Zero Reviews Accommodation',
                    summary: 'This accommodation has no reviews yet.',
                    type: 'HOTEL',
                    price: { price: 75.0, currency: 'USD' },
                    location: { city: 'Test City', country: 'Test Country' },
                    media: { featuredImage: { url: 'https://example.com/zero-image.jpg' } },
                    averageRating: 0,
                    reviewsCount: 0,
                    isFeatured: false,
                    ownerId: '12345678-1234-4567-8901-123456789013'
                }
            };
        }

        return {
            data: {
                id: _params.id,
                slug: 'test-accommodation',
                name: 'Test Accommodation',
                summary: 'This is a lovely test accommodation perfect for your stay.',
                type: 'HOTEL',
                price: { price: 150.5, currency: 'USD' },
                location: { city: 'Test City', country: 'Test Country' },
                media: { featuredImage: { url: 'https://example.com/image.jpg' } },
                averageRating: 4.5,
                reviewsCount: 42,
                isFeatured: true,
                ownerId: '12345678-1234-4567-8901-123456789013'
            }
        };
    }

    async getStats(_actor: unknown, _params: { idOrSlug?: string }) {
        if (_params.idOrSlug === NOT_FOUND_UUID) {
            return { data: null };
        }

        if (_params.idOrSlug === ZERO_REVIEWS_UUID) {
            return {
                data: {
                    stats: {
                        total: 1,
                        totalFeatured: 0,
                        averagePrice: 0,
                        averageRating: 0,
                        totalByType: { HOTEL: 1 }
                    }
                }
            };
        }

        return {
            data: {
                stats: {
                    total: 1,
                    totalFeatured: 1,
                    averagePrice: 150.5,
                    averageRating: 4.5,
                    totalByType: { HOTEL: 1 }
                }
            }
        };
    }

    async getByDestination(_actor: unknown, params: { destinationId: string }) {
        return { data: { destinationId: params.destinationId, accommodations: [] } };
    }

    async getTopRatedByDestination(_actor: unknown, params: { destinationId: string }) {
        return { data: { destinationId: params.destinationId, accommodations: [] } };
    }
}

/**
 * Mock AmenityService - returns predictable happy-path data.
 */
export class AmenityService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'amenity_mock_id',
                name: String((body as Record<string, unknown>).name || 'Amenity Mock'),
                type: String((body as Record<string, unknown>).type || 'GENERAL_APPLIANCES'),
                slug: (body as Record<string, unknown>).slug || 'amenity-mock',
                isFeatured: Boolean((body as Record<string, unknown>).isFeatured ?? false),
                displayWeight: Number((body as Record<string, unknown>).displayWeight ?? 50)
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                name: String((body as Record<string, unknown>).name || 'Amenity Updated')
            }
        };
    }

    async softDelete(_actor: unknown, id: string) {
        return { data: { id, deletedAt: new Date().toISOString() } };
    }

    async restore(_actor: unknown, id: string) {
        return { data: { id } };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return {
            data: {
                items: [
                    {
                        id: 'amenity-1',
                        name: 'WiFi',
                        type: 'CONNECTIVITY',
                        slug: 'wifi',
                        isFeatured: true,
                        displayWeight: 95
                    },
                    {
                        id: 'amenity-2',
                        name: 'Pool',
                        type: 'RECREATIONAL',
                        slug: 'pool',
                        isFeatured: false,
                        displayWeight: 60
                    }
                ],
                total: 2
            }
        };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id,
                name: 'Amenity',
                type: 'GENERAL_APPLIANCES',
                slug: 'amenity',
                isFeatured: false,
                displayWeight: 50
            }
        };
    }

    async search(
        _actor: unknown,
        _params: {
            filters?: { name?: string; type?: string };
            pagination?: { page?: number; pageSize?: number };
        }
    ) {
        return {
            data: {
                items: [
                    {
                        id: 'amenity-1',
                        name: 'WiFi',
                        type: 'CONNECTIVITY',
                        slug: 'wifi',
                        isFeatured: true,
                        displayWeight: 95
                    }
                ],
                total: 1
            }
        };
    }

    async getAccommodationsByAmenity(_actor: unknown, _params: { amenityId: string }) {
        return { data: { accommodations: [] } };
    }

    async getAmenitiesForAccommodation(_actor: unknown, _params: { accommodationId: string }) {
        return { data: { amenities: [] } };
    }

    async addAmenityToAccommodation(
        _actor: unknown,
        _params: {
            accommodationId: string;
            amenityId: string;
            isOptional?: boolean;
            additionalCost?: unknown;
            additionalCostPercent?: number;
        }
    ) {
        return { data: { relation: { amenityId: _params.amenityId } } };
    }

    async removeAmenityFromAccommodation(
        _actor: unknown,
        _params: { accommodationId: string; amenityId: string }
    ) {
        return { data: { relation: { amenityId: _params.amenityId } } };
    }
}

/**
 * Mock AccommodationReviewService - returns predictable happy-path data.
 */
export class AccommodationReviewService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'acc_review_mock_id',
                accommodationId: String(
                    (body as Record<string, unknown>).destinationId ||
                        (body as Record<string, unknown>).accommodationId ||
                        'acc_mock_id'
                ),
                userId: String((body as Record<string, unknown>).userId || 'user_mock'),
                rating: (body as Record<string, unknown>).rating ?? {
                    cleanliness: 5,
                    hospitality: 5,
                    services: 5,
                    accuracy: 5,
                    communication: 5,
                    location: 5
                },
                title: (body as Record<string, unknown>).title ?? 'Review Title',
                content: (body as Record<string, unknown>).content ?? 'Review content'
            }
        };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async listByAccommodation(
        _actor: unknown,
        input: { accommodationId: string; page?: number; pageSize?: number }
    ) {
        const page = input.page ?? 1;
        const pageSize = input.pageSize ?? 10;
        return { data: { items: [], total: 0, page, pageSize } };
    }

    async listByUser(
        _actor: unknown,
        _input: {
            userId: string;
            page?: number;
            pageSize?: number;
            sortBy?: string;
            sortOrder?: string;
        }
    ) {
        return { data: { accommodationReviews: [], total: 0 } };
    }
}
