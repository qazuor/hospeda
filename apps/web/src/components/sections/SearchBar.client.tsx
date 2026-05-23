/**
 * @file SearchBar.client.tsx
 * @description Interactive search bar island for the hero section. Provides four
 * inputs (destination, accommodation type, date range, guests) with dropdown
 * panels. Replaces the static SearchBar.astro stub with full interactivity.
 */

import { ErrorBoundary } from '@/components/shared/ui/ErrorBoundary';
import { getAccommodationTypeIcon } from '@/lib/accommodation-type-icons';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    BuildingIcon,
    CalendarDotsIcon,
    CloseIcon,
    LocationIcon,
    SearchIcon,
    StarIcon,
    UsersIcon
} from '@repo/icons';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import styles from './SearchBar.module.css';

/**
 * Lazy-loaded date-range calendar. The chunk (react-day-picker + locales +
 * style.css) is fetched only when the user opens the dates panel for the
 * first time, keeping the hero island bundle small for LCP.
 */
const SearchBarCalendar = lazy(() =>
    import('./SearchBarCalendar.client').then((mod) => ({ default: mod.SearchBarCalendar }))
);

// Types

/** A city destination option pre-fetched at build time. */
interface DestinationOption {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    /** When true, the option is highlighted as a featured destination. */
    readonly isFeatured?: boolean;
}

interface SearchBarProps {
    readonly locale: SupportedLocale;
    /** Pre-fetched destination options (cities only, from SSR). */
    readonly destinations: readonly DestinationOption[];
    /**
     * Absolute or locale-prefixed base URL of the listing page the search
     * should navigate to. Example: `/es/alojamientos/`.
     */
    readonly searchBaseUrl: string;
}

/** Which panel is currently open, or null when all closed. */
type ActivePanel = 'destination' | 'type' | 'dates' | 'guests' | null;

// Accommodation type config

const ACCOMMODATION_TYPES = [
    'HOTEL',
    'APARTMENT',
    'HOUSE',
    'COUNTRY_HOUSE',
    'CABIN',
    'HOSTEL',
    'CAMPING',
    'ROOM',
    'MOTEL',
    'RESORT'
] as const;

type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

// Component

/**
 * Interactive search bar with four input columns: destination, accommodation
 * type, date range, and guest count. Each column opens a dropdown panel on
 * click. Only one panel is open at a time.
 *
 * @example
 * ```tsx
 * <SearchBar
 *   client:load
 *   locale="es"
 *   destinations={[{ id: '1', slug: 'colon', name: 'Colón' }]}
 * />
 * ```
 */
export function SearchBar(props: SearchBarProps) {
    return (
        <ErrorBoundary>
            <SearchBarInner {...props} />
        </ErrorBoundary>
    );
}

/**
 * Format a Date as ISO `YYYY-MM-DD` using local time (not UTC). Required
 * because react-day-picker yields Date objects in local TZ; calling
 * `.toISOString()` would shift dates near midnight to the previous day.
 */
function formatIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Build the navigation URL with only the params that have a meaningful value.
 * Adults/children are emitted only when they differ from defaults (2/0) so the
 * URL stays clean for casual searches.
 */
export function buildSearchUrl(args: {
    readonly baseUrl: string;
    readonly destinationId: string | null;
    readonly types: ReadonlySet<AccommodationType>;
    readonly checkIn?: Date;
    readonly checkOut?: Date;
    readonly adults: number;
    readonly children: number;
}): string {
    const params = new URLSearchParams();
    if (args.destinationId) {
        params.set('destinationIds', args.destinationId);
    }
    if (args.types.size > 0 && args.types.size < ACCOMMODATION_TYPES.length) {
        params.set('types', Array.from(args.types).join(','));
    }
    if (args.checkIn) {
        params.set('checkIn', formatIsoDate(args.checkIn));
    }
    if (args.checkOut) {
        params.set('checkOut', formatIsoDate(args.checkOut));
    }
    // Always emit adults/children so the listing's sidebar steppers reflect
    // exactly what the user saw in the hero (otherwise defaults diverge: hero
    // defaults to 2/0, sidebar minima are 1/0).
    params.set('adults', String(args.adults));
    if (args.children > 0) {
        params.set('children', String(args.children));
    }
    const qs = params.toString();
    return qs ? `${args.baseUrl}?${qs}` : args.baseUrl;
}

