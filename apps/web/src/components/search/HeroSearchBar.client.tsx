import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single accommodation type returned by the API.
 */
interface AccommodationType {
    readonly id: string;
    readonly name: string;
}

/**
 * A single destination returned by the API.
 */
interface Destination {
    readonly id: string;
    readonly name: string;
}

/**
 * Shape of the /api/v1/accommodations/types response.
 */
interface AccommodationTypesResponse {
    readonly data: readonly AccommodationType[];
}

/**
 * Shape of the /api/v1/destinations response.
 */
interface DestinationsResponse {
    readonly data: readonly Destination[];
}

/**
 * Internal form state for the hero search bar.
 */
interface SearchFormState {
    readonly type: string;
    readonly destination: string;
    readonly checkIn: string;
    readonly checkOut: string;
}

/**
 * Props for the {@link HeroSearchBar} component.
 */
export interface HeroSearchBarProps {
    /** Active locale — used for future i18n hooks; labels are passed explicitly. */
    readonly locale: 'es' | 'en' | 'pt';

    /**
     * Base URL for the Hospeda REST API (no trailing slash).
     * @example 'https://api.hospeda.com'
     */
    readonly apiBaseUrl: string;

    /** Localised UI strings injected by the parent Astro component. */
    readonly labels: {
        /** Placeholder / first option text for the accommodation-type select. */
        readonly typePlaceholder: string;
        /** Placeholder / first option text for the destination select. */
        readonly destinationPlaceholder: string;
        /** Placeholder text for the check-in date input. */
        readonly checkInPlaceholder: string;
        /** Placeholder text for the check-out date input. */
        readonly checkOutPlaceholder: string;
        /** Call-to-action button label. */
        readonly ctaLabel: string;
        /** Text displayed on the button while API data is still loading. */
        readonly loadingText: string;
        /** aria-label for the search form. */
        readonly searchAriaLabel: string;
    };

