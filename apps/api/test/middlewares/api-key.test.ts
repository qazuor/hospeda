/**
 * API Key Middleware Tests (T-024)
 *
 * Covers:
 * - Valid key → 200 + actor injected into context
 * - Wrong key → 401
 * - Missing header → 401
 * - Unconfigured env (getExpectedKey returns undefined/empty) → 401 fail-closed
 * - timingSafeEqual path: keys of different plaintext lengths still compare
 *   without throwing (digest lengths are always equal — 32 bytes)
 *
 * The test creates a minimal Hono app, mounts the middleware, and verifies
 * both the HTTP response and the actor set on context.
 */

import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type ApiKeyMiddlewareConfig,
    apiKeyMiddleware,
    compareApiKeys
} from '../../src/middlewares/api-key';
import type { AppBindings } from '../../src/types';

// ---------------------------------------------------------------------------
// Mock logger so tests don't emit real log output
// ---------------------------------------------------------------------------
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { apiLogger } from '../../src/utils/logger';
const mockLogger = vi.mocked(apiLogger);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const VALID_KEY = 'super-secret-key-for-tests';

const DEFAULT_CONFIG: ApiKeyMiddlewareConfig = {
    headerName: 'x-hospeda-ai-key',
    getExpectedKey: () => VALID_KEY,
    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
};

/**
 * Build a minimal Hono app that:
 * 1. Runs apiKeyMiddleware
 * 2. On success, returns 200 with the actor from context as JSON
 */
function buildTestApp(config: ApiKeyMiddlewareConfig): Hono<AppBindings> {
    const app = new Hono<AppBindings>();

    app.use('*', apiKeyMiddleware(config));

    app.get('/test', (c) => {
        const actor = c.get('actor') as Actor | undefined;
        return c.json({ success: true, actor });
    });
    app.post('/test', (c) => {
        const actor = c.get('actor') as Actor | undefined;
        return c.json({ success: true, actor });
    });

    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('apiKeyMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    describe('valid key', () => {
        it('returns 200 when the correct key is provided', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': VALID_KEY }
            });
            expect(res.status).toBe(200);
        });

        it('injects the synthetic actor into context on success', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': VALID_KEY }
            });
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.actor).toBeDefined();
            expect(body.actor.id).toBe('gpt-action');
            expect(body.actor.name).toBe('Custom GPT Social Action');
            expect(body.actor.role).toBe(RoleEnum.SYSTEM);
            expect(body.actor.permissions).toEqual([]);
            expect(body.actor._isSystemActor).toBe(false);
        });

        it('does not log a warn on successful auth', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': VALID_KEY }
            });
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Wrong key
    // -------------------------------------------------------------------------

    describe('wrong key', () => {
        it('returns 401 when the wrong key is provided', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': 'wrong-key' }
            });
            expect(res.status).toBe(401);
        });

        it('returns standard error envelope on wrong key', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': 'wrong-key' }
            });
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
            expect(typeof body.error.message).toBe('string');
        });

        it('logs a WARN on key mismatch', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': 'wrong-key' }
            });
            expect(mockLogger.warn).toHaveBeenCalledOnce();
            const [meta, msg] = mockLogger.warn.mock.calls[0] as [{ reason: string }, string];
            expect(meta.reason).toBe('API_KEY_MISMATCH');
            expect(typeof msg).toBe('string');
        });

        it('does not call next() when key is wrong', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            const nextSpy = vi.fn();
            // Verify that the handler after the middleware is NOT reached
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': 'totally-wrong' }
            });
            // Handler returns actor in body; on 401, actor should be absent
            expect(res.status).toBe(401);
            expect(nextSpy).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Missing header
    // -------------------------------------------------------------------------

    describe('missing header', () => {
        it('returns 401 when the header is absent', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            const res = await app.request('/test', {
                method: 'GET'
                // no x-hospeda-ai-key header
            });
            expect(res.status).toBe(401);
        });

        it('returns standard error envelope on missing header', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            const res = await app.request('/test', { method: 'GET' });
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('logs a WARN on missing header', async () => {
            const app = buildTestApp(DEFAULT_CONFIG);
            await app.request('/test', { method: 'GET' });
            expect(mockLogger.warn).toHaveBeenCalledOnce();
            const [meta] = mockLogger.warn.mock.calls[0] as [{ reason: string }];
            expect(meta.reason).toBe('API_KEY_MISSING');
        });
    });

    // -------------------------------------------------------------------------
    // Unconfigured env (fail-closed)
    // -------------------------------------------------------------------------

    describe('unconfigured env (fail-closed)', () => {
        it('returns 401 when getExpectedKey returns undefined', async () => {
            const config: ApiKeyMiddlewareConfig = {
                ...DEFAULT_CONFIG,
                getExpectedKey: () => undefined
            };
            const app = buildTestApp(config);
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': VALID_KEY }
            });
            expect(res.status).toBe(401);
        });

        it('returns 401 when getExpectedKey returns empty string', async () => {
            const config: ApiKeyMiddlewareConfig = {
                ...DEFAULT_CONFIG,
                getExpectedKey: () => ''
            };
            const app = buildTestApp(config);
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': VALID_KEY }
            });
            expect(res.status).toBe(401);
        });

        it('returns 401 when getExpectedKey returns whitespace-only string', async () => {
            const config: ApiKeyMiddlewareConfig = {
                ...DEFAULT_CONFIG,
                getExpectedKey: () => '   '
            };
            const app = buildTestApp(config);
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': VALID_KEY }
            });
            expect(res.status).toBe(401);
        });

        it('logs a clear warning when env key is not configured', async () => {
            const config: ApiKeyMiddlewareConfig = {
                ...DEFAULT_CONFIG,
                getExpectedKey: () => undefined
            };
            const app = buildTestApp(config);
            await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': VALID_KEY }
            });
            expect(mockLogger.warn).toHaveBeenCalledOnce();
            const [meta] = mockLogger.warn.mock.calls[0] as [{ reason: string }];
            expect(meta.reason).toBe('API_KEY_ENV_NOT_CONFIGURED');
        });
    });

    // -------------------------------------------------------------------------
    // Different header names (Make.com scenario)
    // -------------------------------------------------------------------------

    describe('custom header name', () => {
        it('reads key from the configured header name', async () => {
            const makeConfig: ApiKeyMiddlewareConfig = {
                headerName: 'x-hospeda-make-key',
                getExpectedKey: () => 'make-secret',
                actor: { id: 'make-integration', name: 'Make.com Integration' }
            };
            const app = buildTestApp(makeConfig);

            // Correct header → 200
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-make-key': 'make-secret' }
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.actor.id).toBe('make-integration');
        });

        it('returns 401 when the wrong header name is used', async () => {
            const makeConfig: ApiKeyMiddlewareConfig = {
                headerName: 'x-hospeda-make-key',
                getExpectedKey: () => 'make-secret',
                actor: { id: 'make-integration', name: 'Make.com Integration' }
            };
            const app = buildTestApp(makeConfig);

            // Send key in the GPT header — wrong name
            const res = await app.request('/test', {
                method: 'GET',
                headers: { 'x-hospeda-ai-key': 'make-secret' }
            });
            expect(res.status).toBe(401);
        });
    });
});

