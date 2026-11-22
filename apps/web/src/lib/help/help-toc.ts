/**
 * @file help-toc.ts
 * @description Highlights the section being read in a help article's side index
 * (HOS-2410 `docs/web-ui.md` §4).
 *
 * The current section is the LAST heading whose top has reached the line where
 * an anchor jump lands it (the page's `scroll-padding-top` plus the heading's
 * own `scroll-margin-top`, with a small tolerance). That is the heading the
 * reader sees just under the sticky navbar. The previous rule ("topmost heading
 * in the upper 40% of the viewport") picked the section ABOVE the chosen one
 * whenever that section was short, because its heading was still on screen
 * (HOS-2552).
 *
 * A click on an index link marks its section at once and keeps it marked until
 * the reader scrolls on their own: the last sections of a page may never reach
 * the line, since the page cannot scroll past its end.
 *
 * Without JavaScript the index is a plain list of links, which is all the
 * reader needs.
 */

/** Pixels below the landing line that still count as "reached". */
export const HELP_TOC_TOLERANCE_PX = 8;

/** Arguments for {@link initHelpToc}. RO-RO. */
export interface InitHelpTocArgs {
    /** Every `nav[data-help-toc]` of the page (side index and mobile index). */
    readonly navs: readonly HTMLElement[];
    /** Where scroll and input events are listened for; defaults to `window`. */
    readonly win?: Window;
}

/**
 * Marks one section id as current in every index.
 *
 * @param args.navs - The indexes
 * @param args.id - The section anchor id
 */
export function markHelpTocCurrent({
    navs,
    id
}: {
    readonly navs: readonly HTMLElement[];
    readonly id: string;
}): void {
    for (const nav of navs) {
        for (const link of nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
            if (link.getAttribute('href') === `#${id}`) {
                link.setAttribute('aria-current', 'location');
            } else {
                link.removeAttribute('aria-current');
            }
        }
    }
}

/** One heading's position for {@link pickHelpTocCurrent}. */
export interface HelpTocHeadingPosition {
    readonly id: string;
    /** `getBoundingClientRect().top`. */
    readonly top: number;
    /** Where an anchor jump puts this heading's top (padding + margin). */
    readonly landingLine: number;
}

/**
 * The current section: the last heading, in document order, whose top has
 * reached its landing line; the first heading when none has yet.
 *
 * @param args.headings - The headings in document order
 * @returns The id to mark, or `undefined` when there are no headings
 */
export function pickHelpTocCurrent({
    headings
}: {
    readonly headings: readonly HelpTocHeadingPosition[];
}): string | undefined {
    let current = headings[0]?.id;
    for (const heading of headings) {
        if (heading.top <= heading.landingLine + HELP_TOC_TOLERANCE_PX) {
            current = heading.id;
        }
    }
    return current;
}

/** Reads a CSS length in pixels, `0` when it is not one. */
function pixels(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Starts highlighting the current section.
 *
 * @param args - The indexes and the window
 * @returns A cleanup function that removes the listeners
 */
export function initHelpToc({ navs, win = window }: InitHelpTocArgs): () => void {
    const first = navs[0];
    if (first === undefined) {
        return () => undefined;
    }
    const doc = win.document;
    const ids = [...first.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
        .map((link) => link.getAttribute('href')?.slice(1) ?? '')
        .filter((id) => id !== '');
    const targets = ids
        .map((id) => doc.getElementById(id))
        .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) {
        return () => undefined;
    }

    /** Set by an index click; cleared by the reader's own scrolling input. */
    let pinned = false;
    let frame: number | undefined;

    const update = (): void => {
        frame = undefined;
        if (pinned) {
            return;
        }
        const padding = pixels(win.getComputedStyle(doc.documentElement).scrollPaddingTop);
        const current = pickHelpTocCurrent({
            headings: targets.map((target) => ({
                id: target.id,
                top: target.getBoundingClientRect().top,
                landingLine: padding + pixels(win.getComputedStyle(target).scrollMarginTop)
            }))
        });
        if (current !== undefined) {
            markHelpTocCurrent({ navs, id: current });
        }
    };

    const onScroll = (): void => {
        if (frame === undefined) {
            frame = win.requestAnimationFrame(update);
        }
    };

    const onClick = (event: Event): void => {
        const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
        const id = link?.getAttribute('href')?.slice(1);
        if (id !== undefined && ids.includes(id)) {
            pinned = true;
            markHelpTocCurrent({ navs, id });
        }
    };

    const onUserScroll = (): void => {
        pinned = false;
    };

    const userScrollEvents = ['wheel', 'touchstart', 'keydown'] as const;
    win.addEventListener('scroll', onScroll, { passive: true });
    for (const name of userScrollEvents) {
        win.addEventListener(name, onUserScroll, { passive: true });
    }
    for (const nav of navs) {
        nav.addEventListener('click', onClick);
    }
    update();

    return () => {
        win.removeEventListener('scroll', onScroll);
        for (const name of userScrollEvents) {
            win.removeEventListener(name, onUserScroll);
        }
        for (const nav of navs) {
            nav.removeEventListener('click', onClick);
        }
        if (frame !== undefined) {
            win.cancelAnimationFrame(frame);
        }
    };
}
