/**
 * @file use-reply-conversation.test.ts
 * @description Unit tests for the reply mutation hook (SPEC-243 T-044).
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so tests never hit the network.
 *
 * Coverage:
 * - CreatedMessageSchema: valid response → passes parse
 * - CreatedMessageSchema: missing id → fails
 * - CreatedMessageSchema: missing body field → fails
 * - apiFetch POST reply path: body field name is `body` (not `content`/`message`)
 * - apiFetch POST reply path: 403 → ApiError
 * - apiFetch POST reply path: schema drift → ApiSchemaError
 * - apiFetch POST reply path: valid 201 → typed data returned
 * - Invalidation target keys exported correctly (smoke-check)
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
import { conversationThreadKeys } from './use-conversation-thread';
import { ownerConversationKeys } from './use-owner-conversations';
import { CreatedMessageSchema } from './use-reply-conversation';

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
const UUID_MSG = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

const makeCreatedMessage = (overrides: Record<string, unknown> = {}) => ({
    id: UUID_MSG,
    conversationId: UUID_CONV,
    senderType: 'OWNER',
    userId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    body: 'Thank you for your inquiry!',
    status: 'SENT',
    createdAt: '2024-06-01T12:00:00.000Z',
    updatedAt: '2024-06-01T12:00:00.000Z',
    ...overrides
});

// ---------------------------------------------------------------------------
// CreatedMessageSchema tests
// ---------------------------------------------------------------------------

describe('CreatedMessageSchema', () => {
    it('parses a valid created message', () => {
        const result = CreatedMessageSchema.safeParse(makeCreatedMessage());
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.senderType).toBe('OWNER');
            expect(result.data.body).toBe('Thank you for your inquiry!');
        }
    });

    it('parses when userId is null (anonymous owner scenario)', () => {
        const result = CreatedMessageSchema.safeParse(makeCreatedMessage({ userId: null }));
        expect(result.success).toBe(true);
    });

    it('fails when id field is missing', () => {
        const { id: _removed, ...msgWithoutId } = makeCreatedMessage();
        const result = CreatedMessageSchema.safeParse(msgWithoutId);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('id');
        }
    });

    it('fails when body field is missing', () => {
        const { body: _removed, ...msgWithoutBody } = makeCreatedMessage();
        const result = CreatedMessageSchema.safeParse(msgWithoutBody);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('body');
        }
    });

    it('fails when id is not a valid UUID', () => {
        const result = CreatedMessageSchema.safeParse(makeCreatedMessage({ id: 'not-a-uuid' }));
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// apiFetch POST reply path — body field name verification
// ---------------------------------------------------------------------------

describe('apiFetch POST reply — body field name', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('sends request body with field named `body` (not content or message)', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: makeCreatedMessage() })
        );

        await apiFetch({
            path: `/api/v1/protected/conversations/owner/${UUID_CONV}/messages`,
            method: 'POST',
            body: { body: 'Hello!' },
            schema: CreatedMessageSchema
        });

        const call = vi.mocked(fetch).mock.calls[0];
        expect(call).toBeDefined();
        const requestInit = call?.[1] as RequestInit;
        const sentBody = JSON.parse(requestInit.body as string) as Record<string, unknown>;
        // Verify the field name is `body`, not `content` or `message`
        expect(sentBody).toHaveProperty('body', 'Hello!');
        expect(sentBody).not.toHaveProperty('content');
        expect(sentBody).not.toHaveProperty('message');
    });

    it('throws ApiError on 403 Forbidden', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Permission denied' }
                },
                403
            )
        );

        await expect(
            apiFetch({
                path: `/api/v1/protected/conversations/owner/${UUID_CONV}/messages`,
                method: 'POST',
                body: { body: 'Hello!' },
                schema: CreatedMessageSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiSchemaError when 201 response has unexpected shape', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: { unexpected: true } })
        );

        await expect(
            apiFetch({
                path: `/api/v1/protected/conversations/owner/${UUID_CONV}/messages`,
                method: 'POST',
                body: { body: 'Hello!' },
                schema: CreatedMessageSchema
            })
        ).rejects.toBeInstanceOf(ApiSchemaError);
    });

    it('returns typed data on a valid 201 response', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: makeCreatedMessage() })
        );

        const { data } = await apiFetch({
            path: `/api/v1/protected/conversations/owner/${UUID_CONV}/messages`,
            method: 'POST',
            body: { body: 'Hello!' },
            schema: CreatedMessageSchema
        });

        expect(data.id).toBe(UUID_MSG);
        expect(data.senderType).toBe('OWNER');
        expect(data.body).toBe('Thank you for your inquiry!');
    });
});

// ---------------------------------------------------------------------------
// Invalidation target keys smoke-check
// ---------------------------------------------------------------------------

describe('Invalidation query key factories', () => {
    it('ownerConversationKeys.lists() returns expected prefix', () => {
        const key = ownerConversationKeys.lists();
        expect(key[0]).toBe('owner-conversations');
        expect(key[1]).toBe('list');
    });

    it('ownerConversationKeys.unreadCount() returns expected prefix', () => {
        const key = ownerConversationKeys.unreadCount();
        expect(key[0]).toBe('owner-conversations');
        expect(key[1]).toBe('unread-count');
    });

    it('conversationThreadKeys.detail(id) returns expected key', () => {
        const key = conversationThreadKeys.detail(UUID_CONV);
        expect(key[0]).toBe('conversation-thread');
        expect(key[key.length - 1]).toBe(UUID_CONV);
    });
});
