/**
 * @file umami-first-pageview.test.ts
 * @description HOS-2119 (OQ-5 revised 2026-11-17, AC-12): the admin sends its
 * pageviews itself and the FIRST pageview of a document waits until the staff
 * identity settles, so the identify is the document's first request and opens
 * the per-user Umami session. With the tracker's auto pageview the pageview was
 * answered first, the tracker held an `x-umami-cache` token and the identify
 * was skipped (the staff member stayed anonymous in the browser).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installUmamiTrackerStub, type UmamiTrackerStub } from '../../helpers/umami-tracker-stub';

const mockEnv: Record<string, string | undefined> = {};

vi.mock('@/env', () => ({ env: mockEnv }));
vi.mock('@/lib/csp-nonce', () => ({ getCspNonceOnClient: () => undefined }));
vi.mock('@/utils/logger', () => ({
    adminLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

type UmamiClientModule = typeof import('@/lib/analytics/umami-client');

const ORIGIN = window.location.origin;

async function loadFreshModule(): Promise<UmamiClientModule> {
    vi.resetModules();
    return import('@/lib/analytics/umami-client');
}

function trackerScript(): HTMLScriptElement | null {
    return document.querySelector<HTMLScriptElement>('script[data-website-id]');
}

/** The deferred tracker script finished loading. */
function loadTrackerScript(): UmamiTrackerStub {
    const umami = installUmamiTrackerStub();
    trackerScript()?.dispatchEvent(new Event('load'));
    return umami;
}

/** Resolves the function form of every `umami.track` call. */
function payloads(umami: UmamiTrackerStub): readonly Record<string, unknown>[] {
    return umami.track.mock.calls.map((call) => {
        const builder = call[0] as (defaults: Record<string, unknown>) => Record<string, unknown>;
        return builder({ website: 'site-id', url: `${ORIGIN}/stale/`, title: 'stale' });
    });
}

function order(spy: ReturnType<typeof vi.fn>, index = 0): number {
    return spy.mock.invocationCallOrder[index] ?? Number.NaN;
}

beforeEach(() => {
    vi.stubEnv('DEV', false);
    mockEnv.VITE_UMAMI_SCRIPT_URL = 'https://pulso-staging.hospeda.com.ar/app.js';
    mockEnv.VITE_UMAMI_WEBSITE_ID = '3f1c2b4e-8a6d-4c1f-9b2e-7d5a1e0c9f33';
    mockEnv.VITE_APP_VERSION = '1.2.3';
    document.head.innerHTML = '';
    Reflect.deleteProperty(window, 'umami');
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    document.head.innerHTML = '';
    Reflect.deleteProperty(window, 'umami');
});

describe('tracker script', () => {
    it('turns off the automatic pageview (the router sends them), keeping auto-track', async () => {
        // Arrange
        const mod = await loadFreshModule();

        // Act
        mod.initUmami();

        // Assert
        expect(trackerScript()?.getAttribute('data-auto-pageview')).toBe('false');
        // auto-track=false would stop the tracker following pushState, freezing
        // the URL of every custom event at the landing page.
        expect(trackerScript()?.hasAttribute('data-auto-track')).toBe(false);
    });
});

