/**
 * @file umami-client.test.ts
 * @description HOS-2119 T-034: the admin Umami client injects the tracker script
 * once (with the CSP nonce), is a no-op when unconfigured or in dev, and routes
 * events / identify / reset through the shared analytics package.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
            // Arrange
            const tracker = installTracker();
            const mod = await loadFreshModule();
            mod.initUmami();

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
        it('identifies with the staff user id only, never extra data', async () => {
            // Arrange
            const tracker = installTracker();
            const mod = await loadFreshModule();
            mod.initUmami();

            // Act
            mod.identifyUser('user-123');

            // Assert
            expect(tracker.identify).toHaveBeenCalledTimes(1);
            expect(tracker.identify).toHaveBeenCalledWith('user-123');
        });

        it('does not identify before init', async () => {
            // Arrange
            const tracker = installTracker();
            const mod = await loadFreshModule();

            // Act
            mod.identifyUser('user-123');

            // Assert
            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('resetUser does not throw and does not call the tracker (Umami has no reset)', async () => {
            // Arrange
            const tracker = installTracker();
            const mod = await loadFreshModule();
            mod.initUmami();

            // Act + Assert
            expect(() => mod.resetUser()).not.toThrow();
            expect(tracker.track).not.toHaveBeenCalled();
            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('identify does not throw when the tracker is absent', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();

            // Act + Assert
            expect(() => mod.identifyUser('user-123')).not.toThrow();
        });

        it('delivers an identify issued before load exactly once on the script load event', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();
            mod.identifyUser('user-early');
            const tracker = installTracker();

            // Act
            trackerScripts()[0]?.dispatchEvent(new Event('load'));
            trackerScripts()[0]?.dispatchEvent(new Event('load'));

            // Assert
            expect(tracker.identify).toHaveBeenCalledTimes(1);
            expect(tracker.identify).toHaveBeenCalledWith('user-early');
        });

        it('identifies immediately when the tracker is already loaded', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();
            const tracker = installTracker();
            trackerScripts()[0]?.dispatchEvent(new Event('load'));

            // Act
            mod.identifyUser('user-late');

            // Assert
            expect(tracker.identify).toHaveBeenCalledTimes(1);
            expect(tracker.identify).toHaveBeenCalledWith('user-late');
        });

        it('drops a pending identify when resetUser runs before load', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();
            mod.identifyUser('user-early');
            mod.resetUser();
            const tracker = installTracker();

            // Act
            trackerScripts()[0]?.dispatchEvent(new Event('load'));

            // Assert
            expect(tracker.identify).not.toHaveBeenCalled();
        });
    });
});
