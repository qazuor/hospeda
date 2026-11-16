/**
 * @file umami-pageview.ts
 * @description Sends exactly one Umami pageview per page load, tagged with the
 * CURRENT page's entity id (HOS-2119, review finding C1).
 *
 * ## Why the tracker does not send pageviews itself
 *
 * The site navigates with Astro's `<ClientRouter />`. On a soft navigation the
 * router never re-executes an external script whose `src` already ran
 * (`deselectScripts` keys executed scripts by `src`), and the Umami 3.5.0
 * tracker reads its `data-*` attributes ONCE, from `document.currentScript`, at
 * start-up. A `data-tag` on the tracker element therefore stuck to the first
 * page of the visit: every later pageview carried the landing page's listing id
 * (or none), and the per-listing owner stats read the wrong numbers.
 *
 * So the tracker renders with `data-auto-pageview="false"` and this module sends
 * the pageview on `astro:page-load`, which the router fires on the initial load
 * AND after every swap. The tag comes from `<meta name="umami-tag">`, a head
 * element the router swaps with the document, so it always belongs to the page
 * being counted.
 *
 * `data-auto-pageview` (not `data-auto-track`) is deliberate: with auto-track
 * off the tracker never hooks `history.pushState`, so the URL it puts on every
 * custom event would stay frozen at the landing page. With only auto-pageview
 * off it keeps hooking `pushState` / `replaceState` and still sends no pageview
 * of its own.
 *
 * Known limitation: the tracker hooks only those two history methods, never
 * `popstate`. After a back/forward navigation a custom event therefore carries
 * the URL the tracker last saw through a push (the page before the
 * back/forward), until the next push or replace. Pageviews are not affected:
 * {@link buildPageviewPayload} always overwrites the URL.
 *
 * Only a router navigation (`astro:page-load`) counts as a page. An app's own
 * `pushState` without the router (the destinations filters,
 * `DestinationPOIFilter`) changes the URL but sends no pageview, by decision.
 *
 * ## The referrer of a soft navigation
 *
 * `document.referrer` does not change on `pushState`. The URL of the page the
 * visitor came from is recorded on `astro:before-swap` and exposed through
 * {@link getCurrentPageReferrer}, which the internal-entry island also uses.
 * `ListingLayout.astro` fetches and swaps the results itself and then
 * dispatches a synthetic `astro:page-load` WITHOUT `astro:before-swap`; a URL
 * change without that event takes the last counted page as the referrer.
 *
 * Pages without `<ClientRouter />` (StandaloneLayout) never get
 * `astro:page-load`; there the pageview is sent once, directly.
 *
 * ## The pageview acknowledgement (OQ-5, revised 2026-11-16)
 *
 * Umami 3.5.0 derives the session as `uuid(website, ip, ua, salt, id)`. An
 * `identify` that carries the tracker's `x-umami-cache` token claims the
 * anonymous fingerprint session (same session id, distinct id attached); one
 * sent without the token opens a separate `uuid(…, id)` session, and a server
 * event (which never carries a distinct id) can no longer join the browser.
 *
 * The tracker stores the token from the answer of each request it sends
 * (`cache = data.cache` in `send()`), keeps it in memory for the life of the
 * document (a `pushState` does not touch it) and exposes it through
 * `getSession()`. Its `send()` swallows every error, so the promise `track()`
 * returns also resolves for a blocked or failed request. A pageview therefore
 * counts as acknowledged only when that promise resolved AND the tracker then
 * holds a token. {@link subscribePageviewAcknowledgement} is what the identify
 * waits on. Module state is per document: a full reload starts unacknowledged.
 *
 * The subscription has no timeout on purpose. With `<ClientRouter />` the
 * initial `astro:page-load` fires on `window.load`, which on a slow page comes
 * long after the islands hydrate (where the identify is requested). A wait
 * bounded from the identify call gave up before the pageview was even sent, so
 * a single-page visit never identified. A subscriber that only waits holds no
 * timer and costs nothing when the acknowledgement never comes.
 */

import type { UmamiTracker } from '@repo/analytics';
import { hasUmamiCacheToken } from '@repo/analytics';
import { getUmamiTracker, waitForUmamiTracker } from '@/lib/analytics/umami-tracker';

/** `name` of the per-page `<meta>` carrying the Umami tag (detail pages only). */
export const UMAMI_TAG_META_NAME = 'umami-tag';

/** Meta element `<ClientRouter />` renders; its absence means no soft navigation. */
const CLIENT_ROUTER_META_SELECTOR = 'meta[name="astro-view-transitions-enabled"]';

