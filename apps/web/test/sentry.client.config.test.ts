/**
 * @file sentry.client.config.test.ts
 * @description Regression tests for the web Sentry client config:
 *
 * 1. Privacy: `Sentry.replayIntegration` must be configured with
 *    `maskAllText: true` and `blockAllMedia: true` so replays never leak
 *    personal data (names, addresses, booking details, photos) from the DOM.
 * 2. Performance (HOS-369): the SDK must NOT be imported or initialised during
 *    page parse. It is ~236 KB raw / ~78 KB over the wire and this module is
 *    emitted as a `<script type="module">` in every page head, so an eager load
 *    competes with the LCP image on a bandwidth-bound connection.
 * 3. Consent: no DSN or no crash-reporting consent means the SDK is never
 *    fetched at all.
 *
 * `sentry.client.config.ts` schedules its work as a module-level side effect, so
 * each test stubs `PUBLIC_SENTRY_DSN`, mocks `getConsent`, mocks `@sentry/astro`,
 * and imports the module fresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentryInitMock = vi.fn();
const consentMock = vi.fn();

vi.mock('@sentry/astro', () => ({
    init: (...args: unknown[]) => sentryInitMock(...args),
    captureException: vi.fn(),
    browserTracingIntegration: vi.fn(() => ({ name: 'browserTracing' })),
    replayIntegration: vi.fn(() => ({ name: 'replay' }))
}));

vi.mock('@/lib/cookie-consent', () => ({
    getConsent: () => consentMock()
}));

/** Idle callbacks registered by the config, so tests control when it loads. */
let idleCallbacks: Array<() => void> = [];

function grantedConsent() {
    return {
        necessary: true,
        crashReporting: true,
        analytics: true,
        marketing: false,
        version: 2,
        decidedAt: '2026-01-01'
    };
}

describe('web sentry.client.config', () => {
    beforeEach(() => {
        vi.resetModules();
        sentryInitMock.mockClear();
        consentMock.mockReset().mockReturnValue(grantedConsent());
        idleCallbacks = [];
        vi.stubEnv('PUBLIC_SENTRY_DSN', 'https://key@o123.ingest.sentry.io/123');
        Object.defineProperty(window, 'requestIdleCallback', {
            configurable: true,
            writable: true,
            value: (callback: () => void) => {
                idleCallbacks.push(callback);
                return idleCallbacks.length;
            }
        });
    });

    afterEach(() => {
        Reflect.deleteProperty(window, 'requestIdleCallback');
        vi.unstubAllEnvs();
    });

    it('does NOT import or initialise the SDK during page parse (HOS-369)', async () => {
        await import('../sentry.client.config');

        // Give any accidental synchronous/microtask init a chance to show up.
        await Promise.resolve();

        expect(
            sentryInitMock,
            'Sentry.init() must not run on import. The SDK load is scheduled after `load` + ' +
                'idle so its ~78 KB never competes with the LCP image.'
        ).not.toHaveBeenCalled();
        expect(
            idleCallbacks,
            'the config must schedule the SDK load through requestIdleCallback'
        ).toHaveLength(1);
    });

    it('enables Session Replay with text masking and media blocking once loaded', async () => {
        const Sentry = await import('@sentry/astro');
        await import('../sentry.client.config');

        idleCallbacks[0]?.();
        await vi.waitFor(() => expect(sentryInitMock).toHaveBeenCalled());

        expect(Sentry.replayIntegration).toHaveBeenCalledWith(
            expect.objectContaining({ maskAllText: true, blockAllMedia: true })
        );
    });

    it('does not schedule any SDK load without crash-reporting consent', async () => {
        consentMock.mockReturnValue({ ...grantedConsent(), crashReporting: false });

        await import('../sentry.client.config');
        await Promise.resolve();

        expect(
            idleCallbacks,
            'without crash-reporting consent the SDK must never be fetched — the whole point of ' +
                'the dynamic import is that the download, not just init(), is gated'
        ).toHaveLength(0);
        expect(sentryInitMock).not.toHaveBeenCalled();
    });

    it('does not schedule any SDK load without a DSN', async () => {
        vi.stubEnv('PUBLIC_SENTRY_DSN', '');

        await import('../sentry.client.config');
        await Promise.resolve();

        expect(idleCallbacks).toHaveLength(0);
        expect(sentryInitMock).not.toHaveBeenCalled();
    });
});
