/**
 * @file filter-reducer.ts
 * @description Pure reducer, helper functions, and state initializer for FilterSidebar.
 * Extracted to keep the orchestrator component focused on rendering logic.
 */

import type { FilterAction, FilterGroup, FilterState } from './filter-types/filter.types';

// --- Reducer ---

/**
 * Pure reducer for the FilterSidebar state machine.
 * Handles all filter action types: checkbox, radio, range, search, sort,
 * stepper, toggle, date-range, clear group, and clear all.
 */
export function filterReducer(state: FilterState, action: FilterAction): FilterState {
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
        case 'SET_DATE_RANGE':
            return {
                ...state,
                dates: {
                    ...state.dates,
                    [action.groupId]: { from: action.from, to: action.to }
                }
            };
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
            const { [action.groupId]: _removedDate, ...restDates } = state.dates;
            return {
                ...state,
                selections: { ...state.selections, [action.groupId]: [] },
                steppers: { ...state.steppers, [action.groupId]: 0 },
                toggles: {
                    ...state.toggles,
                    [action.groupId]: false,
                    [`${action.groupId}_includeNull`]: false,
                    // Price-composite sub-toggles. Harmless when the group is
                    // not a price-composite. `includeUnpriced` resets to its
                    // default of TRUE so the URL drops the param.
                    [`${action.groupId}_isFree`]: false,
                    [`${action.groupId}_includeUnpriced`]: true
                },
                ranges: restRanges,
                dates: restDates
            };
        }
        case 'CLEAR_ALL':
            return {
                selections: {},
                ranges: {},
                steppers: {},
                toggles: {},
                dates: {},
                search: '',
                sort: state.sort
            };
        default:
            return state;
    }
}

// --- Helpers ---

/**
 * Returns the default stepper value for a given filter group.
 * For non-stepper groups, returns 0.
 */
export function getStepperDefault(group: FilterGroup): number {
    if (group.type === 'stepper') return group.defaultValue ?? group.min ?? 0;
    return 0;
}

/**
 * Returns true when the given group has any active selection in the current state.
 */
export function groupHasActiveSelection(group: FilterGroup, state: FilterState): boolean {
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
        const stateVal = state.steppers[group.id];
        if (group.emitWhenAtDefault === true) return stateVal !== undefined;
        return (stateVal ?? def) > def;
    }
    if (group.type === 'stars') {
        const hasIncludeNull = !!state.toggles[`${group.id}_includeNull`];
        return hasIncludeNull || (state.steppers[group.id] ?? 0) > 0;
    }
    if (group.type === 'toggle') return !!state.toggles[group.id];
    if (group.type === 'price-composite') {
        // Active if isFree is set, OR includeUnpriced is explicitly OFF
        // (server default is ON), OR the dual-range has non-default values.
        const isFree = !!state.toggles[`${group.id}_isFree`];
        const includeUnpricedDefault = true;
        const includeUnpriced =
            state.toggles[`${group.id}_includeUnpriced`] ?? includeUnpricedDefault;
        const range = state.ranges[group.id];
        const rangeActive = !!(
            (range?.min && range.min !== String(group.min)) ||
            (range?.max && range.max !== String(group.max))
        );
        return isFree || includeUnpriced !== includeUnpricedDefault || rangeActive;
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
    if (group.type === 'date-range') {
        const v = state.dates[group.id];
        return !!(v?.from || v?.to);
    }
    return false;
}

/**
 * Computes the initial collapsed state for each filter group.
 * Groups with active values or the first group are expanded; the rest are collapsed.
 */
export function computeInitialCollapsed({
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
        result[group.id] = !(hasActive || isFirst);
        isFirst = false;
    }
    return result;
}

/**
 * Builds the initial FilterState from a plain params record (server-provided or
 * parsed from `window.location.search`). Intended to be used as the `useReducer`
 * lazy initializer to avoid hydration flashes.
 */
export function initStateFromParams({
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
    const dates: Record<string, { from: string; to: string }> = {};
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
            const includeNullParam = group.includeNullParam;
            if (includeNullParam && params[includeNullParam] === 'true') {
                toggles[`${group.id}_includeNull`] = true;
            }
        }
        if (group.type === 'toggle') {
            if (params[group.id] === 'true') toggles[group.id] = true;
        }
        if (group.type === 'date-range') {
            const fromParam = group.fromParam ?? 'checkIn';
            const toParam = group.toParam ?? 'checkOut';
            const from = params[fromParam] ?? '';
            const to = params[toParam] ?? '';
            if (from || to) dates[group.id] = { from, to };
        }
        if (group.type === 'price-composite') {
            if (params.isFree === 'true') toggles[`${group.id}_isFree`] = true;
            if (params.includeUnpriced === 'false') {
                toggles[`${group.id}_includeUnpriced`] = false;
            } else {
                // Default: include unpriced events. Server treats absent as TRUE.
                toggles[`${group.id}_includeUnpriced`] = true;
            }
            const min = params.minPrice ?? '';
            const max = params.maxPrice ?? '';
            if (min || max) ranges[group.id] = { min, max };
        }
    }

    return { selections, ranges, steppers, toggles, dates, search, sort };
}

/**
 * Builds URLSearchParams from the current filter state.
 * Used in `buildParams` inside the FilterSidebar component.
 */
export function buildParamsFromState({
    state,
    filters
}: {
    readonly state: FilterState;
    readonly filters: readonly FilterGroup[];
}): URLSearchParams {
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
            const stateVal = state.steppers[group.id];
            const val = stateVal ?? def;
            const shouldEmit =
                group.type === 'stepper' && group.emitWhenAtDefault === true
                    ? stateVal !== undefined
                    : val > def;
            if (shouldEmit)
                params.set(group.type === 'stars' ? 'minRating' : group.id, String(val));
        }
        if (group.type === 'toggle' && state.toggles[group.id]) {
            params.set(group.id, 'true');
        }
        if (
            (group.type === 'dual-range' || group.type === 'stars') &&
            group.includeNullParam &&
            state.toggles[`${group.id}_includeNull`]
        ) {
            params.set(group.includeNullParam, 'true');
        }
        if (group.type === 'date-range') {
            const v = state.dates[group.id];
            const fromParam = group.fromParam ?? 'checkIn';
            const toParam = group.toParam ?? 'checkOut';
            if (v?.from) params.set(fromParam, v.from);
            if (v?.to) params.set(toParam, v.to);
        }
        if (group.type === 'price-composite') {
            const isFree = !!state.toggles[`${group.id}_isFree`];
            if (isFree) params.set('isFree', 'true');
            // Only emit includeUnpriced when explicitly OFF — server default is TRUE,
            // so an absent param means "include unpriced".
            const includeUnpricedRaw = state.toggles[`${group.id}_includeUnpriced`];
            const includeUnpriced = includeUnpricedRaw ?? true;
            if (!includeUnpriced) params.set('includeUnpriced', 'false');
            // Price range is only meaningful when not filtering free-only.
            if (!isFree) {
                const range = state.ranges[group.id];
                if (range?.min && range.min !== String(group.min))
                    params.set('minPrice', range.min);
                if (range?.max && range.max !== String(group.max))
                    params.set('maxPrice', range.max);
            }
        }
    }
    return params;
}