/** Selector of the tracker element `UmamiScript.astro` renders when configured. */
const TRACKER_SCRIPT_SELECTOR = 'script[data-website-id]';

/** Umami's tag limit. */
const UMAMI_TAG_MAX_LENGTH = 50;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Defaults the tracker passes to the function form of `umami.track`. */
type TrackerPayload = Record<string, unknown>;

/** URL of the page the visitor left on the last soft navigation, if any. */
let softNavFromUrl: string | null = null;
/** URL of the page counted by the last pageview. */
let lastPageUrl: string | null = null;
let started = false;
/** Whether a pageview of this document was answered and left a cache token. */
let pageviewAcknowledged = false;
/** Bumped by `stop`, so an answer to a request of an earlier wiring is ignored. */
let wiringGeneration = 0;
/** Subscribers notified on the next acknowledgement. */
const acknowledgementSubscribers = new Set<() => void>();

/** Whether this document's pageview was acknowledged and the token is still held. */
function isAcknowledgedNow(): boolean {
    if (!pageviewAcknowledged) return false;
    const tracker = getUmamiTracker();
    return hasUmamiCacheToken({ tracker });
}

/**
 * Marks the document acknowledged once the pageview request settled and the
 * tracker holds a token, then notifies the waiters.
 */
async function acknowledgeWhenAnswered({
    sent,
    generation
}: {
    readonly sent: unknown;
    readonly generation: number;
}): Promise<void> {
    try {
        await sent;
    } catch {
        return;
    }
    if (generation !== wiringGeneration) return;
    const tracker = getUmamiTracker();
    if (!hasUmamiCacheToken({ tracker })) return;
    pageviewAcknowledged = true;
    for (const subscriber of [...acknowledgementSubscribers]) subscriber();
}

/** Input of {@link subscribePageviewAcknowledgement}. */
export interface SubscribePageviewAcknowledgementInput {
    /** Called once when this document's pageview has been acknowledged. */
    readonly onAcknowledged: () => void;
}

/** Result of {@link subscribePageviewAcknowledgement}. */
export interface SubscribePageviewAcknowledgementResult {
    /** Drops the subscription without calling back. A no-op once it ran. */
    readonly unsubscribe: () => void;
}

/**
 * Runs `onAcknowledged` once this document's pageview was answered by Umami
 * and the tracker holds the `x-umami-cache` token: synchronously when that
 * already happened (also after a soft navigation, the token outlives
 * `pushState`), otherwise on the acknowledgement, however late it comes.
 *
 * There is no timeout (see the file header): when the acknowledgement never
 * comes (ad blocker, failed request) the callback simply never runs. The
 * subscription holds no timer, never throws, and lives until it ran, the
 * caller unsubscribes, or the document goes away.
 *
 * @param input - The callback.
 * @returns A handle to drop the subscription.
 */
export function subscribePageviewAcknowledgement({
    onAcknowledged
}: SubscribePageviewAcknowledgementInput): SubscribePageviewAcknowledgementResult {
    const noop: SubscribePageviewAcknowledgementResult = { unsubscribe: () => undefined };
    if (typeof window === 'undefined') return noop;
    if (isAcknowledgedNow()) {
        onAcknowledged();
        return noop;
    }

    const unsubscribe = (): void => {
        acknowledgementSubscribers.delete(subscriber);
    };
    function subscriber(): void {
        unsubscribe();
        onAcknowledged();
    }
    acknowledgementSubscribers.add(subscriber);
    return { unsubscribe };
}

/**
 * Referrer of the page being shown: the previous page's URL after a soft
 * navigation, `document.referrer` on a full page load.
 *
 * @returns The referrer URL, or `''` when there is none.
 */
export function getCurrentPageReferrer(): string {
    if (softNavFromUrl !== null) return softNavFromUrl;
    return typeof document === 'undefined' ? '' : document.referrer;
}

/**
 * Reads the Umami tag of the current page from `<meta name="umami-tag">`.
 * Only a UUID-shaped value of at most 50 characters counts.
 *
 * @param input - The document to read.
 * @returns The tag, or `undefined` on a page without one.
 */
export function readPageTag({ doc }: { readonly doc: Document }): string | undefined {
    const content = doc
        .querySelector<HTMLMetaElement>(`meta[name="${UMAMI_TAG_META_NAME}"]`)
        ?.getAttribute('content')
        ?.trim();
    if (!content || content.length > UMAMI_TAG_MAX_LENGTH || !UUID_SHAPE.test(content)) {
        return undefined;
    }
    return content;
}

