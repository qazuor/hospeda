/**
 * @file umami-client.test.ts
 * @description HOS-2119 T-034: the admin Umami client injects the tracker script
 * once (with the CSP nonce), is a no-op when unconfigured or in dev, and routes
 * events / identify / reset through the shared analytics package. The identify
 * is sent as soon as the tracker is present and skipped when it already holds a
 * cache token (OQ-5, revised 2026-11-17), checked against a tracker stub that
 * models `getSession().cache`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installUmamiTrackerStub, type UmamiTrackerStub } from '../../helpers/umami-tracker-stub';

const SCRIPT_URL = 'https://pulso-staging.hospeda.com.ar/app.js';
const WEBSITE_ID = '3f1c2b4e-8a6d-4c1f-9b2e-7d5a1e0c9f33';

const mockEnv: Record<string, string | undefined> = {};
const nonceMock = vi.fn<() => string | undefined>();

vi.mock('@/env', () => ({ env: mockEnv }));
vi.mock('@/lib/csp-nonce', () => ({ getCspNonceOnClient: () => nonceMock() }));
vi.mock('@/utils/logger', () => ({
    adminLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

type UmamiClientModule = typeof import('@/lib/analytics/umami-client');

interface FakeTracker {
    track: ReturnType<typeof vi.fn>;
    identify: ReturnType<typeof vi.fn>;
}

async function loadFreshModule(): Promise<UmamiClientModule> {
    vi.resetModules();
    return import('@/lib/analytics/umami-client');
}

function trackerScripts(): HTMLScriptElement[] {
    return Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-website-id]'));
}

function installTracker(): FakeTracker {
    const tracker: FakeTracker = { track: vi.fn(), identify: vi.fn() };
    (window as unknown as { umami?: FakeTracker }).umami = tracker;
    return tracker;
}

describe('umami-client (admin)', () => {
    beforeEach(() => {
        vi.stubEnv('DEV', false);
        mockEnv.VITE_UMAMI_SCRIPT_URL = SCRIPT_URL;
        mockEnv.VITE_UMAMI_WEBSITE_ID = WEBSITE_ID;
        mockEnv.VITE_APP_VERSION = '1.2.3';
        nonceMock.mockReturnValue('nonce-abc');
        document.head.innerHTML = '';
        (window as unknown as { umami?: FakeTracker }).umami = undefined;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        document.head.innerHTML = '';
    });

    describe('initUmami', () => {
        it('is a no-op when the script URL is unset', async () => {
            // Arrange
            mockEnv.VITE_UMAMI_SCRIPT_URL = undefined;
            const mod = await loadFreshModule();

            // Act
            mod.initUmami();

            // Assert
            expect(trackerScripts()).toHaveLength(0);
            expect(mod.isUmamiInitialized()).toBe(false);
        });

        it('is a no-op when the website id is unset', async () => {
            // Arrange
            mockEnv.VITE_UMAMI_WEBSITE_ID = undefined;
            const mod = await loadFreshModule();

            // Act
            mod.initUmami();

            // Assert
            expect(trackerScripts()).toHaveLength(0);
            expect(mod.isUmamiInitialized()).toBe(false);
        });

        it('is a no-op in development', async () => {
            // Arrange
            vi.stubEnv('DEV', true);
            const mod = await loadFreshModule();

            // Act
            mod.initUmami();

            // Assert
            expect(trackerScripts()).toHaveLength(0);
            expect(mod.isUmamiInitialized()).toBe(false);
        });

        it('injects the tracker script with src, website id, defer and nonce', async () => {
            // Arrange
            const mod = await loadFreshModule();

            // Act
            mod.initUmami();

            // Assert
            const scripts = trackerScripts();
            expect(scripts).toHaveLength(1);
            const [script] = scripts;
            expect(script?.src).toBe(SCRIPT_URL);
            expect(script?.getAttribute('data-website-id')).toBe(WEBSITE_ID);
            expect(script?.defer).toBe(true);
            expect(script?.nonce).toBe('nonce-abc');
            expect(mod.isUmamiInitialized()).toBe(true);
        });

        it('omits the nonce when none is available', async () => {
            // Arrange
            nonceMock.mockReturnValue(undefined);
            const mod = await loadFreshModule();

            // Act
            mod.initUmami();

            // Assert
            expect(trackerScripts()).toHaveLength(1);
            expect(trackerScripts()[0]?.nonce).toBe('');
        });

        it('injects the script exactly once across repeated calls', async () => {
            // Arrange
            const mod = await loadFreshModule();

            // Act
            mod.initUmami();
            mod.initUmami();
            mod.initUmami();

            // Assert
            expect(trackerScripts()).toHaveLength(1);
        });
    });

    describe('trackEvent', () => {
        it('forwards a valid catalog event to window.umami.track', async () => {
            // Arrange: identity settled, so the event is not held (HOS-2119)
            const tracker = installTracker();
            const mod = await loadFreshModule();
            mod.initUmami();
            mod.markVisitorAnonymous();

            // Act
            mod.trackEvent('admin_tour_completed', { role: null, tour_id: 'welcome' });

            // Assert
            expect(tracker.track).toHaveBeenCalledTimes(1);
            expect(tracker.track.mock.calls[0]?.[0]).toBe('admin_tour_completed');
            expect(tracker.track.mock.calls[0]?.[1]).toMatchObject({
                tour_id: 'welcome',
                app: 'admin'
            });
        });

        it('rejects an event name that is not in the catalog', async () => {
            // Arrange
            const tracker = installTracker();
            const mod = await loadFreshModule();
            mod.initUmami();
            mod.markVisitorAnonymous();

            // Act
            expect(() => mod.trackEvent('not_a_real_event' as never, {} as never)).not.toThrow();

            // Assert
            expect(tracker.track).not.toHaveBeenCalled();
        });

        it('does nothing before init', async () => {
            // Arrange
            const tracker = installTracker();
            const mod = await loadFreshModule();

            // Act
            mod.trackEvent('admin_tour_completed', { role: null, tour_id: 'welcome' });

            // Assert
            expect(tracker.track).not.toHaveBeenCalled();
        });

        it('does not throw when the tracker script never loaded', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();

            // Act + Assert
            expect(() =>
                mod.trackEvent('admin_tour_completed', { role: null, tour_id: 'welcome' })
            ).not.toThrow();
        });
    });

    describe('identifyUser / resetUser', () => {
        it('does not identify before init', async () => {
            // Arrange
            const umami = installUmamiTrackerStub();
            umami.answerPageview();
            const mod = await loadFreshModule();

            // Act
            mod.identifyUser('user-123');

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
        });

        it('identify does not throw when the tracker is absent', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();

            // Act + Assert
            expect(() => mod.identifyUser('user-123')).not.toThrow();
        });

        it('resetUser does not throw and does not call the tracker (Umami has no reset)', async () => {
            // Arrange
            const umami = installUmamiTrackerStub();
            const mod = await loadFreshModule();
            mod.initUmami();

            // Act + Assert
            expect(() => mod.resetUser()).not.toThrow();
            expect(umami.track).not.toHaveBeenCalled();
            expect(umami.identify).not.toHaveBeenCalled();
        });
    });

    describe('identify opens a per-user session and never claims the anonymous one (OQ-5)', () => {
        /** The tracker script finished loading; its auto pageview may be in flight. */
        async function loadTracker(): Promise<{
            readonly mod: UmamiClientModule;
            readonly umami: UmamiTrackerStub;
        }> {
            const mod = await loadFreshModule();
            mod.initUmami();
            const umami = installUmamiTrackerStub();
            trackerScripts()[0]?.dispatchEvent(new Event('load'));
            return { mod, umami };
        }

        it('identifies at once, without a token, while the pageview is unanswered', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();

            // Act
            mod.identifyUser('user-123');

            // Assert
            expect(umami.identify).toHaveBeenCalledTimes(1);
            expect(umami.identify).toHaveBeenCalledWith('user-123');
            expect(umami.identifyCaches).toEqual([undefined]);
        });

        it('delivers an identify issued before the script load when it loads', async () => {
            // Arrange: initUmami ran, the deferred script has not loaded yet
            const mod = await loadFreshModule();
            mod.initUmami();
            mod.identifyUser('user-early');

            // Act
            const umami = installUmamiTrackerStub();
            trackerScripts()[0]?.dispatchEvent(new Event('load'));

            // Assert
            expect(umami.identifyCaches).toEqual([undefined]);
            expect(umami.identify).toHaveBeenCalledWith('user-early');
        });

        it('never identifies when the tracker already holds a cache token (would claim the fingerprint)', async () => {
            // Arrange: the pageview was answered before the session resolved
            const { mod, umami } = await loadTracker();
            umami.answerPageview();

            // Act
            mod.identifyUser('user-late');

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
        });

        it('identifies once per document for the same user', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();

            // Act
            mod.identifyUser('user-123');
            mod.identifyUser('user-123');

            // Assert
            expect(umami.identify).toHaveBeenCalledTimes(1);
        });

        it('identifies when the tracker has no getSession (no token provable)', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();
            const umami = installUmamiTrackerStub({ withGetSession: false });
            trackerScripts()[0]?.dispatchEvent(new Event('load'));

            // Act
            mod.identifyUser('user-123');

            // Assert
            expect(umami.identify).toHaveBeenCalledTimes(1);
        });

        it('gives up silently and holds no timer when the tracker never loads', async () => {
            // Arrange
            vi.useFakeTimers();
            const mod = await loadFreshModule();
            mod.initUmami();

            // Act / Assert
            expect(() => mod.identifyUser('user-123')).not.toThrow();
            vi.advanceTimersByTime(60_000);
            expect(vi.getTimerCount()).toBe(0);
            vi.useRealTimers();
        });

        it('drops a pending identify when resetUser runs before the script loads', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();
            mod.identifyUser('user-early');
            mod.resetUser();

            // Act
            const umami = installUmamiTrackerStub();
            trackerScripts()[0]?.dispatchEvent(new Event('load'));

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
        });

        it('identifies again after resetUser and a new login', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();
            mod.identifyUser('user-1');

            // Act
            mod.resetUser();
            mod.identifyUser('user-1');

            // Assert
            expect(umami.identify).toHaveBeenCalledTimes(2);
        });
    });
});
