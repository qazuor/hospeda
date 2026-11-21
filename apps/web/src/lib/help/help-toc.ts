/**
 * @file help-toc.ts
 * @description Highlights the section being read in a help article's side index
 * (HOS-2410 `docs/web-ui.md` §4). An `IntersectionObserver` watches the section
 * headings; the link of the topmost visible one gets `aria-current="location"`.
 * Without JavaScript, or without the observer, the index is a plain list of
 * links, which is all the reader needs.
 */

/** Arguments for {@link initHelpToc}. RO-RO. */
export interface InitHelpTocArgs {
    /** Every `nav[data-help-toc]` of the page (side index and mobile index). */
    readonly navs: readonly HTMLElement[];
    /** The observer constructor; injected by tests. Defaults to the global one. */
    readonly Observer?: typeof IntersectionObserver;
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

/**
 * Starts highlighting the current section.
 *
 * @param args - The indexes and the observer constructor
 * @returns A cleanup function that disconnects the observer
 */
export function initHelpToc({ navs, Observer }: InitHelpTocArgs): () => void {
    const ObserverCtor =
        Observer ??
        (typeof IntersectionObserver === 'undefined' ? undefined : IntersectionObserver);
    const first = navs[0];
    if (ObserverCtor === undefined || first === undefined) {
        return () => undefined;
    }
    const ids = [...first.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
        .map((link) => link.getAttribute('href')?.slice(1) ?? '')
        .filter((id) => id !== '');
    const targets = ids
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element !== null);
    const visible = new Set<string>();
    const observer = new ObserverCtor(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    visible.add(entry.target.id);
                } else {
                    visible.delete(entry.target.id);
                }
            }
            const current = ids.find((id) => visible.has(id));
            if (current !== undefined) {
                markHelpTocCurrent({ navs, id: current });
            }
        },
        { rootMargin: '0px 0px -60% 0px' }
    );
    for (const target of targets) {
        observer.observe(target);
    }
    return () => observer.disconnect();
}
