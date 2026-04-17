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
import { createPortal } from 'react-dom';
import styles from './FilterSidebar.module.css';
import { FilterGroupContent } from './filter-types/FilterGroupContent';
import type { FilterAction, FilterGroup, FilterState } from './filter-types/filter.types';

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
    readonly filters: readonly FilterGroup[];
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
    readonly className?: string;
}

// --- Reducer ---

function filterReducer(state: FilterState, action: FilterAction): FilterState {
    switch (action.type) {
        case 'TOGGLE_CHECKBOX': {
            const current = state.selections[action.groupId] ?? [];
            const updated = current.includes(action.value)
                ? current.filter((v) => v !== action.value)
                : [...current, action.value];
            return { ...state, selections: { ...state.selections, [action.groupId]: updated } };
        }
        case 'SET_RADIO':
            return {
                ...state,
                selections: { ...state.selections, [action.groupId]: [action.value] }
            };
        case 'SET_RANGE': {
            const prev = state.ranges[action.groupId] ?? { min: '', max: '' };
            return {
                ...state,
                ranges: {
                    ...state.ranges,
                    [action.groupId]: { ...prev, [action.field]: action.value }
                }
            };
        }
        case 'SET_SEARCH':
            return { ...state, search: action.value };
        case 'SET_SORT':
            return { ...state, sort: action.value };
        case 'SET_STEPPER':
            return { ...state, steppers: { ...state.steppers, [action.groupId]: action.value } };
        case 'SET_TOGGLE':
            return { ...state, toggles: { ...state.toggles, [action.groupId]: action.value } };
        case 'REMOVE_FILTER': {
            const current = state.selections[action.groupId] ?? [];
            return {
                ...state,
                selections: {
                    ...state.selections,
                    [action.groupId]: current.filter((v) => v !== action.value)
                }
            };
        }
        case 'CLEAR_GROUP': {
            const { [action.groupId]: _removed, ...restRanges } = state.ranges;
            return {
                ...state,
                selections: { ...state.selections, [action.groupId]: [] },
                steppers: { ...state.steppers, [action.groupId]: 0 },
                toggles: {
                    ...state.toggles,
                    [action.groupId]: false,
                    [`${action.groupId}_includeNull`]: false
                },
                ranges: restRanges
            };
        }
        case 'CLEAR_ALL':
            return {
                selections: {},
                ranges: {},
                steppers: {},
                toggles: {},
                search: '',
                sort: state.sort
            };
        default:
            return state;
    }
}

// --- Helpers ---

function getStepperDefault(group: FilterGroup): number {
    if (group.type === 'stepper') return group.defaultValue ?? group.min ?? 0;
    return 0;
}

/** Returns true when the given group has any active selection in the current state. */
function groupHasActiveSelection(group: FilterGroup, state: FilterState): boolean {
    if (
        group.type === 'checkbox' ||
        group.type === 'radio' ||
        group.type === 'select-search' ||
        group.type === 'icon-chips'
    ) {
        return (state.selections[group.id] ?? []).length > 0;
    }
    if (group.type === 'stepper') {
        const def = getStepperDefault(group);
        return (state.steppers[group.id] ?? def) > def;
    }
    if (group.type === 'stars') {
        const hasIncludeNull = !!state.toggles[`${group.id}_includeNull`];
        return hasIncludeNull || (state.steppers[group.id] ?? 0) > 0;
    }
    if (group.type === 'toggle') {
        return !!state.toggles[group.id];
    }
    if (group.type === 'dual-range') {
        const range = state.ranges[group.id];
        const hasIncludeNull = !!state.toggles[`${group.id}_includeNull`];
        return (
            hasIncludeNull ||
            !!(
                (range?.min && range.min !== String(group.min)) ||
                (range?.max && range.max !== String(group.max))
            )
        );
    }
    return false;
}

/**
 * Computes the initial collapsed state for each filter group.
 * Groups with active values or the first group are expanded; the rest are collapsed.
 */
function computeInitialCollapsed({
    filters,
    state
}: {
    readonly filters: readonly FilterGroup[];
    readonly state: FilterState;
}): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    let isFirst = true;
    for (const group of filters) {
        const hasActive = groupHasActiveSelection(group, state);
        if (hasActive || isFirst) {
            result[group.id] = false; // expanded
        } else {
            result[group.id] = true; // collapsed
        }
        isFirst = false;
    }
    return result;
}

// --- State initialization ---

/**
 * Builds the initial FilterState from a plain params record (server-provided or
 * parsed from `window.location.search`). Called once as the `useReducer` lazy
 * initializer to avoid the hydration flash that occurs when reading the URL on mount.
 */
