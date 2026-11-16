/**
 * @file umami-client.test.ts
 * @description Unit tests for the web Umami client (HOS-2119, T-027, AC-5).
 * Covers cookieless pre-consent tracking, consent-gated once-per-session
 * identify, OQ-5 (no email distinct id), anti-PII keys, a missing tracker and
 * the validated tagged capture.
 */

import type { AnalyticsEventProperties } from '@repo/analytics';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    associateGroup,
    identifyUser,
    resetGroups,
    resetUser,
    setPersonProperties,
    trackEvent,
    trackTaggedEvent
} from '@/lib/analytics/umami-client';
import { CONSENT_CHANGED_EVENT, saveConsent } from '@/lib/cookie-consent';

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

    it('should forward a validated event before consent (cookieless)', () => {
        // Arrange
        const umami = installUmami();

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

describe('identifyUser (consent-gated, once per session)', () => {
    it('should never identify before consent', () => {
        // Arrange
        const umami = installUmami();

        // Act
        identifyUser('user-1');
        trackEvent('search_performed', { search_type: 'accommodation' });

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
        expect(umami.track).toHaveBeenCalledTimes(1);
    });

    it('should identify once with the user id after CONSENT_CHANGED_EVENT', () => {
        // Arrange
        const umami = installUmami();
        identifyUser('user-1');

        // Act
        grantConsent();

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
        expect(umami.identify).toHaveBeenCalledWith('user-1');
    });

    it('should not re-identify on repeated consent events', () => {
        // Arrange
        const umami = installUmami();
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

    it('should not identify when consent changes to analytics=false', () => {
        // Arrange
        const umami = installUmami();
        identifyUser('user-1');

        // Act
        saveConsent({ crashReporting: true, analytics: false, marketing: false });

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should identify only once per session when called repeatedly with consent', () => {
        // Arrange
        grantConsent();
        const umami = installUmami();

        // Act
        identifyUser('user-1');
        identifyUser('user-1');
        identifyUser('user-1');

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
    });

    it('should identify again after resetUser (sign-out then sign-in)', () => {
        // Arrange
        grantConsent();
        const umami = installUmami();
        identifyUser('user-1');

        // Act
        resetUser();
        identifyUser('user-1');

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(2);
    });

    it('should never identify a user dropped by resetUser while pending consent', () => {
        // Arrange
        const umami = installUmami();
        identifyUser('user-1');
        resetUser();

        // Act
        grantConsent();

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should reject an email as distinct id', () => {
        // Arrange
        grantConsent();
        const umami = installUmami();

        // Act
        identifyUser('someone@example.com');

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should reject a forbidden distinct id value', () => {
        // Arrange
        grantConsent();
        const umami = installUmami();

        // Act
        identifyUser('anonymous');

        // Assert
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should fold person properties into the identify data', () => {
        // Arrange
        grantConsent();
        const umami = installUmami();
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

describe('documented no-ops', () => {
    it('should not throw or call the tracker for groups', () => {
        // Arrange
        const umami = installUmami();

        // Act
        associateGroup('accommodation', 'acc-1');
        resetGroups();

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
        expect(umami.identify).not.toHaveBeenCalled();
    });
});

describe('trackTaggedEvent', () => {
    it('should validate, then forward name, data and tag through the function form', () => {
        // Arrange
        const umami = installUmami();

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
