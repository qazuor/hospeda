/**
 * @file gallery-preload.ts
 * @description Progressive photo preloading for the listing gallery (owner smoke,
 * HOS-2520). After the page has finished loading and the main thread is idle, the
 * next slides are fetched so a swipe finds them ready; every swipe moves that window
 * forward. A visitor who asked to save data (`navigator.connection.saveData`) gets
 * no preloading at all: only what the browser's own lazy loading decides.
 */

/** How many photos past the current one are fetched ahead of a swipe. */
export const GALLERY_PRELOAD_AHEAD = 2 as const;

/** The subset of `navigator.connection` this module reads (not in every TS DOM lib). */
interface ConnectionLike {
    readonly saveData?: boolean;
}

/**
 * Whether the visitor asked the browser to save data.
 *
 * @param input - The navigator to read; absent outside a browser.
 * @returns `{ saveData }`, false when the API is not available.
 */
export function readSaveData({ nav }: { readonly nav?: Navigator }): {
    readonly saveData: boolean;
} {
    const connection = (nav as (Navigator & { readonly connection?: ConnectionLike }) | undefined)
        ?.connection;
    return { saveData: connection?.saveData === true };
}

/** Input of {@link resolveEagerThrough}. */
export interface ResolveEagerThroughInput {
    /** Index of the slide on screen. */
    readonly current: number;
    /** Number of slides in the track. */
    readonly count: number;
    /** True once the page has loaded and the browser went idle. */
    readonly ready: boolean;
    /** True when the visitor asked to save data. */
    readonly saveData: boolean;
    /** Last value returned: the window only grows, an image is never made lazy again. */
    readonly previous: number;
}

/**
 * Highest slide index that renders with `loading="eager"`. Slide 0 is always eager
 * (it is the LCP candidate); the rest stay lazy until the page is ready, then the
 * window covers the current slide plus {@link GALLERY_PRELOAD_AHEAD}.
 *
 * Flipping `loading` from lazy to eager on the SAME `<img>` makes the browser fetch
 * the candidate it already chose from that `<picture>`'s srcset and sizes, so the
 * preload can never download a different size than the slide shows, and the slide
 * keeps its reserved box (no layout shift).
 *
 * @param input - Current slide, slide count, readiness, data saver and previous value.
 * @returns `{ eagerThrough }`.
 */
export function resolveEagerThrough({
    current,
    count,
    ready,
    saveData,
    previous
}: ResolveEagerThroughInput): { readonly eagerThrough: number } {
    const floor = Math.max(0, previous);
    if (!ready || saveData || count <= 1) return { eagerThrough: floor };
    const target = Math.min(count - 1, Math.max(0, current) + GALLERY_PRELOAD_AHEAD);
    return { eagerThrough: Math.max(floor, target) };
}

/** Input of {@link resolveLightboxPreloadIndices}. */
export interface ResolveLightboxPreloadInput {
    /** Index of the photo on screen. */
    readonly index: number;
    /** Number of photos. */
    readonly count: number;
    /** True when the visitor asked to save data. */
    readonly saveData: boolean;
}

/**
 * Photos the lightbox warms in the cache: the next {@link GALLERY_PRELOAD_AHEAD} (it
 * wraps around, like its navigation) and the previous one. Empty with data saver on
 * or with a single photo.
 *
 * @param input - Current index, photo count and data saver flag.
 * @returns `{ indices }`, nearest first, without duplicates or the current photo.
 */
export function resolveLightboxPreloadIndices({
    index,
    count,
    saveData
}: ResolveLightboxPreloadInput): { readonly indices: readonly number[] } {
    if (saveData || count < 2) return { indices: [] };
    const wrap = (value: number): number => ((value % count) + count) % count;
    const candidates = [
        ...Array.from({ length: GALLERY_PRELOAD_AHEAD }, (_, offset) => wrap(index + offset + 1)),
        wrap(index - 1)
    ];
    const indices = candidates.filter(
        (candidate, position) => candidate !== index && candidates.indexOf(candidate) === position
    );
    return { indices };
}

/**
 * Calls `onReady` once the page has fired `load` and the browser is idle (or after a
 * short timeout where `requestIdleCallback` does not exist). Returns a cleanup.
 *
 * @param input - The window and the callback.
 * @returns `{ cleanup }`.
 */
export function whenPageIdle({
    win,
    onReady
}: {
    readonly win: Window;
    readonly onReady: () => void;
}): { readonly cleanup: () => void } {
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleIdle = (): void => {
        if (cancelled) return;
        const fire = (): void => {
            if (!cancelled) onReady();
        };
        if (typeof win.requestIdleCallback === 'function') {
            idleId = win.requestIdleCallback(fire, { timeout: 2000 });
        } else {
            timeoutId = setTimeout(fire, 200);
        }
    };

    if (win.document.readyState === 'complete') scheduleIdle();
    else win.addEventListener('load', scheduleIdle, { once: true });

    return {
        cleanup: () => {
            cancelled = true;
            win.removeEventListener('load', scheduleIdle);
            if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
                win.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) clearTimeout(timeoutId);
        }
    };
}
