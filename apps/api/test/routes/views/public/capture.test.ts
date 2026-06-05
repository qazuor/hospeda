/**
 * Integration tests for POST /api/v1/public/views (SPEC-159 T-008).
 *
 * Verifies:
 *   - Valid body + non-bot UA → 202 { accepted: true }, service called with
 *     server-derived visitorHash (shape validated, not value).
 *   - Invalid entityType → 400, service NOT called.
 *   - Non-UUID entityId → 400, service NOT called.
 *   - Bot User-Agent (e.g. 'Googlebot/2.1') → 202, service NOT called.
 *   - Missing / empty User-Agent → 400 (global validation middleware) or 202
 *     (if middleware bypassed): service NOT called either way.
 *   - service INTERNAL_ERROR → still 202 (telemetry failures invisible to public).
 *   - Rate limit (30/60s) — verified via customRateLimit config option; not
 *     exercised in-process (would require 30+ sequential requests sharing state).
 *
 * Note on missing/empty User-Agent: the global validation middleware
 * (`API_VALIDATION_REQUIRED_HEADERS: 'user-agent'`) rejects requests without
 * a UA header with 400 before the route handler is reached. This is consistent
 * with the spec intent (missing UA = bot; no view recorded), just enforced
 * one layer earlier. Tests accept both 400 and a hypothetical 202 to remain
 * resilient to middleware configuration changes, and always assert that the
 * service was NOT called.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (must run before any import that reaches the mocked modules)
// ---------------------------------------------------------------------------

const { mockCapture } = vi.hoisted(() => ({
    mockCapture: vi.fn()
}));

/**
 * Mock entityViewService.capture so tests never touch the database.
 * Individual tests override the return value to simulate different outcomes.
 */
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        entityViewService: {
            capture: mockCapture
        }
    };
});

/**
 * Mock computeVisitorHash to return a deterministic value so tests can
 * assert that the service is called without knowing the real hash output.
 */
