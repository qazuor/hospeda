import * as React from 'react';

/**
 * Cross-tree section navigation for the entity accordion.
 *
 * The score popover (rendered in the page header) needs to reach into the
 * accordion (rendered inside EntityFormProvider) without lifting state to a
 * shared ancestor. We use a window-level CustomEvent as a tiny event bus: the
 * popover fires `openSection(id)`; the accordion listens via
 * `useSectionOpenListener` and toggles/scrolls accordingly.
 *
 * Why an event bus and not a context: the trigger lives OUTSIDE the
 * EntityFormProvider tree, so a regular React context would require lifting
 * the accordion state up to EntityPageBase or higher. That refactor blast
 * radius is large and not justified for one popover. If a second consumer
 * shows up, swap to a controller context — the event surface here is
 * intentionally tiny.
 */
const SECTION_OPEN_EVENT = 'admin:open-section';

interface SectionOpenDetail {
    readonly id: string;
}

/**
 * Request the accordion to open and scroll to the given section.
 * No-op on the server (guards `window`).
 */
export function openSection(sectionId: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent<SectionOpenDetail>(SECTION_OPEN_EVENT, {
            detail: { id: sectionId }
        })
    );
}

/**
 * Subscribe to `openSection` requests. The handler is wrapped in a ref so
 * callers don't need to memoize it — the listener registers once per mount.
 */
export function useSectionOpenListener(handler: (sectionId: string) => void): void {
    const handlerRef = React.useRef(handler);
    handlerRef.current = handler;

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const listener = (event: Event) => {
            const detail = (event as CustomEvent<SectionOpenDetail>).detail;
            if (detail?.id) handlerRef.current(detail.id);
        };
        window.addEventListener(SECTION_OPEN_EVENT, listener);
        return () => window.removeEventListener(SECTION_OPEN_EVENT, listener);
    }, []);
}