function initStateFromParams({
    filters,
    defaultSort,
    params
}: {
    readonly filters: readonly FilterGroup[];
    readonly defaultSort: string;
    readonly params: Readonly<Record<string, string>>;
}): FilterState {
    const selections: Record<string, string[]> = {};
    const ranges: Record<string, { min: string; max: string }> = {};
    const steppers: Record<string, number> = {};
    const toggles: Record<string, boolean> = {};
    const search = params.q ?? '';
    const sort = params.sortBy ?? defaultSort;

    for (const group of filters) {
        if (
            group.type === 'checkbox' ||
            group.type === 'radio' ||
            group.type === 'select-search' ||
            group.type === 'icon-chips'
        ) {
            const val = params[group.id];
            if (val) selections[group.id] = val.split(',');
        }
        if (group.type === 'dual-range') {
            const cap = group.id.charAt(0).toUpperCase() + group.id.slice(1);
            const min = params[`min${cap}`] ?? '';
            const max = params[`max${cap}`] ?? '';
            if (min || max) ranges[group.id] = { min, max };
            // Restore includeNull toggle
            const includeNullParam = group.includeNullParam;
            if (includeNullParam && params[includeNullParam] === 'true') {
                toggles[`${group.id}_includeNull`] = true;
            }
        }
        if (group.type === 'stepper') {
            const val = params[group.id];
            if (val) steppers[group.id] = Number(val);
        }
        if (group.type === 'stars') {
            const val = params.minRating;
            if (val) steppers[group.id] = Number(val);
            // Restore includeNull toggle
            const includeNullParam = group.includeNullParam;
            if (includeNullParam && params[includeNullParam] === 'true') {
                toggles[`${group.id}_includeNull`] = true;
            }
        }
        if (group.type === 'toggle') {
            if (params[group.id] === 'true') toggles[group.id] = true;
        }
    }

    return { selections, ranges, steppers, toggles, search, sort };
}

// --- Sub-components ---

/**
 * Sort icon button + popover dropdown.
 * Replaces the legacy <select> sort control in the sidebar header.
 */
interface SortPopoverProps {
    readonly options: readonly SortOption[];
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly t: ReturnType<typeof createTranslations>['t'];
}

function SortPopover({ options, value, onChange, t }: SortPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({
        top: 0,
        right: 0
    });

    // Position the dropdown relative to the trigger using fixed positioning
    // (escapes overflow:hidden on parent containers)
    useEffect(() => {
        if (!isOpen || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + 6,
            right: window.innerWidth - rect.right
        });
    }, [isOpen]);

    // Close when clicking outside the popover
    useEffect(() => {
        if (!isOpen) return;
        const handleMouseDown = (e: MouseEvent) => {
            if (
                triggerRef.current?.contains(e.target as Node) ||
                dropdownRef.current?.contains(e.target as Node)
            ) {
                return;
            }
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen]);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

    return (
        <>
            <button
                type="button"
                ref={triggerRef}
                className={styles.sortPopoverTrigger}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-label={`${t('ui.filter.sortBy', 'Ordenar por')}: ${selectedLabel}`}
                title={`${t('ui.filter.sortBy', 'Ordenar por')}: ${selectedLabel}`}
            >
                ⇅
            </button>
            {isOpen &&
                createPortal(
                    <div
                        ref={dropdownRef}
                        className={styles.sortPopoverDropdown}
                        style={{
                            top: `${dropdownPos.top}px`,
                            right: `${dropdownPos.right}px`,
                            backgroundColor:
                                document.documentElement.dataset.theme === 'dark'
                                    ? 'oklch(0.25 0.01 210)'
                                    : 'oklch(0.99 0.002 210)',
                            border: `1px solid ${
                                document.documentElement.dataset.theme === 'dark'
                                    ? 'oklch(0.35 0.01 210)'
                                    : 'oklch(0.85 0.01 210)'
                            }`
                        }}
                    >
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                className={cn(
                                    styles.sortPopoverOption,
                                    opt.value === value && styles.sortPopoverOptionActive
                                )}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                {opt.label}
                                {opt.value === value && <span aria-hidden="true">✓</span>}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    );
}

/** The inner panel content shared between desktop sidebar and mobile drawer. */
interface SidebarPanelProps {
    readonly filters: readonly FilterGroup[];
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
    // Separate toggle filters (rendered inline) from collapsible groups
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
                                t={t}
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
                    return (
                        <fieldset
                            key={group.id}
                            className={cn(styles.group, hasActive && styles.groupActive)}
                            aria-labelledby={`filter-${group.id}`}
                        >
                            <div className={styles.groupHeader}>
                                <button
                                    type="button"
                                    className={styles.groupToggle}
                                    onClick={() => onToggleGroup(group.id)}
                                    id={`filter-${group.id}`}
                                    aria-expanded={!collapsed[group.id]}
                                >
                                    <span className={styles.groupToggleLabel}>
                                        {hasActive && (
                                            <span
                                                className={styles.groupActiveDot}
                                                aria-hidden="true"
                                            />
                                        )}
                                        {group.label}
                                    </span>
                                </button>
                                <span className={styles.groupHeaderActions}>
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
                                    <button
                                        type="button"
                                        className={styles.chevronBtn}
                                        onClick={() => onToggleGroup(group.id)}
                                        aria-label={
                                            collapsed[group.id]
                                                ? t('ui.filter.expand', 'Expandir')
                                                : t('ui.filter.collapse', 'Colapsar')
                                        }
                                    >
                                        <span
                                            className={cn(
                                                styles.chevron,
                                                collapsed[group.id] && styles.chevronCollapsed
                                            )}
                                            aria-hidden="true"
                                        >
                                            ▾
                                        </span>
                                    </button>
                                </span>
                            </div>

                            <div
                                className={cn(
                                    styles.groupContent,
                                    collapsed[group.id] && styles.groupContentCollapsed
                                )}
                            >
                                <FilterGroupContent
                                    group={group}
                                    state={state}
                                    dispatch={dispatch}
                                    onSearchChange={(searchValue: string) => {
                                        dispatch({ type: 'SET_SEARCH', value: searchValue });
                                    }}
                                    locale={locale}
                                />
                            </div>
                        </fieldset>
                    );
                })}
            </div>
        </>
    );
}

