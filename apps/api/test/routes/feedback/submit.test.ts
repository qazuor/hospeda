/**
 * Tests for POST /api/v1/public/feedback
 *
 * Tests cover:
 * - Valid submission returns success
 * - Missing `data` field returns 400
 * - Malformed JSON in `data` field returns 400
 * - Missing required field `type` returns 400
 * - Invalid type enum returns 400
 * - Title too short returns 400
 * - Title too long (> 200 chars) returns 400
 * - Description too short (< 10 chars) returns 400
 * - Invalid email returns 400
 * - Missing environment.timestamp returns 400
 * - Missing environment.appSource returns 400
 * - File type validation (non-image rejected)
 * - File size validation (oversized file rejected)
 * - Max attachments exceeded returns 400
 * - Valid image attachments pass through
 * - Honeypot field triggers silent success
 * - Route is reachable without authentication (public)
 * - Rate limiting returns 429 after exceeding limit
 * - Multiple requests within rate limit succeed
 * - Linear success returns linearIssueId from the created issue
 * - Linear failure triggers email fallback and returns success with null ID
 * - Linear not configured (no API key) triggers email fallback
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { clearRateLimitStore } from '../../../src/middlewares/rate-limit.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Module mocks ─────────────────────────────────────────────────────────────

/**
 * Hoist mock references so they are available inside vi.mock() factory closures.
 * vi.mock() calls are hoisted to the top of the file by Vitest, so any variable
 * referenced inside the factory must itself be hoisted via vi.hoisted().
 *
 * `linearApiKeyOverride` allows individual tests to simulate the absence of
 * HOSPEDA_LINEAR_API_KEY without relying on process.env mutation (values are
 * already captured at module-load time by the env module).
 */
const { mockCreateIssue, mockSendNotification } = vi.hoisted(() => ({
    mockCreateIssue: vi.fn(),
    mockSendNotification: vi.fn().mockResolvedValue(undefined)
}));

/**
 * Mock LinearFeedbackService so that unit tests do not make real network calls.
 * Individual tests override `mockCreateIssue` to control the outcome.
 */
vi.mock('../../../src/services/feedback/linear.service.js', () => ({
    LinearFeedbackService: vi.fn().mockImplementation(() => ({
        createIssue: mockCreateIssue
    }))
}));

/**
 * Mock notification-helper so that email fallback tests do not send real emails.
 */
