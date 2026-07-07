/**
 * @file posthog-client.test.ts
 * @description Unit tests for the `trackEvent` wrapper (SPEC-140 — fix B).
 *
 * Initialisation lives entirely in `PostHogScript.astro` now, so this file
 * only covers the runtime contract of the wrapper:
 *  - SSR safe (no-op when `window` is undefined).
 *  - No-op when `window.posthog` is undefined (key unset / dev mode / SDK
 *    not yet stubbed).
 *  - Forwards `name` and `props` verbatim to `window.posthog.capture(...)`
 *    when the stub is present.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    associateGroup,
    identifyUser,
    resetUser,
    setPersonProperties,
    trackEvent
} from '@/lib/analytics/posthog-client';

/** Set (or clear, when `granted` is false) the analytics-consent cookie. */
function setAnalyticsConsent(granted: boolean): void {
    if (granted) {
        document.cookie = `cookie-consent=${encodeURIComponent(
            JSON.stringify({ analytics: true })
        )}; path=/`;
    } else {
        document.cookie = 'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
}

afterEach(() => {
    // Reset window.posthog between tests so cross-test state doesn't leak.
    (window as unknown as { posthog?: unknown }).posthog = undefined;
    // Clear any identity that a deferring test left pending (module singleton),
    // and drop the consent cookie, so tests stay order-independent.
    resetUser();
    setAnalyticsConsent(false);
    vi.restoreAllMocks();
});

describe('trackEvent (SPEC-140 — fix B)', () => {
    it('should no-op when window.posthog is undefined', () => {
        // Arrange — no posthog stub on window. Act / Assert (no throw).
        expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
    });

    it('should call window.posthog.capture(name, props) when stub is present', () => {
        // Arrange
        const captureSpy = vi.fn();
        (window as unknown as { posthog: { capture: typeof captureSpy } }).posthog = {
            capture: captureSpy
        };

        // Act
        trackEvent('accommodation_viewed', { slug: 'mi-cabaña' });

        // Assert
        expect(captureSpy).toHaveBeenCalledTimes(1);
        expect(captureSpy).toHaveBeenCalledWith('accommodation_viewed', {
            slug: 'mi-cabaña'
        });
    });

    it('should call window.posthog.capture without props when none provided', () => {
        // Arrange
        const captureSpy = vi.fn();
        (window as unknown as { posthog: { capture: typeof captureSpy } }).posthog = {
            capture: captureSpy
        };

        // Act
        trackEvent('newsletter_subscribed');

        // Assert
        expect(captureSpy).toHaveBeenCalledWith('newsletter_subscribed', undefined);
    });
});

describe('identifyUser (consent-gated)', () => {
    it('should no-op when window.posthog is undefined', () => {
        setAnalyticsConsent(true);
        expect(() => identifyUser('user-1')).not.toThrow();
    });

    it('should identify immediately when analytics consent is granted', () => {
        // Arrange
        setAnalyticsConsent(true);
        const identifySpy = vi.fn();
        (window as unknown as { posthog: { identify: typeof identifySpy } }).posthog = {
            identify: identifySpy
        };

        // Act
        identifyUser('user-1', { role: 'host' });

        // Assert
        expect(identifySpy).toHaveBeenCalledWith('user-1', { role: 'host' });
    });

    it('should pass props through as-is when consent is granted', () => {
        // Arrange
        setAnalyticsConsent(true);
        const identifySpy = vi.fn();
        (window as unknown as { posthog: { identify: typeof identifySpy } }).posthog = {
            identify: identifySpy
        };

        // Act
        identifyUser('user-2');

        // Assert
        expect(identifySpy).toHaveBeenCalledWith('user-2', undefined);
    });

    it('should NOT identify when analytics consent is absent (privacy gate)', () => {
        // Arrange — no consent cookie set.
        const identifySpy = vi.fn();
        (window as unknown as { posthog: { identify: typeof identifySpy } }).posthog = {
            identify: identifySpy
        };

        // Act
        identifyUser('user-3', { role: 'host' });

        // Assert
        expect(identifySpy).not.toHaveBeenCalled();
    });

    it('should replay the deferred identify once consent flips to true', () => {
        // Arrange — identify while consent is absent, so it defers.
        const identifySpy = vi.fn();
        (window as unknown as { posthog: { identify: typeof identifySpy } }).posthog = {
            identify: identifySpy
        };
        identifyUser('user-4', { role: 'host' });
        expect(identifySpy).not.toHaveBeenCalled();

        // Act — the visitor accepts analytics cookies.
        window.dispatchEvent(
            new CustomEvent('cookie-consent:changed', { detail: { analytics: true } })
        );

        // Assert
        expect(identifySpy).toHaveBeenCalledWith('user-4', { role: 'host' });
    });

    it('should NOT replay a deferred identify when consent change is not analytics', () => {
        // Arrange
        const identifySpy = vi.fn();
        (window as unknown as { posthog: { identify: typeof identifySpy } }).posthog = {
            identify: identifySpy
        };
        identifyUser('user-5');

        // Act — a consent change that does NOT grant analytics.
        window.dispatchEvent(
            new CustomEvent('cookie-consent:changed', { detail: { analytics: false } })
        );

        // Assert
        expect(identifySpy).not.toHaveBeenCalled();
    });
});

describe('setPersonProperties (consent-gated)', () => {
    it('sets properties immediately when analytics consent is granted', () => {
        setAnalyticsConsent(true);
        const setSpy = vi.fn();
        (window as unknown as { posthog: { setPersonProperties: typeof setSpy } }).posthog = {
            setPersonProperties: setSpy
        };

        setPersonProperties({ plan: 'host-pro', plan_status: 'active' });

        expect(setSpy).toHaveBeenCalledWith({ plan: 'host-pro', plan_status: 'active' });
    });

    it('does NOT set properties when consent is absent (privacy gate)', () => {
        const setSpy = vi.fn();
        (window as unknown as { posthog: { setPersonProperties: typeof setSpy } }).posthog = {
            setPersonProperties: setSpy
        };

        setPersonProperties({ plan: 'host-pro' });

        expect(setSpy).not.toHaveBeenCalled();
    });

    it('replays the deferred (merged) properties once consent flips to true', () => {
        const setSpy = vi.fn();
        (window as unknown as { posthog: { setPersonProperties: typeof setSpy } }).posthog = {
            setPersonProperties: setSpy
        };

        // Two pre-consent calls should merge into a single flushed payload.
        setPersonProperties({ plan: 'host-pro' });
        setPersonProperties({ plan_status: 'active' });
        expect(setSpy).not.toHaveBeenCalled();

        window.dispatchEvent(
            new CustomEvent('cookie-consent:changed', { detail: { analytics: true } })
        );

        expect(setSpy).toHaveBeenCalledWith({ plan: 'host-pro', plan_status: 'active' });
    });
});

describe('associateGroup (consent-gated)', () => {
    it('associates the group immediately when consent is granted', () => {
        setAnalyticsConsent(true);
        const groupSpy = vi.fn();
        (window as unknown as { posthog: { group: typeof groupSpy } }).posthog = {
            group: groupSpy
        };

        associateGroup('accommodation', 'acc-1');

        expect(groupSpy).toHaveBeenCalledWith('accommodation', 'acc-1');
    });

    it('does NOT associate when consent is absent (privacy gate)', () => {
        const groupSpy = vi.fn();
        (window as unknown as { posthog: { group: typeof groupSpy } }).posthog = {
            group: groupSpy
        };

        associateGroup('accommodation', 'acc-1');

        expect(groupSpy).not.toHaveBeenCalled();
    });

    it('replays the deferred association once consent flips to true', () => {
        const groupSpy = vi.fn();
        (window as unknown as { posthog: { group: typeof groupSpy } }).posthog = {
            group: groupSpy
        };

        associateGroup('accommodation', 'acc-1');
        expect(groupSpy).not.toHaveBeenCalled();

        window.dispatchEvent(
            new CustomEvent('cookie-consent:changed', { detail: { analytics: true } })
        );

        expect(groupSpy).toHaveBeenCalledWith('accommodation', 'acc-1');
    });
});

describe('resetUser', () => {
    it('should no-op when window.posthog is undefined', () => {
        expect(() => resetUser()).not.toThrow();
    });

    it('should call window.posthog.reset() when stub is present', () => {
        // Arrange
        const resetSpy = vi.fn();
        (window as unknown as { posthog: { reset: typeof resetSpy } }).posthog = {
            reset: resetSpy
        };

        // Act
        resetUser();

        // Assert
        expect(resetSpy).toHaveBeenCalledTimes(1);
    });
});
