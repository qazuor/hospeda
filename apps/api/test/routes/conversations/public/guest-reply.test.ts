/**
 * Tests for POST /api/v1/public/conversations/guest/:token/messages
 *
 * Strategy: import route directly + mock infrastructure.
 * - env: importOriginal (preserves all helpers, overrides env object)
 * - logger, redis: fully mocked
 * - @repo/service-core: importOriginal, AccessTokenService + MessageService overridden
 *
 * What is verified:
 * - Route is registered and reachable (not 404)
 * - 201 happy path returns the created message
 * - 401 with reason TOKEN_EXPIRED for expired token
 * - 401 with reason TOKEN_REVOKED for revoked token
 * - 422 with reason MESSAGE_CONTENT_BLOCKED for blocked content
 * - 403 with reason CONVERSATION_BLOCKED for blocked conversation
 * - 400 on missing body field
 * - 400 on invalid JSON body
 *
 * @module test/routes/conversations/public/guest-reply
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Infrastructure mocks ──────────────────────────────────────────────────────

vi.mock('../../../../src/utils/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/env')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            NODE_ENV: 'test',
            HOSPEDA_TESTING_RATE_LIMIT: false,
            HOSPEDA_BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long!!',
            HOSPEDA_SITE_URL: 'http://localhost:4321'
        }
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockValidateToken = vi.fn();
const mockCreateMessage = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        AccessTokenService: vi.fn().mockImplementation(() => ({
            validateToken: mockValidateToken
        })),
        MessageService: vi.fn().mockImplementation(() => ({
            createMessage: mockCreateMessage
        }))
    };
});

// ── Route import (after mocks) ────────────────────────────────────────────────

import { guestReplyPublicConversationRoute } from '../../../../src/routes/conversations/public/guest-reply.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440001';

const VALID_TOKEN_ROW = {
    conversationId: CONVERSATION_ID,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 1_000_000)
};

function buildApp(): Hono {
    const app = new Hono({ strict: false });
    app.route('/guest', guestReplyPublicConversationRoute);
    return app;
}

async function postReply(app: Hono, token: string, body: unknown): Promise<Response> {
    return app.request(`/guest/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/public/conversations/guest/:token/messages', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    // ── Route registration ────────────────────────────────────────────────────

    it('route is registered and reachable (not 404)', async () => {
        mockValidateToken.mockResolvedValueOnce({ data: VALID_TOKEN_ROW, error: undefined });
        mockCreateMessage.mockResolvedValueOnce({
            data: {
                id: '550e8400-e29b-41d4-a716-446655440010',
                body: 'hello',
                senderType: 'GUEST',
                createdAt: new Date().toISOString(),
                conversationId: CONVERSATION_ID,
                userId: null,
                status: 'VISIBLE',
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                createdById: null,
                updatedById: null,
                deletedById: null
            },
            error: undefined
        });

        const res = await postReply(app, 'some-token', { body: 'hello' });

        expect(res.status).not.toBe(404);
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('returns 201 with created message on valid token and clean body', async () => {
        // Arrange
        // Include all fields MessageGuestPublicSchema requires after SPEC-210 PR3
        // schema stripping (senderType + createdAt are mandatory; the schema strips
        // conversationId / userId / status / audit timestamps).
        const createdMessage = {
            id: '550e8400-e29b-41d4-a716-446655440011',
            body: 'Hello owner!',
            senderType: 'GUEST',
            createdAt: new Date().toISOString(),
            // Extra fields that will be stripped by MessageGuestPublicSchema
            conversationId: CONVERSATION_ID,
            userId: null,
            status: 'VISIBLE',
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            createdById: null,
            updatedById: null,
            deletedById: null
        };
        mockValidateToken.mockResolvedValueOnce({ data: VALID_TOKEN_ROW, error: undefined });
        mockCreateMessage.mockResolvedValueOnce({ data: createdMessage, error: undefined });

        // Act
        const res = await postReply(app, 'valid-token-32chars-xxxxxxxxxxxx', {
            body: 'Hello owner!'
        });

        // Assert
        expect(res.status).toBe(201);
        const resBody = (await res.json()) as { data: { body: string } };
        expect(resBody.data.body).toBe('Hello owner!');
    });

    // ── Token expired ─────────────────────────────────────────────────────────

    it('returns 401 with reason TOKEN_EXPIRED on expired token', async () => {
        // Arrange
        mockValidateToken.mockResolvedValueOnce({
            data: undefined,
            error: { code: 'UNAUTHORIZED', message: 'Token expired', reason: 'TOKEN_EXPIRED' }
        });

        // Act
        const res = await postReply(app, 'expired-token', { body: 'Hello' });

        // Assert
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: { reason: string } };
        expect(body.error.reason).toBe('TOKEN_EXPIRED');
    });

    // ── Token revoked ─────────────────────────────────────────────────────────

    it('returns 401 with reason TOKEN_REVOKED on revoked token', async () => {
        // Arrange
        mockValidateToken.mockResolvedValueOnce({
            data: undefined,
            error: { code: 'UNAUTHORIZED', message: 'Token revoked', reason: 'TOKEN_REVOKED' }
        });

        // Act
        const res = await postReply(app, 'revoked-token', { body: 'Hello' });

        // Assert
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: { reason: string } };
        expect(body.error.reason).toBe('TOKEN_REVOKED');
    });

    // ── Blocked content ───────────────────────────────────────────────────────

    it('returns 422 with reason MESSAGE_CONTENT_BLOCKED on blocked content', async () => {
        // Arrange
        mockValidateToken.mockResolvedValueOnce({ data: VALID_TOKEN_ROW, error: undefined });
        mockCreateMessage.mockResolvedValueOnce({
            data: undefined,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Message blocked',
                reason: 'MESSAGE_CONTENT_BLOCKED'
            }
        });

        // Act
        const res = await postReply(app, 'valid-token', { body: 'blocked-word-here' });

        // Assert
        expect(res.status).toBe(422);
        const body = (await res.json()) as { error: { reason: string } };
        expect(body.error.reason).toBe('MESSAGE_CONTENT_BLOCKED');
    });

    // ── Blocked conversation ──────────────────────────────────────────────────

    it('returns 403 with reason CONVERSATION_BLOCKED when conversation is blocked', async () => {
        // Arrange
        mockValidateToken.mockResolvedValueOnce({ data: VALID_TOKEN_ROW, error: undefined });
        mockCreateMessage.mockResolvedValueOnce({
            data: undefined,
            error: {
                code: 'FORBIDDEN',
                message: 'Conversation is blocked',
                reason: 'CONVERSATION_BLOCKED'
            }
        });

        // Act
        const res = await postReply(app, 'valid-token', { body: 'Normal message' });

        // Assert
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error: { reason: string } };
        expect(body.error.reason).toBe('CONVERSATION_BLOCKED');
    });

    // ── Validation error ──────────────────────────────────────────────────────

    it('returns 400 on missing body field', async () => {
        // Arrange — token valid but missing `body` in request
        mockValidateToken.mockResolvedValueOnce({ data: VALID_TOKEN_ROW, error: undefined });

        // Act — empty object (no `body` key)
        const res = await postReply(app, 'valid-token', {});

        // Assert
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 on invalid JSON body', async () => {
        // Act
        const res = await app.request('/guest/some-token/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-json{'
        });

        // Assert
        expect(res.status).toBe(400);
    });
});
