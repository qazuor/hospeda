/**
 * Mock implementations for user-related services.
 *
 * Provides happy-path mock classes for UserService and UserBookmarkService
 * used in unit tests.
 *
 * @module test/helpers/mocks/user-services
 */

/**
 * Mock UserService - always returns an admin user with all permissions.
 */
export class UserService {
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
