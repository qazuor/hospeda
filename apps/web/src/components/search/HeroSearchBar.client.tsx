import type { AccommodationTypeEnum } from '@repo/schemas';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { SearchBottomSheet } from './SearchBottomSheet.client';
import { DateRangePopover } from './popovers/DateRangePopover.client';
import { DestinationPopover } from './popovers/DestinationPopover.client';
import { GuestsPopover } from './popovers/GuestsPopover.client';
import { TypePopover } from './popovers/TypePopover.client';
import { FOCUS_RING } from './search-bar-constants';
import type { DestinationOption, HeroSearchBarLabels, SearchFormState } from './search-bar-types';
import { INITIAL_SEARCH_STATE } from './search-bar-types';

// ---------------------------------------------------------------------------
// Re-export props type for consumers
// ---------------------------------------------------------------------------

export type { HeroSearchBarProps } from './search-bar-types';

/** Props for the {@link HeroSearchBar} component. */
interface InternalProps {
    readonly locale: 'es' | 'en' | 'pt';
    readonly apiBaseUrl: string;
    readonly labels: HeroSearchBarLabels;
    readonly baseAccommodationsPath: string;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface DestinationsListResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: readonly DestinationOption[];
        readonly pagination: { readonly total: number };
    };
}

async function fetchDestinations({
    apiBaseUrl
}: {
    readonly apiBaseUrl: string;
}): Promise<readonly DestinationOption[]> {
    try {
        const response = await fetch(
            `${apiBaseUrl}/api/v1/public/destinations?pageSize=100&destinationType=CITY`
        );
        if (!response.ok) return [];
        const json = (await response.json()) as DestinationsListResponse;
        const items = json?.data?.items;
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

function buildSearchUrl({
    baseAccommodationsPath,
    formState
}: {
    readonly baseAccommodationsPath: string;
    readonly formState: SearchFormState;
}): string {
    const params = new URLSearchParams();

    for (const dest of formState.destinations) {
        params.append('destino', dest);
    }
    for (const type of formState.types) {
        params.append('tipo', type);
    }
    if (formState.checkIn) params.set('llegada', formState.checkIn);
    if (formState.checkOut) params.set('salida', formState.checkOut);
    if (formState.adults !== 2) params.set('adultos', String(formState.adults));
    if (formState.children > 0) params.set('ninos', String(formState.children));

    const query = params.toString();
    return query ? `${baseAccommodationsPath}?${query}` : baseAccommodationsPath;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Redesigned hero search bar with multi-select popovers.
 *
 * Desktop: horizontal bar with 4 trigger buttons + search CTA.
 * Mobile: collapsed button that opens a bottom sheet with all fields.
 *
 * Features:
 * - Multi-select destinations (from API)
 * - Multi-select accommodation types (static enum)
 * - Date range picker with native inputs
 * - Guest selector with stepper controls
 * - @floating-ui/react for popover positioning
 */
export function HeroSearchBar({
    locale,
    apiBaseUrl,
    labels,
    baseAccommodationsPath
}: InternalProps): JSX.Element {
    const [formState, setFormState] = useState<SearchFormState>(INITIAL_SEARCH_STATE);
    const [destinations, setDestinations] = useState<readonly DestinationOption[]>([]);
    const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    /**
     * Viewport layout mode:
     * - 'mobile'     (<768px)  : collapsed trigger + bottom sheet
     * - 'horizontal' (768-1279): horizontal bar with popovers
     * - 'vertical'   (>=1280)  : stacked vertical form for side-by-side hero
     */
    type LayoutMode = 'mobile' | 'horizontal' | 'vertical';
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontal');

    // Detect viewport layout mode
    useEffect(() => {
        function check(): void {
            const w = window.innerWidth;
            if (w < 768) {
                setLayoutMode('mobile');
            } else if (w >= 1280) {
                setLayoutMode('vertical');
            } else {
                setLayoutMode('horizontal');
            }
        }
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Fetch destinations
    useEffect(() => {
        let cancelled = false;
        async function load(): Promise<void> {
            setIsLoadingDestinations(true);
            const dests = await fetchDestinations({ apiBaseUrl });
            if (!cancelled) {
                setDestinations(dests);
                setIsLoadingDestinations(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl]);

    // Field handlers
    const handleDestinationToggle = useCallback((id: string) => {
        setFormState((prev) => ({
            ...prev,
            destinations: prev.destinations.includes(id)
                ? prev.destinations.filter((d) => d !== id)
                : [...prev.destinations, id]
        }));
    }, []);

    const handleTypeToggle = useCallback((type: AccommodationTypeEnum) => {
        setFormState((prev) => ({
            ...prev,
            types: prev.types.includes(type)
                ? prev.types.filter((t) => t !== type)
                : [...prev.types, type]
        }));
    }, []);

    const handleCheckInChange = useCallback((value: string) => {
        setFormState((prev) => ({ ...prev, checkIn: value }));
    }, []);

    const handleCheckOutChange = useCallback((value: string) => {
        setFormState((prev) => ({ ...prev, checkOut: value }));
    }, []);

    const handleAdultsChange = useCallback((value: number) => {
        setFormState((prev) => ({ ...prev, adults: value }));
    }, []);

    const handleChildrenChange = useCallback((value: number) => {
        setFormState((prev) => ({ ...prev, children: value }));
    }, []);

    const handleSubmit = useCallback(() => {
        const url = buildSearchUrl({ baseAccommodationsPath, formState });
        window.location.href = url;
    }, [baseAccommodationsPath, formState]);

    const handleFormSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            handleSubmit();
        },
        [handleSubmit]
    );

    // Mobile: collapsed trigger + bottom sheet
    if (layoutMode === 'mobile') {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setIsSheetOpen(true)}
                    className={`w-full rounded-[20px] border-2 border-white/30 bg-white/10 px-6 py-4 text-left text-white/70 backdrop-blur-md transition-all duration-200 hover:border-white/50 hover:bg-white/15 ${FOCUS_RING}`}
                    aria-label={labels.searchAriaLabel}
                >
                    <span className="flex items-center gap-2 text-base">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 256 256"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                        </svg>
                        {labels.destinationPlaceholder}...
                    </span>
                </button>
                <SearchBottomSheet
                    isOpen={isSheetOpen}
                    onClose={() => setIsSheetOpen(false)}
                    onSubmit={() => {
                        setIsSheetOpen(false);
                        handleSubmit();
                    }}
                    formState={formState}
                    destinations={destinations}
                    isLoadingDestinations={isLoadingDestinations}
                    labels={labels}
                    locale={locale}
                    onDestinationToggle={handleDestinationToggle}
                    onTypeToggle={handleTypeToggle}
                    onCheckInChange={handleCheckInChange}
                    onCheckOutChange={handleCheckOutChange}
                    onAdultsChange={handleAdultsChange}
                    onChildrenChange={handleChildrenChange}
                />
            </>
        );
    }

    // Wide: vertical stacked form for side-by-side hero layout
    if (layoutMode === 'vertical') {
        return (
            <search aria-label={labels.searchAriaLabel}>
                <form
                    onSubmit={handleFormSubmit}
                    noValidate
                    className="w-full"
                >
                    <div className="flex flex-col gap-2 rounded-[20px] border-2 border-white/20 bg-white/10 p-3 shadow-xl backdrop-blur-md">
                        {/* Destination */}
                        <div className="rounded-xl bg-white/95 shadow-sm">
                            <DestinationPopover
                                destinations={destinations}
                                selected={formState.destinations as string[]}
                                onToggle={handleDestinationToggle}
                                isLoading={isLoadingDestinations}
                                destinationPlaceholder={labels.destinationPlaceholder}
                                loadingText={labels.loadingText}
                            />
                        </div>

                        {/* Type */}
                        <div className="rounded-xl bg-white/95 shadow-sm">
                            <TypePopover
                                selected={formState.types}
                                onToggle={handleTypeToggle}
                                typeLabels={labels.typeLabels}
                                typePlaceholder={labels.typePlaceholder}
                            />
                        </div>

                        {/* Dates */}
                        <div className="rounded-xl bg-white/95 shadow-sm">
                            <DateRangePopover
                                checkIn={formState.checkIn}
                                checkOut={formState.checkOut}
                                onCheckInChange={handleCheckInChange}
                                onCheckOutChange={handleCheckOutChange}
                                locale={locale}
                                checkInLabel={labels.checkInLabel}
                                checkOutLabel={labels.checkOutLabel}
                                datesPlaceholder={labels.datesPlaceholder}
                            />
                        </div>

                        {/* Guests */}
                        <div className="rounded-xl bg-white/95 shadow-sm">
                            <GuestsPopover
                                adults={formState.adults}
                                childrenCount={formState.children}
                                onAdultsChange={handleAdultsChange}
                                onChildrenChange={handleChildrenChange}
                                adultsLabel={labels.adultsLabel}
                                childrenLabel={labels.childrenLabel}
                                guestsPlaceholder={labels.guestsPlaceholder}
                                guestsSummary={labels.guestsSummary}
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className={`mt-1 w-full rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition-colors duration-150 hover:bg-primary-dark ${FOCUS_RING}`}
                            aria-label={labels.searchAriaLabel}
                        >
                            {labels.ctaLabel}
                        </button>
                    </div>
                </form>
            </search>
        );
    }

    // Medium: horizontal search bar with 4 popover triggers
    return (
        <search aria-label={labels.searchAriaLabel}>
            <form
                onSubmit={handleFormSubmit}
                noValidate
                className="w-full"
            >
                <div className="flex items-stretch overflow-hidden rounded-[20px] border-2 border-primary-light bg-white shadow-xl">
                    {/* Destination */}
                    <div className="flex min-w-0 flex-1 border-border border-r">
                        <DestinationPopover
                            destinations={destinations}
                            selected={formState.destinations as string[]}
                            onToggle={handleDestinationToggle}
                            isLoading={isLoadingDestinations}
                            destinationPlaceholder={labels.destinationPlaceholder}
                            loadingText={labels.loadingText}
                        />
                    </div>

                    {/* Type */}
                    <div className="flex min-w-0 flex-1 border-border border-r">
                        <TypePopover
                            selected={formState.types}
                            onToggle={handleTypeToggle}
                            typeLabels={labels.typeLabels}
                            typePlaceholder={labels.typePlaceholder}
                        />
                    </div>

                    {/* Dates */}
                    <div className="flex min-w-0 flex-1 border-border border-r">
                        <DateRangePopover
                            checkIn={formState.checkIn}
                            checkOut={formState.checkOut}
                            onCheckInChange={handleCheckInChange}
                            onCheckOutChange={handleCheckOutChange}
                            locale={locale}
                            checkInLabel={labels.checkInLabel}
                            checkOutLabel={labels.checkOutLabel}
                            datesPlaceholder={labels.datesPlaceholder}
                        />
                    </div>

                    {/* Guests */}
                    <div className="flex min-w-0 flex-1 border-border border-r">
                        <GuestsPopover
                            adults={formState.adults}
                            childrenCount={formState.children}
                            onAdultsChange={handleAdultsChange}
                            onChildrenChange={handleChildrenChange}
                            adultsLabel={labels.adultsLabel}
                            childrenLabel={labels.childrenLabel}
                            guestsPlaceholder={labels.guestsPlaceholder}
                            guestsSummary={labels.guestsSummary}
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className={`whitespace-nowrap rounded-r-[18px] bg-primary px-8 py-3 font-semibold text-sm text-white transition-colors duration-150 hover:bg-primary-dark ${FOCUS_RING}`}
                        aria-label={labels.searchAriaLabel}
                    >
                        {labels.ctaLabel}
                    </button>
                </div>
            </form>
        </search>
    );
}
