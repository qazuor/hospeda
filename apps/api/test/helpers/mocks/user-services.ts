/**
 * Mock implementations for user-related services.
 *
 * Provides happy-path mock classes for UserService, UserBookmarkService and
 * UserBookmarkCollectionService used in unit tests.
 *
 * @module test/helpers/mocks/user-services
 */

/**
 * Mock UserService - always returns an admin user with all permissions.
 */
export class UserService {
    async findOptions(_actor: unknown, _params: { q?: string; limit?: number }) {
        return { data: { items: [] } };
    }

    async getById(_actor: unknown, userId: string) {
        return {
            data: {
                id: userId,
                role: 'ADMIN',
                permissions: ['*']
            }
        };
    }

    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
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
