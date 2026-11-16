/**
 * @file umami-pageview-acknowledgement.test.ts
 * @description Tests for `subscribePageviewAcknowledgement` (HOS-2119, OQ-5):
 * the signal the web identify waits on. A pageview counts as acknowledged only
 * when the tracker's promise settled AND `getSession().cache` holds a token.
 * The subscription has no timeout: the router's initial pageview goes out on
 * `window.load`, which can come long after the identify was requested.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type StartUmamiPageviewsResult,
    startUmamiPageviews,
    subscribePageviewAcknowledgement
} from '@/lib/analytics/umami-pageview';
import { flushMicrotasks, installUmamiTrackerStub } from '../../helpers/umami-tracker-stub';

/** Longer than any bound the acknowledgement wait used to have (10 s). */
const LONG_DELAY_MS = 30_000;

let handle: StartUmamiPageviewsResult | null = null;

/** Renders the head UmamiScript + ClientRouter produce. */
function renderHead({ clientRouter }: { readonly clientRouter: boolean }): void {
    document.head.insertAdjacentHTML(
        'beforeend',
        '<script data-website-id="site-id" data-auto-pageview="false"></script>'
    );
    if (clientRouter) {
        document.head.insertAdjacentHTML(
            'beforeend',
            '<meta name="astro-view-transitions-enabled" content="true">'
        );
    }
}

function firstLoad(): void {
    document.dispatchEvent(new Event('astro:page-load'));
}

/** One ClientRouter soft navigation to `path`. */
function softNavigate({ path }: { readonly path: string }): void {
    document.dispatchEvent(new Event('astro:before-swap'));
    window.history.pushState({}, '', path);
    document.dispatchEvent(new Event('astro:page-load'));
}

beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/es/');
});

afterEach(() => {
    handle?.stop();
    handle = null;
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'umami');
    document.head.innerHTML = '';
});

describe('subscribePageviewAcknowledgement (identify after the pageview ack, OQ-5)', () => {
    function waitAck(): { readonly acknowledged: () => number } {
        let acknowledged = 0;
        subscribePageviewAcknowledgement({
            onAcknowledged: () => {
                acknowledged += 1;
            }
        });
        return { acknowledged: () => acknowledged };
    }

    it('does not acknowledge while the pageview request is in flight', async () => {
        renderHead({ clientRouter: true });
        installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();

        const wait = waitAck();
        await flushMicrotasks();

        expect(wait.acknowledged()).toBe(0);
    });

    it('acknowledges right after Umami answers the pageview with a cache token', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();
        const wait = waitAck();

        umami.respond();
        await flushMicrotasks();

        expect(wait.acknowledged()).toBe(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('acknowledges at once (synchronously) once this document was acknowledged', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();
        umami.respond();
        await flushMicrotasks();

        const wait = waitAck();

        expect(wait.acknowledged()).toBe(1);
    });

    it('stays acknowledged across a soft navigation (the tracker keeps its token)', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();
        umami.respond();
        await flushMicrotasks();

        softNavigate({ path: '/es/destinos/' });
        const wait = waitAck();

        expect(wait.acknowledged()).toBe(1);
    });

    it('never acknowledges a request that failed (no cache token), holding no timer', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();
        const wait = waitAck();

        umami.respond({ ok: false });
        await flushMicrotasks();
        vi.advanceTimersByTime(LONG_DELAY_MS);

        expect(wait.acknowledged()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('never acknowledges a tracker without getSession (cannot prove the token)', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub({ withGetSession: false });
        handle = startUmamiPageviews();
        firstLoad();
        const wait = waitAck();

        umami.respond();
        await flushMicrotasks();

        expect(wait.acknowledged()).toBe(0);
    });

    it('stays silent without a timer when the tracker never loads (ad blocker)', () => {
        renderHead({ clientRouter: true });
        handle = startUmamiPageviews();
        firstLoad();
        const wait = waitAck();

        vi.advanceTimersByTime(LONG_DELAY_MS);

        expect(wait.acknowledged()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('acknowledges a pageview sent and answered long after subscribing', async () => {
        // The router's initial page-load fires on window.load, after hydration.
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        const wait = waitAck();
        vi.advanceTimersByTime(LONG_DELAY_MS);

        firstLoad();
        umami.respond();
        await flushMicrotasks();

        expect(wait.acknowledged()).toBe(1);
    });

    it('unsubscribe drops a pending subscription without calling back', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();
        const onAcknowledged = vi.fn();
        const { unsubscribe } = subscribePageviewAcknowledgement({ onAcknowledged });

        unsubscribe();
        umami.respond();
        await flushMicrotasks();

        expect(onAcknowledged).not.toHaveBeenCalled();
    });

    it('calls a subscriber once, not again on a later acknowledgement', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();
        const wait = waitAck();
        umami.respond();
        await flushMicrotasks();

        softNavigate({ path: '/es/destinos/' });
        umami.respond();
        await flushMicrotasks();

        expect(wait.acknowledged()).toBe(1);
    });

    it('acknowledges the StandaloneLayout single pageview too', async () => {
        renderHead({ clientRouter: false });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        const wait = waitAck();

        umami.respond();
        await flushMicrotasks();

        expect(umami.track).toHaveBeenCalledTimes(1);
        expect(wait.acknowledged()).toBe(1);
    });
});
