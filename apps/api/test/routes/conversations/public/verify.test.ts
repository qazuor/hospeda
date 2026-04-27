/**
 * Tests for GET /api/v1/public/conversations/verify/:verificationToken
 *
 * Strategy: import route directly + mock infrastructure.
 * - env: importOriginal (preserves all helpers, overrides env object)
 * - logger, redis: fully mocked
 * - @repo/service-core: importOriginal, ConversationService overridden
 *
 * What is verified:
 * - Route is registered and reachable (not 404)
 * - 302 redirect to guest messages URL on valid token
 * - Correct locale in redirect URL
 * - Default `es` locale when not specified
 * - 302 redirect to verify-expired on invalid/expired JWT
 * - Idempotent re-click: second call with same token still returns 302
 *
 * @module test/routes/conversations/public/verify
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

// ── Service mock ──────────────────────────────────────────────────────────────

const mockVerifyEmailToken = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        ConversationService: vi.fn().mockImplementation(() => ({
            verifyEmailToken: mockVerifyEmailToken
        }))
    };
});

// ── Route import (after mocks) ────────────────────────────────────────────────

import { verifyPublicConversationRoute } from '../../../../src/routes/conversations/public/verify.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp(): Hono {
    const app = new Hono({ strict: false });
    app.route('/verify', verifyPublicConversationRoute);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/public/conversations/verify/:verificationToken', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    // ── Route registration ────────────────────────────────────────────────────

    it('route is registered and reachable (not 404)', async () => {
        mockVerifyEmailToken.mockResolvedValueOnce({
            data: { conversationId: '550e8400-e29b-41d4-a716-446655440001', rawToken: 'abc123' },
            error: undefined
        });

        const res = await app.request('/verify/some-token');

        expect(res.status).not.toBe(404);
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('returns 302 redirect to guest messages URL on valid token', async () => {
        // Arrange
        const rawToken = 'abc123def456abc123def456abc123de';
        mockVerifyEmailToken.mockResolvedValueOnce({
            data: { conversationId: '550e8400-e29b-41d4-a716-446655440001', rawToken },
            error: undefined
        });

        // Act
        const res = await app.request('/verify/valid-jwt-token?locale=es');

        // Assert
        expect(res.status).toBe(302);
        const location = res.headers.get('Location');
        expect(location).toContain('/es/guest/messages/');
        expect(location).toContain(rawToken);
    });

    it('includes correct locale in redirect URL', async () => {
        // Arrange
        const rawToken = 'abc123def456abc123def456abc123de';
        mockVerifyEmailToken.mockResolvedValueOnce({
            data: { conversationId: '550e8400-e29b-41d4-a716-446655440001', rawToken },
            error: undefined
        });

        // Act — request with pt locale
        const res = await app.request('/verify/valid-token?locale=pt');

        // Assert
        const location = res.headers.get('Location');
        expect(location).toContain('/pt/guest/messages/');
    });

    it('defaults to es locale when not specified', async () => {
        // Arrange
        const rawToken = 'fallback-raw-token-hex-32chars-xx';
        mockVerifyEmailToken.mockResolvedValueOnce({
            data: { conversationId: '550e8400-e29b-41d4-a716-446655440001', rawToken },
            error: undefined
        });

        // Act — no locale param
        const res = await app.request('/verify/valid-token');

        // Assert
        const location = res.headers.get('Location');
        expect(location).toContain('/es/guest/messages/');
    });

    // ── Invalid / expired token ───────────────────────────────────────────────

    it('returns 302 redirect to verify-expired on invalid JWT', async () => {
        // Arrange
        mockVerifyEmailToken.mockResolvedValueOnce({
            data: undefined,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid verification token',
                reason: 'VERIFICATION_INVALID'
            }
        });

        // Act
        const res = await app.request('/verify/invalid-jwt?locale=es');

        // Assert
        expect(res.status).toBe(302);
        const location = res.headers.get('Location');
        expect(location).toContain('/es/guest/messages/verify-expired');
    });

    it('returns 302 redirect to verify-expired on expired JWT', async () => {
        // Arrange
        mockVerifyEmailToken.mockResolvedValueOnce({
            data: undefined,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Token expired',
                reason: 'VERIFICATION_INVALID'
            }
        });

        // Act
        const res = await app.request('/verify/expired-token?locale=en');

        // Assert
        expect(res.status).toBe(302);
        const location = res.headers.get('Location');
        expect(location).toContain('/en/guest/messages/verify-expired');
    });

    // ── Idempotent re-click ───────────────────────────────────────────────────

    it('still redirects on idempotent re-click of valid link', async () => {
        // Arrange — service returns a fresh token on re-click
        const freshRawToken = 'fresh-token-hex-32chars-xxxxxxxxxxx';
        mockVerifyEmailToken.mockResolvedValue({
            data: {
                conversationId: '550e8400-e29b-41d4-a716-446655440003',
                rawToken: freshRawToken
            },
            error: undefined
        });

        // Act — first click
        const res1 = await app.request('/verify/already-verified-jwt?locale=es');
        // Act — second click (idempotent)
        const res2 = await app.request('/verify/already-verified-jwt?locale=es');

        // Assert — both return 302 redirect
        expect(res1.status).toBe(302);
        expect(res2.status).toBe(302);
        expect(res1.headers.get('Location')).toContain(freshRawToken);
        expect(res2.headers.get('Location')).toContain(freshRawToken);
    });
});