// --- Component ---

/**
 * FilterSidebar component.
 * Renders collapsible filter groups with a sort dropdown.
 * Every state change triggers a debounced navigation (500ms) via Astro View Transitions.
 *
 * Responsive behavior:
 * - Desktop (>= 768px): static sidebar panel.
 * - Mobile (< 768px): floating trigger button + full-height drawer from the left.
 */
export function FilterSidebar({
    locale,
    filters,
    sortOptions,
    defaultSort = '',
    initialParams,
    onFiltersChange,
    className
}: FilterSidebarProps) {
    const { t } = createTranslations(locale);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const drawerPanelRef = useRef<HTMLDialogElement>(null);
    const isInitialMount = useRef(true);

    const [state, dispatch] = useReducer(
        filterReducer,
        { filters, defaultSort, params: initialParams ?? {} },
        ({ filters: f, defaultSort: ds, params: p }) =>
            initStateFromParams({ filters: f, defaultSort: ds, params: p })
    );

    /**
     * Pre-sort filters once from initial (URL-applied) state so that active filters
     * float to the top only on page load, not on every local state change.
     */
    const sortedFilters = useMemo(() => {
        const initialState = initStateFromParams({
            filters,
            defaultSort,
            params: initialParams ?? {}
        });
        const active: FilterGroup[] = [];
        const inactive: FilterGroup[] = [];
        for (const group of filters) {
            if (groupHasActiveSelection(group, initialState)) {
                active.push(group);
            } else {
                inactive.push(group);
            }
        }
        return [...active, ...inactive];
    }, [filters, defaultSort, initialParams]);

    // Smart collapsible defaults: computed lazily from the initial state
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
        computeInitialCollapsed({ filters: sortedFilters, state })
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

    // Lock body scroll while drawer is open
    useEffect(() => {
        if (isDrawerOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isDrawerOpen]);

    // Trap focus inside the drawer when open
    useEffect(() => {
        if (!isDrawerOpen || !drawerPanelRef.current) return;
        const panel = drawerPanelRef.current;
        const focusable = panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        first?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsDrawerOpen(false);
                return;
            }
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };

        panel.addEventListener('keydown', handleKeyDown);
        return () => panel.removeEventListener('keydown', handleKeyDown);
    }, [isDrawerOpen]);

    // Close drawer and clear navigating state when Astro swaps the page
    useEffect(() => {
        const handleBeforeSwap = () => {
            setIsDrawerOpen(false);
            setIsNavigating(false);
        };
        document.addEventListener('astro:before-swap', handleBeforeSwap);
        return () => document.removeEventListener('astro:before-swap', handleBeforeSwap);
    }, []);

    // Clean up loading attribute and navigating state when Astro finishes loading
    useEffect(() => {
        const cleanup = () => {
            delete document.documentElement.dataset.filtersLoading;
            setIsNavigating(false);
        };
        document.addEventListener('astro:page-load', cleanup);
        return () => document.removeEventListener('astro:page-load', cleanup);
    }, []);

    const buildParams = useCallback((): URLSearchParams => {
        const params = new URLSearchParams();
        if (state.search) params.set('q', state.search);
        if (state.sort) params.set('sortBy', state.sort);
        for (const [id, values] of Object.entries(state.selections)) {
            if (values.length > 0) params.set(id, values.join(','));
        }
        for (const [id, range] of Object.entries(state.ranges)) {
            const cap = id.charAt(0).toUpperCase() + id.slice(1);
            if (range.min) params.set(`min${cap}`, range.min);
            if (range.max) params.set(`max${cap}`, range.max);
        }
        for (const group of filters) {
            if (group.type === 'stepper' || group.type === 'stars') {
                const def = getStepperDefault(group);
                const val = state.steppers[group.id] ?? def;
                if (val > def)
                    params.set(group.type === 'stars' ? 'minRating' : group.id, String(val));
            }
            if (group.type === 'toggle' && state.toggles[group.id]) {
                params.set(group.id, 'true');
            }
            // includeNull params for dual-range and stars
            if (
                (group.type === 'dual-range' || group.type === 'stars') &&
                group.includeNullParam &&
                state.toggles[`${group.id}_includeNull`]
            ) {
                params.set(group.includeNullParam, 'true');
            }
        }
        return params;
    }, [state, filters]);

    // Keep a ref to buildParams and onFiltersChange to avoid stale closures in the debounce
    const buildParamsRef = useRef(buildParams);
    buildParamsRef.current = buildParams;
    const onFiltersChangeRef = useRef(onFiltersChange);
    onFiltersChangeRef.current = onFiltersChange;

    /**
     * Auto-navigate on every state change with a 500ms debounce.
     * Skips the initial mount (state already matches the URL).
     * biome-ignore lint/correctness/useExhaustiveDependencies: `state` is intentionally the
     * only dependency — the reducer returns a new object on every change, making this
     * a correct reactive trigger. All other dependencies are accessed via refs.
     */
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            const params = buildParamsRef.current();

            // If a custom handler is provided (e.g. tests or embedded usage), use it
            if (onFiltersChangeRef.current) {
                onFiltersChangeRef.current(params);
                return;
            }

            setIsNavigating(true);
            document.documentElement.dataset.filtersLoading = 'true';

            const newUrl = new URL(window.location.href);
            newUrl.pathname = newUrl.pathname.replace(/\/page\/\d+\/?$/, '/');
            newUrl.search = params.toString();
            newUrl.searchParams.delete('page');

            // Use Astro View Transitions navigate for smooth transition
            (
                import('astro:transitions/client') as Promise<{
                    navigate: (href: string) => Promise<void>;
                }>
            )
                .then(({ navigate }) => {
                    navigate(newUrl.href);
                })
                .catch(() => {
                    // Fallback to hard navigation if View Transitions are unavailable
                    window.location.href = newUrl.href;
                });
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [state]);

    const handleClearAll = useCallback(() => {
        dispatch({ type: 'CLEAR_ALL' });
    }, []);

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

    /** Count of filter groups that have an active selection. */
    const activeCount = useMemo(
        () => filters.filter((g) => groupHasActiveSelection(g, state)).length,
        [filters, state]
    );

    const panelProps: SidebarPanelProps = {
        filters: sortedFilters,
        state,
        dispatch,
        collapsed,
        locale,
        t,
        activeCount,
        isNavigating,
        sortOptions,
        onToggleGroup: toggleGroup,
        onClearAll: handleClearAll,
        onResetGroup: handleResetGroup
    };

    return (
        <div className={cn(styles.wrapper, className)}>
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

            {/* Mobile drawer */}
            {isDrawerOpen && (
                /* Overlay */
                <div
                    className={styles.drawerOverlay}
                    onClick={() => setIsDrawerOpen(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setIsDrawerOpen(false);
                    }}
                    aria-hidden="true"
                />
            )}

            <dialog
                ref={drawerPanelRef}
                className={cn(styles.drawer, isDrawerOpen && styles.drawerOpen)}
                aria-label={t('ui.filter.title', 'Filtros')}
                open={isDrawerOpen}
            >
                <SidebarPanel
                    {...panelProps}
                    drawerMode
                    onCloseDrawer={() => setIsDrawerOpen(false)}
                />
            </dialog>
        </div>
    );
}