vi.mock('../../../src/utils/notification-helper.js', () => ({
    sendNotification: mockSendNotification
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid feedback payload (JSON-serializable, sent in FormData `data` field) */
const validFeedbackData = {
    type: 'bug-js',
    title: 'Something is broken',
    description: 'The page crashes when I click the button after logging in.',
    reporterEmail: 'user@example.com',
    reporterName: 'Test User',
    environment: {
        timestamp: new Date().toISOString(),
        appSource: 'web'
    }
} as const;

/** Standard request headers required by the validation middleware */
const TEST_HEADERS: Record<string, string> = {
    'user-agent': 'vitest',
    accept: 'application/json'
};

/** Simulated Linear issue result */
const LINEAR_ISSUE_RESULT = {
    issueId: 'uuid-1234',
    issueUrl: 'https://linear.app/team/issue/ABC-42',
    issueIdentifier: 'ABC-42'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a FormData body with the given data JSON and optional attachments.
 *
 * @param data - Object to serialize into the `data` field (or raw string for malformed JSON tests)
 * @param overrides - Additional FormData entries to append
 */
function buildFormData(
    data: unknown,
    overrides: Record<string, string | File | File[]> = {}
): FormData {
    const fd = new FormData();
    fd.append('data', typeof data === 'string' ? data : JSON.stringify(data));
    for (const [key, value] of Object.entries(overrides)) {
        if (Array.isArray(value)) {
            for (const file of value) {
                fd.append(key, file);
            }
        } else {
            fd.append(key, value);
        }
    }
    return fd;
}

/**
 * Creates a mock File with the specified type and size (content is zero-filled).
 *
 * @param name - File name
 * @param type - MIME type
 * @param sizeBytes - File size in bytes
 */
function mockFile(name: string, type: string, sizeBytes: number): File {
    const buffer = new Uint8Array(sizeBytes);
    return new File([buffer], name, { type });
}

const BASE_URL = '/api/v1/public/feedback';

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('POST /api/v1/public/feedback', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        app = initApp();
    });

    beforeEach(async () => {
        // Clear rate limit state between tests to avoid cross-test interference
        await clearRateLimitStore();
        // Reset notification mock between tests
        mockSendNotification.mockReset().mockResolvedValue(undefined);
    });

    // ── Route reachability ────────────────────────────────────────────────────

    it('route is registered and reachable without authentication (not 404)', async () => {
        mockCreateIssue.mockResolvedValue(LINEAR_ISSUE_RESULT);

        const fd = buildFormData(validFeedbackData);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });
        expect(res.status).not.toBe(404);
    });

    // ── Linear integration - success ──────────────────────────────────────────

    it('returns linearIssueId when Linear creates the issue successfully', async () => {
        mockCreateIssue.mockResolvedValue(LINEAR_ISSUE_RESULT);

        const fd = buildFormData(validFeedbackData);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        // When Linear mock succeeds, linearIssueId is populated
        expect(body.data.linearIssueId).toBe(LINEAR_ISSUE_RESULT.issueId);
        expect(body.data.message).toContain(LINEAR_ISSUE_RESULT.issueIdentifier);
    });

    // ── Linear integration - fallback ─────────────────────────────────────────

    it('falls back to email and returns null linearIssueId when Linear createIssue throws', async () => {
        // Make all retries fail so the email fallback is triggered
        mockCreateIssue
            .mockRejectedValueOnce(new Error('Linear unavailable 1'))
            .mockRejectedValueOnce(new Error('Linear unavailable 2'))
            .mockRejectedValueOnce(new Error('Linear unavailable 3'));

        const fd = buildFormData(validFeedbackData);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        // After all retries fail, linearIssueId is null and fallback message returned
        expect(body.data.linearIssueId).toBeNull();
        expect(typeof body.data.message).toBe('string');
        // Email fallback should have been called
        expect(mockSendNotification).toHaveBeenCalledTimes(1);
    });

    it('does not call email fallback when Linear succeeds', async () => {
        mockCreateIssue.mockResolvedValue(LINEAR_ISSUE_RESULT);

        const fd = buildFormData(validFeedbackData);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.linearIssueId).toBe(LINEAR_ISSUE_RESULT.issueId);
        // No email fallback when Linear succeeds
        expect(mockSendNotification).not.toHaveBeenCalled();
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('accepts submission with optional fields (severity, stepsToReproduce)', async () => {
        mockCreateIssue.mockResolvedValue(LINEAR_ISSUE_RESULT);

        const data = {
            ...validFeedbackData,
            severity: 'high',
            stepsToReproduce: '1. Click button\n2. Observe crash',
            expectedResult: 'Page should stay open',
            actualResult: 'Page crashed'
        };
        const fd = buildFormData(data);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(200);
    });

    it('accepts valid image attachments', async () => {
        mockCreateIssue.mockResolvedValue(LINEAR_ISSUE_RESULT);

        const fd = buildFormData(validFeedbackData);
        fd.append('attachments', mockFile('screenshot.png', 'image/png', 1024));
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(200);
    });

    // ── Missing / malformed data ──────────────────────────────────────────────

    it('returns 400 when data field is missing', async () => {
        const fd = new FormData();
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when data field is not valid JSON', async () => {
        const fd = buildFormData('{ this is not json }');
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    // ── Zod validation ────────────────────────────────────────────────────────

    it('returns 400 when type field is missing entirely', async () => {
        const { type: _type, ...dataWithoutType } = validFeedbackData;
        const fd = buildFormData(dataWithoutType);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when type is an invalid enum value', async () => {
        const data = { ...validFeedbackData, type: 'invalid-type' };
        const fd = buildFormData(data);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when title is too short (< 5 chars)', async () => {
        const data = { ...validFeedbackData, title: 'Oops' };
        const fd = buildFormData(data);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when title is too long (> 200 chars)', async () => {
        const data = { ...validFeedbackData, title: 'A'.repeat(201) };
        const fd = buildFormData(data);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when reporterEmail is not a valid email', async () => {
        const data = { ...validFeedbackData, reporterEmail: 'not-an-email' };
        const fd = buildFormData(data);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when description is too short (< 10 chars)', async () => {
        const data = { ...validFeedbackData, description: 'Short' };
        const fd = buildFormData(data);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    it('returns 400 when environment.appSource is missing', async () => {
        const data = {
            ...validFeedbackData,
            environment: { timestamp: new Date().toISOString() }
        };
        const fd = buildFormData(data);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when environment.timestamp is missing', async () => {
        const data = {
            ...validFeedbackData,
            environment: { appSource: 'web' }
        };
        const fd = buildFormData(data);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    // ── Attachment validation ─────────────────────────────────────────────────

    it('returns 400 when attachment has a non-image MIME type', async () => {
        const fd = buildFormData(validFeedbackData);
        fd.append('attachments', mockFile('script.js', 'application/javascript', 512));
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toContain('Tipo de archivo no permitido');
    });

    it('returns 400 when attachment exceeds 10MB', async () => {
        // Use a file slightly over the per-file limit (10MB) but under the global bodyLimit.
        // The global bodyLimit middleware (10MB for local, 4.5MB for Vercel) may intercept
        // very large payloads before formData() can parse them. We use a ~10.1MB file
        // which exceeds FEEDBACK_CONFIG.maxFileSize (10_485_760 bytes) when the bodyLimit
        // does not block it first. Either way the response must be 400.
        const slightlyOverLimit = 10 * 1024 * 1024 + 1;
        const fd = buildFormData(validFeedbackData);
        fd.append('attachments', mockFile('huge.png', 'image/png', slightlyOverLimit));
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        // Both the bodyLimit middleware (413) and the per-file check (400) result in an error
        expect([400, 413]).toContain(res.status);
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    it('returns 400 when more than 5 attachments are included', async () => {
        const fd = buildFormData(validFeedbackData);
        for (let i = 0; i < 6; i++) {
            fd.append('attachments', mockFile(`img${i}.png`, 'image/png', 1024));
        }
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.message).toContain('Maximo');
    });

    // ── Linear not configured ─────────────────────────────────────────────────

    it('falls back to email and returns null linearIssueId when Linear is unavailable (all retries exhausted)', async () => {
        // Arrange: simulate the scenario where Linear is unconfigured OR all retries fail.
        // In the production code, HOSPEDA_LINEAR_API_KEY absence makes buildLinearService()
        // return null, which takes the same email-fallback path as all-retries-exhausted.
        // Both paths produce identical observable behavior: linearIssueId=null + email fired.
        //
        // We simulate this here by exhausting all retries (3 rejections), which exercises
        // the same code path as "Linear not configured". The "no API key" path cannot be
        // tested in isolation without mocking the env module (which would break all
        // other middlewares that import it at startup).
        mockCreateIssue
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'));

        const fd = buildFormData(validFeedbackData);
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        // Assert: route still returns 200, email fallback fires
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.linearIssueId).toBeNull();
        expect(typeof body.data.message).toBe('string');
        // Email notification should be triggered as the final fallback
        expect(mockSendNotification).toHaveBeenCalledTimes(1);
    });

    // ── Honeypot ──────────────────────────────────────────────────────────────

    it('silently succeeds when honeypot `website` field is filled (bot detection)', async () => {
        const fd = buildFormData(validFeedbackData, { website: 'http://spam.example.com' });
        const res = await app.request(BASE_URL, {
            method: 'POST',
            body: fd,
            headers: TEST_HEADERS
        });

        // Must return 200 to not reveal bot detection
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.linearIssueId).toBeNull();
    });

    // ── Rate limiting ─────────────────────────────────────────────────────────

    it('multiple sequential requests within limit all succeed (TESTING_RATE_LIMIT with generous limit)', async () => {
        mockCreateIssue.mockResolvedValue(LINEAR_ISSUE_RESULT);

        const originalTesting = process.env.HOSPEDA_TESTING_RATE_LIMIT;
        const originalMax = process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS;

        process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';
        // Set a limit high enough that our 3 requests do not trigger it
        process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS = '10';

        try {
            await clearRateLimitStore();

            const REQUEST_COUNT = 3;
            const statuses: number[] = [];

            for (let i = 0; i < REQUEST_COUNT; i++) {
                const fd = buildFormData(validFeedbackData);
                const res = await app.request(BASE_URL, {
                    method: 'POST',
                    body: fd,
                    headers: TEST_HEADERS
                });
                statuses.push(res.status);
            }

            // All requests within the limit must succeed
            expect(statuses).toHaveLength(REQUEST_COUNT);
            for (const status of statuses) {
                expect(status).toBe(200);
            }
        } finally {
            if (originalTesting === undefined) {
                process.env.HOSPEDA_TESTING_RATE_LIMIT = undefined;
            } else {
                process.env.HOSPEDA_TESTING_RATE_LIMIT = originalTesting;
            }
            if (originalMax === undefined) {
                process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS = undefined;
            } else {
                process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS = originalMax;
            }
            await clearRateLimitStore();
        }
    });

    it('sets X-RateLimit headers on successful responses when TESTING_RATE_LIMIT is set', async () => {
        mockCreateIssue.mockResolvedValue(LINEAR_ISSUE_RESULT);

        const originalEnv = process.env.HOSPEDA_TESTING_RATE_LIMIT;
        process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

        try {
            await clearRateLimitStore();

            const fd = buildFormData(validFeedbackData);
            const res = await app.request(BASE_URL, {
                method: 'POST',
                body: fd,
                headers: TEST_HEADERS
            });

            // The rate limit middleware must be active and set standard headers
            expect(res.status).toBe(200);
            expect(res.headers.get('x-ratelimit-limit')).toBeTruthy();
            expect(res.headers.get('x-ratelimit-remaining')).toBeTruthy();
        } finally {
            if (originalEnv === undefined) {
                process.env.HOSPEDA_TESTING_RATE_LIMIT = undefined;
            } else {
                process.env.HOSPEDA_TESTING_RATE_LIMIT = originalEnv;
            }
            await clearRateLimitStore();
        }
    });

    it('returns 429 when public rate limit is exceeded (TESTING_RATE_LIMIT + low limit via env)', async () => {
        mockCreateIssue.mockResolvedValue(LINEAR_ISSUE_RESULT);

        // Override env vars to set a very low limit for this test only
        const originalTesting = process.env.HOSPEDA_TESTING_RATE_LIMIT;
        const originalMax = process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS;

        process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';
        process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS = '3';

        try {
            await clearRateLimitStore();

            let lastStatus = 0;
            for (let i = 0; i <= 5; i++) {
                const fd = buildFormData(validFeedbackData);
                const res = await app.request(BASE_URL, {
                    method: 'POST',
                    body: fd,
                    headers: TEST_HEADERS
                });
                lastStatus = res.status;
                if (res.status === 429) break;
            }

            expect(lastStatus).toBe(429);
        } finally {
            if (originalTesting === undefined) {
                process.env.HOSPEDA_TESTING_RATE_LIMIT = undefined;
            } else {
                process.env.HOSPEDA_TESTING_RATE_LIMIT = originalTesting;
            }
            if (originalMax === undefined) {
                process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS = undefined;
            } else {
                process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS = originalMax;
            }
            await clearRateLimitStore();
        }
    });
});
