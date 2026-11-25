/**
 * @file use-tab-scroll-affordance.ts
 * @description Makes a horizontally scrolling tab bar say so (HOS-2610 F-24).
 *
 * When the tabs do not fit, the bar fades out on the side that still has tabs
 * hidden (`data-fade-start` / `data-fade-end`, painted by `Tabs.module.css`)
 * and the active tab is scrolled into view, inside the bar only, so the page
 * itself never moves.
 *
 * @module components/account/ui/use-tab-scroll-affordance
 */

import { type RefObject, useEffect, useRef } from 'react';
import { syncTabScrollFade, TAB_SCROLL_EDGE_TOLERANCE } from '@/lib/ui/tab-scroll-fade';

/** Selector of the tab that marks the current one, for both bar kinds. */
const ACTIVE_TAB_SELECTOR = '[aria-selected="true"], [aria-current="page"]';

/**
 * Keeps the fade flags of a tab bar in step with its scroll position and brings
 * the active tab into view.
 *
 * @param input - Options object.
 * @param input.selectedKey - Changes whenever the active tab changes, so the new
 *   one is scrolled into view.
 * @returns A ref for the scrolling bar element.
 */
export function useTabScrollAffordance<T extends HTMLElement>({
    selectedKey
}: {
    readonly selectedKey: string | undefined;
}): RefObject<T | null> {
    const barRef = useRef<T | null>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: `selectedKey` is a re-run trigger, not a value read inside the effect.
    useEffect(() => {
        const bar = barRef.current;
        if (!bar) return;

        const update = () => syncTabScrollFade({ bar });

        const active = bar.querySelector<HTMLElement>(ACTIVE_TAB_SELECTOR);
        if (active && bar.scrollWidth > bar.clientWidth + TAB_SCROLL_EDGE_TOLERANCE) {
            bar.scrollLeft = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
        }
        update();

        bar.addEventListener('scroll', update, { passive: true });
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
        observer?.observe(bar);
        return () => {
            bar.removeEventListener('scroll', update);
            observer?.disconnect();
        };
    }, [selectedKey]);

    return barRef;
}
