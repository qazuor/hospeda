/**
 * @file help-tabs.ts
 * @description Progressive enhancement of the help landing's audience tabs
 * (HOS-2410 `docs/web-ui.md` §2, AC-3, AC-4), WAI-ARIA tabs pattern.
 *
 * The server renders every panel as a plain `<section>` with its own `<h2>` and
 * a hidden tab list, so without JavaScript every audience is visible, stacked
 * (AC-4). This script turns that into tabs: it shows the tab list, gives the
 * panels their roles, hides all panels but the selected one, and keeps `?para=`
 * in the URL in step with the selection (`history.replaceState`).
 *
 * It listens for {@link HELP_SELECT_AUDIENCE_EVENT} (sent by the preselect
 * island) and fires {@link HELP_AUDIENCE_CHANGED_EVENT} after every change
 * (read by the search island's "only my account type" filter).
 */

import type { HelpAudience } from '@repo/help';
import { syncTabScrollFade } from '@/lib/ui/tab-scroll-fade';
import {
    HELP_AUDIENCE_CHANGED_EVENT,
    HELP_AUDIENCE_PARAM,
    HELP_SELECT_AUDIENCE_EVENT,
    type HelpAudienceEventDetail,
    parseHelpAudience
} from './help-audience-shared';

/** Class the root gets once the tabs are live. */
export const HELP_TABS_ENHANCED_CLASS = 'is-enhanced';

export { HELP_AUDIENCE_PARAM };

/** Arguments for {@link initHelpTabs}. RO-RO. */
export interface InitHelpTabsArgs {
    /** The `[data-help-tabs]` element. */
    readonly root: HTMLElement;
    /** Where the events are listened for and fired; defaults to `window`. */
    readonly eventTarget?: EventTarget;
}

/**
 * The tab a key moves to (WAI-ARIA tabs: arrows wrap, Home and End jump).
 *
 * @param args.key - `KeyboardEvent.key`
 * @param args.current - Index of the selected tab
 * @param args.count - How many tabs there are
 * @returns The index to select, or `undefined` for a key tabs ignore
 */
export function nextTabIndex({
    key,
    current,
    count
}: {
    readonly key: string;
    readonly current: number;
    readonly count: number;
}): number | undefined {
    const last = count - 1;
    switch (key) {
        case 'ArrowRight':
            return current >= last ? 0 : current + 1;
        case 'ArrowLeft':
            return current <= 0 ? last : current - 1;
        case 'Home':
            return 0;
        case 'End':
            return last;
        default:
            return undefined;
    }
}

/**
 * The horizontal scroll that brings a tab fully into view in a scrollable
 * tablist (narrow screens keep the five tabs on one row, HOS-2552). Moves as
 * little as possible: a tab already in view keeps the current scroll.
 *
 * @param args.tabStart - The tab's left edge, in tablist content coordinates
 * @param args.tabWidth - The tab's width
 * @param args.viewStart - The tablist's current `scrollLeft`
 * @param args.viewWidth - The tablist's visible width (`clientWidth`)
 * @returns The `scrollLeft` to set
 */
export function tabScrollLeft({
    tabStart,
    tabWidth,
    viewStart,
    viewWidth
}: {
    readonly tabStart: number;
    readonly tabWidth: number;
    readonly viewStart: number;
    readonly viewWidth: number;
}): number {
    if (tabStart < viewStart) {
        return tabStart;
    }
    const tabEnd = tabStart + tabWidth;
    if (tabEnd > viewStart + viewWidth) {
        return Math.min(tabStart, tabEnd - viewWidth);
    }
    return viewStart;
}

/** Scrolls the tablist (never the page) so the tab is fully visible. */
function revealTab({
    tablist,
    tab
}: {
    readonly tablist: HTMLElement;
    readonly tab: HTMLElement;
}): void {
    const listBox = tablist.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    tablist.scrollLeft = tabScrollLeft({
        tabStart: tabBox.left - listBox.left + tablist.scrollLeft,
        tabWidth: tabBox.width,
        viewStart: tablist.scrollLeft,
        viewWidth: tablist.clientWidth
    });
}

