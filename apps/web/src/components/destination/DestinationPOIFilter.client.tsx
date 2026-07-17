/**
 * @file DestinationPOIFilter.client.tsx
 * @description Thematic POI category filter chips for the destination detail
 * page (HOS-147). A `client:load` island that filters the destination's POIs
 * by category ENTIRELY client-side (owner decision D-3): the destination POI
 * endpoint already returns the full, unpaginated set, so this toggles the
 * already-rendered SSR cards (`[data-poi-card]` in `DestinationPOISection.astro`)
 * and broadcasts to the map island — no server round-trip.
 *
 * Design contract:
 * - Chips are `<a href>` (shareable, keyboard-operable) carrying `aria-current`
 *   for the active state — NEVER `aria-pressed` (invalid on `<a>`; the CI a11y
 *   sweep removes it). The `href` reflects the toggled URL, but the click is
 *   intercepted (`preventDefault`) and handled client-side.
 * - The active selection lives ONLY in the URL `?categories=` param (for
 *   shareability + back/forward), read via `readFacetActiveValues`.
 * - OR / any-of semantics via the shared `matchesActivePoiCategories` predicate,
 *   the same rule the map applies (spec R-3).
 * - "Clear (N)" chip appears at >=2 active values (`buildClearFacetChip`).
 * - Only categories actually PRESENT among the destination's POIs are rendered
 *   (D-5) — the page computes that set and passes it in.
 *
 * Deep-link flash (accepted, D-3): the SSR HTML shows every POI; when the page
 * loads with `?categories=` already set, this island hides the non-matching
 * cards only after it hydrates.
 */
import { getPoiCategoryColorScheme, getPoiCategoryIcon, XCircleIcon } from '@repo/icons';
import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { buildClearFacetChip } from '@/lib/filters/build-clear-facet-chip';
import { FACET_CONFIG_BY_ID } from '@/lib/filters/facet-config';
import { matchesActivePoiCategories } from '@/lib/filters/match-poi-category-filter';
import { POI_CATEGORY_FILTER_EVENT } from '@/lib/filters/poi-category-filter-event';
import { readFacetActiveValues } from '@/lib/filters/read-facet-active-values';
import { buildMultiToggleParamHref } from '@/lib/filters/toggle-multi-query-param';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { I18nTextLike } from '@/lib/resolve-i18n-text';
import { resolveI18nText } from '@/lib/resolve-i18n-text';
import styles from './DestinationPOIFilter.module.css';

/** A single filter-chip option — a POI category present in this destination. */
export interface DestinationPOIFilterCategory {
    readonly slug: string;
    readonly nameI18n?: I18nTextLike | null;
    readonly icon?: string | null;
    readonly displayWeight?: number;
}

export interface DestinationPOIFilterProps {
    /**
     * Categories present among the destination's POIs (D-5), already ordered
     * for display (displayWeight desc, then slug). Rendered one chip each.
     */
    readonly categories: ReadonlyArray<DestinationPOIFilterCategory>;
    readonly locale: SupportedLocale;
}

const FACET = FACET_CONFIG_BY_ID.pointOfInterestCategory;

/**
 * Reads the currently active category slugs from `window.location`.
 * Returns `[]` during SSR (no `window`) — the island seeds real state on mount.
 */
function readActiveFromUrl(): string[] {
    if (typeof window === 'undefined') return [];
    return [
        ...readFacetActiveValues({
            searchParams: new URLSearchParams(window.location.search),
            paramKey: FACET.paramKey
        })
    ];
}

