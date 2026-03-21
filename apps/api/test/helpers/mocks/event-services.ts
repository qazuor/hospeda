/**
 * Mock implementations for event-related services.
 *
 * Provides happy-path mock classes for EventService, EventLocationService,
 * and EventOrganizerService used in unit tests.
 *
 * @module test/helpers/mocks/event-services
 */

/** Non-existent UUID used to trigger 404 responses in tests. */
const NOT_FOUND_UUID = '87654321-4321-4321-8765-876543218765';

/**
 * Mock EventService - returns predictable happy-path data.
 */
export class EventService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'event_mock_id',
                slug: String((body as Record<string, unknown>).slug || 'event-mock'),
                name: String((body as Record<string, unknown>).name || 'Event Mock'),
                category: (body as Record<string, unknown>).category || 'CONCERT',
                isFeatured: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: 'user_mock',
                updatedById: 'user_mock',
                media: { featuredImage: { url: 'https://example.com/event.jpg' } },
                date: { start: new Date().toISOString() }
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                slug: String((body as Record<string, unknown>).slug || 'event-updated'),
                name: String((body as Record<string, unknown>).name || 'Event Updated')
            }
        };
    }

    async list(_actor: unknown, _opts: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return {
            data: {
                id,
                slug: 'event-slug',
                name: 'Test Event',
                category: 'CONCERT',
                isFeatured: false,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null,
                media: { featuredImage: { url: 'https://example.com/event.jpg' } },
                date: { start: '2024-02-01T00:00:00.000Z' },
                location: { city: 'Test City', country: 'Testland' }
            }
        };
    }

    async getBySlug(_actor: unknown, slug: string) {
        return { data: { id: 'event_by_slug', slug, name: 'Event By Slug' } };
    }

    async getSummary(_actor: unknown, params: { id: string }) {
        return {
            data: {
                summary: {
                    id: params.id,
                    slug: 'event-summary',
                    name: 'Event Summary',
                    category: 'CONCERT',
                    date: { start: '2024-02-01T00:00:00.000Z' },
                    media: { featuredImage: { url: 'https://example.com/event.jpg' } },
                    isFeatured: false
                }
            }
        };
    }

    async getByAuthor(
        _actor: unknown,
        input: { authorId: string; page?: number; pageSize?: number }
    ) {
        const page = input.page ?? 1;
        const pageSize = input.pageSize ?? 10;
        return {
            data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
        };
    }

    async getByLocation(
        _actor: unknown,
        input: { locationId: string; page?: number; pageSize?: number }
    ) {
        const page = input.page ?? 1;
        const pageSize = input.pageSize ?? 10;
        return {
            data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
        };
    }

    async getByOrganizer(
        _actor: unknown,
        input: { organizerId: string; page?: number; pageSize?: number }
    ) {
        const page = input.page ?? 1;
        const pageSize = input.pageSize ?? 10;
        return {
            data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
        };
    }

    async getByCategory(
        _actor: unknown,
        input: { category: string; page?: number; pageSize?: number }
    ) {
        const page = input.page ?? 1;
        const pageSize = input.pageSize ?? 10;
        return {
            data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
        };
    }

    async getFreeEvents(_actor: unknown, input: { page?: number; pageSize?: number }) {
        const page = input.page ?? 1;
        const pageSize = input.pageSize ?? 10;
        return {
            data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
        };
    }

    async getUpcoming(
        _actor: unknown,
        input: { fromDate: Date; toDate?: Date; page?: number; pageSize?: number }
    ) {
        const page = input.page ?? 1;
        const pageSize = input.pageSize ?? 10;
        return {
            data: { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
        };
    }

    async softDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id, deletedAt: new Date().toISOString() } };
    }

    async restore(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id } };
    }

    async hardDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id, deleted: true, count: 1 } };
    }
}

/**
 * Mock EventLocationService - returns predictable happy-path data.
 */
export class EventLocationService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'event_location_mock_id',
                slug: String((body as Record<string, unknown>).slug || 'location-mock'),
                name: String((body as Record<string, unknown>).name || 'Location Mock'),
                city: String((body as Record<string, unknown>).city || 'Test City'),
                address: String((body as Record<string, unknown>).address || '123 Test St'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: 'user_mock',
                updatedById: 'user_mock'
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                slug: String((body as Record<string, unknown>).slug || 'location-updated'),
                name: String((body as Record<string, unknown>).name || 'Location Updated')
            }
        };
    }

    async list(_actor: unknown, _opts: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return {
            data: {
                id,
                slug: 'location-slug',
                name: 'Test Location',
                city: 'Test City',
                address: '123 Test St',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null
            }
        };
    }

    async getBySlug(_actor: unknown, slug: string) {
        return { data: { id: 'location_by_slug', slug, name: 'Location By Slug' } };
    }

    async softDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id, deletedAt: new Date().toISOString() } };
    }

    async restore(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id } };
    }

    async hardDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id, deleted: true, count: 1 } };
    }
}

/**
 * Mock EventOrganizerService - returns predictable happy-path data.
 */
export class EventOrganizerService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'event_organizer_mock_id',
                slug: String((body as Record<string, unknown>).slug || 'organizer-mock'),
                name: String((body as Record<string, unknown>).name || 'Organizer Mock'),
                description: (body as Record<string, unknown>).description || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: 'user_mock',
                updatedById: 'user_mock'
            }
        };
    }

    async update(_actor: unknown, id: string, body: Record<string, unknown>) {
        return {
            data: {
                id,
                slug: String((body as Record<string, unknown>).slug || 'organizer-updated'),
                name: String((body as Record<string, unknown>).name || 'Organizer Updated')
            }
        };
    }

    async list(_actor: unknown, _opts: { page?: number; pageSize?: number }) {
        return { data: { items: [], total: 0 } };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async getById(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return {
            data: {
                id,
                slug: 'organizer-slug',
                name: 'Test Organizer',
                description: 'Test description',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null
            }
        };
    }

    async getBySlug(_actor: unknown, slug: string) {
        return { data: { id: 'organizer_by_slug', slug, name: 'Organizer By Slug' } };
    }

    async softDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id, deletedAt: new Date().toISOString() } };
    }

    async restore(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id } };
    }

    async hardDelete(_actor: unknown, id: string) {
        if (id === NOT_FOUND_UUID) {
            return { data: null };
        }
        return { data: { id, deleted: true, count: 1 } };
    }
}
