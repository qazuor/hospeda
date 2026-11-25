/**
 * @file tab-scroll-fade.ts
 * @description Pure DOM helper behind the scroll affordance of every tab bar
 * (HOS-2610 F-24): it writes `data-fade-start` / `data-fade-end` on a
 * horizontally scrolling bar so CSS can fade the edge that still hides tabs.
 *
 * Shared by the kit `Tabs` / `NavTabs` (through `useTabScrollAffordance`) and
 * the help landing's tabs, so there is one rule for "an edge still has tabs".
 *
 * @module lib/ui/tab-scroll-fade
 */

/** Slack, in px, before an edge counts as reached (sub-pixel rounding). */
export const TAB_SCROLL_EDGE_TOLERANCE = 1;

/**
 * Sets the fade flags of a scrolling bar from its current scroll position.
 *
 * @param input - Options object.
 * @param input.bar - The element that scrolls horizontally.
 */
export function syncTabScrollFade({ bar }: { readonly bar: HTMLElement }): void {
    const overflows = bar.scrollWidth > bar.clientWidth + TAB_SCROLL_EDGE_TOLERANCE;
    const atStart = bar.scrollLeft <= TAB_SCROLL_EDGE_TOLERANCE;
    const atEnd = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - TAB_SCROLL_EDGE_TOLERANCE;
    bar.dataset.fadeStart = String(overflows && !atStart);
    bar.dataset.fadeEnd = String(overflows && !atEnd);
}
