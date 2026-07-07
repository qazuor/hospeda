/**
 * @file sentry.client.config.test.ts
 * @description Regression test for the web Session Replay privacy hardening:
 * `Sentry.replayIntegration` must be configured with `maskAllText: true` and
 * `blockAllMedia: true` so replays never leak personal data (names,
 * addresses, booking details, photos) rendered in the DOM.
 *
 * `sentry.client.config.ts` runs its `Sentry.init()` call as a module-level
 * side effect gated by the crash-reporting consent cookie, so this test
 * stubs `PUBLIC_SENTRY_DSN`, mocks `getConsent` to opt in, mocks
 * `@sentry/astro`, and imports the module fresh to trigger `Sentry.init`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryInitMock = vi.fn();

vi.mock('@sentry/astro', () => ({
    init: (...args: unknown[]) => sentryInitMock(...args),
    browserTracingIntegration: vi.fn(() => ({ name: 'browserTracing' })),
    replayIntegration: vi.fn(() => ({ name: 'replay' }))
}));

vi.mock('@/lib/cookie-consent', () => ({
    getConsent: () => ({
        necessary: true,
        crashReporting: true,
        analytics: true,
        marketing: false,
        version: 2,
        decidedAt: '2026-01-01'
    })
}));

describe('web sentry.client.config', () => {
    beforeEach(() => {
        vi.resetModules();
        sentryInitMock.mockClear();
        vi.stubEnv('PUBLIC_SENTRY_DSN', 'https://key@o123.ingest.sentry.io/123');
    });

    it('enables Session Replay with text masking and media blocking', async () => {
        const Sentry = await import('@sentry/astro');
        await import('../sentry.client.config');

        expect(Sentry.replayIntegration).toHaveBeenCalledWith(
            expect.objectContaining({ maskAllText: true, blockAllMedia: true })
        );
        expect(sentryInitMock).toHaveBeenCalled();
    });
});
