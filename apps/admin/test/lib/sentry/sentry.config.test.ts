/**
 * @file sentry.config.test.ts
 * @description Tests for the admin Sentry configuration, covering the
 * `setSentryUser` email-anonymization hardening (Sentry must never receive a
 * user's raw email address, only the domain part) and the Session Replay
 * privacy hardening (replay must mask all text and block all media).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentrySetUserMock = vi.fn();
const sentryInitMock = vi.fn();
const replayIntegrationMock = vi.fn((..._args: unknown[]) => ({ name: 'replay' }));

vi.mock('@sentry/react', () => ({
    init: (...args: unknown[]) => sentryInitMock(...args),
    setUser: (...args: unknown[]) => sentrySetUserMock(...args),
    setTag: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    browserTracingIntegration: vi.fn(() => ({ name: 'browserTracing' })),
    replayIntegration: (...args: unknown[]) => replayIntegrationMock(...args)
}));

vi.mock('@/env', () => ({
    env: {
        VITE_SENTRY_DSN: 'https://key@o123.ingest.sentry.io/123',
        VITE_SENTRY_ENVIRONMENT: 'test',
        VITE_SENTRY_RELEASE: 'test-release',
        VITE_SENTRY_PROJECT: 'hospeda-admin'
    }
}));

vi.mock('../../../src/utils/logger', () => ({
    adminLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('admin sentry.config', () => {
    // Each test re-imports sentry.config dynamically after vi.resetModules(),
    // which cold-resolves @sentry/react + @repo/utils on the first run. Under a
    // loaded CI shard that resolution can exceed the default 5s test timeout
    // (the assertions themselves are instant). Raise the budget so this is not
    // flaky when shard distribution puts this file on a heavily loaded worker.
    vi.setConfig({ testTimeout: 20_000 });

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        // Force the "should initialize" branch: shouldInitializeSentry() checks
        // `import.meta.env.DEV` directly, not the mocked @/env module.
        vi.stubEnv('DEV', false);
    });

    it('anonymizes the email (keeps domain only) before attaching the user to Sentry', async () => {
        const { initSentry, setSentryUser } = await import('../../../src/lib/sentry/sentry.config');

        initSentry();
        setSentryUser({ id: 'user-123', email: 'jane.doe@example.com', username: 'jane' });

        expect(sentrySetUserMock).toHaveBeenCalledWith({
            id: 'user-123',
            email: '***@example.com',
            username: 'jane'
        });
    });

    it('handles a malformed email (no domain) by falling back to a fixed mask', async () => {
        const { initSentry, setSentryUser } = await import('../../../src/lib/sentry/sentry.config');

        initSentry();
        setSentryUser({ id: 'user-123', email: 'not-an-email' });

        expect(sentrySetUserMock).toHaveBeenCalledWith({
            id: 'user-123',
            email: '***',
            username: undefined
        });
    });

    it('clears the Sentry user context when passed null', async () => {
        const { initSentry, setSentryUser } = await import('../../../src/lib/sentry/sentry.config');

        initSentry();
        setSentryUser(null);

        expect(sentrySetUserMock).toHaveBeenCalledWith(null);
    });

    it('is a no-op when Sentry has not been initialized', async () => {
        const { setSentryUser } = await import('../../../src/lib/sentry/sentry.config');

        // initSentry() was never called in this test, so isInitialized stays false.
        setSentryUser({ id: 'user-123', email: 'jane.doe@example.com' });

        expect(sentrySetUserMock).not.toHaveBeenCalled();
    });

    it('enables Session Replay with text masking and media blocking', async () => {
        const { initSentry } = await import('../../../src/lib/sentry/sentry.config');

        initSentry();

        expect(replayIntegrationMock).toHaveBeenCalledWith(
            expect.objectContaining({ maskAllText: true, blockAllMedia: true })
        );
    });

    describe('v11 privacy (HOS-1892)', () => {
        it('passes the pinned dataCollection policy and beforeSend to Sentry.init', async () => {
            const { initSentry, SENTRY_DATA_COLLECTION, applyBeforeSend } = await import(
                '../../../src/lib/sentry/sentry.config'
            );

            initSentry();

            const options = sentryInitMock.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(options.dataCollection).toBe(SENTRY_DATA_COLLECTION);
            expect(options.beforeSend).toBe(applyBeforeSend);
        });

        it('does not use the removed sendDefaultPii or profilesSampleRate options', async () => {
            const { initSentry } = await import('../../../src/lib/sentry/sentry.config');

            initSentry();

            const options = sentryInitMock.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(options).not.toHaveProperty('sendDefaultPii');
            expect(options).not.toHaveProperty('profilesSampleRate');
        });

        it('collects no cookies, bodies, user info or query params', async () => {
            const { SENTRY_DATA_COLLECTION } = await import(
                '../../../src/lib/sentry/sentry.config'
            );

            expect(SENTRY_DATA_COLLECTION.cookies).toBe(false);
            expect(SENTRY_DATA_COLLECTION.userInfo).toBe(false);
            expect(SENTRY_DATA_COLLECTION.httpBodies).toEqual([]);
            expect(SENTRY_DATA_COLLECTION.urlQueryParams).toEqual({ allow: [] });
        });

        it('denies auth and cookie headers in both directions', async () => {
            const { SENTRY_DATA_COLLECTION } = await import(
                '../../../src/lib/sentry/sentry.config'
            );
            const headers = SENTRY_DATA_COLLECTION.httpHeaders as {
                request: { deny: string[] };
                response: { deny: string[] };
            };

            for (const name of ['authorization', 'cookie', 'token', 'api-key']) {
                expect(headers.request.deny).toContain(name);
                expect(headers.response.deny).toContain(name);
            }
            expect(headers.response.deny).toContain('set-cookie');
        });

        it('strips query_string, url query and fragment in beforeSend', async () => {
            const { applyBeforeSend } = await import('../../../src/lib/sentry/sentry.config');
            const event = {
                request: {
                    url: 'https://admin.example.com/cb?code=abc&state=xyz#frag',
                    query_string: 'code=abc&state=xyz'
                }
            } as unknown as Parameters<typeof applyBeforeSend>[0];

            const result = applyBeforeSend(event);

            expect(result.request).toEqual({ url: 'https://admin.example.com/cb' });
        });

        it('removes sensitive headers in beforeSend', async () => {
            const { applyBeforeSend } = await import('../../../src/lib/sentry/sentry.config');
            const event = {
                request: {
                    headers: { Authorization: 'x', Cookie: 'y', 'X-Auth-Token': 'z', Accept: '*/*' }
                }
            } as unknown as Parameters<typeof applyBeforeSend>[0];

            const result = applyBeforeSend(event);

            expect(result.request?.headers).toEqual({ Accept: '*/*' });
        });
    });
});
