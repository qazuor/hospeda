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
 * ## Identify order (OQ-5, revised 2026-11-17)
 *
 * The identify (`umami-client.ts`) must be a document's FIRST request, before
 * the tracker holds an `x-umami-cache` token, so it opens a per-user session
 * instead of claiming the anonymous one; the client skips it once a token
 * exists (`hasUmamiCacheToken`). The first `astro:page-load` usually comes
 * before the UserMenu island hydrates and resolves the session, so an unheld
 * first pageview would win that race and leave every logged-in visitor
 * anonymous in the browser.
 *
 * So the FIRST pageview of the document is held until the visitor identity is
 * settled (`umami-identity-gate.ts`): identify sent (or skipped), guest
 * declared, or {@link FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS} elapsed, after which
 * it goes out anonymously. It is held only when both hold:
 * - the page mounts an auth-aware island that settles the identity, which
 *   `UmamiScript.astro` declares with `<meta name="umami-await-identity">`
 *   (BaseLayout; StandaloneLayout has no UserMenu, identifies nobody and so
 *   sends at once);
 * - analytics consent is granted, since without it no identify is sent
 *   anyway (AC-5).
 * Later pageviews are never held; one counted while the first is still held
 * queues behind it so the order of the pages is kept.
 */

import type { UmamiTracker } from '@repo/analytics';
import {
    FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS,
    waitForVisitorIdentity
} from '@/lib/analytics/umami-identity-gate';
import { waitForUmamiTracker } from '@/lib/analytics/umami-tracker';
import { getConsent } from '@/lib/cookie-consent';

/** `name` of the per-page `<meta>` carrying the Umami tag (detail pages only). */
export const UMAMI_TAG_META_NAME = 'umami-tag';

/**
 * `name` of the `<meta>` declaring that the page mounts an auth-aware island
 * which settles the visitor identity (see "Identify order").
 */
export const UMAMI_AWAIT_IDENTITY_META_NAME = 'umami-await-identity';

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
/** Whether this document already counted its first page. */
let firstPageCounted = false;
/** Pageview sends held behind the first pageview, in page order. */
let heldSends: Array<() => void> | null = null;
/** Cancels the identity wait of the first pageview, while one is pending. */
let cancelIdentityWait: (() => void) | null = null;
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

    const send = (): void => {
        waitForUmamiTracker({
            onReady: (tracker: UmamiTracker) => {
                try {
                    tracker.track((defaults) =>
                        buildPageviewPayload({ defaults, url, title, referrer, tag })
                    );
                } catch {
                    // Best-effort: analytics must never break the page.
                }
            }
        });
    };

    if (heldSends) {
        heldSends.push(send);
        return;
    }
    if (firstPageCounted || !shouldHoldFirstPageview()) {
        firstPageCounted = true;
        send();
        return;
    }
    firstPageCounted = true;
    holdFirstPageview(send);
}

/** Whether the first pageview waits for the visitor identity (see "Identify order"). */
function shouldHoldFirstPageview(): boolean {
    if (!document.querySelector(`meta[name="${UMAMI_AWAIT_IDENTITY_META_NAME}"]`)) return false;
    return getConsent()?.analytics === true;
}

/** Holds `send` (and any page counted meanwhile) until the identity settles. */
function holdFirstPageview(send: () => void): void {
    const queue: Array<() => void> = [send];
    heldSends = queue;
    const { cancel } = waitForVisitorIdentity({
        timeoutMs: FIRST_PAGEVIEW_IDENTITY_TIMEOUT_MS,
        onSettled: () => {
            cancelIdentityWait = null;
            heldSends = null;
            for (const held of queue) held();
        }
    });
    // A synchronous settlement already flushed the queue.
    if (heldSends === queue) cancelIdentityWait = cancel;
}

function rememberPageBeingLeft(): void {
    // Back/forward has already changed `location` when this fires, so the page
    // being left is the one the last pageview counted.
    softNavFromUrl = lastPageUrl ?? window.location.href;
}

/** Result of {@link startUmamiPageviews}. */
export interface StartUmamiPageviewsResult {
    /**
     * Removes the listeners, drops a held first pageview and forgets the
     * navigation state (used by tests to start each case as a fresh document).
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
        cancelIdentityWait?.();
        cancelIdentityWait = null;
        heldSends = null;
        firstPageCounted = false;
        softNavFromUrl = null;
        lastPageUrl = null;
        started = false;
    };

    if (!document.querySelector(CLIENT_ROUTER_META_SELECTOR)) {
        countCurrentPage();
        return { stop };
    }

    document.addEventListener('astro:before-swap', rememberPageBeingLeft);
    document.addEventListener('astro:page-load', countCurrentPage);
    return { stop };
}
