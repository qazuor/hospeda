/**
 * @file gallery-preload.ts
 * @description Progressive photo preloading for the listing gallery (owner smoke,
 * HOS-2520). After the page has finished loading and the main thread is idle, the
 * next slides are fetched so a swipe finds them ready; every swipe moves that window
 * forward. A visitor who asked to save data (`navigator.connection.saveData`) gets
 * no preloading at all: only what the browser's own lazy loading decides.
 *
 * It also warms the LIGHTBOX in the background (owner request, HOS-2520): once the
 * page is idle, the full-size URLs of the first {@link GALLERY_WARMUP_FULL_LIMIT}
 * photos and the strip's thumbnails, so the first open usually paints from cache.
 * Data saver and 2G connections skip all of it ({@link readPreloadAllowed}).
 */

import { buildLightboxThumbUrl, buildLightboxUrl } from './gallery-image-sources';

/** How many photos past the current one are fetched ahead of a swipe. */
export const GALLERY_PRELOAD_AHEAD = 2 as const;

/** The subset of `navigator.connection` this module reads (not in every TS DOM lib). */
interface ConnectionLike {
    readonly saveData?: boolean;
    /** Network Information API estimate: 'slow-2g' | '2g' | '3g' | '4g'. */
    readonly effectiveType?: string;
}

/** Reads `navigator.connection`, which is not in every TS DOM lib. */
function readConnection(nav?: Navigator): ConnectionLike | undefined {
    return (nav as (Navigator & { readonly connection?: ConnectionLike }) | undefined)?.connection;
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
    return { saveData: readConnection(nav)?.saveData === true };
}

/** Connection estimates on which no photo is fetched ahead of need. */
const SLOW_EFFECTIVE_TYPES: ReadonlySet<string> = new Set(['slow-2g', '2g']);

/**
 * Whether background photo preloading is allowed at all: false with data saver on
 * or on a `slow-2g`/`2g` connection estimate. True when the API is not available
 * (Safari, Firefox), which is the same default the browser's own loading assumes.
 *
 * @param input - The navigator to read; absent outside a browser.
 * @returns `{ allowed }`.
 */
