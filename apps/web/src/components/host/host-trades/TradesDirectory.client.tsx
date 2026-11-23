/**
 * @file TradesDirectory.client.tsx
 * @description React island for the host trades directory page.
 *
 * Features (HOS-919 US-5):
 * - Category filter chips (kit `FilterChips`, "Todos" + one chip per category
 *   present in the result set), multi-select with ANY-OF semantics: a provider is listed when
 *   it has at least one of the selected categories, and once however many it
 *   matches.
 * - Pills follow the catalog order (group weight, then category weight). The
 *   page passes that order as `catalogOrder` (slugs); without it the order of
 *   first appearance is used, which is catalog order for every single provider
 *   because the API returns each provider's categories already sorted.
 * - Client-side filtering — no refetch needed.
 * - Providers keep the server-provided order (name ASC); filtering never
 *   re-sorts them.
 * - TradeCard grid rendering, each card with its own category badges.
 *
 * Receives trades as a prop from the SSR page (data already fetched
 * server-side). i18n is resolved client-side via `createTranslations(locale)`;
 * category labels come from the multilang catalog name.
 */

import type { HostTradePublic } from '@repo/schemas';
import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { Button, EmptyState, FilterChips } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolveTradeCategoryName } from '@/lib/trade-category-labels';
import { TradeCard } from './TradeCard';
import styles from './TradesDirectory.module.css';

/** Value of the «Todos» chip. It is exclusive and never reaches `activeSlugs`. */
const ALL_CHIP = '__all__';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradesDirectoryProps {
    /** Trades returned by the server-side fetch (already owner-scoped) */
    readonly trades: ReadonlyArray<HostTradePublic>;
    /** Active UI locale for i18n */
    readonly locale: SupportedLocale;
    /**
     * Category slugs in catalog order (group weight, then category weight).
     * Optional: when absent, pills keep the order in which categories first
     * appear across the providers.
     */
    readonly catalogOrder?: ReadonlyArray<string>;
}

interface CategoryPill {
    readonly slug: string;
    readonly label: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the filter pills: the union of the categories present in the result
 * set, each once, in catalog order.
 *
 * Categories the catalog order does not mention sort after the known ones, in
 * order of first appearance. Array `sort` is stable, so ties keep that order.
 *
 * @param params.trades - Providers in the result set
 * @param params.locale - Page locale, for the label
 * @param params.catalogOrder - Slugs in catalog order, when the page has them
 * @returns The pills to render
 */
function buildCategoryPills({
    trades,
    locale,
    catalogOrder
}: {
    readonly trades: ReadonlyArray<HostTradePublic>;
    readonly locale: SupportedLocale;
    readonly catalogOrder?: ReadonlyArray<string>;
}): ReadonlyArray<CategoryPill> {
    const bySlug = new Map<string, CategoryPill>();
    for (const trade of trades) {
        for (const category of trade.categories) {
            if (!bySlug.has(category.slug)) {
                bySlug.set(category.slug, {
                    slug: category.slug,
                    label: resolveTradeCategoryName({ nameI18n: category.nameI18n, locale })
                });
            }
        }
    }

    const pills = Array.from(bySlug.values());
    if (!catalogOrder || catalogOrder.length === 0) return pills;

    const rank = (slug: string): number => {
        const index = catalogOrder.indexOf(slug);
        return index === -1 ? Number.POSITIVE_INFINITY : index;
    };
    return pills.sort((a, b) => {
        const ra = rank(a.slug);
        const rb = rank(b.slug);
        if (ra === rb) return 0;
        return ra < rb ? -1 : 1;
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TradesDirectory island — renders a filterable grid of host trade cards.
 *
 * @example
 * ```astro
 * <TradesDirectory client:idle trades={trades} locale={locale} catalogOrder={order} />
 * ```
 */
export function TradesDirectory({
    trades,
    locale,
    catalogOrder
}: TradesDirectoryProps): JSX.Element {
    const { t } = createTranslations(locale);

    // Selected category slugs. Empty means "Todos" (no filter).
    const [activeSlugs, setActiveSlugs] = useState<readonly string[]>([]);

    const pills = useMemo(
        () => buildCategoryPills({ trades, locale, catalogOrder }),
        [trades, locale, catalogOrder]
    );

    // Any-of filter (client-side, no refetch). `filter` keeps each provider once.
    const visibleTrades = useMemo(
        () =>
            activeSlugs.length === 0
                ? trades
                : trades.filter((trade) =>
                      trade.categories.some((category) => activeSlugs.includes(category.slug))
                  ),
        [trades, activeSlugs]
    );

    // Whether the active category filter returned an empty result
    const isFilteredEmpty = activeSlugs.length > 0 && visibleTrades.length === 0;

    const chipItems = useMemo(
        () => [
            {
                value: ALL_CHIP,
                label: t('host-trades.filter.all', 'Todos'),
                exclusive: true
            },
            ...pills.map(({ slug, label }) => ({ value: slug, label }))
        ],
        [pills, t]
    );

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div className={styles.container}>
            {/* ── Category filter chips: "Todos" + one per category, in catalog order ── */}
            <FilterChips
                mode="multiple"
                label={t('host-trades.filter.label', 'Filtrar por rubro')}
                items={chipItems}
                value={activeSlugs}
                onChange={setActiveSlugs}
            />

            {/* ── Filtered-empty state, with a way out ── */}
            {isFilteredEmpty ? (
                <EmptyState
                    title={t(
                        'host-trades.emptyState.filteredTitle',
                        'Ningún proveedor con esos rubros'
                    )}
                    description={t(
                        'host-trades.emptyState.noTrades',
                        'No hay proveedores disponibles para tus destinos por ahora.'
                    )}
                    action={
                        <Button
                            variant="secondary"
                            onClick={() => setActiveSlugs([])}
                        >
                            {t('host-trades.filter.clear', 'Quitar filtros')}
                        </Button>
                    }
                />
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
