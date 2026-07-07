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
});