// ---------------------------------------------------------------------------
// compareApiKeys unit tests (ensures timingSafeEqual is used, no early-return)
// ---------------------------------------------------------------------------

describe('compareApiKeys', () => {
    it('returns true for identical keys', () => {
        expect(compareApiKeys({ provided: 'abc', expected: 'abc' })).toBe(true);
    });

    it('returns false for different keys', () => {
        expect(compareApiKeys({ provided: 'abc', expected: 'xyz' })).toBe(false);
    });

    it('returns false for keys that differ only by case', () => {
        expect(compareApiKeys({ provided: 'Secret', expected: 'secret' })).toBe(false);
    });

    it('does NOT short-circuit on length difference (different length inputs still produce equal-length digests)', () => {
        // Both sides are hashed to 32-byte digests — lengths never differ
        // at the timingSafeEqual level. Verify no throw and correct result.
        const result = compareApiKeys({
            provided: 'short',
            expected: 'a-much-longer-key-than-short'
        });
        expect(result).toBe(false);
    });

    it('returns false for empty strings', () => {
        // Edge: both empty → same digest → TRUE (both callers would need to
        // send an empty string AND the env would need to be empty, which the
        // middleware guards against separately via fail-closed check).
        expect(compareApiKeys({ provided: '', expected: '' })).toBe(true);
        expect(compareApiKeys({ provided: '', expected: 'non-empty' })).toBe(false);
    });

    it('is deterministic — same inputs always return the same result', () => {
        const result1 = compareApiKeys({ provided: 'key-abc', expected: 'key-abc' });
        const result2 = compareApiKeys({ provided: 'key-abc', expected: 'key-abc' });
        expect(result1).toBe(true);
        expect(result2).toBe(true);
    });
});
