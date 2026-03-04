/**
 * Mock implementations for destination and attraction related services.
 *
 * Provides happy-path mock classes for DestinationService, AttractionService,
 * FeatureService, and DestinationReviewService used in unit tests.
 *
 * @module test/helpers/mocks/destination-services
 */

/** Non-existent UUID used to trigger 404 responses in tests. */
const NOT_FOUND_UUID = '87654321-4321-4321-8765-876543218765';

/**
 * Mock DestinationService - returns predictable happy-path data.
 */
export class DestinationService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'dest_mock_id',
                slug: String((body as Record<string, unknown>).slug || 'destination-mock'),
                name: String((body as Record<string, unknown>).name || 'Destination Mock'),
                summary: (body as Record<string, unknown>).summary || 'Nice destination',
                description: (body as Record<string, unknown>).description || 'Long description',
                isFeatured: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: 'user_mock',
                updatedById: 'user_mock',
                media: { featuredImage: { url: 'https://example.com/image.jpg' } },
                location: { country: 'Testland' }
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                slug: String((body as Record<string, unknown>).slug || 'destination-updated'),
                name: String((body as Record<string, unknown>).name || 'Destination Updated')
            }
        };
    }

    async list(_actor: unknown, _opts: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async searchForList(
        _actor: unknown,
        _opts: { pagination: { page: number; pageSize: number }; filters?: { q?: string } }
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
                slug: 'destination-slug',
                name: 'Test Destination',
                location: { country: 'Testland' },
                media: { featuredImage: { url: 'https://example.com/img.jpg' } }
            }
        };
    }

    async getBySlug(_actor: unknown, slug: string) {
        return { data: { id: 'dest_by_slug', slug, name: 'Destination By Slug' } };
    }

    async getStats(_actor: unknown, _params: { destinationId: string }) {
        return {
            data: {
                stats: {
                    accommodationsCount: 0,
                    reviewsCount: 0,
                    averageRating: 0
                }
            }
        };
    }

    async getSummary(_actor: unknown, params: { destinationId: string }) {
        return {
            data: {
                summary: {
                    id: params.destinationId,
                    slug: 'destination-summary',
                    name: 'Destination Summary',
                    country: 'Testland',
                    location: { country: 'Testland' },
                    isFeatured: false,
                    averageRating: 0,
                    reviewsCount: 0,
                    accommodationsCount: 0,
                    featuredImage: 'https://example.com/img.jpg'
                }
            }
        };
    }

    async softDelete(_actor: unknown, _id: string) {
        return { data: { count: 1 } };
    }

    async restore(_actor: unknown, _id: string) {
        return { data: { count: 1 } };
    }

    async hardDelete(_actor: unknown, _id: string) {
        return { data: { count: 1 } };
    }

    async getAccommodations(_actor: unknown, _params: { destinationId: string }) {
        return { data: { accommodations: [] } };
    }
}

/**
 * Mock DestinationReviewService - returns predictable happy-path data.
 */
export class DestinationReviewService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'dest_review_mock_id',
                destinationId: String(
                    (body as Record<string, unknown>).destinationId || 'dest_mock_id'
                ),
                userId: String((body as Record<string, unknown>).userId || 'user_mock'),
                rating: (body as Record<string, unknown>).rating ?? {},
                title: (body as Record<string, unknown>).title ?? 'Destination Review Title',
                content: (body as Record<string, unknown>).content ?? 'Destination review content'
            }
        };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
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
        return { data: { data: [], pagination: { total: 0 } } };
    }
}

/**
 * Mock AttractionService - returns predictable happy-path data.
 */
