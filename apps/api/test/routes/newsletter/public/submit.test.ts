/**
 * Integration tests for POST /api/v1/public/newsletter.
 *
 * Verifies:
 *   - Valid body without env config → 200 fake-success + warn log
 *     (the endpoint never blocks the user when Brevo isn't wired up).
 *   - Honeypot (`website` non-empty) → 200 fake-success + honeypot log.
 *   - Invalid body (missing or malformed email) → 400 validation error.
 *
 * The route is mounted on a slim `new Hono()` instance instead of going
 * through `initApp()` because `initApp()` eagerly loads every route file,
 * including `routes/user/protected/reviews.ts` which instantiates
 * `new AccommodationModel()` at module scope and crashes in unit-test
 * environments where the DB pool is not initialised. The newsletter submit
 * route is self-contained so mounting it directly is enough to exercise the
 * handler + middleware stack (rate-limit is stubbed out for determinism).
 *
 * Brevo round-trip is exercised manually with `curl` after the env vars
 * are set in production — there is no value in mocking the upstream
 * here because we cannot also assert against the real list state.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// Stub rate-limit so the per-route limiter doesn't carry state between
// runs (the real impl uses an in-memory map that would 429 the 4th request
// within the 60s window).
vi.mock('../../../../src/middlewares/rate-limit', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../../../../src/middlewares/rate-limit')>();
    return {
        ...original,
        createPerRouteRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

// Imports AFTER the mocks so the route module picks up the stubbed deps.
import { Hono } from 'hono';
import { submitNewsletterRoute } from '../../../../src/routes/newsletter/submit';

const URL = '/api/v1/public/newsletter';

function buildApp() {
    const app = new Hono();
    app.route('/api/v1/public', submitNewsletterRoute);
    return app;
}

describe('POST /api/v1/public/newsletter', () => {
    beforeEach(() => {
        loggerInfo.mockClear();
        loggerWarn.mockClear();
    });

    // ----------------------------------------------------------------------
    // Happy path
    // ----------------------------------------------------------------------

    describe('Happy path', () => {
        it('returns 200 success for a valid email', async () => {
            const app = buildApp();
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ email: 'ada@example.com' })
            });

            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                success?: boolean;
                data?: { success?: boolean; message?: string };
            };
            expect(body.success).toBe(true);
            expect(body.data?.success).toBe(true);
            expect(body.data?.message).toBeTruthy();

            const receivedCall = loggerInfo.mock.calls.find(
                (call) =>
                    typeof call[1] === 'string' && call[1] === 'Newsletter subscription received'
            );
            expect(receivedCall).toBeDefined();
        });

        it('warns when Brevo env config is missing (test env never sets it)', async () => {
            const app = buildApp();
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ email: 'no-config@example.com' })
            });

            expect(res.status).toBe(200);

            const warnCall = loggerWarn.mock.calls.find(
                (call) =>
                    typeof call[1] === 'string' &&
                    call[1].includes('Newsletter submission persisted in logs only')
            );
            expect(warnCall).toBeDefined();
        });
    });

    // ----------------------------------------------------------------------
    // Honeypot
    // ----------------------------------------------------------------------

    describe('Honeypot', () => {
        it('returns 200 fake-success when honeypot field is populated', async () => {
            const app = buildApp();
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

            expect(res.status).toBe(200);

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
        });
    });

    // ----------------------------------------------------------------------
    // Validation
    // ----------------------------------------------------------------------

    describe('Validation', () => {
        it('returns 400 when email is missing', async () => {
            const app = buildApp();
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({})
            });

            expect(res.status).toBe(400);
        });

        it('returns 400 when email is malformed', async () => {
            const app = buildApp();
            const res = await app.request(URL, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({ email: 'not-an-email' })
            });

            expect(res.status).toBe(400);
        });

        it('returns 400 when email exceeds 254 chars', async () => {
            const app = buildApp();
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

            expect(res.status).toBe(400);
        });
    });
});
