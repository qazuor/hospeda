import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccommodationType {
    readonly id: string;
    readonly name: string;
}

interface Destination {
    readonly id: string;
    readonly name: string;
}

interface AccommodationTypesResponse {
    readonly data: readonly AccommodationType[];
}

interface DestinationsResponse {
    readonly data: readonly Destination[];
}

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
    readonly locale: 'es' | 'en' | 'pt';
    readonly apiBaseUrl: string;
    readonly labels: {
        readonly typePlaceholder: string;
        readonly destinationPlaceholder: string;
        readonly checkInPlaceholder: string;
        readonly checkOutPlaceholder: string;
        readonly ctaLabel: string;
        readonly loadingText: string;
        readonly searchAriaLabel: string;
    };
    readonly baseAccommodationsPath: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FOCUS_RING =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-1';

const FIELD_BASE =
    'w-full bg-white text-text placeholder-text-tertiary text-sm px-4 py-3 border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Expandable hero search bar.
 *
 * Shows a single "Donde queres ir?" input by default. On focus, expands
 * to reveal all 5 fields (destination, type, check-in, check-out, CTA).
 * Features organic border-radius, teal accent border, and glass effect on mobile.
 */
export function HeroSearchBar({
    locale: _locale,
    apiBaseUrl,
    labels,
    baseAccommodationsPath
}: HeroSearchBarProps): JSX.Element {
    const [accommodationTypes, setAccommodationTypes] = useState<readonly AccommodationType[]>([]);
    const [destinations, setDestinations] = useState<readonly Destination[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    /* Auto-expand on desktop/tablet (>=768px) on mount */
    useEffect(() => {
        if (window.innerWidth >= 768) {
            setIsExpanded(true);
        }
    }, []);

    const [formState, setFormState] = useState<SearchFormState>({
        type: '',
        destination: '',
        checkIn: '',
        checkOut: ''
    });

    // Data fetching
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

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent): void {
            if (formRef.current && !formRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFieldChange = useCallback(
        (field: keyof SearchFormState) =>
            (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
                const { value } = event.target;
                setFormState((prev) => ({ ...prev, [field]: value }));
            },
        []
    );

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const url = buildSearchUrl({ baseAccommodationsPath, formState });
            window.location.href = url ?? baseAccommodationsPath;
        },
        [baseAccommodationsPath, formState]
    );

    const handleExpand = useCallback(() => {
        setIsExpanded(true);
    }, []);

    const todayIso = new Date().toISOString().split('T')[0] as string;

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            aria-label={labels.searchAriaLabel}
            noValidate
            className="w-full transition-all duration-300 ease-out"
        >
            {/* Collapsed state: single search trigger */}
            {!isExpanded && (
                <button
                    type="button"
                    onClick={handleExpand}
                    className={`w-full rounded-[20px] border-2 border-white/30 bg-white/10 px-6 py-4 text-left text-white/70 backdrop-blur-md transition-all duration-200 hover:border-white/50 hover:bg-white/15 ${FOCUS_RING}`}
                >
                    <span className="text-base">{labels.destinationPlaceholder}...</span>
                </button>
            )}

            {/* Expanded state: full search form */}
            {isExpanded && (
                <div className="animate-expand overflow-hidden rounded-[20px] border-2 border-primary-light bg-white shadow-xl backdrop-blur-md">
                    <div className="flex flex-col md:flex-row">
                        {/* Destination */}
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
                                className={`${FIELD_BASE} rounded-none disabled:cursor-wait disabled:opacity-60 md:rounded-l-[18px]`}
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

                        {/* Accommodation type */}
                        <div className="flex flex-1 flex-col border-border border-b md:border-r md:border-b-0">
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
                                className={`${FIELD_BASE} rounded-none disabled:cursor-wait disabled:opacity-60`}
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

                        {/* Check-in */}
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
                                className={`${FIELD_BASE} rounded-none`}
                                aria-label={labels.checkInPlaceholder}
                            />
                        </div>

                        {/* Check-out */}
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
                                className={`${FIELD_BASE} rounded-none`}
                                aria-label={labels.checkOutPlaceholder}
                            />
                        </div>

                        {/* CTA */}
                        <div className="flex">
                            <button
                                type="submit"
                                aria-label={labels.searchAriaLabel}
                                className={`w-full rounded-b-[18px] bg-primary px-8 py-3 font-semibold text-sm text-white transition-colors duration-150 hover:bg-primary-dark md:w-auto md:rounded-r-[18px] md:rounded-b-none ${FOCUS_RING} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                                {labels.ctaLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
}
