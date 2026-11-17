/**
 * @file umami-first-pageview-gate.test.ts
 * @description The first pageview of a document waits until the visitor's
 * identity is settled (HOS-2119, OQ-5 revised 2026-11-17, AC-12).
 *
 * Why: the identify must be the document's FIRST request, before the tracker
 * holds an `x-umami-cache` token, or it is skipped to avoid claiming the
 * anonymous fingerprint session. The first pageview fires on
 * `astro:page-load`, and the UserMenu island that identifies often hydrates
 * after it, so without the gate a logged-in visitor stayed anonymous in the
 * browser while their server events went to the per-user session.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { identifyUser, markVisitorAnonymous, resetUser } from '@/lib/analytics/umami-client';
import { FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS } from '@/lib/analytics/umami-identity-gate';
import { saveConsent } from '@/lib/cookie-consent';
import {
    flushMicrotasks,
    installUmamiTrackerStub,
    renderTrackerElement,
    startPageviews,
    type UmamiTrackerStub,
    unloadPage
} from '../../helpers/umami-tracker-stub';

function grantConsent(): void {
    saveConsent({ crashReporting: false, analytics: true, marketing: false });
}

/** Resolves the function form of the n-th `umami.track` call to its URL. */
function pageviewUrl(umami: UmamiTrackerStub, index: number): unknown {
    const builder = umami.track.mock.calls[index]?.[0] as
        | ((defaults: Record<string, unknown>) => Record<string, unknown>)
        | undefined;
    return builder?.({ website: 'site-id' }).url;
}

/** One ClientRouter soft navigation to `path`. */
function softNavigate(path: string): void {
    document.dispatchEvent(new Event('astro:before-swap'));
    window.history.pushState({}, '', path);
    document.dispatchEvent(new Event('astro:page-load'));
}

/** A BaseLayout document: ClientRouter, an auth-aware island, the tracker present. */
function loadBaseLayoutPage(): UmamiTrackerStub {
    renderTrackerElement({ clientRouter: true, awaitIdentity: true });
    const umami = installUmamiTrackerStub();
    startPageviews();
    document.dispatchEvent(new Event('astro:page-load'));
    return umami;
}

afterEach(() => {
    resetUser();
    unloadPage();
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'umami');
    document.cookie = 'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    vi.restoreAllMocks();
});

describe('first pageview of a logged-in visitor', () => {
    it('should identify (without a token) before the first pageview when the island hydrates late', async () => {
        // Arrange: the first page-load fires before the UserMenu island hydrated
        grantConsent();
        const umami = loadBaseLayoutPage();
        // Had a pageview gone out, Umami answers it now and the tracker holds a token.
        umami.respond();
        await flushMicrotasks();

        // Act: the island hydrates and identifies
        identifyUser('user-1');

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
        expect(umami.identifyCaches).toEqual([undefined]);
        expect(umami.track).toHaveBeenCalledTimes(1);
        const identifyOrder = umami.identify.mock.invocationCallOrder[0] ?? Number.NaN;
        const trackOrder = umami.track.mock.invocationCallOrder[0] ?? Number.NaN;
        expect(identifyOrder).toBeLessThan(trackOrder);
    });
});

describe('first pageview of an anonymous visitor', () => {
    it('should hold the pageview until the session resolves, then send it at once', () => {
        // Arrange
        grantConsent();
        const umami = loadBaseLayoutPage();
        expect(umami.track).not.toHaveBeenCalled();

        // Act: /auth/me answered "guest"
        markVisitorAnonymous();

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should send at once when the guest was declared before the first page-load', () => {
        // Arrange: the island hydrated and resolved first
        grantConsent();
        markVisitorAnonymous();

        // Act
        const umami = loadBaseLayoutPage();

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
    });
});

describe('first pageview when the identity never settles', () => {
    it('should send the pageview anonymously after the timeout', () => {
        // Arrange
        vi.useFakeTimers();
        grantConsent();
        const umami = loadBaseLayoutPage();

        // Act / Assert
        vi.advanceTimersByTime(FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS - 1);
        expect(umami.track).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS).toBe(3000);
    });

    it('should still skip a late identify once the timed-out pageview left a token', async () => {
        // Arrange
        vi.useFakeTimers();
        grantConsent();
        const umami = loadBaseLayoutPage();
        vi.advanceTimersByTime(FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS);
        umami.respond();
        await flushMicrotasks();

        // Act
        identifyUser('user-1');

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });
});

describe('later pageviews', () => {
    it('should not hold a navigation after the first pageview went out', () => {
        // Arrange
        grantConsent();
        const umami = loadBaseLayoutPage();
        identifyUser('user-1');

        // Act
        softNavigate('/es/alojamientos/');

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(2);
        expect(pageviewUrl(umami, 1)).toBe(`${window.location.origin}/es/alojamientos/`);
    });

    it('should queue a navigation made while the first pageview is held, keeping the order', () => {
        // Arrange
        grantConsent();
        window.history.replaceState({}, '', '/es/');
        const umami = loadBaseLayoutPage();
        softNavigate('/es/destinos/');
        expect(umami.track).not.toHaveBeenCalled();

        // Act
        identifyUser('user-1');

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(2);
        expect(pageviewUrl(umami, 0)).toBe(`${window.location.origin}/es/`);
        expect(pageviewUrl(umami, 1)).toBe(`${window.location.origin}/es/destinos/`);
        expect(umami.identify.mock.invocationCallOrder[0] ?? Number.NaN).toBeLessThan(
            umami.track.mock.invocationCallOrder[0] ?? Number.NaN
        );
    });
});

describe('pages and visitors that never wait', () => {
    it('should send at once without analytics consent, and identify nobody (AC-5)', () => {
        // Arrange: no consent cookie
        const umami = loadBaseLayoutPage();

        // Act
        identifyUser('user-1');

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should send at once on a page without an auth-aware island (StandaloneLayout)', () => {
        // Arrange
        grantConsent();
        renderTrackerElement();
        const umami = installUmamiTrackerStub();

        // Act
        startPageviews();

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
    });

    it('should release the pageview when the distinct id is rejected', () => {
        // Arrange
        grantConsent();
        const umami = loadBaseLayoutPage();

        // Act
        identifyUser('someone@example.com');

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should leave no timer behind once the pageview was released', () => {
        // Arrange
        vi.useFakeTimers();
        grantConsent();
        loadBaseLayoutPage();

        // Act
        markVisitorAnonymous();

        // Assert
        expect(vi.getTimerCount()).toBe(0);
    });
});