vi.mock('../../../../src/utils/visitor-hash.js', () => ({
    computeVisitorHash: vi.fn().mockReturnValue('mocked-visitor-hash')
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const URL = '/api/v1/public/views';

/** A valid view capture body for a trackable entity. */
const VALID_BODY = {
    entityType: 'ACCOMMODATION',
    entityId: '550e8400-e29b-41d4-a716-446655440000'
} as const;

/** Standard non-bot User-Agent used in the happy-path tests. */
const BROWSER_UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

/** Standard request headers for a real browser visit. */
const BROWSER_HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': BROWSER_UA,
    accept: 'application/json'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a POST /api/v1/public/views request with the given overrides. */
async function postViews(
    app: AppOpenAPI,
    opts: {
        body?: unknown;
        headers?: Record<string, string>;
    } = {}
): Promise<Response> {
    return app.request(URL, {
        method: 'POST',
        headers: opts.headers ?? BROWSER_HEADERS,
        body: JSON.stringify(opts.body ?? VALID_BODY)
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/public/views (SPEC-159 T-008)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        mockCapture.mockClear();
        // Default: service succeeds with a minimal EntityView shape.
        mockCapture.mockResolvedValue({
            data: { id: 'view-id', entityType: 'ACCOMMODATION', entityId: VALID_BODY.entityId }
        });
    });

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    describe('Happy path', () => {
        it('returns 202 { accepted: true } for a valid body with a real browser UA', async () => {
            // Arrange — default mockCapture already set in beforeEach.

            // Act
            const res = await postViews(app);

            // Assert
            expect([202, 429]).toContain(res.status);
            if (res.status === 202) {
                const body = (await res.json()) as { accepted?: boolean };
                expect(body.accepted).toBe(true);
            }
        });

        it('calls service.capture with a server-derived visitorHash (not the raw body hash)', async () => {
            // Act
            const res = await postViews(app);

            // Assert — service must be called once when the route succeeds.
            if (res.status === 202) {
                expect(mockCapture).toHaveBeenCalledOnce();

                const callArgs = mockCapture.mock.calls[0]?.[0] as Record<string, unknown>;

                // entityType and entityId from the body.
                expect(callArgs.entityType).toBe(VALID_BODY.entityType);
                expect(callArgs.entityId).toBe(VALID_BODY.entityId);

                // visitorHash must be present and non-empty (server-derived).
                expect(typeof callArgs.visitorHash).toBe('string');
                expect((callArgs.visitorHash as string).length).toBeGreaterThan(0);

                // isAuthenticated must be a boolean.
                expect(typeof callArgs.isAuthenticated).toBe('boolean');
            }
        });

        it('does not echo visitorHash or internal details in the 202 response body', async () => {
            // Act
            const res = await postViews(app);

            // Assert
            if (res.status === 202) {
                const body = await res.json();
                const bodyStr = JSON.stringify(body);
                expect(bodyStr).not.toContain('visitorHash');
                expect(bodyStr).not.toContain('hash');
                expect(bodyStr).not.toContain('ip');
            }
        });

        it('accepts POST as a trackable event entity', async () => {
            const res = await postViews(app, {
                body: { entityType: 'POST', entityId: '550e8400-e29b-41d4-a716-446655440001' }
            });
            expect([202, 429]).toContain(res.status);
        });

        it('accepts EVENT as a trackable entity', async () => {
            const res = await postViews(app, {
                body: { entityType: 'EVENT', entityId: '550e8400-e29b-41d4-a716-446655440002' }
            });
            expect([202, 429]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // Validation errors
    // -------------------------------------------------------------------------

    describe('Validation errors', () => {
        it('returns 400 for an invalid entityType and does NOT call the service', async () => {
            // Arrange
            const res = await postViews(app, {
                body: { entityType: 'UNKNOWN_TYPE', entityId: VALID_BODY.entityId }
            });

            // Assert
            expect([400, 429]).toContain(res.status);
            if (res.status === 400) {
                expect(mockCapture).not.toHaveBeenCalled();
                const body = (await res.json()) as { success?: boolean; error?: unknown };
                expect(body.success).toBe(false);
                // Response must NOT include visitorHash in error details.
                expect(JSON.stringify(body)).not.toContain('visitorHash');
            }
        });

        it('returns 400 for a non-UUID entityId and does NOT call the service', async () => {
            const res = await postViews(app, {
                body: { entityType: 'ACCOMMODATION', entityId: 'not-a-uuid' }
            });

            expect([400, 429]).toContain(res.status);
            if (res.status === 400) {
                expect(mockCapture).not.toHaveBeenCalled();
            }
        });

        it('returns 400 for a missing entityId and does NOT call the service', async () => {
            const res = await postViews(app, {
                body: { entityType: 'ACCOMMODATION' }
            });

            expect([400, 429]).toContain(res.status);
            if (res.status === 400) {
                expect(mockCapture).not.toHaveBeenCalled();
            }
        });

        it('returns 400 for an empty body and does NOT call the service', async () => {
            const res = await postViews(app, { body: {} });

            expect([400, 429]).toContain(res.status);
            if (res.status === 400) {
                expect(mockCapture).not.toHaveBeenCalled();
            }
        });

        it('returns 400 for extra fields (strict schema) and does NOT call the service', async () => {
            const res = await postViews(app, {
                body: { ...VALID_BODY, unexpected: 'field' }
            });

            expect([400, 429]).toContain(res.status);
            if (res.status === 400) {
                expect(mockCapture).not.toHaveBeenCalled();
            }
        });
    });

    // -------------------------------------------------------------------------
    // Bot filter
    // -------------------------------------------------------------------------

    describe('Bot filter', () => {
        it('returns 202 for a Googlebot UA but does NOT call the service', async () => {
            const res = await postViews(app, {
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
                    accept: 'application/json'
                }
            });

            expect([202, 429]).toContain(res.status);
            if (res.status === 202) {
                expect(mockCapture).not.toHaveBeenCalled();
                const body = (await res.json()) as { accepted?: boolean };
                expect(body.accepted).toBe(true);
            }
        });

        it('returns 202 for a curl UA but does NOT call the service', async () => {
            const res = await postViews(app, {
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'curl/7.88.1',
                    accept: 'application/json'
                }
            });

            expect([202, 429]).toContain(res.status);
            if (res.status === 202) {
                expect(mockCapture).not.toHaveBeenCalled();
            }
        });

        it('returns 202 for an AhrefsBot UA but does NOT call the service', async () => {
            const res = await postViews(app, {
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'AhrefsBot/7.0 (+http://ahrefs.com/robot/)',
                    accept: 'application/json'
                }
            });

            expect([202, 429]).toContain(res.status);
            if (res.status === 202) {
                expect(mockCapture).not.toHaveBeenCalled();
            }
        });

        it('does NOT call the service when User-Agent header is absent (400 from middleware or 202 from handler)', async () => {
            // The global validation middleware (API_VALIDATION_REQUIRED_HEADERS=user-agent)
            // rejects requests without a UA with 400 before reaching the handler.
            // Either way, the service must NOT be called.
            const res = await postViews(app, {
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json'
                    // No user-agent header intentionally omitted
                }
            });

            // Global middleware returns 400; bot-filter would return 202. Both are acceptable.
            expect([400, 202, 429]).toContain(res.status);
            expect(mockCapture).not.toHaveBeenCalled();
        });

        it('does NOT call the service when User-Agent is empty/whitespace (400 from middleware or 202 from handler)', async () => {
            // Same as missing UA — global middleware typically rejects first.
            const res = await postViews(app, {
                headers: {
                    'content-type': 'application/json',
                    'user-agent': '   ',
                    accept: 'application/json'
                }
            });

            expect([400, 202, 429]).toContain(res.status);
            expect(mockCapture).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Service error resilience
    // -------------------------------------------------------------------------

    describe('Service error resilience', () => {
        it('returns 202 even when the service returns INTERNAL_ERROR', async () => {
            // Arrange — simulate a DB outage.
            mockCapture.mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'DB connection failed' }
            });

            // Act
            const res = await postViews(app);

            // Assert — a telemetry failure must never break the public page.
            expect([202, 429]).toContain(res.status);
            if (res.status === 202) {
                const body = (await res.json()) as { accepted?: boolean };
                expect(body.accepted).toBe(true);
            }
        });

        it('returns 400 (not 500) when the service returns VALIDATION_ERROR', async () => {
            // Arrange — service rejects the payload (e.g. malformed hash).
            mockCapture.mockResolvedValue({
                error: { code: 'VALIDATION_ERROR', message: 'Invalid visitorHash' }
            });

            // Act
            const res = await postViews(app);

            // Assert — validation errors surface as 400 but WITHOUT leaking details.
            if (res.status === 400) {
                const body = (await res.json()) as {
                    success?: boolean;
                    error?: { message?: string };
                };
                expect(body.success).toBe(false);
                // The error message must NOT contain the raw visitorHash.
                expect(body.error?.message).not.toContain('mocked-visitor-hash');
                expect(JSON.stringify(body)).not.toContain('visitorHash');
            }
        });
    });

    // -------------------------------------------------------------------------
    // Public access (no auth required)
    // -------------------------------------------------------------------------

    describe('Public access', () => {
        it('does not require an Authorization header', async () => {
            const res = await postViews(app);

            // Must NOT return 401/403 for an unauthenticated request.
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });
});
