/**
 * @file umami-client-identify-order.test.ts
 * @description The web identify opens a per-user Umami session and never
 * claims the anonymous fingerprint session (HOS-2119, OQ-5 revised 2026-11-17,
 * AC-12).
 *
 * Why: Umami 3.5.0 derives the session as `uuid(website, ip, ua, salt, id)`.
 * An identify that carries the tracker's `x-umami-cache` token claims the
 * anonymous fingerprint session, and every later visitor on the same device
 * keeps landing in it (account switch, shared device). So the identify is sent
 * as soon as consent and the tracker exist, WITHOUT waiting for the pageview's
 * answer, and is skipped (never delayed) when the tracker already holds a
 * token for another identity.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { identifyUser, resetUser, setPersonProperties } from '@/lib/analytics/umami-client';
import { saveConsent } from '@/lib/cookie-consent';
import {
    acknowledgedPage,
    flushMicrotasks,
    loadPage,
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

describe('identifyUser is not delayed by the pageview acknowledgement', () => {
    it('should identify while the pageview request is still in flight, without a token', () => {
        // Arrange
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('user-1', { is_host: true });

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
        expect(umami.identify).toHaveBeenCalledWith('user-1', { is_host: true });
        expect(umami.identifyCaches).toEqual([undefined]);
    });

    it('should identify as soon as consent arrives, without waiting for the pageview', () => {
        // Arrange
        const umami = loadPage();
        identifyUser('user-1');
        expect(umami.identify).not.toHaveBeenCalled();

        // Act
        grantConsent();

        // Assert
        expect(umami.identifyCaches).toEqual([undefined]);
    });

    it('should not identify before consent', () => {
        // Arrange
        const umami = loadPage();

        // Act
        identifyUser('user-1');

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should not send again for the same user and properties', () => {
        // Arrange
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1', { is_host: true });

        // Act
        identifyUser('user-1', { is_host: true });
        identifyUser('user-1');

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
    });

    it('should send again when the person properties change', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1');
        umami.respond();
        await flushMicrotasks();

        // Act
        setPersonProperties({ is_host: true });

        // Assert: the re-send is for the user this document already identified
        expect(umami.identify).toHaveBeenCalledTimes(2);
        expect(umami.identify).toHaveBeenLastCalledWith('user-1', { is_host: true });
    });

    it('should reject an email as distinct id', () => {
        // Arrange
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('someone@example.com');

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should identify again on a new document (nothing is persisted across reloads)', () => {
        // Arrange: a previous document identified, sessionStorage survives a reload
        window.sessionStorage.setItem(
            'umami-identified-user',
            JSON.stringify({ userId: 'user-1', properties: {} })
        );
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('user-1');

        // Assert: the tracker of this document knows nobody yet
        expect(umami.identify).toHaveBeenCalledTimes(1);
    });
});

describe('identifyUser never claims the anonymous session', () => {
    it('should skip the identify when the tracker already holds a cache token', async () => {
        // Arrange: the pageview was answered, an identify now would claim the fingerprint
        grantConsent();
        const umami = await acknowledgedPage();

        // Act
        identifyUser('user-1');
        await flushMicrotasks();

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should not identify a second user on a document that already holds a token', async () => {
        // Arrange: user-1 identified first (first request), Umami answered
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1');
        umami.respond();
        await flushMicrotasks();

        // Act: another account on the same document without a reload
        identifyUser('user-2');

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
    });

    it('should neither identify nor throw when the tracker is ad-blocked, and hold no timer', () => {
        // Arrange: the tracker never appears
        vi.useFakeTimers();
        grantConsent();

        // Act / Assert
        expect(() => identifyUser('user-1')).not.toThrow();
        vi.advanceTimersByTime(30_000);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('revocation and sign-out', () => {
    it('should send nothing after sign-out while waiting for the tracker', () => {
        // Arrange
        vi.useFakeTimers();
        grantConsent();
        identifyUser('user-1');

        // Act: sign-out, then the tracker appears
        resetUser();
        vi.advanceTimersByTime(30_000);

        // Assert
        expect(vi.getTimerCount()).toBe(0);
    });

    it('should reload on revocation once the document identified', () => {
        // Arrange
        const reload = vi.fn();
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, reload }
        });
        grantConsent();
        loadPage();
        identifyUser('user-1');

        // Act
        saveConsent({ crashReporting: false, analytics: false, marketing: false });

        // Assert
        expect(reload).toHaveBeenCalledTimes(1);
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });
});
