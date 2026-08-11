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
 * A `users` row exactly as the Drizzle `author` relation returns it — every
 * column, private ones included. Exported so route tests can assert against the
 * same source values they expect the response to project down from.
 *
 * @see apps/api/test/routes/event/public/author-relation.test.ts
 */
export const RAW_AUTHOR_ROW = {
    id: '34011499-69a6-4f82-8d97-58b161a28f91',
    displayName: 'Laura Vega',
    firstName: 'Laura',
    lastName: 'Vega',
    slug: 'laura-vega',
    image: 'https://example.com/avatars/laura-vega.jpg',
    email: 'laura.vega@example.com',
    password: 'hashed-secret',
    phone: '+5493442123456',
    settings: { publicProfileShowSocialNetworks: false },
    contactInfo: { personalEmail: 'laura@personal.example.com' },
    isSystemAccount: false,
    deletedAt: null
} as const;

/**
 * Mock EventService - returns predictable happy-path data.
 */
export class EventService {
    async findOptions(_actor: unknown, _params: { q?: string; limit?: number }) {
        return { data: { items: [] } };
    }

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
        return {
            data: {
                id: 'e5e5e5e5-e5e5-4e5e-ae5e-e5e5e5e5e5e5',
                slug,
                name: 'Event By Slug',
                category: 'SPORTS',
                summary: 'A mock event summary long enough to satisfy the public read schema.',
                description:
                    'A mock event description that is comfortably long enough to satisfy the minimum length the public read schema enforces on this field.',
                isFeatured: false,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                media: {
                    featuredImage: {
                        url: 'https://example.com/event.jpg',
                        moderationState: 'APPROVED'
                    }
                },
                date: { start: '2024-02-01T00:00:00.000Z', precision: 'EXACT' },
                pricing: { price: 2000, currency: 'ARS', isFree: false },
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null,
                // HOS-375 §6.9: the REAL service eager-loads the `author`
                // relation (`getDefaultListRelations`, inherited by
                // `getDefaultGetByIdRelations`), and Drizzle hands back the
                // WHOLE `users` row — private columns included. The mock
                // returns that row verbatim on purpose: projecting it down to
                // the public tier is the RESPONSE SCHEMA's job, so a mock that
                // pre-trimmed it would make the route look correct no matter
                // what `EventPublicSchema` declares.
                author: RAW_AUTHOR_ROW
            }
        };
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

    /**
     * Mirrors the REAL `EventService.getByAuthor`, which returns the model's
     * `{ items, total }` — NOT `{ items, pagination }`.
     *
     * This mock used to return a `pagination` envelope the service never
     * produces, which made the route look correct in tests while answering 500
     * in production for every author: `createPublicListRoute` demands the
     * envelope, and the route was handing the service output straight through.
     * A mock that is kinder than the real service cannot catch that class of
     * bug — building the envelope is the ROUTE's job, so the mock must stop
     * doing it for free.
     */
    async getByAuthor(
        _actor: unknown,
        _input: { authorId: string; page?: number; pageSize?: number }
    ) {
        return { data: { items: [], total: 0 } };
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
    async findOptions(_actor: unknown, _params: { q?: string; limit?: number }) {
        return { data: { items: [] } };
    }

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
    async findOptions(_actor: unknown, _params: { q?: string; limit?: number }) {
        return { data: { items: [] } };
    }

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