export function DestinationPOIFilter({ categories, locale }: DestinationPOIFilterProps) {
    const { t } = createTranslations(locale);
    const [activeSlugs, setActiveSlugs] = useState<readonly string[]>([]);

    /**
     * Apply the active selection to the SSR card grid + empty state, and
     * broadcast to the map. Pure DOM work — safe to call post-hydration only.
     */
    const applyFilter = useCallback((active: readonly string[]) => {
        if (typeof document === 'undefined') return;
        const cards = document.querySelectorAll<HTMLElement>('[data-poi-card]');
        let visibleCount = 0;
        for (const card of cards) {
            const slugs = (card.dataset.poiCategories ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            const visible = matchesActivePoiCategories({
                poiCategorySlugs: slugs,
                activeCategorySlugs: active
            });
            card.hidden = !visible;
            if (visible) visibleCount += 1;
        }
        const empty = document.querySelector<HTMLElement>('[data-poi-empty]');
        if (empty) empty.hidden = visibleCount > 0;

        window.dispatchEvent(
            new CustomEvent(POI_CATEGORY_FILTER_EVENT, { detail: { categories: [...active] } })
        );
    }, []);

    // Seed from the URL on mount, apply the initial filter (honors a deep-link),
    // and keep in sync with browser back/forward.
    useEffect(() => {
        const sync = () => {
            const next = readActiveFromUrl();
            setActiveSlugs(next);
            applyFilter(next);
        };
        sync();
        window.addEventListener('popstate', sync);
        return () => window.removeEventListener('popstate', sync);
    }, [applyFilter]);

    const handleToggle = useCallback(
        (slug: string, event: MouseEvent<HTMLAnchorElement>) => {
            // Client-side only — never navigate.
            event.preventDefault();
            const href = buildMultiToggleParamHref({
                baseUrl: window.location.pathname,
                searchParams: new URLSearchParams(window.location.search),
                key: FACET.paramKey,
                value: slug
            });
            window.history.pushState({}, '', href);
            const next = readActiveFromUrl();
            setActiveSlugs(next);
            applyFilter(next);
        },
        [applyFilter]
    );

    const handleClear = useCallback(
        (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            window.history.pushState({}, '', window.location.pathname);
            setActiveSlugs([]);
            applyFilter([]);
        },
        [applyFilter]
    );

    const activeSet = useMemo(() => new Set(activeSlugs), [activeSlugs]);

    // hrefs (for shareability + right-click-open) are computed from the CURRENT
    // location. SSR has no `window`, so they fall back to empty — the island
    // recomputes real hrefs after hydration.
    const currentSearch = typeof window === 'undefined' ? '' : window.location.search;
    const currentPath = typeof window === 'undefined' ? '' : window.location.pathname;

    const clearChip = buildClearFacetChip({
        baseUrl: currentPath,
        searchParams: new URLSearchParams(currentSearch),
        paramKey: FACET.paramKey,
        count: activeSlugs.length,
        labelTemplate: t(
            'destinations.detailPage.pointsOfInterestFilterClear',
            'Limpiar ({{count}})'
        ),
        ariaLabelTemplate: t(
            'destinations.detailPage.pointsOfInterestFilterClearAria',
            'Quitar los {{count}} filtros de categoría'
        ),
        icon: XCircleIcon
    });

    if (categories.length === 0) return null;

    return (
        <nav
            className={styles.filter}
            aria-label={t(
                'destinations.detailPage.pointsOfInterestFilterLabel',
                'Filtrar por categoría'
            )}
        >
            <ul className={styles.list}>
                {categories.map((category) => {
                    const active = activeSet.has(category.slug);
                    const Icon = getPoiCategoryIcon({ slug: category.slug });
                    const color = getPoiCategoryColorScheme({ slug: category.slug }).fill;
                    const label = resolveI18nText(category.nameI18n, locale) || category.slug;
                    const href = buildMultiToggleParamHref({
                        baseUrl: currentPath,
                        searchParams: new URLSearchParams(currentSearch),
                        key: FACET.paramKey,
                        value: category.slug
                    });
                    return (
                        <li key={category.slug}>
                            <a
                                href={href}
                                className={cn(styles.chip, active && styles.chipActive)}
                                aria-current={active ? 'true' : undefined}
                                onClick={(event) => handleToggle(category.slug, event)}
                            >
                                <Icon
                                    size={16}
                                    weight="fill"
                                    color={color}
                                    aria-hidden="true"
                                />
                                <span>{label}</span>
                            </a>
                        </li>
                    );
                })}
                {clearChip && (
                    <li>
                        <a
                            href={clearChip.href}
                            className={cn(styles.chip, styles.chipClear)}
                            aria-label={clearChip.ariaLabel}
                            onClick={handleClear}
                        >
                            <clearChip.icon
                                size={16}
                                weight="bold"
                                aria-hidden="true"
                            />
                            <span>{clearChip.label}</span>
                        </a>
                    </li>
                )}
            </ul>
        </nav>
    );
}