export function readPreloadAllowed({ nav }: { readonly nav?: Navigator }): {
    readonly allowed: boolean;
} {
    const connection = readConnection(nav);
    if (connection?.saveData === true) return { allowed: false };
    const type = connection?.effectiveType;
    return { allowed: !(typeof type === 'string' && SLOW_EFFECTIVE_TYPES.has(type)) };
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

/** Most full-size lightbox photos warmed before the visitor has interacted at all. */
export const GALLERY_WARMUP_FULL_LIMIT = 3 as const;

/** Input of {@link planGalleryWarmup}. */
export interface PlanGalleryWarmupInput {
    /** The gallery's original image URLs, in display order. */
    readonly imageUrls: readonly string[];
    /** Result of {@link readPreloadAllowed}. */
    readonly allowed: boolean;
    /** Full-size photos the page already warmed before any interaction (other galleries). */
    readonly alreadyWarmedFull: number;
}

/**
 * The URLs the idle warm-up fetches: the lightbox (`full`) URL of the first photos, up
 * to {@link GALLERY_WARMUP_FULL_LIMIT} for the whole page, and every strip thumbnail
 * (small, and the strip mounts right after the first open) when there are 2+ photos.
 *
 * @param input - Image URLs, the network verdict and the page-wide full-size count.
 * @returns `{ full, thumbs }`, deduplicated; both empty when preloading is not allowed.
 */
export function planGalleryWarmup({
    imageUrls,
    allowed,
    alreadyWarmedFull
}: PlanGalleryWarmupInput): {
    readonly full: readonly string[];
    readonly thumbs: readonly string[];
} {
    if (!allowed || imageUrls.length === 0) return { full: [], thumbs: [] };
    const budget = Math.max(0, GALLERY_WARMUP_FULL_LIMIT - alreadyWarmedFull);
    const full = [...new Set(imageUrls.map((url) => buildLightboxUrl({ url }).src))].slice(
        0,
        budget
    );
    // A single photo still opens the lightbox (so its full size is worth warming),
    // but the strip only renders with 2+ photos (`GalleryLightboxThumbs`).
    const thumbs =
        imageUrls.length < 2
            ? []
            : [...new Set(imageUrls.map((url) => buildLightboxThumbUrl({ url }).src))];
    return { full, thumbs };
}

/**
 * URLs this session already asked for, so no two callers fetch the same photo twice.
 * Session-wide on purpose: it only dedupes requests the HTTP cache already holds.
 */
const warmedUrls = new Set<string>();

/**
 * Full-size URLs warmed by the idle pass on the CURRENT page, counted against the
 * limit. Keyed by `location.pathname`: this module survives ClientRouter soft
 * navigations, so a module-wide counter let the first listing spend the budget of
 * every listing visited after it.
 */
let idleWarmedFull: { readonly page: string; readonly urls: Set<string> } = {
    page: '',
    urls: new Set<string>()
};

/** The idle full-size budget of the page `win` shows; a new page starts at zero. */
function currentPageWarmedFull({ win }: { readonly win: Window }): Set<string> {
    const page = win.location?.pathname ?? '';
    if (idleWarmedFull.page !== page) idleWarmedFull = { page, urls: new Set<string>() };
    return idleWarmedFull.urls;
}

/** Input of {@link warmImage}. */
export interface WarmImageInput {
    readonly url: string;
    /** `low` for speculative warm-ups, `auto` once the visitor is navigating. */
    readonly priority: 'low' | 'auto';
    /** Image factory; tests inject a fake. Defaults to `new Image()`. */
    readonly createImage?: () => HTMLImageElement;
    /** Dedup set; tests pass their own. Defaults to the document-wide set. */
    readonly seen?: Set<string>;
}

/**
 * Fetches one image into the browser cache, once per URL per document.
 *
 * Why `new Image()` and not `<link rel="prefetch">`: prefetch is for the NEXT
 * navigation (Safari does not implement it, and Chrome keeps the response in a
 * prefetch cache an `<img>` of the same document does not reliably reuse), while a
 * detached `Image` lands in the memory cache the lightbox's `<img>` reads from on
 * every engine. `fetchPriority = 'low'` keeps it behind everything the page needs.
 *
 * @param input - URL, priority and optional injections.
 * @returns `{ started }`, false when the URL was already requested.
 */
export function warmImage({
    url,
    priority,
    createImage = () => new Image(),
    seen = warmedUrls
}: WarmImageInput): { readonly started: boolean } {
    if (!url || seen.has(url)) return { started: false };
    seen.add(url);
    const img = createImage();
    img.decoding = 'async';
    if (priority === 'low') img.fetchPriority = 'low';
    img.src = url;
    return { started: true };
}

/**
 * Warms the lightbox after the page is ready: `load`, then idle (see
 * {@link whenPageIdle}). Reads the network verdict at that moment, not at mount.
 *
 * @param input - The window, the gallery's image URLs and an optional image factory.
 * @returns `{ cleanup }` to cancel a warm-up that has not fired yet.
 */
export function warmGalleryOnIdle({
    win,
    imageUrls,
    createImage
}: {
    readonly win: Window;
    readonly imageUrls: readonly string[];
    readonly createImage?: () => HTMLImageElement;
}): { readonly cleanup: () => void } {
    return whenPageIdle({
        win,
        onReady: () => {
            const { allowed } = readPreloadAllowed({ nav: win.navigator });
            const pageWarmedFull = currentPageWarmedFull({ win });
            const { full, thumbs } = planGalleryWarmup({
                imageUrls,
                allowed,
                alreadyWarmedFull: pageWarmedFull.size
            });
            for (const url of full) {
                pageWarmedFull.add(url);
                warmImage({ url, priority: 'low', createImage });
            }
            for (const url of thumbs) warmImage({ url, priority: 'low', createImage });
        }
    });
}
