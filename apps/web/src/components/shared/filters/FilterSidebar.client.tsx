/**
 * @file FilterSidebar.client.tsx
 * @description Interactive filter sidebar for listing pages. Provides checkbox, radio,
 * range, search, stepper, stars, toggle, dual-range, and select-search filter groups
 * with sort dropdown.
 *
 * On mobile (< 768px): renders as a floating trigger button + full-height drawer.
 * On desktop (>= 768px): renders as a static sidebar panel.
 *
 * Navigation behavior: every state change triggers a debounced navigation (500ms)
 * via Astro View Transitions. No apply button required.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import styles from './FilterSidebar.module.css';
import { FilterGroup } from './components/FilterGroup';
import { MobileDrawer } from './components/MobileDrawer';
import { SortPopover } from './components/SortPopover';
import {
    buildParamsFromState,
    computeInitialCollapsed,
    filterReducer,
    groupActiveCount,
    groupHasActiveSelection,
    initStateFromParams
} from './filter-reducer';
import { FilterGroupContent } from './filter-types/FilterGroupContent';
import type {
    FilterAction,
    FilterGroup as FilterGroupType,
    FilterState
} from './filter-types/filter.types';
import { useFilterDebounce } from './hooks/useFilterDebounce';

// Re-export public types for consumers of this component
export type { FilterGroup } from './filter-types/filter.types';

/** Sort option for the sort dropdown. */
interface SortOption {
    readonly value: string;
    readonly label: string;
}

/** Props for the FilterSidebar component. */
export interface FilterSidebarProps {
    readonly locale: SupportedLocale;
    readonly filters: readonly FilterGroupType[];
    readonly sortOptions?: readonly SortOption[];
    readonly defaultSort?: string;
    /**
     * Initial filter values passed from the server (Astro SSR) to avoid
     * the hydration flash caused by reading `window.location.search` on mount.
     * Keys match URL param names (e.g. `q`, `type`, `minPrice`, `amenities`).
     */
    readonly initialParams?: Readonly<Record<string, string>>;
    /**
     * Optional callback when filters change. If omitted, the component
     * navigates by updating `window.location.search` (the default behavior
     * for Astro islands where functions cannot be serialized as props).
     */
    readonly onFiltersChange?: (params: URLSearchParams) => void;
    /**
     * Layout position of the filter panel on desktop (>=768px).
     *
     * - `'left'` (default): static panel to the left of the content grid.
     * - `'top'`: horizontal bar above the content area.
     *
     * On mobile (<768px) both variants collapse to the same floating-button +
     * left-side drawer.
     */
    readonly position?: 'left' | 'top';
    readonly className?: string;
}

// --- SidebarPanel sub-component ---

/** Props for the SidebarPanel inner layout component. */
interface SidebarPanelProps {
    readonly filters: readonly FilterGroupType[];
    readonly state: FilterState;
    readonly dispatch: React.Dispatch<FilterAction>;
    readonly collapsed: Record<string, boolean>;
    readonly locale: SupportedLocale;
    readonly t: ReturnType<typeof createTranslations>['t'];
    readonly activeCount: number;
    readonly isNavigating: boolean;
    readonly sortOptions?: readonly SortOption[];
    readonly onToggleGroup: (groupId: string) => void;
    readonly onClearAll: () => void;
    readonly onResetGroup: (groupId: string) => void;
    readonly drawerMode?: boolean;
    readonly onCloseDrawer?: () => void;
}

/**
 * Inner panel content shared between desktop sidebar and mobile drawer.
 * Renders the header (title, badge, sort, clear-all) and the scrollable body
 * with inline toggle filters and collapsible filter groups.
 */
