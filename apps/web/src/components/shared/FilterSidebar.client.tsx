/**
 * @file FilterSidebar.client.tsx
 * @description Interactive filter sidebar for listing pages. Provides checkbox, radio,
 * range, and search filter groups with active filter chips and sort dropdown.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useReducer, useRef, useState } from 'react';
import styles from './FilterSidebar.module.css';

/** Configuration for a single filter group. */
interface FilterGroup {
    readonly id: string;
    readonly label: string;
    readonly type: 'checkbox' | 'radio' | 'range' | 'search';
    readonly options?: readonly { value: string; label: string }[];
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
}

/** An active filter selection. */
interface ActiveFilter {
    readonly groupId: string;
    readonly value: string;
    readonly label: string;
}

/** Sort option for the sort dropdown. */
interface SortOption {
    readonly value: string;
    readonly label: string;
}

interface FilterSidebarProps {
    readonly locale: SupportedLocale;
    readonly filters: readonly FilterGroup[];
    readonly sortOptions?: readonly SortOption[];
    readonly defaultSort?: string;
    readonly onFiltersChange: (params: URLSearchParams) => void;
    readonly className?: string;
}

// --- Reducer ---

interface FilterState {
    readonly selections: Record<string, readonly string[]>;
    readonly ranges: Record<string, { min: string; max: string }>;
    readonly search: string;
    readonly sort: string;
}

type FilterAction =
    | { type: 'TOGGLE_CHECKBOX'; groupId: string; value: string }
    | { type: 'SET_RADIO'; groupId: string; value: string }
    | { type: 'SET_RANGE'; groupId: string; field: 'min' | 'max'; value: string }
    | { type: 'SET_SEARCH'; value: string }
    | { type: 'SET_SORT'; value: string }
    | { type: 'REMOVE_FILTER'; groupId: string; value: string }
    | { type: 'CLEAR_ALL' };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
    switch (action.type) {
        case 'TOGGLE_CHECKBOX': {
            const current = state.selections[action.groupId] ?? [];
            const exists = current.includes(action.value);
            const updated = exists
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
        case 'CLEAR_ALL':
            return { selections: {}, ranges: {}, search: '', sort: state.sort };
        default:
            return state;
    }
}

// --- Component ---

