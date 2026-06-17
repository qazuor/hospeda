/**
 * @file use-conversation-thread.test.ts
 * @description Unit tests for the conversation thread hook (SPEC-243 T-044).
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so tests never hit the network.
 *
 * Coverage:
 * - ConversationThreadSchema: valid payload (messages + nextCursor) → passes
 * - ConversationThreadSchema: empty messages array → passes
 * - ConversationThreadSchema: nextCursor null → passes
 * - ConversationThreadSchema: missing conversation field → fails
 * - ThreadMessageSchema: valid OWNER and GUEST sender types → both pass
 * - ThreadMessageSchema: missing body field → fails
 * - apiFetch thread path: 404 → ApiError
 * - apiFetch thread path: schema drift → ApiSchemaError
 * - apiFetch thread path: valid 200 → typed data returned
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
import { ConversationThreadSchema, ThreadMessageSchema } from './use-conversation-thread';

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
const UUID_MSG_1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const UUID_MSG_2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const makeConversation = (overrides: Record<string, unknown> = {}) => ({
    id: UUID_CONV,
    accommodationId: UUID_ACC,
    accommodationName: 'Casa del río',
    userId: null,
    anonymousName: 'Juan Pérez',
    guestName: 'Juan Pérez',
    status: 'OPEN',
    locale: 'es',
    createdAt: '2024-05-01T00:00:00.000Z',
    updatedAt: '2024-06-01T12:00:00.000Z',
    ...overrides
});

const makeMessage = (senderType: 'GUEST' | 'OWNER', overrides: Record<string, unknown> = {}) => ({
    id: senderType === 'GUEST' ? UUID_MSG_1 : UUID_MSG_2,
    conversationId: UUID_CONV,
    senderType,
    userId: null,
    body: `Hello from ${senderType}`,
    status: 'SENT',
    createdAt: '2024-06-01T10:00:00.000Z',
    updatedAt: '2024-06-01T10:00:00.000Z',
    ...overrides
});

// ---------------------------------------------------------------------------
// ThreadMessageSchema tests
// ---------------------------------------------------------------------------

describe('ThreadMessageSchema', () => {
    it('parses a valid GUEST message', () => {
        const msg = makeMessage('GUEST');
        const result = ThreadMessageSchema.safeParse(msg);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.senderType).toBe('GUEST');
        }
    });

    it('parses a valid OWNER message', () => {
        const msg = makeMessage('OWNER');
        const result = ThreadMessageSchema.safeParse(msg);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.senderType).toBe('OWNER');
        }
    });

    it('fails when body field is missing', () => {
        const { body: _removed, ...msgWithoutBody } = makeMessage('GUEST');
        const result = ThreadMessageSchema.safeParse(msgWithoutBody);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('body');
        }
    });

    it('fails when id is not a valid UUID', () => {
        const msg = makeMessage('GUEST', { id: 'not-a-uuid' });
        const result = ThreadMessageSchema.safeParse(msg);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ConversationThreadSchema tests
// ---------------------------------------------------------------------------

describe('ConversationThreadSchema', () => {
    it('parses a valid thread payload with messages and a nextCursor', () => {
        const payload = {
            conversation: makeConversation(),
            messages: [makeMessage('GUEST'), makeMessage('OWNER')],
            nextCursor: '2024-05-31T10:00:00.000Z'
        };
        const result = ConversationThreadSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.messages).toHaveLength(2);
            expect(result.data.nextCursor).toBe('2024-05-31T10:00:00.000Z');
        }
    });

    it('parses when messages array is empty', () => {
        const payload = {
            conversation: makeConversation(),
            messages: [],
            nextCursor: null
        };
        const result = ConversationThreadSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.messages).toHaveLength(0);
        }
    });

    it('parses when nextCursor is null', () => {
        const payload = {
            conversation: makeConversation(),
            messages: [makeMessage('GUEST')],
            nextCursor: null
        };
        const result = ConversationThreadSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.nextCursor).toBeNull();
        }
    });

    it('parses with enriched null conversation fields', () => {
        const payload = {
            conversation: makeConversation({ accommodationName: null, guestName: null }),
            messages: [],
            nextCursor: null
        };
        const result = ConversationThreadSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });

    it('fails when conversation field is missing', () => {
        const payload = {
            messages: [makeMessage('GUEST')],
            nextCursor: null
        };
        const result = ConversationThreadSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('conversation');
        }
    });
});

// ---------------------------------------------------------------------------
// apiFetch integration (network layer)
// ---------------------------------------------------------------------------

describe('apiFetch with conversation thread path — error handling', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('throws ApiError on 404 for a non-existent conversation', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Conversation not found' }
                },
                404
            )
        );

        await expect(
            apiFetch({
                path: `/api/v1/protected/conversations/owner/${UUID_CONV}`,
                schema: ConversationThreadSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiSchemaError when server returns unexpected data shape', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: { unexpected: true } })
        );

        await expect(
            apiFetch({
                path: `/api/v1/protected/conversations/owner/${UUID_CONV}`,
                schema: ConversationThreadSchema
            })
        ).rejects.toBeInstanceOf(ApiSchemaError);
    });

    it('returns typed data on a valid 200 thread response', async () => {
        const validData = {
            conversation: makeConversation(),
            messages: [makeMessage('GUEST'), makeMessage('OWNER')],
            nextCursor: null
        };
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: validData })
        );

        const { data } = await apiFetch({
            path: `/api/v1/protected/conversations/owner/${UUID_CONV}`,
            schema: ConversationThreadSchema
        });

        expect(data.conversation.id).toBe(UUID_CONV);
        expect(data.messages).toHaveLength(2);
        expect(data.nextCursor).toBeNull();
    });
});