function SidebarPanel({
    filters,
    state,
    dispatch,
    collapsed,
    locale,
    t,
    activeCount,
    isNavigating,
    sortOptions,
    onToggleGroup,
    onClearAll,
    onResetGroup,
    drawerMode = false,
    onCloseDrawer
}: SidebarPanelProps) {
    const inlineFilters = filters.filter((g) => g.type === 'toggle');
    const collapsibleFilters = filters.filter((g) => g.type !== 'toggle');

    return (
        <>
            <div className={styles.sidebarHeader}>
                <div className={styles.headerTop}>
                    <h2 className={styles.title}>
                        {t('ui.filter.title', 'Filtros')}
                        {activeCount > 0 && (
                            <span
                                className={styles.titleBadge}
                                aria-label={
                                    activeCount === 1
                                        ? t(
                                              'ui.filter.activeCount',
                                              `${activeCount} filtro activo`
                                          ).replace('{{count}}', String(activeCount))
                                        : t(
                                              'ui.filter.activeCountPlural',
                                              `${activeCount} filtros activos`
                                          ).replace('{{count}}', String(activeCount))
                                }
                            >
                                {activeCount}
                            </span>
                        )}
                        {isNavigating && (
                            <span
                                className={styles.loadingIndicator}
                                aria-hidden="true"
                            />
                        )}
                    </h2>
                    <div className={styles.headerActions}>
                        {sortOptions && sortOptions.length > 0 && (
                            <SortPopover
                                options={sortOptions}
                                value={state.sort}
                                onChange={(v) => dispatch({ type: 'SET_SORT', value: v })}
                                locale={locale}
                            />
                        )}
                        {activeCount > 0 && (
                            <button
                                type="button"
                                className={styles.clearAllBtn}
                                onClick={onClearAll}
                            >
                                {t('ui.filter.clearAll', 'Limpiar filtros')}
                            </button>
                        )}
                        {drawerMode && (
                            <button
                                type="button"
                                className={styles.drawerClose}
                                onClick={onCloseDrawer}
                                aria-label={t('ui.filter.closeFilters', 'Cerrar filtros')}
                            >
                                &times;
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.sidebarBody}>
                {/* Inline toggle filters — always visible, no collapsible wrapper */}
                {inlineFilters.map((group) => {
                    const hasActive = groupHasActiveSelection(group, state);
                    return (
                        <div
                            key={group.id}
                            className={styles.inlineFilter}
                        >
                            <FilterGroupContent
                                group={group}
                                state={state}
                                dispatch={dispatch}
                                locale={locale}
                            />
                            {hasActive && (
                                <button
                                    type="button"
                                    className={styles.groupReset}
                                    onClick={() => onResetGroup(group.id)}
                                    aria-label={`${t('ui.filter.reset', 'Limpiar')} ${group.label}`}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Collapsible filter groups */}
                {collapsibleFilters.map((group) => {
                    const hasActive = groupHasActiveSelection(group, state);
                    const activeCount = groupActiveCount(group, state);
                    return (
                        <FilterGroup
                            key={group.id}
                            id={group.id}
                            label={group.label}
                            locale={locale}
                            collapsed={!!collapsed[group.id]}
                            hasActive={hasActive}
                            activeCount={activeCount}
                            onToggle={() => onToggleGroup(group.id)}
                            onReset={() => onResetGroup(group.id)}
                        >
                            <FilterGroupContent
                                group={group}
                                state={state}
                                dispatch={dispatch}
                                onSearchChange={(v: string) =>
                                    dispatch({ type: 'SET_SEARCH', value: v })
                                }
                                locale={locale}
                            />
                        </FilterGroup>
                    );
                })}
            </div>
        </>
    );
}

// --- Main component ---

/**
 * FilterSidebar component.
 * Renders collapsible filter groups with a sort dropdown.
 * Every state change triggers a debounced navigation (500ms) via Astro View Transitions.
 *
 * Responsive behavior:
 * - Desktop (>= 768px): static panel, layout depends on `position` prop.
 * - Mobile (< 768px): floating trigger button + full-height drawer (position-agnostic).
 */
export function FilterSidebar({
    locale,
    filters,
    sortOptions,
    defaultSort = '',
    initialParams,
    onFiltersChange,
    position = 'left',
    className
}: FilterSidebarProps) {
    const { t } = createTranslations(locale);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { debouncedNavigate, isPending, clearPending } = useFilterDebounce();
    const isInitialMount = useRef(true);

    const [state, dispatch] = useReducer(
        filterReducer,
        { filters, defaultSort, params: initialParams ?? {} },
        ({ filters: f, defaultSort: ds, params: p }) =>
            initStateFromParams({ filters: f, defaultSort: ds, params: p })
    );

    // Filter render order is the declaration order from the consuming page —
    // it stays stable across navigations so users build spatial memory of
    // where each filter lives. Active filters get a background tint + count
    // badge in `FilterGroup` (see CSS module) instead of floating to the top.
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
        computeInitialCollapsed({ filters, state })
    );

    // Close drawer when viewport grows beyond mobile breakpoint
    useEffect(() => {
        const mql = window.matchMedia('(min-width: 768px)');
        const handleChange = (e: MediaQueryListEvent) => {
            if (e.matches) setIsDrawerOpen(false);
        };
        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, []);

    // Handle Astro page lifecycle events
    useEffect(() => {
        const handleBeforeSwap = () => {
            setIsDrawerOpen(false);
            clearPending();
        };
        document.addEventListener('astro:before-swap', handleBeforeSwap);
        document.addEventListener('astro:page-load', clearPending);
        return () => {
            document.removeEventListener('astro:before-swap', handleBeforeSwap);
            document.removeEventListener('astro:page-load', clearPending);
        };
    }, [clearPending]);

    // Refs to avoid stale closures in the debounce
    const onFiltersChangeRef = useRef(onFiltersChange);
    onFiltersChangeRef.current = onFiltersChange;

    const stateRef = useRef(state);
    stateRef.current = state;

    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    /**
     * Auto-navigate on every state change with a 500ms debounce.
     * Skips the initial mount (state already matches the URL).
     * biome-ignore lint/correctness/useExhaustiveDependencies: `state` is intentionally the
     * only dependency — the reducer returns a new object on every change, making this
     * a correct reactive trigger. All other values accessed via refs to avoid stale closures.
     */
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        debouncedNavigate(
            buildParamsFromState({ state: stateRef.current, filters: filtersRef.current }),
            onFiltersChangeRef.current
        );
    }, [state, debouncedNavigate]);

    const handleClearAll = useCallback(() => dispatch({ type: 'CLEAR_ALL' }), []);

    const handleResetGroup = useCallback(
        (groupId: string) => {
            const group = filters.find((g) => g.id === groupId);
            if (!group) return;
            if (group.type === 'search') {
                dispatch({ type: 'SET_SEARCH', value: '' });
            } else {
                dispatch({ type: 'CLEAR_GROUP', groupId });
            }
        },
        [filters]
    );

    const toggleGroup = useCallback((groupId: string) => {
        setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    }, []);

    const activeCount = useMemo(
        () => filters.filter((g) => groupHasActiveSelection(g, state)).length,
        [filters, state]
    );

    const panelProps: SidebarPanelProps = {
        filters,
        state,
        dispatch,
        collapsed,
        locale,
        t,
        activeCount,
        isNavigating: isPending,
        sortOptions,
        onToggleGroup: toggleGroup,
        onClearAll: handleClearAll,
        onResetGroup: handleResetGroup
    };

    return (
        <div
            className={cn(
                styles.wrapper,
                position === 'left' && styles.positionLeft,
                position === 'top' && styles.positionTop,
                className
            )}
            data-position={position}
        >
            {/* Desktop sidebar — hidden on mobile via CSS */}
            <div className={cn(styles.sidebar, styles.sidebarDesktop)}>
                <SidebarPanel {...panelProps} />
            </div>

            {/* Mobile: floating trigger button */}
            <button
                type="button"
                className={styles.floatingTrigger}
                onClick={() => setIsDrawerOpen(true)}
                aria-label={t('ui.filter.openFilters', 'Filtros')}
                aria-expanded={isDrawerOpen}
                aria-haspopup="dialog"
            >
                <span
                    className={styles.floatingTriggerIcon}
                    aria-hidden="true"
                >
                    ☰
                </span>
                <span>{t('ui.filter.openFilters', 'Filtros')}</span>
                {activeCount > 0 && (
                    <span
                        className={styles.floatingBadge}
                        aria-label={
                            activeCount === 1
                                ? t(
                                      'ui.filter.activeCount',
                                      `${activeCount} filtro activo`
                                  ).replace('{{count}}', String(activeCount))
                                : t(
                                      'ui.filter.activeCountPlural',
                                      `${activeCount} filtros activos`
                                  ).replace('{{count}}', String(activeCount))
                        }
                        aria-hidden="true"
                    >
                        {activeCount}
                    </span>
                )}
            </button>

            {/* Mobile drawer — focus trap, scroll lock, escape handled inside */}
            <MobileDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                ariaLabel={t('ui.filter.title', 'Filtros')}
            >
                <SidebarPanel
                    {...panelProps}
                    drawerMode
                    onCloseDrawer={() => setIsDrawerOpen(false)}
                />
            </MobileDrawer>
        </div>
    );
}