function SearchBarInner({ locale, destinations, searchBaseUrl }: SearchBarProps) {
    const { t } = createTranslations(locale);
    const barRef = useRef<HTMLDivElement>(null);

    // State
    const [activePanel, setActivePanel] = useState<ActivePanel>(null);
    const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
    const [selectedDestination, setSelectedDestination] = useState<DestinationOption | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<ReadonlySet<AccommodationType>>(new Set());
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    // Search inputs inside the destination and type panels. Filtered locally
    // against the pre-fetched lists — no extra API calls.
    const [destinationQuery, setDestinationQuery] = useState('');
    const [typeQuery, setTypeQuery] = useState('');
    const destinationSearchInputRef = useRef<HTMLInputElement | null>(null);
    const typeSearchInputRef = useRef<HTMLInputElement | null>(null);

    // Click outside / ESC to close
    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (barRef.current && !barRef.current.contains(event.target as Node)) {
            setActivePanel(null);
        }
    }, []);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            setActivePanel(null);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleClickOutside, handleKeyDown]);

    /**
     * Expose panel open state on <html> so global UI (e.g. the feedback FAB)
     * can hide itself while a search panel covers the bottom of the viewport
     * on mobile. Also locks <html> scroll while the bottom-sheet is open so
     * background scroll doesn't bleed through the drawer.
     */
    useEffect(() => {
        const isOpen = activePanel !== null;
        const previousOverflow = document.documentElement.style.overflow;
        if (isOpen) {
            document.documentElement.setAttribute('data-search-panel-open', '');
            // Only lock scroll on mobile sheet sizes — desktop dropdowns are
            // popovers and shouldn't block page scroll.
            if (window.matchMedia('(max-width: 900px)').matches) {
                document.documentElement.style.overflow = 'hidden';
            }
        } else {
            document.documentElement.removeAttribute('data-search-panel-open');
            document.documentElement.style.overflow = previousOverflow;
        }
        return () => {
            document.documentElement.removeAttribute('data-search-panel-open');
            document.documentElement.style.overflow = previousOverflow;
        };
    }, [activePanel]);

    /** Close the active panel (used by the mobile X button). */
    const closePanel = useCallback(() => setActivePanel(null), []);

    // Reset the per-panel search query whenever the user closes or switches
    // panels, and autofocus the input on the freshly opened panel so power
    // users can start typing right away.
    useEffect(() => {
        if (activePanel !== 'destination') {
            setDestinationQuery('');
        } else {
            destinationSearchInputRef.current?.focus();
        }
        if (activePanel !== 'type') {
            setTypeQuery('');
        } else {
            typeSearchInputRef.current?.focus();
        }
    }, [activePanel]);

    /** Substring-filtered destinations driven by the panel search input. */
    const filteredDestinations = useMemo(() => {
        const needle = destinationQuery.trim().toLowerCase();
        if (needle.length === 0) return destinations;
        return destinations.filter((dest) => dest.name.toLowerCase().includes(needle));
    }, [destinations, destinationQuery]);

    /** Substring-filtered accommodation types driven by the panel search input. */
    const filteredTypes = useMemo(() => {
        const needle = typeQuery.trim().toLowerCase();
        if (needle.length === 0) return ACCOMMODATION_TYPES;
        return ACCOMMODATION_TYPES.filter((value) => {
            const label = t(`home.searchBar.types.${value}`, value).toLowerCase();
            return label.includes(needle);
        });
    }, [typeQuery, t]);

    // Panel toggle (measures viewport space to decide direction)
    const togglePanel = useCallback((panel: ActivePanel) => {
        setActivePanel((prev) => {
            if (prev === panel) return null;
            /* Measure space below the bar to decide open direction */
            if (barRef.current) {
                const rect = barRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                /* If less than 380px below (enough for the tallest panel), open upward */
                setOpenDirection(spaceBelow < 380 ? 'up' : 'down');
            }
            return panel;
        });
    }, []);

    // Destination handlers
    const handleSelectDestination = useCallback((dest: DestinationOption | null) => {
        setSelectedDestination(dest);
        setActivePanel(null);
    }, []);

    // Type handlers (single-select: picking a type replaces the selection
    // and closes the panel, mirroring the destination column UX).
    const handleSelectType = useCallback((type: AccommodationType | null) => {
        setSelectedTypes(type ? new Set([type]) : new Set());
        setActivePanel(null);
    }, []);

    // Calendar chunk modulepreload (fires once on first hover/focus of dates column)
    const calendarPreloadedRef = useRef(false);
    const preloadCalendar = useCallback(() => {
        if (calendarPreloadedRef.current) return;
        calendarPreloadedRef.current = true;
        // Fire-and-forget speculative import. The browser caches the module
        // graph so the subsequent React.lazy resolution is instant.
        void import('./SearchBarCalendar.client');
    }, []);

    // Date display
    const formatDateShort = useCallback((date: Date): string => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    }, []);

    // Type display value (single-select: at most one entry in the set).
    const getTypeDisplayValue = useCallback((): string | null => {
        const [first] = selectedTypes;
        if (!first) return null;
        return t(`home.searchBar.types.${first}`, first);
    }, [selectedTypes, t]);

    // Guests display value
    const guestsDisplay = t('home.searchBar.guestsSummary', '{adults} adultos, {children} niños', {
        adults,
        children
    });

    return (
        <div
            ref={barRef}
            className={styles.searchBar}
            // biome-ignore lint/a11y/useSemanticElements: <search> element has inconsistent browser support
            role="search"
            aria-label={t('home.searchBar.searchAriaLabel', 'Buscar alojamientos')}
        >
            <div className={styles.inner}>
                {/* Col 1: Destination */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'destination' && styles.colActive
                    )}
                    onClick={() => togglePanel('destination')}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePanel('destination');
                        }
                    }}
                    // biome-ignore lint/a11y/useSemanticElements: div contains nested divs which are invalid inside <button>
                    role="button"
                    tabIndex={0}
                    aria-expanded={activePanel === 'destination'}
                    aria-haspopup="listbox"
                >
                    <div className={styles.icon}>
                        <LocationIcon
                            size={16}
                            weight="regular"
                            aria-hidden="true"
                        />
                    </div>
                    <div className={styles.content}>
                        <span className={styles.label}>
                            {t('home.searchBar.destinationLabel', 'Destino')}
                        </span>
                        <span
                            className={cn(
                                styles.value,
                                selectedDestination && styles.valueSelected
                            )}
                        >
                            {selectedDestination?.name ??
                                t('home.searchBar.destinationPlaceholder', '¿Dónde querés ir?')}
                        </span>
                    </div>
                </div>

                {/* Col 2: Type */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'type' && styles.colActive
                    )}
                    onClick={() => togglePanel('type')}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePanel('type');
                        }
                    }}
                    // biome-ignore lint/a11y/useSemanticElements: div contains nested divs which are invalid inside <button>
                    role="button"
                    tabIndex={0}
                    aria-expanded={activePanel === 'type'}
                    aria-haspopup="listbox"
                >
                    <div className={styles.icon}>
                        <BuildingIcon
                            size={16}
                            weight="regular"
                            aria-hidden="true"
                        />
                    </div>
                    <div className={styles.content}>
                        <span className={styles.label}>
                            {t('home.searchBar.typeLabel', 'Tipo')}
                        </span>
                        <span
                            className={cn(
                                styles.value,
                                selectedTypes.size > 0 && styles.valueSelected
                            )}
                        >
                            {getTypeDisplayValue() ??
                                t('home.searchBar.typePlaceholder', '¿Tipo de alojamiento?')}
                        </span>
                    </div>
                </div>

                {/* Col 3: Dates */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'dates' && styles.colActive
                    )}
                    onClick={() => togglePanel('dates')}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePanel('dates');
                        }
                    }}
                    onPointerEnter={preloadCalendar}
                    onFocus={preloadCalendar}
                    // biome-ignore lint/a11y/useSemanticElements: div contains nested divs which are invalid inside <button>
                    role="button"
                    tabIndex={0}
                    aria-expanded={activePanel === 'dates'}
                    aria-haspopup="dialog"
                >
                    <div className={styles.icon}>
                        <CalendarDotsIcon
                            size={16}
                            weight="regular"
                            aria-hidden="true"
                        />
                    </div>
                    <div className={styles.content}>
                        <span className={styles.label}>
                            {t('home.searchBar.datesLabel', 'Fechas')}
                        </span>
                        <span className={cn(styles.value, dateRange?.from && styles.valueSelected)}>
                            {dateRange?.from
                                ? dateRange.to
                                    ? `${formatDateShort(dateRange.from)} - ${formatDateShort(dateRange.to)}`
                                    : formatDateShort(dateRange.from)
                                : t('home.searchBar.datesPlaceholder', '¿Cuándo querés venir?')}
                        </span>
                    </div>
                </div>

                {/* Col 4: Guests */}
                <div
                    className={cn(styles.col, activePanel === 'guests' && styles.colActive)}
                    onClick={() => togglePanel('guests')}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePanel('guests');
                        }
                    }}
                    // biome-ignore lint/a11y/useSemanticElements: div contains nested divs which are invalid inside <button>
                    role="button"
                    tabIndex={0}
                    aria-expanded={activePanel === 'guests'}
                    aria-haspopup="dialog"
                >
                    <div className={styles.icon}>
                        <UsersIcon
                            size={16}
                            weight="regular"
                            aria-hidden="true"
                        />
                    </div>
                    <div className={styles.content}>
                        <span className={styles.label}>
                            {t('home.searchBar.guestsLabel', 'Huéspedes')}
                        </span>
                        <span
                            className={cn(
                                styles.value,
                                (adults !== 2 || children !== 0) && styles.valueSelected
                            )}
                        >
                            {adults === 2 && children === 0
                                ? t('home.searchBar.guestsPlaceholder', '¿Cuántas personas son?')
                                : guestsDisplay}
                        </span>
                    </div>
                </div>

                {/* Search button */}
                <button
                    type="button"
                    className={styles.button}
                    aria-label={t('home.searchBar.ctaLabel', 'Buscar')}
                    onClick={() => {
                        const url = buildSearchUrl({
                            baseUrl: searchBaseUrl,
                            destinationId: selectedDestination?.id ?? null,
                            types: selectedTypes,
                            checkIn: dateRange?.from,
                            checkOut: dateRange?.to,
                            adults,
                            children
                        });
                        trackEvent(WebEvents.AccommodationSearched, {
                            destination_id: selectedDestination?.id ?? null,
                            accommodation_types: selectedTypes,
                            has_dates: Boolean(dateRange?.from || dateRange?.to),
                            adults,
                            children,
                            locale
                        });
                        window.location.assign(url);
                    }}
                >
                    <span>{t('home.searchBar.ctaLabel', 'Buscar')}</span>
                    <span className={styles.buttonIcon}>
                        <SearchIcon
                            size={20}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </span>
                </button>
            </div>

            {/* Mobile backdrop — dims the page behind the bottom-sheet panel.
                Clicking it closes the active panel (mirrors the click-outside
                handler). Hidden on viewports >900px where panels are popovers. */}
            {activePanel !== null && (
                <button
                    type="button"
                    className={styles.backdrop}
                    onClick={closePanel}
                    aria-label={t('home.searchBar.closePanel', 'Cerrar panel')}
                    tabIndex={-1}
                />
            )}

            {/* Panels (rendered below the bar) */}

            {/* Destination panel */}
            {activePanel === 'destination' && (
                // biome-ignore lint/a11y/useFocusableInteractive: listbox children (buttons) handle focus
                <div
                    className={cn(
                        styles.panel,
                        styles.destinationPanel,
                        openDirection === 'up' && styles.panelUp
                    )}
                    // biome-ignore lint/a11y/useSemanticElements: custom styled dropdown cannot use native <select>
                    role="listbox"
                >
                    <PanelCloseHeader
                        ariaLabel={t('home.searchBar.closePanel', 'Cerrar panel')}
                        onClose={closePanel}
                    />
                    <div className={styles.panelSearch}>
                        <input
                            ref={destinationSearchInputRef}
                            type="text"
                            className="form-input"
                            value={destinationQuery}
                            onChange={(event) => setDestinationQuery(event.target.value)}
                            placeholder={t(
                                'home.searchBar.destinationSearchPlaceholder',
                                'Buscá un destino'
                            )}
                            aria-label={t(
                                'home.searchBar.destinationSearchLabel',
                                'Buscar entre los destinos'
                            )}
                        />
                    </div>
                    <div className={cn(styles.panelBody, styles.panelOptionList)}>
                        {/* Clear option */}
                        {selectedDestination && (
                            <button
                                type="button"
                                className={cn('combobox__option', styles.optionClear)}
                                onClick={() => handleSelectDestination(null)}
                                // biome-ignore lint/a11y/useSemanticElements: role=option on button is valid ARIA for custom listbox
                                role="option"
                                aria-selected={false}
                            >
                                <span className="combobox__option-label">
                                    {t('home.searchBar.clearTypes', 'Limpiar')}
                                </span>
                            </button>
                        )}
                        {filteredDestinations.map((dest) => {
                            const isSelected = selectedDestination?.id === dest.id;
                            return (
                                <button
                                    key={dest.id}
                                    type="button"
                                    className={cn(
                                        'combobox__option',
                                        isSelected && 'combobox__option--selected'
                                    )}
                                    onClick={() => handleSelectDestination(dest)}
                                    // biome-ignore lint/a11y/useSemanticElements: role=option on button is valid ARIA for custom listbox
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    <span
                                        className="combobox__option-icon"
                                        aria-hidden="true"
                                    >
                                        <LocationIcon
                                            size={14}
                                            weight="regular"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <span className="combobox__option-label">{dest.name}</span>
                                    {dest.isFeatured && (
                                        <span
                                            className="featured-indicator"
                                            aria-label={t(
                                                'home.searchBar.featuredDestinationLabel',
                                                'Destino destacado'
                                            )}
                                        >
                                            <StarIcon
                                                size={13}
                                                weight="fill"
                                                aria-hidden="true"
                                            />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                        {filteredDestinations.length === 0 && (
                            <div className="combobox__status">
                                {destinations.length === 0
                                    ? t(
                                          'home.searchBar.noDestinationsText',
                                          'No hay destinos disponibles'
                                      )
                                    : t(
                                          'home.searchBar.noDestinationsMatch',
                                          'No hay destinos que coincidan con tu búsqueda'
                                      )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Type panel */}
            {activePanel === 'type' && (
                // biome-ignore lint/a11y/useFocusableInteractive: listbox children (buttons) handle focus
                <div
                    className={cn(
                        styles.panel,
                        styles.typePanel,
                        openDirection === 'up' && styles.panelUp
                    )}
                    // biome-ignore lint/a11y/useSemanticElements: custom single-select dropdown cannot use native <select>
                    role="listbox"
                >
                    <PanelCloseHeader
                        ariaLabel={t('home.searchBar.closePanel', 'Cerrar panel')}
                        onClose={closePanel}
                    />
                    <div className={styles.panelSearch}>
                        <input
                            ref={typeSearchInputRef}
                            type="text"
                            className="form-input"
                            value={typeQuery}
                            onChange={(event) => setTypeQuery(event.target.value)}
                            placeholder={t('home.searchBar.typeSearchPlaceholder', 'Buscá un tipo')}
                            aria-label={t(
                                'home.searchBar.typeSearchLabel',
                                'Buscar entre los tipos de alojamiento'
                            )}
                        />
                    </div>
                    <div className={cn(styles.typeList, styles.panelOptionList)}>
                        {/* Clear option */}
                        {selectedTypes.size > 0 && (
                            <button
                                type="button"
                                className={cn('combobox__option', styles.optionClear)}
                                onClick={() => handleSelectType(null)}
                                // biome-ignore lint/a11y/useSemanticElements: role=option on button is valid ARIA for custom listbox
                                role="option"
                                aria-selected={false}
                            >
                                <span className="combobox__option-label">
                                    {t('home.searchBar.clearTypes', 'Limpiar')}
                                </span>
                            </button>
                        )}
                        {filteredTypes.map((type) => {
                            const IconComponent = getAccommodationTypeIcon({ type });
                            const isSelected = selectedTypes.has(type);
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    className={cn(
                                        'combobox__option',
                                        isSelected && 'combobox__option--selected'
                                    )}
                                    onClick={() => handleSelectType(type)}
                                    // biome-ignore lint/a11y/useSemanticElements: role=option on button is valid ARIA for custom listbox
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    <span
                                        className="combobox__option-icon"
                                        aria-hidden="true"
                                    >
                                        <IconComponent
                                            size={14}
                                            weight="regular"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <span className="combobox__option-label">
                                        {t(`home.searchBar.types.${type}`, type)}
                                    </span>
                                </button>
                            );
                        })}
                        {filteredTypes.length === 0 && (
                            <div className="combobox__status">
                                {t(
                                    'home.searchBar.noTypesMatch',
                                    'No hay tipos que coincidan con tu búsqueda'
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Calendar panel */}
            {activePanel === 'dates' && (
                <div
                    className={cn(
                        styles.panel,
                        styles.calendarPanel,
                        openDirection === 'up' && styles.panelUp
                    )}
                    // biome-ignore lint/a11y/useSemanticElements: popover panel, not a modal — <dialog> API requires open/close management incompatible with conditional render
                    role="dialog"
                    aria-label={t('home.searchBar.datesLabel', 'Fechas')}
                >
                    <PanelCloseHeader
                        ariaLabel={t('home.searchBar.closePanel', 'Cerrar panel')}
                        onClose={closePanel}
                    />
                    <div className={styles.panelBody}>
                        <Suspense fallback={null}>
                            <SearchBarCalendar
                                locale={locale}
                                selected={dateRange}
                                onSelect={setDateRange}
                            />
                        </Suspense>
                    </div>
                </div>
            )}

            {/* Guests panel */}
            {activePanel === 'guests' && (
                <div
                    className={cn(
                        styles.panel,
                        styles.guestsPanel,
                        openDirection === 'up' && styles.panelUp
                    )}
                    // biome-ignore lint/a11y/useSemanticElements: popover panel, not a modal — <dialog> API requires open/close management incompatible with conditional render
                    role="dialog"
                    aria-label={t('home.searchBar.guestsLabel', 'Huéspedes')}
                >
                    <PanelCloseHeader
                        ariaLabel={t('home.searchBar.closePanel', 'Cerrar panel')}
                        onClose={closePanel}
                    />
                    <div className={styles.panelBody}>
                        {/* Adults row */}
                        <div className={styles.guestRow}>
                            <span className={styles.guestLabel}>
                                {t('home.searchBar.adultsLabel', 'Adultos')}
                            </span>
                            <div className={styles.stepper}>
                                <button
                                    type="button"
                                    className={styles.stepperButton}
                                    onClick={() => setAdults((prev) => Math.max(1, prev - 1))}
                                    disabled={adults <= 1}
                                    aria-label={t('search.fewerAdults', 'Fewer adults')}
                                >
                                    -
                                </button>
                                <span className={styles.stepperValue}>{adults}</span>
                                <button
                                    type="button"
                                    className={styles.stepperButton}
                                    onClick={() => setAdults((prev) => Math.min(10, prev + 1))}
                                    disabled={adults >= 10}
                                    aria-label={t('search.moreAdults', 'More adults')}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {/* Children row */}
                        <div className={styles.guestRow}>
                            <span className={styles.guestLabel}>
                                {t('home.searchBar.childrenLabel', 'Niños')}
                            </span>
                            <div className={styles.stepper}>
                                <button
                                    type="button"
                                    className={styles.stepperButton}
                                    onClick={() => setChildren((prev) => Math.max(0, prev - 1))}
                                    disabled={children <= 0}
                                    aria-label={t('search.fewerChildren', 'Fewer children')}
                                >
                                    -
                                </button>
                                <span className={styles.stepperValue}>{children}</span>
                                <button
                                    type="button"
                                    className={styles.stepperButton}
                                    onClick={() => setChildren((prev) => Math.min(6, prev + 1))}
                                    disabled={children >= 6}
                                    aria-label={t('search.moreChildren', 'More children')}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Sticky panel header rendered at the top of every mobile bottom-sheet
 * variant. Holds a close (X) button so users can dismiss the sheet without
 * tapping outside it. CSS hides it on viewports >900px where panels render
 * as desktop popovers and a dedicated close button is unnecessary.
 */
function PanelCloseHeader({
    ariaLabel,
    onClose
}: {
    readonly ariaLabel: string;
    readonly onClose: () => void;
}) {
    return (
        <div className={styles.panelHeader}>
            <button
                type="button"
                className={styles.panelClose}
                onClick={onClose}
                aria-label={ariaLabel}
            >
                <CloseIcon
                    size={18}
                    weight="bold"
                    aria-hidden="true"
                />
            </button>
        </div>
    );
}
