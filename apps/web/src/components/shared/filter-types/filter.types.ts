/**
 * @file filter.types.ts
 * @description Shared type definitions for FilterSidebar and its sub-components.
 * Extracted to avoid circular imports between FilterSidebar.client.tsx and FilterGroupContent.tsx.
 */

import type { Dispatch } from 'react';
import type { DualRangeFilterConfig } from './DualRangeFilter';
import type { SelectSearchFilterConfig } from './SelectSearchFilter';
import type { StarsFilterConfig } from './StarsFilter';
import type { StepperFilterConfig } from './StepperFilter';
import type { ToggleFilterConfig } from './ToggleFilter';

/**
 * Filter group that shows options as icon+label chips with a "Ver más" dialog.
 * Suitable for amenities, features, and other categorized options with icons.
 */
export interface IconChipsFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'icon-chips';
    readonly options: readonly {
        readonly value: string;
        readonly label: string;
        readonly icon?: string;
    }[];
    /** Number of chips to show before "Ver más" button. Default: 10 */
    readonly maxVisible?: number;
    /**
     * Optional category grouping for the dialog.
     * Key = category display name, values = option value strings.
     */
    readonly categories?: Readonly<Record<string, readonly string[]>>;
}

interface SearchFilterGroup {
    readonly id: string;
    readonly label: string;
    readonly type: 'search';
    /** Optional placeholder text for the search input. */
    readonly placeholder?: string;
}

interface CheckboxFilterGroup {
    readonly id: string;
    readonly label: string;
    readonly type: 'checkbox';
    readonly options: readonly { readonly value: string; readonly label: string }[];
}

interface RadioFilterGroup {
    readonly id: string;
    readonly label: string;
    readonly type: 'radio';
    readonly options: readonly { readonly value: string; readonly label: string }[];
}

interface RangeFilterGroup {
    readonly id: string;
    readonly label: string;
    readonly type: 'range';
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
}

/** Union of all supported filter group configurations. */
export type FilterGroup =
    | SearchFilterGroup
    | CheckboxFilterGroup
    | RadioFilterGroup
    | RangeFilterGroup
    | StepperFilterConfig
    | StarsFilterConfig
    | ToggleFilterConfig
    | DualRangeFilterConfig
    | SelectSearchFilterConfig
    | IconChipsFilterConfig;

/** Shared reducer state shape. */
export interface FilterState {
    readonly selections: Record<string, readonly string[]>;
    readonly ranges: Record<string, { readonly min: string; readonly max: string }>;
    readonly steppers: Record<string, number>;
    readonly toggles: Record<string, boolean>;
    readonly search: string;
    readonly sort: string;
}

/** Actions for the filter reducer. */
export type FilterAction =
    | { type: 'TOGGLE_CHECKBOX'; groupId: string; value: string }
    | { type: 'SET_RADIO'; groupId: string; value: string }
    | { type: 'SET_RANGE'; groupId: string; field: 'min' | 'max'; value: string }
    | { type: 'SET_SEARCH'; value: string }
    | { type: 'SET_SORT'; value: string }
    | { type: 'SET_STEPPER'; groupId: string; value: number }
    | { type: 'SET_TOGGLE'; groupId: string; value: boolean }
    | { type: 'REMOVE_FILTER'; groupId: string; value: string }
    | { type: 'CLEAR_GROUP'; groupId: string }
    | { type: 'CLEAR_ALL' };

/** Dispatch function type for the filter reducer. */
export type FilterDispatch = Dispatch<FilterAction>;
