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
    readPageTag,
    type StartUmamiPageviewsResult,
    startUmamiPageviews
} from '@/lib/analytics/umami-pageview';
import { saveConsent } from '@/lib/cookie-consent';

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
    addHeadElement(
        '<meta name="umami-config" data-script-url="https://umami.test/t.js" data-website-id="site-id">'
    );
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

beforeEach(() => {
    saveConsent({ crashReporting: false, analytics: true, marketing: false });
});

afterEach(() => {
    document.cookie = 'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
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

    it('uses the last counted page as referrer on a page-load without before-swap', () => {
        // ListingLayout swaps the results itself, pushes the URL and dispatches
        // a synthetic astro:page-load, never astro:before-swap.
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/alojamientos/');
        const umami = installUmami();
        handle = startUmamiPageviews();
        firstLoad();

        window.history.pushState({}, '', '/es/alojamientos/?tipo=cabana');
        document.dispatchEvent(new Event('astro:page-load'));

        expect(payloads(umami)[1]).toMatchObject({
            url: `${ORIGIN}/es/alojamientos/?tipo=cabana`,
            referrer: '/es/alojamientos/'
        });
        expect(getCurrentPageReferrer()).toBe(`${ORIGIN}/es/alojamientos/`);
    });

    it('keeps the before-swap referrer on a regular soft navigation after a synthetic one', () => {
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/alojamientos/');
        const umami = installUmami();
        handle = startUmamiPageviews();
        firstLoad();
        window.history.pushState({}, '', '/es/alojamientos/?tipo=cabana');
        document.dispatchEvent(new Event('astro:page-load'));

        softNavigate({ path: '/es/alojamientos/casa-b/', tag: TAG_B });

        expect(payloads(umami)[2]).toMatchObject({
            url: `${ORIGIN}/es/alojamientos/casa-b/`,
            referrer: '/es/alojamientos/?tipo=cabana'
        });
    });

    it('keeps the first-load referrer when a synthetic page-load leaves the URL unchanged', () => {
        renderHead({ clientRouter: true });
        window.history.replaceState({}, '', '/es/alojamientos/');
        const umami = installUmami();
        handle = startUmamiPageviews();
        firstLoad();

        document.dispatchEvent(new Event('astro:page-load'));

        expect(payloads(umami)[1]).toMatchObject({ referrer: 'https://www.google.com/' });
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
