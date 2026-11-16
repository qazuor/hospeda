/**
 * @file umami-pageview.test.ts
 * @description Tests for the per-page-load Umami pageview (HOS-2119, C1).
 *
 * The router lifecycle is simulated with the real event names: the initial
 * `astro:page-load`, then for each soft navigation `astro:before-swap`, the
 * head/body swap (here: replacing the `umami-tag` meta and the URL) and
 * `astro:page-load` again. The tracker is a `window.umami` stub whose function
 * form of `track` is resolved against tracker-like defaults, so each assertion
 * reads the exact payload Umami would receive.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildPageviewPayload,
    getCurrentPageReferrer,
    PAGEVIEW_ACK_TIMEOUT_MS,
    readPageTag,
    type StartUmamiPageviewsResult,
    startUmamiPageviews,
    waitForPageviewAcknowledgement
} from '@/lib/analytics/umami-pageview';
import { flushMicrotasks, installUmamiTrackerStub } from '../../helpers/umami-tracker-stub';

const TAG_A = '3f2b8c1e-5d4a-4c7b-9e1f-0a1b2c3d4e5f';
const TAG_B = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const ORIGIN = window.location.origin;
/** What the tracker's `getPayload()` holds: its URL is stale after back/forward. */
const TRACKER_DEFAULTS = {
    website: 'site-id',
    hostname: 'localhost',
    url: `${ORIGIN}/stale-landing-page/`,
    referrer: 'https://www.google.com/',
    tag: undefined
} as const;

interface UmamiStub {
    track: ReturnType<typeof vi.fn>;
    identify: ReturnType<typeof vi.fn>;
}

let handle: StartUmamiPageviewsResult | null = null;

function installUmami(): UmamiStub {
    const stub: UmamiStub = { track: vi.fn(), identify: vi.fn() };
    Reflect.set(window, 'umami', stub);
    return stub;
}

function addHeadElement(html: string): void {
    document.head.insertAdjacentHTML('beforeend', html);
}

function setPageTag(tag: string | null): void {
    for (const meta of document.head.querySelectorAll('meta[name="umami-tag"]')) meta.remove();
    if (tag !== null) addHeadElement(`<meta name="umami-tag" content="${tag}">`);
}

/** Renders the head UmamiScript + ClientRouter produce. */
function renderHead({ clientRouter }: { readonly clientRouter: boolean }): void {
    addHeadElement('<script data-website-id="site-id" data-auto-pageview="false"></script>');
    if (clientRouter) addHeadElement('<meta name="astro-view-transitions-enabled" content="true">');
}

function firstLoad(): void {
    document.dispatchEvent(new Event('astro:page-load'));
}

/** One ClientRouter soft navigation to `path`, whose page carries `tag`. */
function softNavigate({ path, tag }: { readonly path: string; readonly tag: string | null }): void {
    document.dispatchEvent(new Event('astro:before-swap'));
    window.history.pushState({}, '', path);
    setPageTag(tag);
    document.dispatchEvent(new Event('astro:page-load'));
}

/** Resolves the function form of every `umami.track` call. */
function payloads(stub: UmamiStub): readonly Record<string, unknown>[] {
    return stub.track.mock.calls.map((call) => {
        const builder = call[0] as (defaults: Record<string, unknown>) => Record<string, unknown>;
        return builder({ ...TRACKER_DEFAULTS });
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/es/');
    Object.defineProperty(document, 'referrer', {
        value: 'https://www.google.com/',
        configurable: true
    });
});

afterEach(() => {
    handle?.stop();
    handle = null;
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'umami');
    document.head.innerHTML = '';
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
});

