/**
 * Tests for Cloudflare Turnstile server-side verification (SPEC-301).
 *
 * These tests exercise the fail-closed policy (R-2) implemented in
 * `apps/api/src/routes/feedback/public/submit.ts` (step 5c).
 *
 * Fail-closed matrix:
 *   (a) secret configured + valid token   → siteverify success:true   → 200 (submission accepted)
 *   (b) secret configured + token absent  → 403 FORBIDDEN
 *   (c) secret configured + invalid token → siteverify success:false   → 403 FORBIDDEN
 *   (d) secret configured + network error → siteverify throws          → 503 SERVICE_UNAVAILABLE
 *   (e) secret NOT configured             → fail-closed (no-op secret) → 403 FORBIDDEN
 *
 * Implementation notes:
 * - `getTurnstileSecret` is mocked so we can control "secret configured / not"
 *   without touching the real env module (which is initialized at module-load time).
 * - `verifyCfTurnstileToken` is mocked to prevent outbound network calls.
 * - Each `describe` block resets the mocks to the state needed for that scenario.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Set up env vars before any import chain reaches the env module.
vi.hoisted(() => {
    process.env.HOSPEDA_EMAIL_API_KEY =
        process.env.HOSPEDA_EMAIL_API_KEY ?? 'test-fallback-key-turnstile-suite';
});

import { initApp } from '../../../src/app.js';
import { clearRateLimitStore } from '../../../src/middlewares/rate-limit.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Hoisted mock references ──────────────────────────────────────────────────

const { mockGetTurnstileSecret, mockVerifyTurnstile, mockCreateIssue } = vi.hoisted(() => ({
    /** Controls whether `getTurnstileSecret()` returns a key or undefined */
    mockGetTurnstileSecret: vi.fn(),
    /** Controls `verifyCfTurnstileToken()` outcome (resolve or reject) */
    mockVerifyTurnstile: vi.fn(),
    mockCreateIssue: vi.fn()
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

/**
 * Mock the Turnstile utility — this is the key hook for all test scenarios.
 * Controlling `getTurnstileSecret` simulates "key configured" vs "key absent".
 * Controlling `verifyCfTurnstileToken` simulates different Cloudflare responses.
 */
vi.mock('../../../src/utils/turnstile.js', () => ({
    getTurnstileSecret: mockGetTurnstileSecret,
    verifyCfTurnstileToken: mockVerifyTurnstile
}));

vi.mock('../../../src/services/feedback/linear.service.js', () => ({
    LinearFeedbackService: vi.fn().mockImplementation(() => ({
        createIssue: mockCreateIssue
    }))
}));

