/**
 * Tests for POST /api/v1/public/conversations/request-access
 *
 * Strategy: import route directly + mock infrastructure.
 * - env: importOriginal (preserves all helpers, overrides env object)
 * - logger, redis: fully mocked
 * - @repo/service-core: importOriginal, services overridden
 *
 * Key assertions:
 * - Anti-enumeration: matched and unmatched emails both return 200 with
 *   IDENTICAL body shape `{ status: 'sent_if_exists' }`
 * - Invalid email and malformed JSON also return 200 (anti-enumeration sentinel)
 * - Response body equality: body1.data.status === body2.data.status
 *
 * @module test/routes/conversations/public/request-access
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

const mockRequestAccessByEmail = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        ConversationService: vi.fn().mockImplementation(() => ({
            // The route handler calls requestAccessByEmail(email).
            // Anti-enumeration: this method NEVER throws — it silently handles
            // not-found / errors and returns void.
            requestAccessByEmail: mockRequestAccessByEmail
        }))
    };
});

// ── Route import (after mocks) ────────────────────────────────────────────────

import { requestAccessPublicConversationRoute } from '../../../../src/routes/conversations/public/request-access.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp(): Hono {
    const app = new Hono({ strict: false });
    app.route('/request-access', requestAccessPublicConversationRoute);
    return app;
}

async function postRequestAccess(app: Hono, email: string): Promise<Response> {
    return app.request('/request-access/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/public/conversations/request-access', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
        // Default: requestAccessByEmail resolves silently (anti-enumeration contract)
        mockRequestAccessByEmail.mockResolvedValue(undefined);
    });

    // ── Route registration ────────────────────────────────────────────────────

    it('route is registered and reachable (not 404)', async () => {
        const res = await postRequestAccess(app, 'test@example.com');
        expect(res.status).not.toBe(404);
    });

    // ── Anti-enumeration ──────────────────────────────────────────────────────

    it('always returns 200 with status sent_if_exists regardless of email match', async () => {
        // Act — email that won't match any conversation
        const res = await postRequestAccess(app, 'notfound@example.com');

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { status: string } };
        expect(body.data.status).toBe('sent_if_exists');
    });

    it('returns identical response body for matched and unmatched emails', async () => {
        // Act — simulate both scenarios
        const res1 = await postRequestAccess(app, 'matched@example.com');
        const res2 = await postRequestAccess(app, 'notfound@example.com');

        // Assert — same status code and same body shape (anti-enumeration)
        expect(res1.status).toBe(res2.status);
        const body1 = (await res1.json()) as { data: { status: string } };
        const body2 = (await res2.json()) as { data: { status: string } };
        expect(body1.data.status).toBe(body2.data.status);
    });

    it('returns 200 even on invalid email format (anti-enumeration sentinel)', async () => {
        // Act — RequestAccessSchema rejects invalid email
        const res = await app.request('/request-access/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'not-an-email' })
        });

        // Assert — schema failure → returns sentinel (not 400)
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { status: string } };
        expect(body.data.status).toBe('sent_if_exists');
    });

    it('returns 200 on malformed JSON (anti-enumeration)', async () => {
        // Act
        const res = await app.request('/request-access/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-json{'
        });

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { status: string } };
        expect(body.data.status).toBe('sent_if_exists');
    });

    it('returns 200 on missing email field (anti-enumeration)', async () => {
        // Act
        const res = await app.request('/request-access/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        // Assert
        expect(res.status).toBe(200);
    });
});
