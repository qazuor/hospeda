/**
 * @file TradesDirectory.client.tsx
 * @description React island for the host trades directory page.
 *
 * Features:
 * - Category filter pills ("Todos" + one pill per present category).
 * - Client-side filtering — no refetch needed.
 * - Category groups sorted ALPHABETICALLY by their localized i18n label
 *   (AC-1.5). The sort uses `Intl.Collator` for locale-aware comparison.
 * - Within each category group, trades keep the server-provided order
 *   (already name-ASC).
 * - TradeCard grid rendering.
 *
 * Receives trades as a prop from the SSR page (data already fetched
 * server-side). i18n is resolved client-side via `createTranslations(locale)`.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { HostTradePublic } from '@repo/schemas';
import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { TradeCard } from './TradeCard';
import styles from './TradesDirectory.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradesDirectoryProps {
    /** Trades returned by the server-side fetch (already owner-scoped) */
    readonly trades: ReadonlyArray<HostTradePublic>;
    /** Active UI locale for i18n and Intl.Collator */
    readonly locale: SupportedLocale;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a sorted list of unique categories present in the trades array.
 * Sorted ALPHABETICALLY by their localized label using `Intl.Collator` so
 * the visual order is consistent with the user's language (AC-1.5).
 *
 * @param trades - All available trades
 * @param getLabel - Callback that resolves a category key to its localized label
 * @param locale - BCP-47 locale for Intl.Collator
 * @returns Array of { category, label } sorted by label
 */
function buildSortedCategories({
    trades,
    getLabel,
    locale
}: {
    readonly trades: ReadonlyArray<HostTradePublic>;
    readonly getLabel: (category: string) => string;
    readonly locale: string;
}): ReadonlyArray<{ readonly category: string; readonly label: string }> {
    const seen = new Set<string>();
    for (const trade of trades) {
        seen.add(trade.category);
    }

    const collator = new Intl.Collator(locale, { sensitivity: 'base' });

    return Array.from(seen)
        .map((category) => ({ category, label: getLabel(category) }))
        .sort((a, b) => collator.compare(a.label, b.label));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TradesDirectory island — renders a filterable grid of host trade cards.
 *
 * @example
 * ```astro
 * <TradesDirectory client:idle trades={trades} locale={locale} />
 * ```
 */
export function TradesDirectory({ trades, locale }: TradesDirectoryProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // Build sorted category list (memoized — depends on trades + locale)
    const sortedCategories = useMemo(
        () =>
            buildSortedCategories({
                trades,
                getLabel: (cat) => t(`host-trades.categories.${cat}`, cat),
                locale
            }),
        [trades, locale, t]
    );

    // Filter trades by the selected category (client-side, no refetch)
    const visibleTrades = useMemo(
        () =>
            activeCategory === null
                ? trades
                : trades.filter((trade) => trade.category === activeCategory),
        [trades, activeCategory]
    );

    // Whether the active category filter returned an empty result
    const isFilteredEmpty = activeCategory !== null && visibleTrades.length === 0;

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div className={styles.container}>
            {/* ── Category filter pills ── */}
            <fieldset
                className={styles.filterBar}
                aria-label={t('host-trades.filter.all', 'Todos')}
            >
                {/* "Todos" pill */}
                <button
                    type="button"
                    className={cn(
                        styles.filterPill,
                        activeCategory === null && styles.filterPillActive
                    )}
                    onClick={() => setActiveCategory(null)}
                    aria-pressed={activeCategory === null}
                >
                    {t('host-trades.filter.all', 'Todos')}
                </button>

                {/* One pill per category present in the data, sorted by localized label */}
                {sortedCategories.map(({ category, label }) => (
                    <button
                        key={category}
                        type="button"
                        className={cn(
                            styles.filterPill,
                            activeCategory === category && styles.filterPillActive
                        )}
                        onClick={() =>
                            setActiveCategory(activeCategory === category ? null : category)
                        }
                        aria-pressed={activeCategory === category}
                    >
                        {label}
                    </button>
                ))}
            </fieldset>

            {/* ── Filtered-empty message ── */}
            {isFilteredEmpty ? (
                <output className={styles.filteredEmpty}>
                    {t(
                        'host-trades.emptyState.noTrades',
                        'No hay proveedores disponibles para tus destinos por ahora.'
                    )}
                </output>
            ) : (
                /* ── Trades grid ── */
                <ul
                    className={styles.grid}
                    aria-label={t('host-trades.page.title', 'Directorio de proveedores')}
                >
                    {visibleTrades.map((trade) => (
                        <li
                            key={trade.id}
                            className={styles.gridItem}
                        >
                            <TradeCard
                                trade={trade}
                                locale={locale}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