describe('first pageview waits for the staff identity', () => {
    it('should identify (without a token) before the first pageview when the session resolves late', async () => {
        // Arrange: the tracker loaded and the router counted the first page
        const mod = await loadFreshModule();
        mod.initUmami();
        const umami = loadTrackerScript();
        mod.trackPageview({ url: `${ORIGIN}/dashboard`, title: 'Panel', awaitIdentity: true });
        // Had the pageview gone out, Umami answers it now and the tracker holds a token.
        if (umami.track.mock.calls.length > 0) umami.answerPageview();

        // Act: AuthProvider resolves the session
        mod.identifyUser('staff-1');

        // Assert
        expect(umami.identify).toHaveBeenCalledTimes(1);
        expect(umami.identifyCaches).toEqual([undefined]);
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(order(umami.identify)).toBeLessThan(order(umami.track));
    });

    it('should send the identify before the pageview when both wait for the script', async () => {
        // Arrange
        const mod = await loadFreshModule();
        mod.initUmami();
        mod.identifyUser('staff-1');
        mod.trackPageview({ url: `${ORIGIN}/dashboard`, title: 'Panel', awaitIdentity: true });

        // Act
        const umami = loadTrackerScript();

        // Assert
        expect(umami.identifyCaches).toEqual([undefined]);
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(order(umami.identify)).toBeLessThan(order(umami.track));
    });

    it('should send the pageview at once on resolution for an anonymous visitor', async () => {
        // Arrange
        const mod = await loadFreshModule();
        mod.initUmami();
        const umami = loadTrackerScript();
        mod.trackPageview({ url: `${ORIGIN}/dashboard`, title: 'Panel', awaitIdentity: true });
        expect(umami.track).not.toHaveBeenCalled();

        // Act
        mod.markVisitorAnonymous();

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(umami.identify).not.toHaveBeenCalled();
    });

    it('should send the pageview anonymously after the timeout and leave no timer', async () => {
        // Arrange
        vi.useFakeTimers();
        const mod = await loadFreshModule();
        mod.initUmami();
        const umami = loadTrackerScript();
        mod.trackPageview({ url: `${ORIGIN}/dashboard`, title: 'Panel', awaitIdentity: true });

        // Act / Assert
        vi.advanceTimersByTime(mod.FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS - 1);
        expect(umami.track).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(mod.FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS).toBe(3000);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('should not hold a route outside the authenticated layout', async () => {
        // Arrange
        const mod = await loadFreshModule();
        mod.initUmami();
        const umami = loadTrackerScript();

        // Act
        mod.trackPageview({
            url: `${ORIGIN}/auth/change-password`,
            title: 'Cambiar contraseña',
            awaitIdentity: false
        });

        // Assert
        expect(umami.track).toHaveBeenCalledTimes(1);
    });
});

describe('later pageviews', () => {
    it('should send navigations at once after the first, with the given url, title and referrer', async () => {
        // Arrange
        const mod = await loadFreshModule();
        mod.initUmami();
        const umami = loadTrackerScript();
        mod.identifyUser('staff-1');
        mod.trackPageview({ url: `${ORIGIN}/dashboard`, title: 'Panel', awaitIdentity: true });

        // Act
        mod.trackPageview({
            url: `${ORIGIN}/users`,
            title: 'Usuarios',
            referrer: '/dashboard',
            awaitIdentity: true
        });

        // Assert
        expect(payloads(umami)).toEqual([
            { website: 'site-id', url: `${ORIGIN}/dashboard`, title: 'Panel' },
            {
                website: 'site-id',
                url: `${ORIGIN}/users`,
                title: 'Usuarios',
                referrer: '/dashboard'
            }
        ]);
    });

    it('should queue a navigation made while the first is held, keeping the order', async () => {
        // Arrange
        const mod = await loadFreshModule();
        mod.initUmami();
        const umami = loadTrackerScript();
        mod.trackPageview({ url: `${ORIGIN}/dashboard`, title: 'Panel', awaitIdentity: true });
        mod.trackPageview({ url: `${ORIGIN}/users`, title: 'Usuarios', awaitIdentity: true });
        expect(umami.track).not.toHaveBeenCalled();

        // Act
        mod.identifyUser('staff-1');

        // Assert
        expect(payloads(umami).map((payload) => payload.url)).toEqual([
            `${ORIGIN}/dashboard`,
            `${ORIGIN}/users`
        ]);
    });

    it('should send nothing before init', async () => {
        // Arrange
        const mod = await loadFreshModule();
        const umami = installUmamiTrackerStub();

        // Act
        mod.trackPageview({ url: `${ORIGIN}/dashboard`, title: 'Panel', awaitIdentity: false });

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
    });

    it('should drop queued pageviews when the tracker script fails to load', async () => {
        // Arrange
        const mod = await loadFreshModule();
        mod.initUmami();
        mod.markVisitorAnonymous();
        mod.trackPageview({ url: `${ORIGIN}/dashboard`, title: 'Panel', awaitIdentity: true });

        // Act: blocked, then something defines a tracker anyway
        trackerScript()?.dispatchEvent(new Event('error'));
        const umami = loadTrackerScript();

        // Assert
        expect(umami.track).not.toHaveBeenCalled();
    });
});