/** Input of {@link buildPageviewPayload}. */
export interface BuildPageviewPayloadInput {
    /** Defaults the tracker built (website, screen, language, hostname, id, ...). */
    readonly defaults: TrackerPayload;
    /** Absolute URL of the page being counted. */
    readonly url: string;
    /** Title of the page being counted. */
    readonly title: string;
    /** Referrer to send; `undefined` keeps the tracker's own value. */
    readonly referrer: string | undefined;
    /** Tag of the page; `undefined` sends no tag at all. */
    readonly tag: string | undefined;
}

/**
 * Builds the pageview payload from the tracker defaults. The page fields are
 * always overwritten (the tracker's URL is stale after a back/forward swap),
 * and any tag in the defaults is dropped so a page without its own tag never
 * inherits one.
 *
 * @param input - Tracker defaults plus the page context captured at load.
 * @returns The payload for `umami.track`.
 */
export function buildPageviewPayload({
    defaults,
    url,
    title,
    referrer,
    tag
}: BuildPageviewPayloadInput): TrackerPayload {
    const { tag: _inheritedTag, ...rest } = defaults;
    return {
        ...rest,
        url,
        title,
        ...(referrer === undefined ? {} : { referrer }),
        ...(tag === undefined ? {} : { tag })
    };
}

/** Same-origin URLs become a path, like the tracker does for its referrers. */
function stripOrigin(url: string): string {
    const { origin } = window.location;
    return url === origin || url.startsWith(`${origin}/`) ? url.slice(origin.length) : url;
}

/**
 * Counts the page now shown. Captures its URL, title, referrer and tag at call
 * time, then sends one pageview once the tracker is present (bounded wait).
 */
function countCurrentPage(): void {
    const url = window.location.href;
    const title = document.title;
    const tag = readPageTag({ doc: document });
    // A synthetic page-load (ListingLayout's own fetch-and-swap) changes the
    // URL without `astro:before-swap`: the page being left is the last one
    // counted. After a real swap this is the value before-swap stored anyway.
    if (lastPageUrl !== null && url !== lastPageUrl) softNavFromUrl = lastPageUrl;
    // After a soft navigation the tracker's own referrer is stale (back/forward
    // never reaches its pushState hook), so send the page we came from.
    const referrer = softNavFromUrl === null ? undefined : stripOrigin(softNavFromUrl);
    lastPageUrl = url;
    const generation = wiringGeneration;

    waitForUmamiTracker({
        onReady: (tracker: UmamiTracker) => {
            let sent: unknown;
            try {
                // Typed `void` in `@repo/analytics`; the 3.5.0 tracker returns
                // the promise of its `send()`.
                sent = tracker.track((defaults) =>
                    buildPageviewPayload({ defaults, url, title, referrer, tag })
                );
            } catch {
                // Best-effort: analytics must never break the page.
                return;
            }
            void acknowledgeWhenAnswered({ sent, generation });
        }
    });
}

function rememberPageBeingLeft(): void {
    // Back/forward has already changed `location` when this fires, so the page
    // being left is the one the last pageview counted.
    softNavFromUrl = lastPageUrl ?? window.location.href;
}

/** Result of {@link startUmamiPageviews}. */
export interface StartUmamiPageviewsResult {
    /**
     * Removes the listeners and forgets the navigation and acknowledgement
     * state (used by tests to start each case as a fresh document).
     */
    readonly stop: () => void;
}

/**
 * Wires the per-page pageview. Idempotent, and a no-op on pages where the
 * tracker is not configured (no tracker element). Called from the bundled
 * script in `UmamiScript.astro`, which the router never re-runs on a swap.
 *
 * @returns A handle whose `stop` undoes the wiring (used by tests).
 */
export function startUmamiPageviews(): StartUmamiPageviewsResult {
    const noop: StartUmamiPageviewsResult = { stop: () => undefined };
    if (started || typeof window === 'undefined') return noop;
    if (!document.querySelector(TRACKER_SCRIPT_SELECTOR)) return noop;
    started = true;

    const stop = (): void => {
        document.removeEventListener('astro:before-swap', rememberPageBeingLeft);
        document.removeEventListener('astro:page-load', countCurrentPage);
        softNavFromUrl = null;
        lastPageUrl = null;
        started = false;
        pageviewAcknowledged = false;
        wiringGeneration += 1;
    };

    if (!document.querySelector(CLIENT_ROUTER_META_SELECTOR)) {
        countCurrentPage();
        return { stop };
    }

    document.addEventListener('astro:before-swap', rememberPageBeingLeft);
    document.addEventListener('astro:page-load', countCurrentPage);
    return { stop };
}
