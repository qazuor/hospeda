/**
 * @file trade-category-labels.ts
 * @description Shared label helpers for provider trade categories (HOS-919).
 *
 * Category and group names are admin-managed multilang data (`nameI18n`), not
 * i18n keys, so every surface resolves them the same way: the page locale,
 * falling back to Spanish. This is the single place that rule lives; the
 * directory cards, the usage cards, the edit form, the marketing page and the
 * combobox all read it from here.
 */

import type { SupportedLocale } from '@/lib/i18n';

/** Multilang name as stored in the catalog: Spanish is required, the rest optional. */
export interface TradeCategoryNameI18n {
    readonly es: string;
    readonly en?: string;
    readonly pt?: string;
}

/** The minimal category shape the badge helpers need (a `HostTradeCategoryRef` fits). */
export interface TradeCategoryLabelSource {
    readonly slug: string;
    readonly nameI18n: TradeCategoryNameI18n;
}

/** A category ready to render as a badge. */
export interface TradeCategoryBadge {
    readonly slug: string;
    readonly label: string;
}

/** Result of {@link splitTradeCategoryBadges}. */
export interface TradeCategoryBadgeSplit {
    /** The first `max` categories, in the order received. */
    readonly visible: ReadonlyArray<TradeCategoryBadge>;
    /** How many categories did not fit (rendered as «+N»). */
    readonly overflowCount: number;
}

/** Badges a card shows before collapsing the rest into «+N». */
export const TRADE_CARD_MAX_BADGES = 3;

/**
 * Resolves a catalog name for a locale: the locale's own name, or Spanish when
 * it is missing or blank.
 *
 * @param params.nameI18n - Multilang name
 * @param params.locale - Page locale
 * @returns The display name
 */
export function resolveTradeCategoryName({
    nameI18n,
    locale
}: {
    readonly nameI18n: TradeCategoryNameI18n;
    readonly locale: SupportedLocale;
}): string {
    const own = nameI18n[locale];
    return own !== undefined && own.trim().length > 0 ? own : nameI18n.es;
}

/**
 * Splits a provider's categories into the badges to render and the overflow
 * count. Order is preserved: callers receive categories already in catalog
 * order, and this must not reshuffle them.
 *
 * @param params.categories - The provider's categories, in catalog order
 * @param params.locale - Page locale
 * @param params.max - How many badges to show (default {@link TRADE_CARD_MAX_BADGES}); pass `Infinity` to show all
 * @returns The visible badges and the number left out
 */
export function splitTradeCategoryBadges({
    categories,
    locale,
    max = TRADE_CARD_MAX_BADGES
}: {
    readonly categories: ReadonlyArray<TradeCategoryLabelSource>;
    readonly locale: SupportedLocale;
    readonly max?: number;
}): TradeCategoryBadgeSplit {
    const visible = categories.slice(0, max).map((category) => ({
        slug: category.slug,
        label: resolveTradeCategoryName({ nameI18n: category.nameI18n, locale })
    }));
    return { visible, overflowCount: Math.max(0, categories.length - visible.length) };
}
