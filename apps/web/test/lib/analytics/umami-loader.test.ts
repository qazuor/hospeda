/**
 * @file umami-loader.test.ts
 * @description HOS-2681: the Umami tracker script is injected only after the
 * visitor grants analytics consent, starts without a reload when the banner is
 * accepted, drops pre-consent pageviews (never flushed later) and stops on
 * revoke.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    startUmamiLoader,
    UMAMI_DISABLED_STORAGE_KEY,
    UMAMI_TRACKER_SCRIPT_ID
} from '@/lib/analytics/umami-loader';
import { startUmamiPageviews } from '@/lib/analytics/umami-pageview';
import { waitForUmamiTracker } from '@/lib/analytics/umami-tracker';
import { saveConsent } from '@/lib/cookie-consent';

const SCRIPT_URL = 'https://umami.test/hospeda.js';

function setConsent({ analytics }: { readonly analytics: boolean }): void {
    saveConsent({ crashReporting: false, analytics, marketing: false });
}

function trackerScripts(): NodeListOf<HTMLScriptElement> {
    return document.head.querySelectorAll<HTMLScriptElement>(`script#${UMAMI_TRACKER_SCRIPT_ID}`);
}

function renderConfig(): void {
    document.head.insertAdjacentHTML(
        'beforeend',
        `<meta name="umami-config" data-script-url="${SCRIPT_URL}" data-website-id="site-id">`
    );
}

let stoppers: Array<() => void> = [];

beforeEach(() => {
    renderConfig();
});

afterEach(() => {
    for (const stop of stoppers) stop();
    stoppers = [];
    document.head.innerHTML = '';
    document.cookie = 'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    window.localStorage.clear();
    Reflect.deleteProperty(window, 'umami');
    vi.useRealTimers();
});

describe('startUmamiLoader', () => {
    it('should inject no tracker script before consent', () => {
        stoppers.push(startUmamiLoader().stop);

        expect(trackerScripts()).toHaveLength(0);
    });

    it('should inject no tracker script when consent was declined', () => {
        setConsent({ analytics: false });
        stoppers.push(startUmamiLoader().stop);

        expect(trackerScripts()).toHaveLength(0);
    });

    it('should inject the tracker at start-up for a returning visitor who accepted', () => {
        setConsent({ analytics: true });
        stoppers.push(startUmamiLoader().stop);

        const scripts = trackerScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.src).toBe(SCRIPT_URL);
        expect(scripts[0]?.getAttribute('data-website-id')).toBe('site-id');
        expect(scripts[0]?.getAttribute('data-auto-pageview')).toBe('false');
    });

    it('should inject the tracker without a reload when the banner is accepted', () => {
        stoppers.push(startUmamiLoader().stop);
        expect(trackerScripts()).toHaveLength(0);

        setConsent({ analytics: true });

        expect(trackerScripts()).toHaveLength(1);
    });

    it('should inject only once across repeated consent saves', () => {
        stoppers.push(startUmamiLoader().stop);

        setConsent({ analytics: true });
        setConsent({ analytics: true });

        expect(trackerScripts()).toHaveLength(1);
    });

    it('should set the umami.disabled flag on revoke and clear it on a new grant', () => {
        stoppers.push(startUmamiLoader().stop);
        setConsent({ analytics: true });

        setConsent({ analytics: false });
        expect(window.localStorage.getItem(UMAMI_DISABLED_STORAGE_KEY)).toBe('1');

        setConsent({ analytics: true });
        expect(window.localStorage.getItem(UMAMI_DISABLED_STORAGE_KEY)).toBeNull();
    });

    it('should write nothing to storage when no tracker was ever loaded', () => {
        stoppers.push(startUmamiLoader().stop);

        setConsent({ analytics: false });

        expect(window.localStorage.getItem(UMAMI_DISABLED_STORAGE_KEY)).toBeNull();
    });

    it('should do nothing on a page without the config', () => {
        document.head.innerHTML = '';
        setConsent({ analytics: true });

        stoppers.push(startUmamiLoader().stop);

        expect(trackerScripts()).toHaveLength(0);
    });
});

describe('after a ClientRouter swap drops the injected script', () => {
    it('should not inject twice on a repeated grant, and should still flag a revoke', () => {
        stoppers.push(startUmamiLoader().stop);
        setConsent({ analytics: true });
        // The router drops the head node on the first soft navigation.
        for (const node of trackerScripts()) node.remove();

        setConsent({ analytics: true });
        expect(trackerScripts()).toHaveLength(0);

        setConsent({ analytics: false });
        expect(window.localStorage.getItem(UMAMI_DISABLED_STORAGE_KEY)).toBe('1');
    });
});

describe('waiting for a slow tracker download', () => {
    it('should keep waiting past the usual budget until the script loads', () => {
        vi.useFakeTimers();
        stoppers.push(startUmamiLoader().stop);
        setConsent({ analytics: true });
        const onReady = vi.fn();
        const onGiveUp = vi.fn();
        waitForUmamiTracker({ onReady, onGiveUp });

        // Well past 20 polls x 250 ms, script still downloading.
        vi.advanceTimersByTime(30_000);
        expect(onGiveUp).not.toHaveBeenCalled();

        // The script loads and defines the tracker.
        Reflect.set(window, 'umami', { track: vi.fn(), identify: vi.fn() });
        vi.advanceTimersByTime(250);
        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('should give up once the script download fails', () => {
        vi.useFakeTimers();
        stoppers.push(startUmamiLoader().stop);
        setConsent({ analytics: true });
        const onGiveUp = vi.fn();
        waitForUmamiTracker({ onReady: vi.fn(), onGiveUp });

        trackerScripts()[0]?.dispatchEvent(new Event('error'));
        vi.advanceTimersByTime(6000);

        expect(onGiveUp).toHaveBeenCalledTimes(1);
    });
});

describe('pageviews around the consent decision', () => {
    function installTracker(): { track: ReturnType<typeof vi.fn> } {
        const stub = { track: vi.fn(), identify: vi.fn() };
        Reflect.set(window, 'umami', stub);
        return stub;
    }

    it('should drop the pre-consent pageview, count the page on accept, and stop on revoke', async () => {
        const umami = installTracker();
        document.head.insertAdjacentHTML(
            'beforeend',
            '<meta name="astro-view-transitions-enabled" content="true">'
        );
        stoppers.push(startUmamiLoader().stop);
        stoppers.push(startUmamiPageviews().stop);

        // No consent yet: the page load is dropped, not queued.
        document.dispatchEvent(new Event('astro:page-load'));
        expect(umami.track).not.toHaveBeenCalled();

        // Accept: exactly one pageview, for the page now shown.
        setConsent({ analytics: true });
        await Promise.resolve();
        expect(umami.track).toHaveBeenCalledTimes(1);

        // Re-saving with analytics already on does not recount the page.
        setConsent({ analytics: true });
        await Promise.resolve();
        expect(umami.track).toHaveBeenCalledTimes(1);

        // Revoke, then a soft navigation: nothing goes out.
        setConsent({ analytics: false });
        document.dispatchEvent(new Event('astro:page-load'));
        expect(umami.track).toHaveBeenCalledTimes(1);
    });
});
