/**
 * @file use-owner-conversations.test.ts
 * @description Unit tests for owner conversations hooks (SPEC-243 T-043).
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so tests never hit the network.
 *
 * Coverage:
 * - OwnerConversationsListSchema: valid payload (with + without unread) → passes
 * - OwnerConversationsListSchema: empty items → passes
 * - OwnerConversationsListSchema: missing pagination → fails parse
 * - OwnerConversationsListSchema: item missing unreadCount → fails parse
 * - OwnerUnreadCountSchema: valid { count: N } → passes
 * - OwnerUnreadCountSchema: negative count → fails
 * - OwnerUnreadCountSchema: missing count field → fails
 * - apiFetch list path: 401 → ApiError
 * - apiFetch list path: schema drift → ApiSchemaError
 * - apiFetch list path: valid 200 → typed data returned
 * - apiFetch unread-count path: valid 200 → typed data returned
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiSchemaError } from '../errors';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports (Vitest hoisting)
// ---------------------------------------------------------------------------

vi.mock('../../auth-client', () => ({
    getCookie: vi.fn(() => '')
}));

vi.mock('expo-constants', () => ({
    default: {
        expoConfig: {
            extra: { apiUrl: 'http://test-api.local' }
        }
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { apiFetch } from '../client';
import { OwnerConversationsListSchema, OwnerUnreadCountSchema } from './use-owner-conversations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFetchResponse = (body: unknown, status = 200): Response => {
    const bodyStr = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => JSON.parse(bodyStr) as unknown,
        text: async () => bodyStr
    } as Response;
};

/** Valid UUIDs for test stubs. */
const UUID_CONV = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const UUID_ACC = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

const makeConversationItem = (overrides: Record<string, unknown> = {}) => ({
    id: UUID_CONV,
    accommodationId: UUID_ACC,
    accommodationName: 'Casa del río',
    userId: null,
    anonymousName: 'Juan Pérez',
    guestName: 'Juan Pérez',
    lastMessageExcerpt: 'Hola, quisiera reservar para este fin de semana.',
    unreadCount: 2,
    status: 'OPEN',
    lastActivityAt: '2024-06-01T12:00:00.000Z',
    createdAt: '2024-05-01T00:00:00.000Z',
    updatedAt: '2024-06-01T12:00:00.000Z',
    ...overrides
});

const validPagination = { total: 1, page: 1, pageSize: 20, totalPages: 1 };

// ---------------------------------------------------------------------------
// OwnerConversationsListSchema tests
// ---------------------------------------------------------------------------

describe('OwnerConversationsListSchema', () => {
    it('parses a valid payload with one item with unread messages', () => {
        const payload = {
            items: [makeConversationItem()],
            pagination: validPagination
        };
        const result = OwnerConversationsListSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.items).toHaveLength(1);
            expect(result.data.items[0]?.unreadCount).toBe(2);
            expect(result.data.pagination.total).toBe(1);
        }
    });

    it('parses a valid item where unreadCount is 0', () => {
        const payload = {
            items: [makeConversationItem({ unreadCount: 0 })],
            pagination: validPagination
        };
        const result = OwnerConversationsListSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.items[0]?.unreadCount).toBe(0);
        }
    });

    it('parses a valid item with null nullable fields', () => {
        const payload = {
            items: [
                makeConversationItem({
                    accommodationName: null,
                    guestName: null,
                    lastMessageExcerpt: null,
                    lastActivityAt: null
                })
            ],
            pagination: validPagination
        };
        const result = OwnerConversationsListSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });

    it('parses an empty items array', () => {
        const payload = {
            items: [],
            pagination: { ...validPagination, total: 0, totalPages: 0 }
        };
        const result = OwnerConversationsListSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.items).toHaveLength(0);
        }
    });

    it('fails when pagination is missing', () => {
        const payload = { items: [] };
        const result = OwnerConversationsListSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('pagination');
        }
    });

    it('fails when an item is missing unreadCount', () => {
        const item = makeConversationItem();
        const { unreadCount: _removed, ...itemWithoutUnread } = item;
        const payload = {
            items: [itemWithoutUnread],
            pagination: validPagination
        };
        const result = OwnerConversationsListSchema.safeParse(payload);
        expect(result.success).toBe(false);
    });

    it('fails when items is not an array', () => {
        const payload = { items: 'not-an-array', pagination: validPagination };
        const result = OwnerConversationsListSchema.safeParse(payload);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// OwnerUnreadCountSchema tests
// ---------------------------------------------------------------------------

describe('OwnerUnreadCountSchema', () => {
    it('parses a valid count of 0', () => {
        const result = OwnerUnreadCountSchema.safeParse({ count: 0 });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.count).toBe(0);
        }
    });

    it('parses a valid positive count', () => {
        const result = OwnerUnreadCountSchema.safeParse({ count: 7 });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.count).toBe(7);
        }
    });

    it('fails when count is negative', () => {
        const result = OwnerUnreadCountSchema.safeParse({ count: -1 });
        expect(result.success).toBe(false);
    });

    it('fails when count field is missing', () => {
        const result = OwnerUnreadCountSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('fails when count is a string', () => {
        const result = OwnerUnreadCountSchema.safeParse({ count: 'five' });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// apiFetch integration (network layer)
// ---------------------------------------------------------------------------

describe('apiFetch with owner conversations path — error handling', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('throws ApiError on 401 Unauthorized for list endpoint', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
                401
            )
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/conversations/owner',
                query: { page: 1, pageSize: 20 },
                schema: OwnerConversationsListSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiSchemaError when server returns unexpected data shape for list', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: { unexpected: true } })
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/conversations/owner',
                schema: OwnerConversationsListSchema
            })
        ).rejects.toBeInstanceOf(ApiSchemaError);
    });

    it('returns typed data on a valid 200 list response', async () => {
        const validData = {
            items: [makeConversationItem()],
            pagination: validPagination
        };
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: validData })
        );

        const { data } = await apiFetch({
            path: '/api/v1/protected/conversations/owner',
            schema: OwnerConversationsListSchema
        });

        expect(data.items).toHaveLength(1);
        expect(data.items[0]?.id).toBe(UUID_CONV);
        expect(data.items[0]?.unreadCount).toBe(2);
    });

    it('returns typed data on a valid 200 unread-count response', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: { count: 5 } })
        );

        const { data } = await apiFetch({
            path: '/api/v1/protected/conversations/owner/unread-count',
            schema: OwnerUnreadCountSchema
        });

        expect(data.count).toBe(5);
    });
});
