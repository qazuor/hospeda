/**
 * @file umami-client-identify-order.test.ts
 * @description The web identify is sent only after THIS document's pageview
 * was acknowledged by Umami (HOS-2119, OQ-5 revised 2026-11-16, AC-12).
 *
 * Why: Umami 3.5.0 derives the session as `uuid(website, ip, ua, salt, id)`.
 * An identify that carries the tracker's `x-umami-cache` token claims the
 * anonymous fingerprint session (same session id, distinct id attached), which
 * is what lets a server event without a distinct id join it. An identify sent
 * before the pageview's answer has no token and opens a separate
 * `uuid(…, id)` session. The tracker stores the token from each answered
 * request and keeps it for the life of the document (also across
 * `pushState`), and its `send()` swallows errors, so "answered" is proven by
 * `getSession().cache`, not by the promise settling.
 *
 * These tests run the real pageview module against a tracker stub whose
 * `track()` settles only when the test answers it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { identifyUser, resetUser } from '@/lib/analytics/umami-client';
import { PAGEVIEW_ACK_TIMEOUT_MS } from '@/lib/analytics/umami-pageview';
import { saveConsent } from '@/lib/cookie-consent';
import {
    flushMicrotasks,
    loadPage,
    renderTrackerElement,
    STUB_CACHE_TOKEN,
    startPageviews,
    unloadPage
} from '../../helpers/umami-tracker-stub';

function grantConsent(): void {
    saveConsent({ crashReporting: false, analytics: true, marketing: false });
}

afterEach(() => {
    resetUser();
    unloadPage();
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'umami');
    document.cookie = 'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    window.sessionStorage.clear();
    vi.restoreAllMocks();
});

describe('identifyUser waits for the pageview acknowledgement (OQ-5, AC-12)', () => {
    it('should not send the identify while the pageview request is in flight', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('user-1');
        await flushMicrotasks();

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem('umami-identified-user')).toBeNull();
    });

    it('should send it right after Umami answers the pageview, with the cache token', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1', { is_host: true });

        // Act
        umami.respond();
        await flushMicrotasks();

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
        expect(umami.identify).toHaveBeenCalledWith('user-1', { is_host: true });
        expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
    });

    it('should wait for the ack when consent arrives while the pageview is in flight', async () => {
        // Arrange
        const umami = loadPage();
        identifyUser('user-1');
        grantConsent();
        expect(umami.identify).not.toHaveBeenCalled();

        // Act
        umami.respond();
        await flushMicrotasks();

        // Assert
        expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
    });

    it('should never identify when the pageview is not acknowledged within the bound', async () => {
        // Arrange
        vi.useFakeTimers();
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('user-1');
        vi.advanceTimersByTime(PAGEVIEW_ACK_TIMEOUT_MS);
        await flushMicrotasks();

        // Assert: gave up silently, nothing marked, no timer left
        expect(umami.identify).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem('umami-identified-user')).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('should never identify when the pageview failed (tracker holds no token)', async () => {
        // Arrange
        vi.useFakeTimers();
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1');

        // Act
        umami.respond({ ok: false });
        await flushMicrotasks();
        vi.advanceTimersByTime(PAGEVIEW_ACK_TIMEOUT_MS);

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should neither identify nor throw when the tracker is ad-blocked', async () => {
        // Arrange: the tracker element renders, `window.umami` never appears
        vi.useFakeTimers();
        grantConsent();
        renderTrackerElement();
        startPageviews();

        // Act / Assert
        expect(() => identifyUser('user-1')).not.toThrow();
        vi.advanceTimersByTime(PAGEVIEW_ACK_TIMEOUT_MS);
        expect(vi.getTimerCount()).toBe(0);
        expect(window.sessionStorage.getItem('umami-identified-user')).toBeNull();
    });

    it('should retry on the next call once a late pageview was acknowledged', async () => {
        // Arrange: the first wait gave up before Umami answered
        vi.useFakeTimers();
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1');
        vi.advanceTimersByTime(PAGEVIEW_ACK_TIMEOUT_MS);
        umami.respond();
        await flushMicrotasks();
        expect(umami.identify).not.toHaveBeenCalled();

        // Act: the next page's UserMenu mount
        identifyUser('user-1');

        // Assert
        expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
    });

    it('should drop a wait on revocation: no identify and no reload', async () => {
        // Arrange
        const reload = vi.fn();
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, reload }
        });
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1');

        // Act
        saveConsent({ crashReporting: false, analytics: false, marketing: false });
        umami.respond();
        await flushMicrotasks();

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });
});

describe('identifyUser across soft navigations and reloads', () => {
    function softNavigate(path: string): void {
        document.dispatchEvent(new Event('astro:before-swap'));
        window.history.pushState({}, '', path);
        document.dispatchEvent(new Event('astro:page-load'));
    }

    it('should never send a cache-less identify when the visitor navigates before the ack', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage({ clientRouter: true });
        identifyUser('user-1');

        // Act: soft navigation, UserMenu identifies again, then Umami answers both
        softNavigate('/es/destinos/');
        identifyUser('user-1');
        await flushMicrotasks();
        expect(umami.identify).not.toHaveBeenCalled();
        umami.respond();
        umami.respond();
        await flushMicrotasks();

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(2);
        expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
    });

    it('should identify at once on a later page of the same document (token kept across pushState)', async () => {
        // Arrange: the first page was acknowledged without consent
        const umami = loadPage({ clientRouter: true });
        umami.respond();
        await flushMicrotasks();
        softNavigate('/es/destinos/');

        // Act
        grantConsent();
        identifyUser('user-1');

        // Assert
        expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
    });

    it('should not re-identify after a full reload when the session marker matches', async () => {
        // Arrange: the previous document identified (sessionStorage survives the reload)
        window.sessionStorage.setItem(
            'umami-identified-user',
            JSON.stringify({ userId: 'user-1', properties: { is_host: true } })
        );
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('user-1', { is_host: true });
        umami.respond();
        await flushMicrotasks();

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should identify after the new document pageview when the properties changed', async () => {
        // Arrange
        window.sessionStorage.setItem(
            'umami-identified-user',
            JSON.stringify({ userId: 'user-1', properties: {} })
        );
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('user-1', { is_host: true });
        await flushMicrotasks();
        const beforeAck = umami.identify.mock.calls.length;
        umami.respond();
        await flushMicrotasks();

        // Assert
        expect(beforeAck).toBe(0);
        expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
    });
});
