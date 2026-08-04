/**
 * Mock implementations for user-related services.
 *
 * Provides happy-path mock classes for UserService, UserBookmarkService and
 * UserBookmarkCollectionService used in unit tests.
 *
 * @module test/helpers/mocks/user-services
 */

/**
 * Slug of a seeded author who has NOT opted into showing social networks.
 * Exported so tests assert against the same value the mock branches on.
 */
export const AUTHOR_SLUG_OPTED_OUT = 'carmen-silva';

/** Slug of a seeded author who HAS opted into showing social networks. */
export const AUTHOR_SLUG_OPTED_IN = 'laura-vega';

/**
 * Public author profiles keyed by slug, shaped exactly like the real
 * `UserService.getPublicProfileBySlug` return value.
 *
 * The `socialNetworks` key is present on ONE of them and absent from the other,
 * which mirrors the real service: the block is opt-in and the opt-in belongs to
 * the PROFILE OWNER. Keying it by slug rather than by actor is the whole point —
 * a mock that varied it by requester could not detect a route that started
 * doing the same (HOS-375 AC-6).
 */
const PUBLIC_AUTHOR_PROFILES: Record<string, Record<string, unknown>> = {
    [AUTHOR_SLUG_OPTED_OUT]: {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Carmen Silva',
        slug: AUTHOR_SLUG_OPTED_OUT,
        avatar: 'https://example.com/avatars/carmen-silva.jpg',
        bio: 'Escribe sobre el litoral.',
        isSystemAccount: false
    },
    [AUTHOR_SLUG_OPTED_IN]: {
        id: '22222222-2222-4222-8222-222222222222',
        displayName: 'Laura Vega',
        slug: AUTHOR_SLUG_OPTED_IN,
        avatar: 'https://example.com/avatars/laura-vega.jpg',
        bio: 'Cubre eventos del Litoral.',
        isSystemAccount: false,
        socialNetworks: {
            instagram: 'https://instagram.com/lauravega',
            linkedIn: 'https://linkedin.com/in/lauravega'
        }
    }
};

/**
 * Mock UserService - always returns an admin user with all permissions.
 */
export class UserService {
    /**
     * HOS-375 — backs `GET /api/v1/public/users/by-slug/{slug}`.
     *
     * Returns `null` for any unknown slug, which the route turns into a 404.
     * That is what the pre-existing tests in
     * `apps/api/test/routes/user/public/getBySlug.test.ts` assume, and until
     * this method existed the route answered 500 for EVERY slug — so every
     * success-path assertion there sat behind an `if (res.status === 200)` that
     * never ran.
     *
     * `_actor` is ignored, exactly as the real service ignores it beyond
     * logging. Do not add an actor branch here: the route is edge-cached on a
     * session-blind key, and a mock that varied by requester would make the
     * actor-blindness test in `by-slug-actor-blind.test.ts` unfalsifiable.
     */
    async getPublicProfileBySlug(_actor: unknown, params: { slug: string }) {
        return { data: PUBLIC_AUTHOR_PROFILES[params.slug] ?? null };
    }

    async findOptions(_actor: unknown, _params: { q?: string; limit?: number }) {
        return { data: { items: [] } };
    }

    async getById(_actor: unknown, userId: string) {
        return {
            data: {
                id: userId,
                roles: ['ADMIN'],
                permissions: ['*']
            }
        };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    /**
     * HOS-375 T-012 — backs `GET /api/v1/public/authors`. Shape copied
     * field-for-field from the real `UserService.listPublicAuthors` return
     * statement (`packages/service-core/src/services/user/user.service.ts`):
     * `{ items, pagination: { page, pageSize, total, totalPages } }`. A mock
     * shaped differently from the real service is exactly how the sibling
     * `events/author/:id` route stayed broken for months — see
     * `apps/api/test/routes/event/public/getByAuthor.test.ts`.
     */
    async listPublicAuthors(_actor: unknown, params: { page?: number; pageSize?: number } = {}) {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 50;
        return {
            data: {
                items: [],
                pagination: { page, pageSize, total: 0, totalPages: 0 }
            }
        };
    }
}

/**
 * Mock UserBookmarkService - returns predictable happy-path data.
 */
export class UserBookmarkService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'bookmark_mock_id',
                entityId: String((body as Record<string, unknown>).entityId || 'entity_mock_id'),
                entityType: String((body as Record<string, unknown>).entityType || 'ACCOMMODATION'),
                userId: String((body as Record<string, unknown>).userId || 'user_mock'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async listBookmarksByUser(
        _actor: unknown,
        _input: { userId: string; page?: number; pageSize?: number; entityType?: string }
    ) {
        return { data: { bookmarks: [], total: 0 } };
    }

    async countBookmarksForUser(_actor: unknown, _input: { userId: string; entityType?: string }) {
        return { data: { count: 0 } };
    }

    async softDelete(_actor: unknown, _id: string) {
        return { data: { count: 1 } };
    }
}

/**
 * Mock UserBookmarkCollectionService - returns predictable happy-path data.
 *
 * Required so the API app can boot under the global service-core mock when
 * SPEC-098 collection routes are registered at startup. Tests that need
 * specific behaviors should override these methods via per-test mocks.
 */
export class UserBookmarkCollectionService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        return {
            data: {
                id: 'collection_mock_id',
                userId: String((body as Record<string, unknown>).userId || 'user_mock'),
                name: String((body as Record<string, unknown>).name || 'Mock collection'),
                description: null,
                color: null,
                icon: null,
                lifecycleState: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async createCollection(_actor: unknown, input: Record<string, unknown>) {
        return this.create(_actor, input);
    }

    async listCollectionsByUser(
        _actor: unknown,
        _input: {
            userId: string;
            page?: number;
            pageSize?: number;
            includeBookmarkCount?: boolean;
        }
    ) {
        return { data: { rows: [], total: 0, page: 1, pageSize: 10 } };
    }

    async countActiveCollections(_actor: unknown) {
        return { data: { count: 0 } };
    }

    async getCollectionById(
        _actor: unknown,
        _params: {
            collectionId: string;
            includeBookmarks?: boolean;
            bookmarksPage?: number;
            bookmarksPageSize?: number;
            entityType?: string;
        }
    ) {
        return {
            data: {
                collection: null,
                bookmarks: { rows: [], total: 0, page: 1, pageSize: 10 }
            }
        };
    }

    async updateCollection(
        _actor: unknown,
        _params: { collectionId: string; input: Record<string, unknown> }
    ) {
        return { data: null };
    }

    async deleteCollection(_actor: unknown, collectionId: string) {
        return { data: { id: collectionId, nullifiedBookmarks: 0 } };
    }

    async addBookmarkToCollection(
        _actor: unknown,
        _params: { collectionId: string; bookmarkId: string }
    ) {
        return { data: null };
    }

    async removeBookmarkFromCollection(_actor: unknown, _params: { bookmarkId: string }) {
        return { data: null };
    }
}
