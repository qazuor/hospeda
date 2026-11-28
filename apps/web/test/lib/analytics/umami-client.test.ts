/**
 * @file umami-client.test.ts
 * @description Unit tests for the web Umami client (HOS-2119, T-027, AC-5).
 * Covers cookieless pre-consent tracking, consent-gated identify (sent once
 * per session unless the person properties change), the pending identity
 * while the deferred tracker is missing (M4), consent revocation (M6), OQ-5
 * (no email distinct id; identify only after this document's pageview was
 * acknowledged by Umami), anti-PII keys and the validated tagged capture.
 *
 * Identify tests run the REAL pageview module against a tracker stub whose
 * `track()` settles only when the test answers it (`respond`), so the
 * pageview-then-identify order is exercised as the browser runs it.
 */

import type { AnalyticsEventProperties } from '@repo/analytics';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    identifyUser,
    resetUser,
    setPersonProperties,
    trackEvent,
    trackTaggedEvent
} from '@/lib/analytics/umami-client';
import { CONSENT_CHANGED_EVENT, saveConsent } from '@/lib/cookie-consent';
import {
    flushMicrotasks,
    installUmamiTrackerStub,
    loadPage,
    renderTrackerElement,
    startPageviews,
    unloadPage
} from '../../helpers/umami-tracker-stub';

interface UmamiStub {
    track: ReturnType<typeof vi.fn>;
    identify: ReturnType<typeof vi.fn>;
}

const GLOBALS = { app: 'web', app_version: 'unknown', environment: 'development' } as const;
const ENTITY_ID = '3f2b8c1e-5d4a-4c7b-9e1f-0a1b2c3d4e5f';

function installUmami(): UmamiStub {
    const stub: UmamiStub = { track: vi.fn(), identify: vi.fn() };
    (window as unknown as { umami?: UmamiStub }).umami = stub;
    return stub;
}

function grantConsent(): void {
    saveConsent({ crashReporting: false, analytics: true, marketing: false });
}

