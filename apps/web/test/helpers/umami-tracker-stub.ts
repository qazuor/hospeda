/**
 * @file umami-tracker-stub.ts
 * @description A `window.umami` stub that behaves like the Umami 3.5.0 tracker
 * where the browser-to-server session join depends on it (HOS-2119):
 *
 * - `track()` returns a promise that settles only when the test answers the
 *   request (`respond`), like the tracker's `send()` awaiting `fetch`.
 * - Answering stores the `x-umami-cache` token, exposed through `getSession()`,
 *   exactly as the tracker does with `data.cache`. A failed request
 *   (`respond({ ok: false })`) resolves too, because the tracker swallows
 *   errors, but leaves no token.
 * - `identify()` records whether the tracker held a token when it was called:
 *   an identify without it opens a separate `uuid(…, id)` session in Umami.
 */

import { vi } from 'vitest';
import {
    type StartUmamiPageviewsResult,
    startUmamiPageviews
} from '@/lib/analytics/umami-pageview';

/** Input of {@link UmamiTrackerStub.respond}. */
export interface RespondInput {
    /** Whether the request reached Umami and returned a cache token. */
    readonly ok?: boolean;
}

/** Controllable stand-in for the Umami tracker. */
export interface UmamiTrackerStub {
    /** Spy of `umami.track`. */
    readonly track: ReturnType<typeof vi.fn>;
    /** Spy of `umami.identify`. */
    readonly identify: ReturnType<typeof vi.fn>;
    /** Mirror of the tracker's `getSession()`. */
    readonly getSession: () => { readonly cache: string | undefined; readonly website: string };
    /** Answers the oldest pending `track` request. */
    readonly respond: (input?: RespondInput) => void;
    /** Cache token held when each `identify` call was made (`undefined` = none). */
    readonly identifyCaches: readonly (string | undefined)[];
}

/** Token value the stub stores when a request is answered. */
export const STUB_CACHE_TOKEN = 'cache-token';

/**
 * Installs the stub as `window.umami`.
 *
 * @param input - `withGetSession: false` models a tracker without `getSession`.
 * @returns The stub and its controls.
 */
export function installUmamiTrackerStub({
    withGetSession = true
}: {
    readonly withGetSession?: boolean;
} = {}): UmamiTrackerStub {
    let cache: string | undefined;
    const pending: Array<(ok: boolean) => void> = [];
    const identifyCaches: Array<string | undefined> = [];

    const track = vi.fn(
        () =>
            new Promise<void>((resolve) => {
                pending.push((ok) => {
                    if (ok) cache = STUB_CACHE_TOKEN;
                    resolve();
                });
            })
    );
    const identify = vi.fn(() => {
        identifyCaches.push(cache);
        return Promise.resolve();
    });
    const getSession = () => ({ cache, website: 'site-id' });

    const tracker = withGetSession ? { track, identify, getSession } : { track, identify };
    Reflect.set(window, 'umami', tracker);

    return {
        track,
        identify,
        getSession,
        respond: ({ ok = true }: RespondInput = {}) => pending.shift()?.(ok),
        identifyCaches
    };
}

/** Lets pending promise callbacks run (the tracker awaits `fetch` and `res.json()`). */
export async function flushMicrotasks(): Promise<void> {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

/** Options of the page helpers below. */
export interface PageOptions {
    /** Whether the page renders `<ClientRouter />` (soft navigation). */
    readonly clientRouter?: boolean;
}

let pageviews: StartUmamiPageviewsResult | null = null;

/**
 * Renders the element `UmamiScript.astro` emits, plus the ClientRouter meta
 * when asked.
 *
 * @param options - Page options.
 */
export function renderTrackerElement({ clientRouter = false }: PageOptions = {}): void {
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

/** Starts the real pageview module (what `UmamiScript.astro` runs). */
export function startPageviews(): void {
    pageviews = startUmamiPageviews();
}

/**
 * A freshly loaded document: the tracker is present and this document's
 * pageview is in flight (not answered yet).
 *
 * @param options - Page options.
 * @returns The tracker stub.
 */
export function loadPage({ clientRouter = false }: PageOptions = {}): UmamiTrackerStub {
    renderTrackerElement({ clientRouter });
    const umami = installUmamiTrackerStub();
    startPageviews();
    if (clientRouter) document.dispatchEvent(new Event('astro:page-load'));
    return umami;
}

/**
 * A loaded document whose pageview Umami already answered, so the tracker
 * holds the cache token.
 *
 * @returns The tracker stub.
 */
export async function acknowledgedPage(): Promise<UmamiTrackerStub> {
    const umami = loadPage();
    umami.respond();
    await flushMicrotasks();
    return umami;
}

/** Undoes the page helpers: stops the pageview module and clears the head. */
export function unloadPage(): void {
    pageviews?.stop();
    pageviews = null;
    document.head.innerHTML = '';
    window.history.replaceState({}, '', '/');
}