vi.mock('../../../src/utils/notification-helper.js', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid feedback payload without a Turnstile token */
const BASE_DATA = {
    type: 'bug-js',
    title: 'Turnstile test issue',
    description: 'Testing Turnstile verification behaviour in the submit route.',
    reporterEmail: 'tester@example.com',
    reporterName: 'Turnstile Tester',
    environment: {
        timestamp: new Date().toISOString(),
        appSource: 'web'
    }
} as const;

/** Valid payload WITH Cloudflare dummy Turnstile token */
const DATA_WITH_TOKEN = {
    ...BASE_DATA,
    cfTurnstileToken: 'XXXX.DUMMY.TOKEN.XXXX'
} as const;

/** Linear issue result used by the mock when the happy path runs through */
const LINEAR_RESULT = {
    issueId: 'uuid-turnstile-test',
    issueUrl: 'https://linear.app/team/issue/TRN-1',
    issueIdentifier: 'TRN-1'
};

const TEST_HEADERS: Record<string, string> = {
    'user-agent': 'vitest-turnstile',
    accept: 'application/json'
};

const BASE_URL = '/api/v1/public/feedback';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFormData(data: unknown): FormData {
    const fd = new FormData();
    fd.append('data', JSON.stringify(data));
    return fd;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Turnstile fail-closed verification matrix (SPEC-301 R-2)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        app = initApp();
    });

    beforeEach(async () => {
        await clearRateLimitStore();
        // Reset to unconfigured/failing defaults; each describe block sets what it needs.
        mockGetTurnstileSecret.mockReset();
        mockVerifyTurnstile.mockReset();
        mockCreateIssue.mockReset();
    });

    // ── (a) Secret configured + valid token → submission accepted ─────────────

    describe('(a) secret configured + valid Turnstile token', () => {
        it('calls verifyCfTurnstileToken and returns 200 when siteverify succeeds', async () => {
            // Arrange
            mockGetTurnstileSecret.mockReturnValue('1x0000000000000000000000000000000AA');
            mockVerifyTurnstile.mockResolvedValue({ success: true });
            mockCreateIssue.mockResolvedValue(LINEAR_RESULT);

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: buildFormData(DATA_WITH_TOKEN),
                headers: TEST_HEADERS
            });

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            // Verify that the token was actually passed to the verifier
            expect(mockVerifyTurnstile).toHaveBeenCalledOnce();
            expect(mockVerifyTurnstile).toHaveBeenCalledWith(
                expect.objectContaining({ token: 'XXXX.DUMMY.TOKEN.XXXX' })
            );
        });
    });

    // ── (b) Secret configured + token absent → 403 ───────────────────────────

    describe('(b) secret configured + Turnstile token absent from payload', () => {
        it('returns 403 FORBIDDEN without calling verifyCfTurnstileToken', async () => {
            // Arrange: secret is set, but payload has no cfTurnstileToken
            mockGetTurnstileSecret.mockReturnValue('1x0000000000000000000000000000000AA');

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: buildFormData(BASE_DATA), // no cfTurnstileToken
                headers: TEST_HEADERS
            });

            // Assert
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('FORBIDDEN');
            // Verifier must NOT be called — token check short-circuits first
            expect(mockVerifyTurnstile).not.toHaveBeenCalled();
            // Linear must NOT be called — submission was rejected
            expect(mockCreateIssue).not.toHaveBeenCalled();
        });
    });

    // ── (c) Secret configured + invalid token → 403 ──────────────────────────

    describe('(c) secret configured + invalid Turnstile token (siteverify success:false)', () => {
        it('returns 403 FORBIDDEN when siteverify reports token as invalid', async () => {
            // Arrange: siteverify returns failure
            mockGetTurnstileSecret.mockReturnValue('1x0000000000000000000000000000000AA');
            mockVerifyTurnstile.mockResolvedValue({
                success: false,
                errorCode: 'invalid-input-response'
            });

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: buildFormData(DATA_WITH_TOKEN),
                headers: TEST_HEADERS
            });

            // Assert
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('FORBIDDEN');
            expect(mockVerifyTurnstile).toHaveBeenCalledOnce();
            // Submission must not proceed past the verification failure
            expect(mockCreateIssue).not.toHaveBeenCalled();
        });

        it('returns 403 when siteverify returns success:false with always-fail test key', async () => {
            // Arrange: use the Cloudflare always-fails test key
            mockGetTurnstileSecret.mockReturnValue('2x0000000000000000000000000000000AA');
            mockVerifyTurnstile.mockResolvedValue({
                success: false,
                errorCode: 'invalid-input-secret'
            });

            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: buildFormData(DATA_WITH_TOKEN),
                headers: TEST_HEADERS
            });

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('FORBIDDEN');
        });
    });

    // ── (d) Secret configured + network error → 503 (fail-closed) ────────────

    describe('(d) secret configured + siteverify network error or timeout', () => {
        it('returns 503 SERVICE_UNAVAILABLE when verifyCfTurnstileToken throws (fail-closed)', async () => {
            // Arrange: verification throws (simulates network error or AbortController timeout)
            mockGetTurnstileSecret.mockReturnValue('1x0000000000000000000000000000000AA');
            mockVerifyTurnstile.mockRejectedValue(
                new Error('fetch failed: AbortError — request timed out after 5000ms')
            );

            // Act
            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: buildFormData(DATA_WITH_TOKEN),
                headers: TEST_HEADERS
            });

            // Assert: fail-closed → reject with 503
            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
            // Submission must not proceed despite the network error
            expect(mockCreateIssue).not.toHaveBeenCalled();
        });

        it('returns 503 when verifyCfTurnstileToken throws a non-Error object', async () => {
            // Arrange: unusual throw (string, object) must still result in fail-closed
            mockGetTurnstileSecret.mockReturnValue('1x0000000000000000000000000000000AA');
            mockVerifyTurnstile.mockRejectedValue('connection refused');

            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: buildFormData(DATA_WITH_TOKEN),
                headers: TEST_HEADERS
            });

            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
        });
    });

    // ── (e) Secret NOT configured → 403 (fail-closed) ────────────────────────

    describe('(e) HOSPEDA_TURNSTILE_SECRET_KEY not configured', () => {
        it('returns 403 FORBIDDEN when the secret key is not set (fail-closed, R-2)', async () => {
            // Arrange: no secret key — environment is misconfigured
            mockGetTurnstileSecret.mockReturnValue(undefined);

            // Act: even with a valid token in the payload, must reject
            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: buildFormData(DATA_WITH_TOKEN),
                headers: TEST_HEADERS
            });

            // Assert: fail-closed → 403
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('FORBIDDEN');
            // Neither the verifier nor Linear should be called
            expect(mockVerifyTurnstile).not.toHaveBeenCalled();
            expect(mockCreateIssue).not.toHaveBeenCalled();
        });

        it('returns 403 even when payload has no token (fail-closed regardless of payload)', async () => {
            // Arrange: no secret key, no token — double misconfiguration
            mockGetTurnstileSecret.mockReturnValue(undefined);

            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: buildFormData(BASE_DATA), // no token
                headers: TEST_HEADERS
            });

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('FORBIDDEN');
            expect(mockVerifyTurnstile).not.toHaveBeenCalled();
        });
    });
});
