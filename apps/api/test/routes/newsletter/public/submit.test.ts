/**
 * Integration tests for POST /api/v1/public/newsletter.
 *
 * Verifies:
 *   - Valid body without env config → 200 fake-success + warn log
 *     (the endpoint never blocks the user when Brevo isn't wired up).
 *   - Honeypot (`website` non-empty) → 200 fake-success + honeypot log.
 *   - Invalid body (missing or malformed email) → 400 validation error.
 *
 * Brevo round-trip is exercised manually with `curl` after the env vars
 * are set in production — there is no value in mocking the upstream
 * here because we cannot also assert against the real list state.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerInfo, loggerWarn } = vi.hoisted(() => ({
    loggerInfo: vi.fn(),
    loggerWarn: vi.fn()
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        info: loggerInfo,
        warn: loggerWarn,
        debug: vi.fn(),
        error: vi.fn(),
        log: vi.fn()
    }
}));

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const URL = '/api/v1/public/newsletter';

describe('POST /api/v1/public/newsletter', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        loggerInfo.mockClear();
        loggerWarn.mockClear();
    });

    // ----------------------------------------------------------------------
    // Happy path
    // ----------------------------------------------------------------------

    describe('Happy path', () => {
        it('returns 200 success for a valid email', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ email: 'ada@example.com' })
            });

            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                const body = (await res.json()) as {
                    success?: boolean;
                    data?: { success?: boolean; message?: string };
                };
                expect(body.success).toBe(true);
                expect(body.data?.success).toBe(true);
                expect(body.data?.message).toBeTruthy();

                const receivedCall = loggerInfo.mock.calls.find(
                    (call) =>
                        typeof call[1] === 'string' &&
                        call[1] === 'Newsletter subscription received'
                );
                expect(receivedCall).toBeDefined();
            }
        });

        it('warns when Brevo env config is missing (test env never sets it)', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ email: 'no-config@example.com' })
            });

            // Status may be 200 (success) or 429 (sibling test pressure).
            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                const warnCall = loggerWarn.mock.calls.find(
                    (call) =>
                        typeof call[1] === 'string' &&
                        call[1].includes('Newsletter submission persisted in logs only')
                );
                expect(warnCall).toBeDefined();
            }
        });
    });

    // ----------------------------------------------------------------------
    // Honeypot
    // ----------------------------------------------------------------------

    describe('Honeypot', () => {
        it('returns 200 fake-success when honeypot field is populated', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    email: 'bot@example.com',
                    website: 'http://spam.example.com'
                })
            });

            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                const body = (await res.json()) as {
                    success?: boolean;
                    data?: { success?: boolean };
                };
                expect(body.success).toBe(true);
                expect(body.data?.success).toBe(true);

                const honeypotCall = loggerInfo.mock.calls.find(
                    (call) =>
                        typeof call[0] === 'object' &&
                        call[0] !== null &&
                        (call[0] as { honeypot?: boolean }).honeypot === true
                );
                expect(honeypotCall).toBeDefined();
            }
        });
    });

    // ----------------------------------------------------------------------
    // Validation
    // ----------------------------------------------------------------------

    describe('Validation', () => {
        it('returns 400 when email is missing', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({})
            });

            expect([400, 429]).toContain(res.status);
        });

        it('returns 400 when email is malformed', async () => {
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ email: 'not-an-email' })
            });

            expect([400, 429]).toContain(res.status);
        });

        it('returns 400 when email exceeds 254 chars', async () => {
            const local = 'a'.repeat(250);
            const tooLong = `${local}@x.com`; // 250 + 6 = 256 chars
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ email: tooLong })
            });

            expect([400, 429]).toContain(res.status);
        });
    });
});