/** Writes `?para=<audience>` into the current URL without a navigation. */
function writeAudienceParam({ audience }: { readonly audience: HelpAudience }): void {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set(HELP_AUDIENCE_PARAM, audience);
        window.history.replaceState(window.history.state, '', url);
    } catch {
        // A URL that cannot be rewritten only loses the deep link.
    }
}

/**
 * Turns the server-rendered audience sections into tabs.
 *
 * @param args - The root element and the event target
 * @returns A cleanup function that removes the listeners
 */
export function initHelpTabs({ root, eventTarget = window }: InitHelpTabsArgs): () => void {
    const tablist = root.querySelector<HTMLElement>('[role="tablist"]');
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    if (tablist === null || tabs.length === 0) {
        return () => undefined;
    }
    const panelOf = (tab: HTMLButtonElement): HTMLElement | null =>
        root.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls') ?? ''}`);

    for (const tab of tabs) {
        const panel = panelOf(tab);
        panel?.setAttribute('role', 'tabpanel');
        panel?.setAttribute('aria-labelledby', tab.id);
        panel?.setAttribute('tabindex', '0');
    }

    const select = ({
        audience,
        focus,
        fromUser
    }: {
        readonly audience: HelpAudience;
        readonly focus: boolean;
        readonly fromUser: boolean;
    }): void => {
        const target = tabs.find((tab) => tab.dataset.audience === audience);
        if (target === undefined) {
            return;
        }
        for (const tab of tabs) {
            const selected = tab === target;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            const panel = panelOf(tab);
            if (panel !== null) {
                panel.hidden = !selected;
            }
        }
        root.dataset.selected = audience;
        revealTab({ tablist, tab: target });
        syncTabScrollFade({ bar: tablist });
        if (focus) {
            target.focus({ preventScroll: true });
        }
        if (fromUser) {
            writeAudienceParam({ audience });
        }
        eventTarget.dispatchEvent(
            new CustomEvent<HelpAudienceEventDetail>(HELP_AUDIENCE_CHANGED_EVENT, {
                detail: { audience }
            })
        );
    };

    const initial =
        parseHelpAudience({ value: root.dataset.selected }) ??
        parseHelpAudience({ value: tabs[0]?.dataset.audience });
    tablist.hidden = false;
    root.classList.add(HELP_TABS_ENHANCED_CLASS);
    if (initial !== undefined) {
        select({ audience: initial, focus: false, fromUser: false });
    }

    const onClick = (event: Event): void => {
        const tab = (event.target as Element | null)?.closest<HTMLButtonElement>('[role="tab"]');
        const audience = parseHelpAudience({ value: tab?.dataset.audience });
        if (audience !== undefined) {
            select({ audience, focus: false, fromUser: true });
        }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
        const current = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
        const next = nextTabIndex({ key: event.key, current, count: tabs.length });
        const audience =
            next === undefined
                ? undefined
                : parseHelpAudience({ value: tabs[next]?.dataset.audience });
        if (audience !== undefined) {
            event.preventDefault();
            select({ audience, focus: true, fromUser: true });
        }
    };

    const onSelectRequest = (event: Event): void => {
        const audience = parseHelpAudience({
            value: (event as CustomEvent<Partial<HelpAudienceEventDetail>>).detail?.audience
        });
        if (audience !== undefined) {
            select({ audience, focus: false, fromUser: false });
        }
    };

    const onScroll = (): void => syncTabScrollFade({ bar: tablist });
    tablist.addEventListener('scroll', onScroll, { passive: true });
    tablist.addEventListener('click', onClick);
    tablist.addEventListener('keydown', onKeyDown);
    eventTarget.addEventListener(HELP_SELECT_AUDIENCE_EVENT, onSelectRequest);
    return () => {
        tablist.removeEventListener('scroll', onScroll);
        tablist.removeEventListener('click', onClick);
        tablist.removeEventListener('keydown', onKeyDown);
        eventTarget.removeEventListener(HELP_SELECT_AUDIENCE_EVENT, onSelectRequest);
    };
}
