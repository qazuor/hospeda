/**
 * @file filter.types.ts
 * @description Shared type definitions for FilterSidebar and its sub-components.
 * Extracted to avoid circular imports between FilterSidebar.client.tsx and FilterGroupContent.tsx.
 */

import type { Dispatch } from 'react';
import type { DateRangeFilterConfig } from './DateRangeFilter';
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
    /**
     * Optional highlighted chips rendered ABOVE the regular options. Each one
     * emits a boolean toggle URL param (its `value` field) — independent from
     * the multi-select state of the main `options` list.
     *
     * Used for "quick filter" shortcuts such as `hasWifi` / `hasPool` /
     * `hasParking` / `allowsPets` on the accommodations listing, which the
     * API resolves server-side into the canonical amenity-id set for each
     * toggle (including slug variants).
     */
    readonly priorityOptions?: readonly {
        /** URL boolean param name. Becomes `?<value>=true` when active. */
        readonly value: string;
        readonly label: string;
        readonly icon?: string;
    }[];
}

/**
 * Decorative entry that breaks the sidebar into labelled sections. Renders as
 * a small-caps header (with optional icon) above the next group of filters.
 *
 * When `filters` contains at least one section-header, the sidebar switches
 * from the legacy "inline toggles first, then collapsibles" layout to a
 * strictly-declaration-order render so each group lands under its intended
 * header. Listings that don't declare any section-header keep the legacy
 * order — no migration required for events / posts.
 */
export interface SectionHeaderConfig {
    /** Stable id for keys + a11y. Not used as a URL param. */
    readonly id: string;
    readonly type: 'section-header';
    /** Display text (will be uppercased in CSS). */
    readonly label: string;
    /** Optional `@repo/icons` name to render on the left of the label. */
    readonly icon?: string;
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

/**
 * Composite price filter that bundles three sub-controls inside one group:
 * - `includeUnpriced` toggle (default ON): include events with no pricing data
 * - `isFree` toggle: only events marked as free
 * - dual-range `minPrice` / `maxPrice`: shown only when `isFree` is OFF
 *
 * Emits the URL params `isFree`, `includeUnpriced`, `minPrice`, `maxPrice`.
 * `includeUnpriced` only emits to the URL when the user EXPLICITLY turns it
 * OFF (server treats absent as `true`, the default).
 */
export interface PriceCompositeFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'price-composite';
    /** Min boundary for the dual-range control (e.g. 0). */
    readonly min: number;
    /** Max boundary for the dual-range control (e.g. 10000). */
    readonly max: number;
    /** Step size for the dual-range control. */
    readonly step?: number;
    /** Display format for the range values. */
    readonly format?: 'currency' | 'number';
    /** Label for the include-unpriced toggle. */
    readonly includeUnpricedLabel: string;
    /** Label for the only-free toggle. */
    readonly isFreeLabel: string;
    /** Label for the dual-range sub-section (shown when isFree is OFF). */
    readonly rangeLabel: string;
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
    | IconChipsFilterConfig
    | DateRangeFilterConfig
    | PriceCompositeFilterConfig
    | SectionHeaderConfig;

/** Shared reducer state shape. */
export interface FilterState {
    readonly selections: Record<string, readonly string[]>;
    readonly ranges: Record<string, { readonly min: string; readonly max: string }>;
    readonly steppers: Record<string, number>;
    readonly toggles: Record<string, boolean>;
    /**
     * Date-range groups keyed by their config id. Each entry holds ISO
     * `YYYY-MM-DD` strings (empty string when unset). Emitted to URL as the
     * `checkIn` / `checkOut` params.
     */
    readonly dates: Record<string, { readonly from: string; readonly to: string }>;
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
    | { type: 'SET_DATE_RANGE'; groupId: string; from: string; to: string }
    | { type: 'REMOVE_FILTER'; groupId: string; value: string }
    | {
          type: 'CLEAR_GROUP';
          groupId: string;
          /**
           * Optional additional toggle keys to reset alongside the group's
           * own state. Used by icon-chips with `priorityOptions` to clear the
           * independent boolean toggles (e.g. `hasWifi`, `hasPool`) when the
           * user hits the per-group "× reset" button.
           */
          extraToggleKeys?: readonly string[];
      }
    | { type: 'CLEAR_ALL' };

/** Dispatch function type for the filter reducer. */
export type FilterDispatch = Dispatch<FilterAction>;
