/**
 * @file provider-tabs.ts
 * @description Tab resolution for `/mi-cuenta/proveedor` (HOS-376 T-050).
 *
 * The active tab lives in the URL rather than in component state, and that is a
 * deliberate trade rather than a shortcut:
 *
 * - Only the active tab's island is rendered, so a provider reading his reviews
 *   never downloads the declaration form. Client-side tabs would ship all four.
 * - Each tab is linkable and survives a reload, which matters because the panel
 *   is where a provider is told his declaration is suspended.
 * - The page reads only the data the active tab needs — one request instead of
 *   four on every visit.
 *
 * The cost is a navigation per switch. For a page opened rarely and read slowly,
 * that is the right side of the trade.
 */

/** The four panels, in the order they are shown. */
export const PROVIDER_TABS = ['ficha', 'usos', 'valoraciones', 'qr'] as const;

/** One of the four panels. */
export type ProviderTab = (typeof PROVIDER_TABS)[number];

/** The panel shown when the URL names none, or names one that does not exist. */
export const DEFAULT_PROVIDER_TAB: ProviderTab = 'ficha';

/**
 * Resolves the tab a URL asks for.
 *
 * An unknown value falls back to the default rather than erroring: the query
 * string is user-editable, and a typo in it should show the listing, not a
 * broken page.
 *
 * @param value - The raw `?tab=` value, if any.
 * @returns The tab to render.
 */
export function resolveProviderTab(value: string | null | undefined): ProviderTab {
    if (!value) return DEFAULT_PROVIDER_TAB;
    return (PROVIDER_TABS as readonly string[]).includes(value)
        ? (value as ProviderTab)
        : DEFAULT_PROVIDER_TAB;
}
