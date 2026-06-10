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

/**
 * Composite geo-radius filter: lets users center the search either on their
 * device location (browser geolocation) or on a known destination from a
 * caller-provided list, and pick a radius from a preset chip row. Emits the
 * `latitude` / `longitude` / `radius` URL params consumed by the backend
 * haversine clause; `mode` and `destId` stay in the reducer state only.
 */
export interface GeoRadiusFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'geo-radius';
    /**
     * Optional anchor destinations the user can pick instead of falling back
     * to browser geolocation. Each option carries its own coordinates so the
     * page does not need an extra API round-trip when the user picks one.
     */
    readonly destinationOptions: readonly {
        readonly value: string;
        readonly label: string;
        readonly lat: number;
        readonly long: number;
        /**
         * Marks the destination as featured. Native `<select>` options cannot
         * be styled per-row across browsers, so featured entries are surfaced
         * by prepending a star glyph to the visible label.
         */
        readonly featured?: boolean;
    }[];
    /** Radius presets in km. Defaults to [5, 10, 25, 50, 100]. */
    readonly radiusPresets?: readonly number[];
    /**
     * Collapsed by default in the sidebar. Honored by `computeInitialCollapsed`
     * to keep the section quiet until the user opens it.
     */
    readonly defaultCollapsed?: boolean;
    /** Display string for the destination radio mode. */
    readonly destinationModeLabel: string;
    /** Display string for the browser-geolocation radio mode. */
    readonly browserModeLabel: string;
    /** Placeholder for the destination select. */
    readonly destinationPlaceholder: string;
    /** CTA copy for the "use my location" browser-mode button. */
    readonly browserCtaLabel: string;
    /** Status copy shown while the geolocation prompt is pending. */
    readonly browserPendingLabel: string;
    /** Status copy when the browser denies / cannot resolve geolocation. */
    readonly browserErrorLabel: string;
    /** Suffix appended to each preset chip (e.g. "km"). */
    readonly radiusUnitLabel: string;
}

/**
 * Reducer slot value for a geo-radius filter. `null` (or no entry) = inactive.
 * `mode` distinguishes between browser geolocation (`'browser'`) and the
 * destination picker (`'destination'`) so the UI can stay on the user's last
 * choice across re-renders. `destId` is only meaningful when `mode === 'destination'`.
 */
export interface GeoRadiusState {
    readonly mode: 'browser' | 'destination';
    readonly lat: number;
    readonly long: number;
    readonly radius: number;
    readonly destId?: string;
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
    | GeoRadiusFilterConfig
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
    /**
     * Geo-radius selections keyed by their config id. Absent = inactive.
     * Coordinates and radius emit to the URL as `latitude` / `longitude` /
     * `radius`; the `mode` and `destId` fields are reducer-only state.
     */
    readonly geo: Record<string, GeoRadiusState>;
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
    | { type: 'SET_GEO'; groupId: string; value: GeoRadiusState | null }
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
