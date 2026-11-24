/**
 * @file section-scroll.ts
 * @description Scrolls a listing detail page to a section so it lands right under
 * the sticky band (navbar + wave band + section tabs), on every vertical (HOS-2605).
 *
 * Why not `scrollIntoView` + `scroll-margin-top`: the destination is computed once,
 * when the scroll starts, but the layout moves while it runs. Leaving the top of the
 * page collapses the wave header band (expanded → compact shrinks it by ~127px at
 * 390px), which pulls every section up by that much, and the band then slides out
 * on the way down, which moves the stuck tabs up. The browser still scrolls to the
 * position it computed at the start, so the section heading ended under the tabs
 * (measured: `#listing-hours` at 83px with the band ending at 125px).
 *
 * This driver re-reads the target and the sticky offset on every frame and eases
 * toward the CURRENT destination, so it converges on the final layout whatever
 * collapses or slides on the way. Each step stops at the destination instead of
 * passing it, so the scroll does not end with a correction back up (a scroll-up of
 * more than 24px reveals the wave band again, which would cover the section).
 *
 * Without JavaScript the tabs are plain anchors and the CSS scroll offsets apply.
 */

/** Fraction of the remaining distance covered per frame when animating. */
const EASE_FACTOR = 0.2;
/** Smallest step in px, so the tail of the ease does not crawl. */
const MIN_STEP_PX = 4;
/** Distance under which the scroll counts as arrived. */
const ARRIVED_PX = 1;
/** Consecutive settled frames required to stop (lets band transitions finish). */
const SETTLED_FRAMES = 6;
/** Hard stop, whatever happens. */
const MAX_DURATION_MS = 2500;

/** Input of {@link nextSectionScrollY}. */
export interface NextSectionScrollYInput {
    readonly currentY: number;
    readonly desiredY: number;
    readonly reduceMotion: boolean;
}

/**
 * Next scroll position of the animation: a fraction of the remaining distance, never
 * past the destination. With reduced motion it jumps straight there.
 *
 * @param input - Current and desired scroll positions, and the motion preference.
 * @returns The scroll position to apply on this frame.
 */
export function nextSectionScrollY({
    currentY,
    desiredY,
    reduceMotion
}: NextSectionScrollYInput): number {
    const diff = desiredY - currentY;
    if (reduceMotion || Math.abs(diff) <= MIN_STEP_PX) return desiredY;
    const step = Math.max(Math.abs(diff) * EASE_FACTOR, MIN_STEP_PX);
    return currentY + Math.sign(diff) * step;
}

/** The window surface the driver needs; injectable for tests. */
export interface SectionScrollWindow {
    readonly scrollY: number;
    readonly innerHeight: number;
    readonly document: { readonly documentElement: { readonly scrollHeight: number } };
    scrollTo(options: ScrollToOptions): void;
    requestAnimationFrame(callback: FrameRequestCallback): number;
    cancelAnimationFrame(handle: number): void;
    addEventListener(type: string, listener: () => void, options?: AddEventListenerOptions): void;
    removeEventListener(type: string, listener: () => void): void;
}

/** Input of {@link scrollToListingSection}. */
export interface ScrollToListingSectionInput {
    readonly target: HTMLElement;
    /** Height pinned above the sections right now (navbar + band + tabs), in px. */
    readonly readOffset: () => number;
    /** Breathing room kept between the sticky band and the section. */
    readonly gap: number;
    readonly reduceMotion: boolean;
    readonly win: SectionScrollWindow;
    /** Clock in ms; defaults to `performance.now`. */
    readonly now?: () => number;
}

/** Result of {@link scrollToListingSection}. */
export interface ScrollToListingSectionResult {
    /** Stops the animation where it is. */
    readonly cancel: () => void;
}

/** User input that takes the scroll back from the animation. */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown'] as const;

/**
 * Animates the page scroll until `target` sits `gap` px under the sticky band, as
 * measured on every frame. Stops once settled, on user input, or after 2.5s.
 *
 * @param input - Target section, offset reader, gap, motion preference and window.
 * @returns A handle to cancel the animation.
 */
export function scrollToListingSection({
    target,
    readOffset,
    gap,
    reduceMotion,
    win,
    now = () => performance.now()
}: ScrollToListingSectionInput): ScrollToListingSectionResult {
    const startedAt = now();
    let settled = 0;
    let handle = 0;
    let stopped = false;

    const stop = (): void => {
        if (stopped) return;
        stopped = true;
        win.cancelAnimationFrame(handle);
        for (const type of USER_SCROLL_EVENTS) win.removeEventListener(type, stop);
    };

    const frame = (): void => {
        if (stopped) return;
        const currentY = win.scrollY;
        const maxY = Math.max(0, win.document.documentElement.scrollHeight - win.innerHeight);
        const rawDesired = currentY + target.getBoundingClientRect().top - (readOffset() + gap);
        const desiredY = Math.min(Math.max(rawDesired, 0), maxY);
        const nextY = nextSectionScrollY({ currentY, desiredY, reduceMotion });
        if (Math.abs(desiredY - currentY) <= ARRIVED_PX) settled += 1;
        else {
            settled = 0;
            win.scrollTo({ top: nextY, behavior: 'instant' });
        }
        if (settled >= SETTLED_FRAMES || now() - startedAt > MAX_DURATION_MS) {
            stop();
            return;
        }
        handle = win.requestAnimationFrame(frame);
    };

    for (const type of USER_SCROLL_EVENTS) {
        win.addEventListener(type, stop, { passive: true, once: true });
    }
    frame();
    return { cancel: stop };
}