describe('startUmamiPageviews with ClientRouter', () => {
    it('sends the tag of the first page on the initial load', () => {
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/alojamientos/casa-a/');
        setPageTag(TAG_A);
        const umami = installUmami();
        handle = startUmamiPageviews();

        firstLoad();

        expect(payloads(umami)).toEqual([
            {
                website: 'site-id',
                hostname: 'localhost',
                url: `${ORIGIN}/es/alojamientos/casa-a/`,
                title: document.title,
                referrer: 'https://www.google.com/',
                tag: TAG_A
            }
        ]);
    });

    it('sends the NEW page tag after a soft navigation, never the stale first one', () => {
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/alojamientos/casa-a/');
        setPageTag(TAG_A);
        const umami = installUmami();
        handle = startUmamiPageviews();
        firstLoad();

        softNavigate({ path: '/es/alojamientos/casa-b/', tag: TAG_B });

        const sent = payloads(umami);
        expect(sent).toHaveLength(2);
        expect(sent[1]).toMatchObject({
            url: `${ORIGIN}/es/alojamientos/casa-b/`,
            referrer: '/es/alojamientos/casa-a/',
            tag: TAG_B
        });
    });

    it('sends no tag on a non-detail page reached from a tagged one', () => {
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/alojamientos/casa-a/');
        setPageTag(TAG_A);
        const umami = installUmami();
        handle = startUmamiPageviews();
        firstLoad();

        softNavigate({ path: '/es/destinos/', tag: null });

        const last = payloads(umami)[1];
        expect(last).toBeDefined();
        expect(last).not.toHaveProperty('tag');
        expect(last?.url).toBe(`${ORIGIN}/es/destinos/`);
    });

    it('drops a tag the tracker defaults carry on a page without one', () => {
        renderHead({ clientRouter: true });
        const umami = installUmami();
        handle = startUmamiPageviews();
        firstLoad();

        const builder = umami.track.mock.calls[0]?.[0] as (
            d: Record<string, unknown>
        ) => Record<string, unknown>;
        expect(builder({ ...TRACKER_DEFAULTS, tag: TAG_A })).not.toHaveProperty('tag');
    });

    it('sends exactly one pageview per page load and never a duplicate', () => {
        renderHead({ clientRouter: true });
        const umami = installUmami();
        handle = startUmamiPageviews();
        // A second start (e.g. the module evaluated twice) must not double-count.
        startUmamiPageviews();

        firstLoad();
        softNavigate({ path: '/es/alojamientos/', tag: null });
        softNavigate({ path: '/es/alojamientos/casa-b/', tag: TAG_B });
        vi.advanceTimersByTime(10_000);

        expect(umami.track).toHaveBeenCalledTimes(3);
    });

    it('sends the previous page as referrer on a back navigation', () => {
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/alojamientos/casa-a/');
        const umami = installUmami();
        handle = startUmamiPageviews();
        firstLoad();
        softNavigate({ path: '/es/destinos/', tag: null });

        // popstate: the browser changes location BEFORE the router's before-swap.
        window.history.replaceState({}, '', '/es/alojamientos/casa-a/');
        setPageTag(TAG_A);
        document.dispatchEvent(new Event('astro:before-swap'));
        document.dispatchEvent(new Event('astro:page-load'));

        expect(payloads(umami)[2]).toMatchObject({
            url: `${ORIGIN}/es/alojamientos/casa-a/`,
            referrer: '/es/destinos/',
            tag: TAG_A
        });
    });

    it('waits for a late tracker and sends the page it was loaded for', () => {
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/alojamientos/casa-a/');
        setPageTag(TAG_A);
        handle = startUmamiPageviews();
        firstLoad();

        vi.advanceTimersByTime(500);
        const umami = installUmami();
        vi.advanceTimersByTime(250);

        expect(payloads(umami)).toHaveLength(1);
        expect(payloads(umami)[0]).toMatchObject({ tag: TAG_A });
    });

    it('gives up without a timer when the tracker never loads', () => {
        renderHead({ clientRouter: true });
        handle = startUmamiPageviews();
        firstLoad();

        vi.advanceTimersByTime(30_000);

        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('startUmamiPageviews without ClientRouter (StandaloneLayout)', () => {
    it('sends one pageview at once, since astro:page-load never fires there', () => {
        renderHead({ clientRouter: false });
        const umami = installUmami();

        handle = startUmamiPageviews();

        expect(umami.track).toHaveBeenCalledTimes(1);
    });
});

describe('startUmamiPageviews without a configured tracker', () => {
    it('does nothing on a page without the tracker element', () => {
        addHeadElement('<meta name="astro-view-transitions-enabled" content="true">');
        const umami = installUmami();
        handle = startUmamiPageviews();

        firstLoad();

        expect(umami.track).not.toHaveBeenCalled();
    });
});

describe('waitForPageviewAcknowledgement (identify after the pageview ack, OQ-5)', () => {
    function waitAck(): { readonly acknowledged: () => number; readonly gaveUp: () => number } {
        let acknowledged = 0;
        let gaveUp = 0;
        waitForPageviewAcknowledgement({
            onAcknowledged: () => {
                acknowledged += 1;
            },
            onGiveUp: () => {
                gaveUp += 1;
            }
        });
        return { acknowledged: () => acknowledged, gaveUp: () => gaveUp };
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
        expect(wait.gaveUp()).toBe(0);
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

        softNavigate({ path: '/es/destinos/', tag: null });
        const wait = waitAck();

        expect(wait.acknowledged()).toBe(1);
    });

    it('never acknowledges a request that failed (no cache token), and gives up', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();
        const wait = waitAck();

        umami.respond({ ok: false });
        await flushMicrotasks();
        vi.advanceTimersByTime(PAGEVIEW_ACK_TIMEOUT_MS);

        expect(wait.acknowledged()).toBe(0);
        expect(wait.gaveUp()).toBe(1);
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

    it('gives up without a timer when the tracker never loads (ad blocker)', () => {
        renderHead({ clientRouter: true });
        handle = startUmamiPageviews();
        firstLoad();
        const wait = waitAck();

        vi.advanceTimersByTime(PAGEVIEW_ACK_TIMEOUT_MS);

        expect(wait.acknowledged()).toBe(0);
        expect(wait.gaveUp()).toBe(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('cancel stops a pending wait without calling back', async () => {
        renderHead({ clientRouter: true });
        const umami = installUmamiTrackerStub();
        handle = startUmamiPageviews();
        firstLoad();
        const onAcknowledged = vi.fn();
        const onGiveUp = vi.fn();
        const { cancel } = waitForPageviewAcknowledgement({ onAcknowledged, onGiveUp });

        cancel();
        umami.respond();
        await flushMicrotasks();
        vi.advanceTimersByTime(PAGEVIEW_ACK_TIMEOUT_MS);

        expect(onAcknowledged).not.toHaveBeenCalled();
        expect(onGiveUp).not.toHaveBeenCalled();
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

describe('getCurrentPageReferrer', () => {
    it('is document.referrer on the first load', () => {
        renderHead({ clientRouter: true });
        handle = startUmamiPageviews();
        firstLoad();

        expect(getCurrentPageReferrer()).toBe('https://www.google.com/');
    });

    it('is the previous Hospeda page after a soft navigation', () => {
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/destinos/');
        handle = startUmamiPageviews();
        firstLoad();

        document.dispatchEvent(new Event('astro:before-swap'));

        expect(getCurrentPageReferrer()).toBe(`${ORIGIN}/es/destinos/`);
    });
});

describe('readPageTag', () => {
    it.each([
        ['an absent meta', null],
        ['a non-UUID value', 'not-a-uuid'],
        ['an over-long value', `${TAG_A}-${TAG_A}`]
    ])('returns undefined for %s', (_label, content) => {
        setPageTag(content);
        expect(readPageTag({ doc: document })).toBeUndefined();
    });

    it('returns a valid UUID tag', () => {
        setPageTag(TAG_A);
        expect(readPageTag({ doc: document })).toBe(TAG_A);
    });
});

describe('buildPageviewPayload', () => {
    it('keeps the tracker referrer when none is given', () => {
        expect(
            buildPageviewPayload({
                defaults: { ...TRACKER_DEFAULTS },
                url: `${ORIGIN}/es/`,
                title: 'Hospeda',
                referrer: undefined,
                tag: undefined
            })
        ).toEqual({
            website: 'site-id',
            hostname: 'localhost',
            url: `${ORIGIN}/es/`,
            title: 'Hospeda',
            referrer: 'https://www.google.com/'
        });
    });
});