export class AttractionService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'attraction_mock_id',
                name: String((body as Record<string, unknown>).name || 'Attraction Mock'),
                slug: (body as Record<string, unknown>).slug || 'attraction-mock',
                type: String((body as Record<string, unknown>).type || 'MUSEUM'),
                description: String(
                    (body as Record<string, unknown>).description || 'Mock attraction description'
                ),
                displayWeight: Number((body as Record<string, unknown>).displayWeight ?? 50),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                name: String((body as Record<string, unknown>).name || 'Attraction Updated'),
                slug: (body as Record<string, unknown>).slug || 'attraction-updated'
            }
        };
    }

    async softDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, deletedAt: new Date().toISOString() } };
    }

    async restore(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id } };
    }

    async hardDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, deleted: true, count: 1 } };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return {
            data: {
                items: [
                    {
                        id: 'attraction-1',
                        name: 'Central Museum',
                        slug: 'central-museum',
                        type: 'MUSEUM',
                        description: 'A museum',
                        displayWeight: 85,
                        createdAt: '2024-01-01T00:00:00.000Z',
                        updatedAt: '2024-01-01T00:00:00.000Z'
                    },
                    {
                        id: 'attraction-2',
                        name: 'City Park',
                        slug: 'city-park',
                        type: 'PARK',
                        description: 'A park',
                        displayWeight: 45,
                        createdAt: '2024-01-01T00:00:00.000Z',
                        updatedAt: '2024-01-01T00:00:00.000Z'
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
                name: 'Test Attraction',
                slug: 'test-attraction',
                type: 'MUSEUM',
                description: 'Test attraction description',
                displayWeight: 50,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async getBySlug(_actor: unknown, slug: string) {
        return {
            data: {
                id: 'attraction_by_slug',
                name: 'Attraction By Slug',
                slug,
                type: 'MUSEUM',
                description: 'Attraction description',
                displayWeight: 50,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async getByName(_actor: unknown, name: string) {
        return {
            data: {
                id: 'attraction_by_name',
                name,
                slug: 'attraction-by-name',
                type: 'MUSEUM',
                description: 'Attraction description',
                displayWeight: 50,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async count(_actor: unknown) {
        return { data: { count: 10 } };
    }

    async search(_actor: unknown, _params: { q?: string }) {
        return {
            data: {
                items: [
                    {
                        id: 'attraction-1',
                        name: 'Central Museum',
                        slug: 'central-museum',
                        type: 'MUSEUM',
                        description: 'A museum',
                        displayWeight: 85,
                        createdAt: '2024-01-01T00:00:00.000Z',
                        updatedAt: '2024-01-01T00:00:00.000Z'
                    }
                ],
                total: 1
            }
        };
    }

    async getAttractionsForDestination(_actor: unknown, _destinationId: string) {
        return { data: [] };
    }

    async getDestinationsByAttraction(_actor: unknown, _attractionId: string) {
        return { data: [] };
    }

    async addAttractionToDestination(
        _actor: unknown,
        _attractionId: string,
        _destinationId: string
    ) {
        return { data: { success: true } };
    }

    async removeAttractionFromDestination(
        _actor: unknown,
        _attractionId: string,
        _destinationId: string
    ) {
        return { data: { success: true } };
    }
}

/**
 * Mock FeatureService - returns predictable happy-path data.
 */
export class FeatureService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'feature_mock_id',
                name: String((body as Record<string, unknown>).name || 'Feature Mock'),
                slug: (body as Record<string, unknown>).slug || 'feature-mock',
                type: String((body as Record<string, unknown>).type || 'GENERAL'),
                description: String(
                    (body as Record<string, unknown>).description || 'Mock feature description'
                ),
                displayWeight: Number((body as Record<string, unknown>).displayWeight ?? 50),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                name: String((body as Record<string, unknown>).name || 'Feature Updated'),
                slug: (body as Record<string, unknown>).slug || 'feature-updated'
            }
        };
    }

    async softDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, deletedAt: new Date().toISOString() } };
    }

    async restore(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id } };
    }

    async hardDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) return { data: null };
        return { data: { id, deleted: true, count: 1 } };
    }

    async list(_actor: unknown, _opts?: { page?: number; pageSize?: number }) {
        return {
            data: {
                items: [
                    {
                        id: 'feature-1',
                        name: 'River Front',
                        slug: 'river-front',
                        type: 'GENERAL',
                        description: 'River front property',
                        displayWeight: 90,
                        createdAt: '2024-01-01T00:00:00.000Z',
                        updatedAt: '2024-01-01T00:00:00.000Z'
                    },
                    {
                        id: 'feature-2',
                        name: 'Quiet Zone',
                        slug: 'quiet-zone',
                        type: 'GENERAL',
                        description: 'Quiet area',
                        displayWeight: 42,
                        createdAt: '2024-01-01T00:00:00.000Z',
                        updatedAt: '2024-01-01T00:00:00.000Z'
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
                name: 'Test Feature',
                slug: 'test-feature',
                type: 'GENERAL',
                description: 'Test feature description',
                displayWeight: 50,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async getBySlug(_actor: unknown, slug: string) {
        return {
            data: {
                id: 'feature_by_slug',
                name: 'Feature By Slug',
                slug,
                type: 'GENERAL',
                description: 'Feature description',
                displayWeight: 50,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async count(_actor: unknown) {
        return { data: { count: 5 } };
    }

    async search(_actor: unknown, _params: { q?: string }) {
        return { data: { items: [], total: 0 } };
    }
}
