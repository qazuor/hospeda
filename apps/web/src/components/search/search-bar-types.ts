import type { AccommodationTypeEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Form State
// ---------------------------------------------------------------------------

/**
 * State for the hero search bar form.
 * Supports multi-select for destinations and accommodation types.
 */
export interface SearchFormState {
    readonly destinations: readonly string[];
    readonly types: readonly AccommodationTypeEnum[];
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: number;
    readonly children: number;
}

/** Default values for the search form. */
export const INITIAL_SEARCH_STATE: SearchFormState = {
    destinations: [],
    types: [],
    checkIn: '',
    checkOut: '',
    adults: 2,
    children: 0
} as const;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** A destination option fetched from the API. */
export interface DestinationOption {
    readonly id: string;
    readonly name: string;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** All translatable labels for the search bar and its popovers. */
export interface HeroSearchBarLabels {
    readonly typePlaceholder: string;
    readonly destinationPlaceholder: string;
    readonly datesPlaceholder: string;
    readonly guestsPlaceholder: string;
    readonly checkInLabel: string;
    readonly checkOutLabel: string;
    readonly adultsLabel: string;
    readonly childrenLabel: string;
    readonly guestsSummary: string;
    readonly ctaLabel: string;
    readonly loadingText: string;
    readonly searchAriaLabel: string;
    readonly closePanelAriaLabel: string;
    /** Labels for each accommodation type, keyed by enum value. */
    readonly typeLabels: Readonly<Record<AccommodationTypeEnum, string>>;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for the top-level {@link HeroSearchBar} component. */
export interface HeroSearchBarProps {
    readonly locale: 'es' | 'en' | 'pt';
    readonly apiBaseUrl: string;
    readonly labels: HeroSearchBarLabels;
    readonly baseAccommodationsPath: string;
}