export function FilterSidebar({
    locale,
    filters,
    sortOptions,
    defaultSort = '',
    onFiltersChange,
    className
}: FilterSidebarProps) {
    const { t } = createTranslations(locale);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const [state, dispatch] = useReducer(filterReducer, {
        selections: {},
        ranges: {},
        search: '',
        sort: defaultSort
    });

    const buildParams = useCallback((): URLSearchParams => {
        const params = new URLSearchParams();
        if (state.search) params.set('q', state.search);
        if (state.sort) params.set('sortBy', state.sort);
        for (const [groupId, values] of Object.entries(state.selections)) {
            if (values.length > 0) {
                params.set(groupId, values.join(','));
            }
        }
        for (const [groupId, range] of Object.entries(state.ranges)) {
            if (range.min)
                params.set(`min${groupId.charAt(0).toUpperCase()}${groupId.slice(1)}`, range.min);
            if (range.max)
                params.set(`max${groupId.charAt(0).toUpperCase()}${groupId.slice(1)}`, range.max);
        }
        return params;
    }, [state]);

    const handleApply = useCallback(() => {
        onFiltersChange(buildParams());
    }, [buildParams, onFiltersChange]);

    const handleSearchChange = useCallback(
        (value: string) => {
            dispatch({ type: 'SET_SEARCH', value });
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                onFiltersChange(buildParams());
            }, 300);
        },
        [buildParams, onFiltersChange]
    );

    const toggleGroup = useCallback((groupId: string) => {
        setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    }, []);

    // Collect active filters for chips
    const activeFilters: ActiveFilter[] = [];
    for (const group of filters) {
        const values = state.selections[group.id] ?? [];
        for (const value of values) {
            const option = group.options?.find((o) => o.value === value);
            activeFilters.push({
                groupId: group.id,
                value,
                label: option?.label ?? value
            });
        }
    }

    return (
        <div className={cn(styles.wrapper, className)}>
            {/* Active filter chips + sort (displayed above grid area) */}
            {(activeFilters.length > 0 || sortOptions) && (
                <div className={styles.toolbar}>
                    {activeFilters.length > 0 && (
                        <div className={styles.chips}>
                            {activeFilters.map((f) => (
                                <button
                                    key={`${f.groupId}-${f.value}`}
                                    type="button"
                                    className={styles.chip}
                                    onClick={() =>
                                        dispatch({
                                            type: 'REMOVE_FILTER',
                                            groupId: f.groupId,
                                            value: f.value
                                        })
                                    }
                                    aria-label={`${t('ui.filter.remove', 'Quitar filtro')}: ${f.label}`}
                                >
                                    {f.label}
                                    <span
                                        className={styles.chipX}
                                        aria-hidden="true"
                                    >
                                        &times;
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    {sortOptions && sortOptions.length > 0 && (
                        <div className={styles.sortWrapper}>
                            <label
                                htmlFor="filter-sort"
                                className={styles.sortLabel}
                            >
                                {t('ui.filter.sortBy', 'Ordenar por')}:
                            </label>
                            <select
                                id="filter-sort"
                                className={styles.sortSelect}
                                value={state.sort}
                                onChange={(e) => {
                                    dispatch({ type: 'SET_SORT', value: e.target.value });
                                    onFiltersChange(buildParams());
                                }}
                            >
                                {sortOptions.map((opt) => (
                                    <option
                                        key={opt.value}
                                        value={opt.value}
                                    >
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Sidebar filter groups */}
            <div className={styles.sidebar}>
                <h2 className={styles.title}>{t('ui.filter.title', 'Filtros')}</h2>

                {filters.map((group) => (
                    <fieldset
                        key={group.id}
                        className={styles.group}
                        aria-labelledby={`filter-${group.id}`}
                    >
                        <button
                            type="button"
                            className={styles.groupToggle}
                            id={`filter-${group.id}`}
                            aria-expanded={!collapsed[group.id]}
                            onClick={() => toggleGroup(group.id)}
                        >
                            {group.label}
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

                        {!collapsed[group.id] && (
                            <div className={styles.groupContent}>
                                {group.type === 'search' && (
                                    <input
                                        type="text"
                                        className={styles.searchInput}
                                        placeholder={t('ui.filter.searchPlaceholder', 'Buscar...')}
                                        value={state.search}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        aria-label={group.label}
                                    />
                                )}

                                {group.type === 'checkbox' &&
                                    group.options?.map((opt) => (
                                        <label
                                            key={opt.value}
                                            className={styles.checkboxLabel}
                                        >
                                            <input
                                                type="checkbox"
                                                className={styles.checkbox}
                                                checked={(
                                                    state.selections[group.id] ?? []
                                                ).includes(opt.value)}
                                                onChange={() =>
                                                    dispatch({
                                                        type: 'TOGGLE_CHECKBOX',
                                                        groupId: group.id,
                                                        value: opt.value
                                                    })
                                                }
                                            />
                                            {opt.label}
                                        </label>
                                    ))}

                                {group.type === 'radio' &&
                                    group.options?.map((opt) => (
                                        <label
                                            key={opt.value}
                                            className={styles.radioLabel}
                                        >
                                            <input
                                                type="radio"
                                                className={styles.radio}
                                                name={group.id}
                                                checked={
                                                    (state.selections[group.id] ?? [])[0] ===
                                                    opt.value
                                                }
                                                onChange={() =>
                                                    dispatch({
                                                        type: 'SET_RADIO',
                                                        groupId: group.id,
                                                        value: opt.value
                                                    })
                                                }
                                            />
                                            {opt.label}
                                        </label>
                                    ))}

                                {group.type === 'range' && (
                                    <div className={styles.rangeInputs}>
                                        <input
                                            type="number"
                                            className={styles.rangeInput}
                                            placeholder={String(group.min ?? 0)}
                                            min={group.min}
                                            max={group.max}
                                            step={group.step}
                                            value={state.ranges[group.id]?.min ?? ''}
                                            onChange={(e) =>
                                                dispatch({
                                                    type: 'SET_RANGE',
                                                    groupId: group.id,
                                                    field: 'min',
                                                    value: e.target.value
                                                })
                                            }
                                            aria-label={`${group.label} ${t('ui.filter.min', 'mínimo')}`}
                                        />
                                        <span className={styles.rangeSeparator}>—</span>
                                        <input
                                            type="number"
                                            className={styles.rangeInput}
                                            placeholder={String(group.max ?? 999999)}
                                            min={group.min}
                                            max={group.max}
                                            step={group.step}
                                            value={state.ranges[group.id]?.max ?? ''}
                                            onChange={(e) =>
                                                dispatch({
                                                    type: 'SET_RANGE',
                                                    groupId: group.id,
                                                    field: 'max',
                                                    value: e.target.value
                                                })
                                            }
                                            aria-label={`${group.label} ${t('ui.filter.max', 'máximo')}`}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </fieldset>
                ))}

                <button
                    type="button"
                    className={styles.applyBtn}
                    onClick={handleApply}
                >
                    {t('ui.filter.apply', 'Aplicar filtros')}
                </button>

                {activeFilters.length > 0 && (
                    <button
                        type="button"
                        className={styles.clearBtn}
                        onClick={() => {
                            dispatch({ type: 'CLEAR_ALL' });
                            onFiltersChange(new URLSearchParams());
                        }}
                    >
                        {t('ui.filter.clearAll', 'Limpiar filtros')}
                    </button>
                )}
            </div>
        </div>
    );
}
