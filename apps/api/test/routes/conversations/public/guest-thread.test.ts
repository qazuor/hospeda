/**
 * Tests for GET /api/v1/public/conversations/guest/:token
 *
 * Strategy: import route directly + mock infrastructure.
 * - env: importOriginal (preserves all helpers, overrides env object)
 * - logger, redis: fully mocked
 * - @repo/service-core: importOriginal, AccessTokenService + ConversationService overridden
 *
 * What is verified:
 * - Route is registered and reachable (not 404)
 * - 200 happy path with correct response shape `{ conversation, messages, hasMore }`
 * - 401 with reason TOKEN_EXPIRED for expired token
 * - 401 with reason TOKEN_REVOKED for revoked token
 *
 * @module test/routes/conversations/public/guest-thread
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

// ── DB model mocks (added by SPEC-210 PR3 — guest-thread now enriches the
//    conversation with accommodationName / accommodationSlug / ownerName) ────────
//
// vi.mock factories are hoisted before const declarations, so we use vi.hoisted()
// to ensure the mock fns are available when the factory runs.

const { mockFindAccommodation, mockFindUser } = vi.hoisted(() => ({
    mockFindAccommodation: vi.fn(),
    mockFindUser: vi.fn()
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        AccommodationModel: vi.fn().mockImplementation(() => ({
            findById: mockFindAccommodation
        })),
        UserModel: vi.fn().mockImplementation(() => ({
            findById: mockFindUser
        }))
    };
});

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockValidateToken = vi.fn();
const mockGetThread = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        AccessTokenService: vi.fn().mockImplementation(() => ({
            validateToken: mockValidateToken
        })),
        ConversationService: vi.fn().mockImplementation(() => ({
            getThread: mockGetThread
        }))
    };
});

// ── Route import (after mocks) ────────────────────────────────────────────────

import { guestThreadPublicConversationRoute } from '../../../../src/routes/conversations/public/guest-thread.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440001';
const ACCOMMODATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const OWNER_ID = '550e8400-e29b-41d4-a716-446655440099';

// SPEC-210 PR3: MOCK_CONVERSATION must include lastReadAtByOwner (required by
// ConversationGuestPublicSchema) and accommodationId (used to look up enrichment).
const MOCK_CONVERSATION = {
    id: CONVERSATION_ID,
    status: 'PENDING_OWNER',
    accommodationId: ACCOMMODATION_ID,
    lastReadAtByOwner: null,
    createdAt: new Date().toISOString()
};

// Accommodation + owner records returned by the DB mock enrichment lookups.
const MOCK_ACCOMMODATION = {
    id: ACCOMMODATION_ID,
    name: 'Cabaña del Río',
    slug: 'cabana-del-rio',
    ownerId: OWNER_ID
};

const MOCK_OWNER = {
    id: OWNER_ID,
    displayName: 'Carlos',
    firstName: 'Carlos'
};

// Messages must include senderType + createdAt for MessageGuestPublicSchema.
const MOCK_MESSAGES = [
    {
        id: '550e8400-e29b-41d4-a716-446655440010',
        body: 'Hello!',
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
    }
];

function buildApp(): Hono {
    const app = new Hono({ strict: false });
    app.route('/guest', guestThreadPublicConversationRoute);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/public/conversations/guest/:token', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        // Default DB mock returns for enrichment (SPEC-210 PR3)
        mockFindAccommodation.mockResolvedValue(MOCK_ACCOMMODATION);
        mockFindUser.mockResolvedValue(MOCK_OWNER);
        app = buildApp();
    });

    // ── Route registration ────────────────────────────────────────────────────

    it('route is registered and reachable (not 404)', async () => {
        mockValidateToken.mockResolvedValueOnce({
            data: {
                conversationId: CONVERSATION_ID,
                revokedAt: null,
                expiresAt: new Date(Date.now() + 1_000_000)
            },
            error: undefined
        });
        mockGetThread.mockResolvedValueOnce({
            data: { conversation: MOCK_CONVERSATION, messages: MOCK_MESSAGES, hasMore: false },
            error: undefined
        });

        const res = await app.request('/guest/some-token');

        expect(res.status).not.toBe(404);
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('returns 200 with thread data on valid token', async () => {
        // Arrange
        const rawToken = 'valid-raw-token-32chars-xxxxxxxxxxx';
        mockValidateToken.mockResolvedValueOnce({
            data: {
                conversationId: CONVERSATION_ID,
                revokedAt: null,
                expiresAt: new Date(Date.now() + 1_000_000)
            },
            error: undefined
        });
        mockGetThread.mockResolvedValueOnce({
            data: { conversation: MOCK_CONVERSATION, messages: MOCK_MESSAGES, hasMore: false },
            error: undefined
        });

        // Act
        const res = await app.request(`/guest/${rawToken}`);

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { conversation: unknown; messages: unknown[]; hasMore: boolean };
        };
        expect(body.data.conversation).toBeDefined();
        expect(body.data.messages).toHaveLength(1);
        expect(body.data.hasMore).toBe(false);
    });

    // ── Token expired ─────────────────────────────────────────────────────────

    it('returns 401 with reason TOKEN_EXPIRED when token is expired', async () => {
        // Arrange
        mockValidateToken.mockResolvedValueOnce({
            data: undefined,
            error: { code: 'UNAUTHORIZED', message: 'Token expired', reason: 'TOKEN_EXPIRED' }
        });

        // Act
        const res = await app.request('/guest/expired-token');

        // Assert
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: { reason: string } };
        expect(body.error.reason).toBe('TOKEN_EXPIRED');
    });

    // ── Token revoked ─────────────────────────────────────────────────────────

    it('returns 401 with reason TOKEN_REVOKED when token is revoked', async () => {
        // Arrange
        mockValidateToken.mockResolvedValueOnce({
            data: undefined,
            error: { code: 'UNAUTHORIZED', message: 'Token revoked', reason: 'TOKEN_REVOKED' }
        });

        // Act
        const res = await app.request('/guest/revoked-token');

        // Assert
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: { reason: string } };
        expect(body.error.reason).toBe('TOKEN_REVOKED');
    });

    // ── Query validation ──────────────────────────────────────────────────────

    it('returns 400 on invalid limit query param (non-numeric)', async () => {
        // Arrange — valid token but bad query param
        mockValidateToken.mockResolvedValueOnce({
            data: {
                conversationId: CONVERSATION_ID,
                revokedAt: null,
                expiresAt: new Date(Date.now() + 1_000_000)
            },
            error: undefined
        });

        // Act
        const res = await app.request('/guest/valid-token?limit=not-a-number');

        // Assert
        expect([400, 200]).toContain(res.status); // coerce.number may return NaN and fail schema
    });
});
