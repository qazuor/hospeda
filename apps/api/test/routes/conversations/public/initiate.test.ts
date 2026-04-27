/**
 * Tests for POST /api/v1/public/conversations/initiate
 *
 * Strategy: import route directly (not via initApp) + mock infrastructure.
 * - env: importOriginal to preserve all helpers, override only `env` object
 * - logger, redis: fully mocked (no DB/Redis side effects)
 * - @repo/service-core: ConversationService constructor intercepted via
 *   vi.fn().mockImplementation so the handler's `new ConversationService(...)`
 *   returns our controlled mock
 *
 * What is verified:
 * - Route is registered and reachable (not 404)
 * - Schema validation: 400 on invalid / missing body fields
 * - Happy path: 200 with `status: 'pending_verification'`
 * - Resent path: 200 with `status: 'resent'`
 * - Verified duplicate: 409 with reason `CONVERSATION_DUPLICATE`
 * - Accommodation not found: 404 with reason `ACCOMMODATION_DELETED`
 *
 * @module test/routes/conversations/public/initiate
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Infrastructure mocks (hoisted — must appear before route imports) ─────────

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

const mockInitiateAnonymous = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        ConversationService: vi.fn().mockImplementation(() => ({
            initiateAnonymous: mockInitiateAnonymous
        }))
    };
});

// ── Route import (after mocks) ────────────────────────────────────────────────

import { initiatePublicConversationRoute } from '../../../../src/routes/conversations/public/initiate.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp(): Hono {
    const app = new Hono({ strict: false });
    app.route('/initiate', initiatePublicConversationRoute);
    return app;
}

const VALID_BODY = {
    accommodationId: '550e8400-e29b-41d4-a716-446655440000',
    guestName: 'Ana García',
    guestEmail: 'ana@example.com',
    message: 'Hola, me gustaría reservar.'
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/public/conversations/initiate', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    // ── Route registration ────────────────────────────────────────────────────

    it('route is registered and reachable (not 404)', async () => {
        mockInitiateAnonymous.mockResolvedValueOnce({
            data: {
                status: 'pending_verification',
                conversationId: '550e8400-e29b-41d4-a716-446655440001'
            },
            error: undefined
        });

        const res = await app.request('/initiate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(VALID_BODY)
        });

        expect(res.status).not.toBe(404);
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('returns 200 with status pending_verification on new conversation', async () => {
        // Arrange
        const conversationId = '550e8400-e29b-41d4-a716-446655440001';
        mockInitiateAnonymous.mockResolvedValueOnce({
            data: { status: 'pending_verification', conversationId },
            error: undefined
        });

        // Act
        const res = await app.request('/initiate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(VALID_BODY)
        });

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            success: boolean;
            data: { status: string; conversationId: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('pending_verification');
        expect(body.data.conversationId).toBe(conversationId);
    });

    it('returns 200 with status resent on unverified duplicate', async () => {
        // Arrange
        const conversationId = '550e8400-e29b-41d4-a716-446655440002';
        mockInitiateAnonymous.mockResolvedValueOnce({
            data: { status: 'resent', conversationId },
            error: undefined
        });

        // Act
        const res = await app.request('/initiate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(VALID_BODY)
        });

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { status: string } };
        expect(body.data.status).toBe('resent');
    });

    // ── Duplicate (verified) ──────────────────────────────────────────────────

    it('returns 409 with reason CONVERSATION_DUPLICATE on verified duplicate', async () => {
        // Arrange
        mockInitiateAnonymous.mockResolvedValueOnce({
            data: undefined,
            error: {
                code: 'ALREADY_EXISTS',
                message: 'A verified conversation already exists',
                reason: 'CONVERSATION_DUPLICATE'
            }
        });

        // Act
        const res = await app.request('/initiate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(VALID_BODY)
        });

        // Assert
        expect(res.status).toBe(409);
        const body = (await res.json()) as { error: { reason: string } };
        expect(body.error.reason).toBe('CONVERSATION_DUPLICATE');
    });

    // ── Validation errors ─────────────────────────────────────────────────────

    it('returns 400 on invalid body (missing required fields)', async () => {
        // Arrange — missing guestName, guestEmail; invalid accommodationId
        const invalidBody = { accommodationId: 'not-a-uuid', message: '' };

        // Act
        const res = await app.request('/initiate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invalidBody)
        });

        // Assert
        expect(res.status).toBe(400);
        const body = (await res.json()) as { success: boolean; error: { code: string } };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 on invalid JSON body', async () => {
        // Act
        const res = await app.request('/initiate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-json{'
        });

        // Assert
        expect(res.status).toBe(400);
    });

    // ── Accommodation not found ───────────────────────────────────────────────

    it('returns 404 when accommodation is deleted', async () => {
        // Arrange
        mockInitiateAnonymous.mockResolvedValueOnce({
            data: undefined,
            error: {
                code: 'NOT_FOUND',
                message: 'Accommodation not found',
                reason: 'ACCOMMODATION_DELETED'
            }
        });

        // Act
        const res = await app.request('/initiate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(VALID_BODY)
        });

        // Assert
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error: { reason: string } };
        expect(body.error.reason).toBe('ACCOMMODATION_DELETED');
    });
});