function clearConsentCookie(): void {
    document.cookie = 'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

afterEach(() => {
    resetUser();
    unloadPage();
    vi.useRealTimers();
    (window as unknown as { umami?: unknown }).umami = undefined;
    clearConsentCookie();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
});

describe('trackEvent', () => {
    it('should not throw when the tracker is absent', () => {
        // Arrange: no window.umami
        // Act / Assert
        expect(() =>
            trackEvent('search_performed', { search_type: 'accommodation' })
        ).not.toThrow();
    });

    it('should drop an event fired before consent (HOS-2681)', () => {
        // Arrange
        const umami = installUmami();

        // Act
        trackEvent('search_performed', { search_type: 'accommodation' });

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('should not flush a pre-consent event once consent is granted', () => {
        // Arrange
        const umami = installUmami();
        trackEvent('search_performed', { search_type: 'accommodation' });

        // Act
        grantConsent();

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('should stop sending after consent is revoked', () => {
        // Arrange
        const umami = installUmami();
        grantConsent();
        trackEvent('search_performed', { search_type: 'accommodation' });
        expect(umami.track).toHaveBeenCalledTimes(1);

        // Act
        saveConsent({ crashReporting: false, analytics: false, marketing: false });
        trackEvent('search_performed', { search_type: 'accommodation' });

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
    });

    it('should forward a validated event once analytics consent is granted', () => {
        // Arrange
        const umami = installUmami();
        grantConsent();

        // Act
        trackEvent('search_performed', { search_type: 'accommodation' });

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(umami.track).toHaveBeenCalledWith('search_performed', {
            ...GLOBALS,
            search_type: 'accommodation'
        });
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should drop an event with a forbidden property key', () => {
        // Arrange
        const umami = installUmami();
        const props = {
            search_type: 'accommodation',
            email: 'a@b.com'
        } as unknown as AnalyticsEventProperties<'search_performed'>;

        // Act
        expect(() => trackEvent('search_performed', props)).not.toThrow();

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
    });
});

describe('identifyUser (consent-gated, once per document)', () => {
    it('should never identify before consent', async () => {
        // Arrange
        const umami = loadPage();

        // Act
        identifyUser('user-1');
        trackEvent('search_performed', { search_type: 'accommodation' });

        // Assert: nothing at all before consent
        expect(umami.identify).not.toHaveBeenCalled();
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('should identify once with the user id after CONSENT_CHANGED_EVENT', async () => {
        // Arrange
        const umami = loadPage();
        identifyUser('user-1');

        // Act
        grantConsent();

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
        expect(umami.identify).toHaveBeenCalledWith('user-1');
        expect(umami.identifyCaches).toEqual([undefined]);
    });

    it('should not re-identify on repeated consent events', async () => {
        // Arrange
        const umami = loadPage();
        identifyUser('user-1');
        grantConsent();

        // Act
        window.dispatchEvent(
            new CustomEvent(CONSENT_CHANGED_EVENT, { detail: { analytics: true } })
        );
        grantConsent();

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
    });

    it('should not identify when consent changes to analytics=false', async () => {
        // Arrange
        const umami = loadPage();
        identifyUser('user-1');

        // Act
        saveConsent({ crashReporting: true, analytics: false, marketing: false });

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should identify only once per session when called repeatedly with consent', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('user-1');
        identifyUser('user-1');
        identifyUser('user-1');

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
    });

    it('should identify again after resetUser (sign-out then sign-in)', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1');

        // Act
        resetUser();
        identifyUser('user-1');

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(2);
    });

    it('should never identify a user dropped by resetUser while pending consent', async () => {
        // Arrange
        const umami = loadPage();
        identifyUser('user-1');
        resetUser();

        // Act
        grantConsent();

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should reject an email as distinct id', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('someone@example.com');

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should reject a forbidden distinct id value', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();

        // Act
        identifyUser('anonymous');

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should fold person properties into the identify data', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();
        setPersonProperties({ locale: 'es' });

        // Act
        identifyUser('user-1', { role: 'host' });

        // Assert
        expect(umami.identify).toHaveBeenCalledWith('user-1', { locale: 'es', role: 'host' });
    });

    it('should not throw when the tracker is absent', () => {
        // Arrange
        grantConsent();

        // Act / Assert
        expect(() => identifyUser('user-1')).not.toThrow();
    });
});

describe('identifyUser before the deferred tracker exists (M4)', () => {
    it('should keep the identity pending and send it as soon as the late tracker appears', async () => {
        // Arrange
        vi.useFakeTimers();
        grantConsent();
        renderTrackerElement();
        startPageviews();

        // Act: no window.umami yet
        identifyUser('user-1');
        vi.advanceTimersByTime(1000);
        const umami = installUmamiTrackerStub();
        vi.advanceTimersByTime(250);
        await flushMicrotasks();

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
        expect(umami.identify).toHaveBeenCalledWith('user-1');
        expect(umami.identifyCaches).toEqual([undefined]);
    });

    it('should not mark the document identified while the tracker is missing', () => {
        // Arrange
        vi.useFakeTimers();
        grantConsent();
        identifyUser('user-1');

        // Act: the tracker shows up later and the same call is repeated
        const umami = installUmamiTrackerStub();
        identifyUser('user-1');
        vi.advanceTimersByTime(250);

        // Assert: exactly one identify, none lost to a marker of a send that never ran
        expect(umami.identify).toHaveBeenCalledTimes(1);
    });
});

describe('identifyUser when person properties change (M4)', () => {
    it('should send the enriched properties of a second call for the same id', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();

        // Act: UserMenu calls with the id alone, then with the props
        identifyUser('user-1');
        identifyUser('user-1', { is_host: true, user_type: 'host' });

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(2);
        expect(umami.identify).toHaveBeenLastCalledWith('user-1', {
            is_host: true,
            user_type: 'host'
        });
    });

    it('should not re-send when the properties did not change', async () => {
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

    it('should re-send for a changed property from setPersonProperties', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();
        identifyUser('user-1', { locale: 'es' });

        // Act
        setPersonProperties({ locale: 'es' });
        setPersonProperties({ locale: 'en' });

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(2);
        expect(umami.identify).toHaveBeenLastCalledWith('user-1', { locale: 'en' });
    });
});

describe('consent revocation after an identify (M6)', () => {
    const originalLocation = window.location;

    function stubReload(): ReturnType<typeof vi.fn> {
        const reload = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, reload }
        });
        return reload;
    }

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it('should forget the identity and reload when this page sent it', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();
        const reload = stubReload();
        identifyUser('user-1', { is_host: true });

        // Act
        saveConsent({ crashReporting: false, analytics: false, marketing: false });

        // Assert
        expect(reload).toHaveBeenCalledTimes(1);
        expect(umami.identify).toHaveBeenCalledTimes(1);
    });

    it('should identify from scratch when consent is granted again', async () => {
        // Arrange
        grantConsent();
        const umami = loadPage();
        stubReload();
        identifyUser('user-1');
        saveConsent({ crashReporting: false, analytics: false, marketing: false });

        // Act
        grantConsent();
        identifyUser('user-1');

        // Assert: the marker was cleared, so the id is sent again (the stub token is reset by a fresh page)
        expect(umami.identify).toHaveBeenCalledTimes(2);
    });

    it('should drop a pending identity and not reload when nothing was sent', async () => {
        // Arrange
        const umami = loadPage();
        const reload = stubReload();
        identifyUser('user-1');

        // Act: reject, then accept later in the same page
        saveConsent({ crashReporting: false, analytics: false, marketing: false });
        grantConsent();

        // Assert
        expect(reload).not.toHaveBeenCalled();
        expect(umami.identify).not.toHaveBeenCalled();
    });
});

describe('trackTaggedEvent', () => {
    it('should validate, then forward name, data and tag through the function form', () => {
        // Arrange
        const umami = installUmami();
        grantConsent();

        // Act
        trackTaggedEvent({
            name: 'listing_internal_entry',
            properties: { entity_id: ENTITY_ID, entity_type: 'ACCOMMODATION' },
            tag: ENTITY_ID
        });

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
        const builder = umami.track.mock.calls[0]?.[0] as (
            defaults: Record<string, unknown>
        ) => Record<string, unknown>;
        expect(builder({ website: 'w-1', url: '/x' })).toEqual({
            website: 'w-1',
            url: '/x',
            name: 'listing_internal_entry',
            data: { ...GLOBALS, entity_id: ENTITY_ID, entity_type: 'ACCOMMODATION' },
            tag: ENTITY_ID
        });
    });

    it('should reject an invalid payload (non-uuid entity id)', () => {
        // Arrange
        const umami = installUmami();

        // Act
        trackTaggedEvent({
            name: 'listing_internal_entry',
            properties: { entity_id: 'not-a-uuid', entity_type: 'ACCOMMODATION' },
            tag: 'x'
        });

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('should reject an unknown event name', () => {
        // Arrange
        const umami = installUmami();

        // Act
        trackTaggedEvent({
            name: 'not_in_catalog' as unknown as 'listing_internal_entry',
            properties: { entity_id: ENTITY_ID, entity_type: 'ACCOMMODATION' },
            tag: ENTITY_ID
        });

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('should reject an empty tag', () => {
        // Arrange
        const umami = installUmami();

        // Act
        trackTaggedEvent({
            name: 'listing_internal_entry',
            properties: { entity_id: ENTITY_ID, entity_type: 'ACCOMMODATION' },
            tag: '  '
        });

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('should not throw when the tracker is absent', () => {
        // Arrange: no window.umami
        // Act / Assert
        expect(() =>
            trackTaggedEvent({
                name: 'listing_internal_entry',
                properties: { entity_id: ENTITY_ID, entity_type: 'ACCOMMODATION' },
                tag: ENTITY_ID
            })
        ).not.toThrow();
    });
});
