/**
 * @file posthog-client.test.ts
 * @description Unit tests for the PostHog initialization wrapper (SPEC-140).
 *
 * Each test uses `vi.resetModules()` + a fresh `await import(...)` to get a
 * clean module-level `initialized` flag in posthog-client.ts. The
 * `posthog-js` default export is mocked end-to-end so no real network or
 * cookies are exercised.
 */

import type { ConsentState } from '@/lib/cookie-consent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface PosthogMockState {
    readonly init: ReturnType<typeof vi.fn>;
    readonly capture: ReturnType<typeof vi.fn>;
    readonly reset: ReturnType<typeof vi.fn>;
}

interface EnvMockState {
    key: string | undefined;
    host: string | undefined;
    dev: boolean;
}

const envState: EnvMockState = {
    key: 'phc_test',
    host: 'https://us.i.posthog.com',
    dev: false
};

const posthogMock: PosthogMockState = {
    init: vi.fn(),
    capture: vi.fn(),
    reset: vi.fn()
};

vi.mock('posthog-js', () => ({
    default: posthogMock
}));

vi.mock('@/lib/env', () => ({
    getPostHogKey: () => envState.key,
    getPostHogHost: () => envState.host,
    isDevelopment: () => envState.dev
}));

const acceptedConsent: ConsentState = {
    necessary: true,
    analytics: true,
    marketing: false,
    version: 1,
    decidedAt: '2026-05-17'
};

const declinedConsent: ConsentState = {
    necessary: true,
    analytics: false,
    marketing: false,
    version: 1,
    decidedAt: '2026-05-17'
};

beforeEach(() => {
    envState.key = 'phc_test';
    envState.host = 'https://us.i.posthog.com';
    envState.dev = false;
    posthogMock.init.mockReset();
    posthogMock.capture.mockReset();
    posthogMock.reset.mockReset();
    vi.resetModules();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('initPostHog — early returns', () => {
    it('should skip init when PUBLIC_POSTHOG_KEY is unset', async () => {
        // Arrange
        envState.key = undefined;
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: acceptedConsent });

        // Assert
        expect(posthogMock.init).not.toHaveBeenCalled();
    });

    it('should skip init when running in development mode', async () => {
        // Arrange
        envState.dev = true;
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: acceptedConsent });

        // Assert
        expect(posthogMock.init).not.toHaveBeenCalled();
    });

    it('should be idempotent — second init call with same module instance is a no-op', async () => {
        // Arrange
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: acceptedConsent });
        initPostHog({ consent: acceptedConsent });

        // Assert
        expect(posthogMock.init).toHaveBeenCalledTimes(1);
    });
});

describe('initPostHog — persistence mode by consent', () => {
    it('should init with localStorage+cookie when analytics consent is true', async () => {
        // Arrange
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: acceptedConsent });

        // Assert
        expect(posthogMock.init).toHaveBeenCalledTimes(1);
        const [token, config] = posthogMock.init.mock.calls[0] as [string, Record<string, unknown>];
        expect(token).toBe('phc_test');
        expect(config.persistence).toBe('localStorage+cookie');
    });

    it('should init with memory persistence when analytics consent is false', async () => {
        // Arrange
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: declinedConsent });

        // Assert
        const [, config] = posthogMock.init.mock.calls[0] as [string, Record<string, unknown>];
        expect(config.persistence).toBe('memory');
    });

    it('should init with memory persistence when no consent decision was recorded (null)', async () => {
        // Arrange
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: null });

        // Assert
        const [, config] = posthogMock.init.mock.calls[0] as [string, Record<string, unknown>];
        expect(config.persistence).toBe('memory');
    });
});

describe('initPostHog — SPEC-140 configuration defaults', () => {
    it('should configure SPEC-140 defaults on every init', async () => {
        // Arrange
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: acceptedConsent });

        // Assert
        const [, config] = posthogMock.init.mock.calls[0] as [string, Record<string, unknown>];
        expect(config.person_profiles).toBe('identified_only');
        expect(config.capture_pageview).toBe(true);
        expect(config.autocapture).toBe(true);
        expect(config.disable_session_recording).toBe(true);
        expect(config.disable_persistence).toBe(false);
        expect(config.respect_dnt).toBe(true);
    });

    it('should fall back to the documented US default when PUBLIC_POSTHOG_HOST is unset', async () => {
        // Arrange
        envState.host = undefined;
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: acceptedConsent });

        // Assert
        const [, config] = posthogMock.init.mock.calls[0] as [string, Record<string, unknown>];
        expect(config.api_host).toBe('https://us.i.posthog.com');
    });

    it('should pass the configured host when PUBLIC_POSTHOG_HOST is set (e.g. EU Cloud)', async () => {
        // Arrange
        envState.host = 'https://eu.i.posthog.com';
        const { initPostHog } = await import('@/lib/analytics/posthog-client');

        // Act
        initPostHog({ consent: acceptedConsent });

        // Assert
        const [, config] = posthogMock.init.mock.calls[0] as [string, Record<string, unknown>];
        expect(config.api_host).toBe('https://eu.i.posthog.com');
    });
});

describe('setConsent', () => {
    it('should reset PostHog and re-init with the new persistence mode', async () => {
        // Arrange
        const { initPostHog, setConsent } = await import('@/lib/analytics/posthog-client');
        initPostHog({ consent: acceptedConsent });
        posthogMock.init.mockClear();

        // Act
        setConsent(declinedConsent);

        // Assert
        expect(posthogMock.reset).toHaveBeenCalledTimes(1);
        expect(posthogMock.init).toHaveBeenCalledTimes(1);
        const [, config] = posthogMock.init.mock.calls[0] as [string, Record<string, unknown>];
        expect(config.persistence).toBe('memory');
    });

    it('should call init without reset when PostHog was never initialized', async () => {
        // Arrange
        envState.dev = true;
        const { setConsent } = await import('@/lib/analytics/posthog-client');

        // Act
        setConsent(acceptedConsent);

        // Assert
        expect(posthogMock.reset).not.toHaveBeenCalled();
        // init still skips because dev mode is true
        expect(posthogMock.init).not.toHaveBeenCalled();
    });
});

describe('trackEvent', () => {
    it('should no-op when PostHog has not been initialized', async () => {
        // Arrange
        envState.key = undefined;
        const { initPostHog, trackEvent } = await import('@/lib/analytics/posthog-client');
        initPostHog({ consent: acceptedConsent });

        // Act
        trackEvent('some_event', { foo: 'bar' });

        // Assert
        expect(posthogMock.capture).not.toHaveBeenCalled();
    });

    it('should call posthog.capture with name and props when initialized', async () => {
        // Arrange
        const { initPostHog, trackEvent } = await import('@/lib/analytics/posthog-client');
        initPostHog({ consent: acceptedConsent });

        // Act
        trackEvent('booking_initiated', { slug: 'mi-cabaña' });

        // Assert
        expect(posthogMock.capture).toHaveBeenCalledTimes(1);
        expect(posthogMock.capture).toHaveBeenCalledWith('booking_initiated', {
            slug: 'mi-cabaña'
        });
    });

    it('should call posthog.capture without props when none provided', async () => {
        // Arrange
        const { initPostHog, trackEvent } = await import('@/lib/analytics/posthog-client');
        initPostHog({ consent: acceptedConsent });

        // Act
        trackEvent('newsletter_subscribed');

        // Assert
        expect(posthogMock.capture).toHaveBeenCalledWith('newsletter_subscribed', undefined);
    });
});