    /**
     * Base path for the accommodations listing page, without trailing slash.
     * @example '/es/alojamientos'
     */
    readonly baseAccommodationsPath: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Shared focus-ring class used across interactive elements. */
const FOCUS_RING =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1';

/** Common field classes shared by selects and date inputs. */
const FIELD_BASE =
    'w-full bg-white text-text placeholder-text-tertiary text-sm px-4 py-3 border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset';

// ---------------------------------------------------------------------------
// Helper: build search URL
// ---------------------------------------------------------------------------

/**
 * Builds the filtered accommodations URL from the form state.
 *
 * Returns `null` when URL construction fails so callers can fall back to the
 * bare base path.
 *
 * @param params - Object containing baseAccommodationsPath and form values.
 * @returns Absolute or relative URL string, or `null` on error.
 */
function buildSearchUrl({
    baseAccommodationsPath,
    formState
}: {
    readonly baseAccommodationsPath: string;
    readonly formState: SearchFormState;
}): string | null {
    try {
        const { type, destination, checkIn, checkOut } = formState;

        const params = new URLSearchParams();

        if (type) params.set('tipo', type);
        if (destination) params.set('destino', destination);
        if (checkIn) params.set('llegada', checkIn);
        if (checkOut) params.set('salida', checkOut);

        const query = params.toString();
        return query ? `${baseAccommodationsPath}?${query}` : baseAccommodationsPath;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Helper: fetch data
// ---------------------------------------------------------------------------

/**
 * Fetches accommodation types from the API.
 *
 * Returns an empty array on any network or parsing error so the dropdown
 * gracefully degrades to showing only the placeholder option.
 *
 * @param apiBaseUrl - Base URL of the Hospeda API.
 */
async function fetchAccommodationTypes({
    apiBaseUrl
}: {
    readonly apiBaseUrl: string;
}): Promise<readonly AccommodationType[]> {
    try {
        const response = await fetch(`${apiBaseUrl}/api/v1/accommodations/types`);

        if (!response.ok) return [];

        const json: AccommodationTypesResponse =
            (await response.json()) as AccommodationTypesResponse;
        return Array.isArray(json?.data) ? json.data : [];
    } catch {
        return [];
    }
}

/**
 * Fetches destinations from the API.
 *
 * Returns an empty array on any network or parsing error so the dropdown
 * gracefully degrades to showing only the placeholder option.
 *
 * @param apiBaseUrl - Base URL of the Hospeda API.
 */
async function fetchDestinations({
    apiBaseUrl
}: {
    readonly apiBaseUrl: string;
}): Promise<readonly Destination[]> {
    try {
        const response = await fetch(`${apiBaseUrl}/api/v1/destinations`);

        if (!response.ok) return [];

        const json: DestinationsResponse = (await response.json()) as DestinationsResponse;
        return Array.isArray(json?.data) ? json.data : [];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HeroSearchBar
 *
 * A React island rendered above the fold on the home-page hero section.
 * Provides five search fields:
 *   1. Accommodation type (select, options fetched from API)
 *   2. Destination (select, options fetched from API)
 *   3. Check-in date (date input)
 *   4. Check-out date (date input)
 *   5. CTA / submit button
 *
 * Layout:
 *   - Mobile: vertical stack (`flex-col`), full-width fields.
 *   - Desktop (lg+): single horizontal row (`lg:flex-row`), white card with
 *     `rounded-xl shadow-lg`. The CTA button is rounded-right on desktop and
 *     fully rounded on mobile.
 *
 * Accessibility:
 *   - Every field has a visually-hidden `<label>` for screen readers.
 *   - The form element carries the `aria-label` from `labels.searchAriaLabel`.
 *   - All fields are keyboard-reachable; focus rings use the design-system
 *     primary colour (`focus-visible:ring-primary`).
 *
 * Data loading:
 *   - Dropdowns are `disabled` while the API request is in flight.
 *   - On API error the dropdowns show only the placeholder option — no broken
 *     state, no thrown exceptions.
 *
 * Navigation:
 *   - On submit, navigates to `${baseAccommodationsPath}?tipo=…&destino=…&llegada=…&salida=…`
 *     via `window.location.href`. Falls back to `baseAccommodationsPath` if
 *     URL construction fails.
 *
 * @param props - {@link HeroSearchBarProps}
 */
export function HeroSearchBar({
    locale: _locale,
    apiBaseUrl,
    labels,
    baseAccommodationsPath
}: HeroSearchBarProps): JSX.Element {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    const [accommodationTypes, setAccommodationTypes] = useState<readonly AccommodationType[]>([]);
    const [destinations, setDestinations] = useState<readonly Destination[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [formState, setFormState] = useState<SearchFormState>({
        type: '',
        destination: '',
        checkIn: '',
        checkOut: ''
    });

    // -----------------------------------------------------------------------
    // Data fetching on mount
    // -----------------------------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function loadData(): Promise<void> {
            setIsLoading(true);

            const [types, dests] = await Promise.all([
                fetchAccommodationTypes({ apiBaseUrl }),
                fetchDestinations({ apiBaseUrl })
            ]);

            if (!cancelled) {
                setAccommodationTypes(types);
                setDestinations(dests);
                setIsLoading(false);
            }
        }

        void loadData();

        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl]);

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    /**
     * Generic field change handler — updates `formState` immutably.
     */
    const handleFieldChange = useCallback(
        (field: keyof SearchFormState) =>
            (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
                const { value } = event.target;
                setFormState((prev) => ({ ...prev, [field]: value }));
            },
        []
    );

    /**
     * Submit handler — builds the search URL and navigates.
     */
    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            const url = buildSearchUrl({ baseAccommodationsPath, formState });
            window.location.href = url ?? baseAccommodationsPath;
        },
        [baseAccommodationsPath, formState]
    );

    // -----------------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------------

    /** Today's date in YYYY-MM-DD format — used as `min` on date inputs. */
    const todayIso = new Date().toISOString().split('T')[0] as string;

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <form
            onSubmit={handleSubmit}
            aria-label={labels.searchAriaLabel}
            noValidate
            className="flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-lg md:flex-row"
        >
            {/* ----------------------------------------------------------------
                1. Accommodation type select
            ---------------------------------------------------------------- */}
            <div className="flex flex-1 flex-col border-border border-b md:border-r md:border-b-0">
                {/* Visually hidden label for accessibility */}
                <label
                    htmlFor="hero-search-type"
                    className="sr-only"
                >
                    {labels.typePlaceholder}
                </label>

                <select
                    id="hero-search-type"
                    name="type"
                    value={formState.type}
                    onChange={handleFieldChange('type')}
                    disabled={isLoading}
                    className={`${FIELD_BASE} ${FOCUS_RING} rounded-none disabled:cursor-wait disabled:opacity-60 md:rounded-l-xl`}
                    aria-label={labels.typePlaceholder}
                >
                    <option value="">
                        {isLoading ? labels.loadingText : labels.typePlaceholder}
                    </option>

                    {accommodationTypes.map((t) => (
                        <option
                            key={t.id}
                            value={t.id}
                        >
                            {t.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ----------------------------------------------------------------
                2. Destination select
            ---------------------------------------------------------------- */}
            <div className="flex flex-1 flex-col border-border border-b md:border-r md:border-b-0">
                <label
                    htmlFor="hero-search-destination"
                    className="sr-only"
                >
                    {labels.destinationPlaceholder}
                </label>

                <select
                    id="hero-search-destination"
                    name="destination"
                    value={formState.destination}
                    onChange={handleFieldChange('destination')}
                    disabled={isLoading}
                    className={`${FIELD_BASE} ${FOCUS_RING} rounded-none disabled:cursor-wait disabled:opacity-60`}
                    aria-label={labels.destinationPlaceholder}
                >
                    <option value="">
                        {isLoading ? labels.loadingText : labels.destinationPlaceholder}
                    </option>

                    {destinations.map((d) => (
                        <option
                            key={d.id}
                            value={d.id}
                        >
                            {d.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ----------------------------------------------------------------
                3. Check-in date
            ---------------------------------------------------------------- */}
            <div className="flex flex-1 flex-col border-border border-b md:border-r md:border-b-0">
                <label
                    htmlFor="hero-search-checkin"
                    className="sr-only"
                >
                    {labels.checkInPlaceholder}
                </label>

                <input
                    id="hero-search-checkin"
                    type="date"
                    name="checkIn"
                    value={formState.checkIn}
                    onChange={handleFieldChange('checkIn')}
                    min={todayIso}
                    placeholder={labels.checkInPlaceholder}
                    className={`${FIELD_BASE} ${FOCUS_RING} rounded-none`}
                    aria-label={labels.checkInPlaceholder}
                />
            </div>

            {/* ----------------------------------------------------------------
                4. Check-out date
            ---------------------------------------------------------------- */}
            <div className="flex flex-1 flex-col border-border border-b md:border-r md:border-b-0">
                <label
                    htmlFor="hero-search-checkout"
                    className="sr-only"
                >
                    {labels.checkOutPlaceholder}
                </label>

                <input
                    id="hero-search-checkout"
                    type="date"
                    name="checkOut"
                    value={formState.checkOut}
                    onChange={handleFieldChange('checkOut')}
                    min={formState.checkIn || todayIso}
                    placeholder={labels.checkOutPlaceholder}
                    className={`${FIELD_BASE} ${FOCUS_RING} rounded-none`}
                    aria-label={labels.checkOutPlaceholder}
                />
            </div>

            {/* ----------------------------------------------------------------
                5. CTA submit button
            ---------------------------------------------------------------- */}
            <div className="flex">
                <button
                    type="submit"
                    aria-label={labels.searchAriaLabel}
                    className={`w-full rounded-b-xl bg-primary px-8 py-3 font-semibold text-sm text-white transition-colors duration-150 hover:bg-primary-dark md:w-auto md:rounded-r-lg md:rounded-b-none md:rounded-l-none ${FOCUS_RING} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60`}
                >
                    {labels.ctaLabel}
                </button>
            </div>
        </form>
    );
}
