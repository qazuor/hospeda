/**
 * @file umami-client.test.ts
 * @description HOS-2119 T-034: the admin Umami client injects the tracker script
 * once (with the CSP nonce), is a no-op when unconfigured or in dev, and routes
 * events / identify / reset through the shared analytics package. The identify
 * is sent only after the tracker holds the cache token of an answered pageview
 * (OQ-5), checked against a tracker stub that models `getSession().cache`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    installUmamiTrackerStub,
    STUB_CACHE_TOKEN,
    type UmamiTrackerStub
} from '../../helpers/umami-tracker-stub';

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

/**
 * Mirrors the module's poll constants. A static import would evaluate the
 * module before the hoisted `vi.mock` factories can read `mockEnv`.
 */
const UMAMI_ACK_POLL_INTERVAL_MS = 250;
const UMAMI_ACK_MAX_POLLS = 40;

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

    describe('identify waits for the pageview acknowledgement (OQ-5)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
            Reflect.deleteProperty(document, 'readyState');
        });

        /** The tracker script finished loading; its auto pageview is in flight. */
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

        it('never identifies while the pageview is unanswered (no cache token)', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();

            // Act
            mod.identifyUser('user-123');
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS * 4);

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
        });

        it('never identifies when the script loaded before the identify but the token is missing', async () => {
            // Arrange: script loaded, tracker present, pageview not answered yet
            const { mod, umami } = await loadTracker();

            // Act
            mod.identifyUser('user-late');

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
        });

        it('identifies exactly once, with the token, right after the pageview is answered', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();
            mod.identifyUser('user-123');
            mod.identifyUser('user-123');

            // Act
            umami.answerPageview();
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS * 3);

            // Assert
            expect(umami.identify).toHaveBeenCalledTimes(1);
            expect(umami.identify).toHaveBeenCalledWith('user-123');
            expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
            expect(vi.getTimerCount()).toBe(0);
        });

        it('delivers an identify issued before the script load once the pageview is answered', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();
            mod.identifyUser('user-early');
            const umami = installUmamiTrackerStub();
            trackerScripts()[0]?.dispatchEvent(new Event('load'));
            trackerScripts()[0]?.dispatchEvent(new Event('load'));

            // Act
            umami.answerPageview();
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS);

            // Assert
            expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
        });

        it('identifies at once, and once per document, when the token is already held', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();
            umami.answerPageview();

            // Act
            mod.identifyUser('user-123');
            mod.identifyUser('user-123');

            // Assert
            expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
        });

        it('gives up silently after the bound: no identify, no timer, no throw', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();
            expect([mod.UMAMI_ACK_POLL_INTERVAL_MS, mod.UMAMI_ACK_MAX_POLLS]).toEqual([
                UMAMI_ACK_POLL_INTERVAL_MS,
                UMAMI_ACK_MAX_POLLS
            ]);
            mod.identifyUser('user-123');

            // Act
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS * UMAMI_ACK_MAX_POLLS);
            umami.answerPageview();
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS * 4);

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
            expect(vi.getTimerCount()).toBe(0);
        });

        it('never identifies when the pageview request failed (no token)', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();
            mod.identifyUser('user-123');

            // Act
            umami.answerPageview({ ok: false });
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS * UMAMI_ACK_MAX_POLLS);

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
        });

        it('never identifies when the tracker has no getSession (cannot prove the token)', async () => {
            // Arrange
            const mod = await loadFreshModule();
            mod.initUmami();
            const umami = installUmamiTrackerStub({ withGetSession: false });
            trackerScripts()[0]?.dispatchEvent(new Event('load'));
            mod.identifyUser('user-123');

            // Act
            umami.answerPageview();
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS * UMAMI_ACK_MAX_POLLS);

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
        });

        it('starts the bound when the document completes, where the auto pageview goes out', async () => {
            // Arrange: the script loads while the document is still loading
            Object.defineProperty(document, 'readyState', {
                configurable: true,
                value: 'interactive'
            });
            const { mod, umami } = await loadTracker();
            mod.identifyUser('user-123');
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS * UMAMI_ACK_MAX_POLLS * 2);

            // Act: window load, then Umami answers the pageview
            window.dispatchEvent(new Event('load'));
            umami.answerPageview();
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS);

            // Assert
            expect(umami.identifyCaches).toEqual([STUB_CACHE_TOKEN]);
        });

        it('drops a pending identify when resetUser runs before the acknowledgement', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();
            mod.identifyUser('user-early');
            mod.resetUser();

            // Act
            umami.answerPageview();
            vi.advanceTimersByTime(UMAMI_ACK_POLL_INTERVAL_MS * 2);

            // Assert
            expect(umami.identify).not.toHaveBeenCalled();
        });

        it('identifies again after resetUser and a new login', async () => {
            // Arrange
            const { mod, umami } = await loadTracker();
            umami.answerPageview();
            mod.identifyUser('user-1');

            // Act
            mod.resetUser();
            mod.identifyUser('user-1');

            // Assert
            expect(umami.identify).toHaveBeenCalledTimes(2);
        });
    });
});
