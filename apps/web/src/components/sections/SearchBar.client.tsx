/**
 * @file SearchBar.client.tsx
 * @description Interactive search bar island for the hero section. Provides four
 * inputs (destination, accommodation type, date range, guests) with dropdown
 * panels. Replaces the static SearchBar.astro stub with full interactivity.
 */

import {
    BuildingIcon,
    CalendarDotsIcon,
    CloseIcon,
    LocationIcon,
    SearchIcon,
    StarIcon,
    UsersIcon
} from '@repo/icons';
import type { ReactNode, RefObject } from 'react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { createPortal } from 'react-dom';
import { ErrorBoundary } from '@/components/shared/ui/ErrorBoundary';
import { getAccommodationTypeIcon } from '@/lib/accommodation-type-icons';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { cn } from '@/lib/cn';
import { trapFocus } from '@/lib/focus-trap';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
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

/**
 * Viewport width below which panels stop being desktop popovers and become
 * fixed bottom-sheets. Must stay in sync with the `@media (max-width: 900px)`
 * block in `SearchBar.module.css` — the portal below reparents the sheet only
 * at sizes where the CSS has already switched it to `position: fixed`.
 */
const MOBILE_SHEET_MEDIA_QUERY = '(max-width: 900px)';

/**
 * Marks every dropdown panel so the click-outside handler can recognise it
 * once it has been portaled away from the bar's DOM subtree.
 */
const PANEL_MARKER_ATTRIBUTE = 'data-search-panel';

/**
 * Stable DOM ids, one per panel, so each trigger column can point at the panel
 * it owns via `aria-controls`. Paired per-panel (rather than a single shared
 * id) because only one panel is rendered at a time and the id has to exist on
 * whichever panel is actually mounted.
 */
const PANEL_IDS = {
    destination: 'search-panel-destination',
    type: 'search-panel-type',
    dates: 'search-panel-dates',
    guests: 'search-panel-guests'
} as const;

/**
 * Tracks whether the viewport is at bottom-sheet size, staying in sync with
 * live viewport changes (rotation, desktop window resize).
 *
 * Starts at `false` so the server render and the first client render agree
 * (SSR has no viewport to measure); the effect corrects it on mount, before
 * any panel can be open.
 */
function useIsMobileSheet(): boolean {
    const [isMobileSheet, setIsMobileSheet] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia(MOBILE_SHEET_MEDIA_QUERY);
        const sync = () => setIsMobileSheet(mediaQuery.matches);
        sync();
        mediaQuery.addEventListener('change', sync);
        return () => mediaQuery.removeEventListener('change', sync);
    }, []);

    return isMobileSheet;
}

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
 * `adults` is emitted only when the guests stepper was actually touched by
 * the user (`guestsTouched`) — an untouched hero search must send NO adults
 * param, otherwise the listing page applies it as a real `minGuests` filter
 * (see BETA-161). `children` is emitted only when non-zero, since 0 remains
 * a true "no children" default regardless of whether the stepper was touched.
 */
export function buildSearchUrl(args: {
    readonly baseUrl: string;
    readonly destinationId: string | null;
    readonly types: ReadonlySet<AccommodationType>;
    readonly checkIn?: Date;
    readonly checkOut?: Date;
    readonly adults: number;
    readonly children: number;
    readonly guestsTouched: boolean;
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
    // Only emit adults when the user actually interacted with the guests
    // stepper — a pristine search must not silently narrow the listing to
    // "at least 2 guests" (BETA-161).
    if (args.guestsTouched) {
        params.set('adults', String(args.adults));
    }
    if (args.children > 0) {
        params.set('children', String(args.children));
    }
    const qs = params.toString();
    return qs ? `${args.baseUrl}?${qs}` : args.baseUrl;
}

function SearchBarInner({ locale, destinations, searchBaseUrl }: SearchBarProps) {
    const { t } = createTranslations(locale);
    const barRef = useRef<HTMLDivElement>(null);
    const isMobileSheet = useIsMobileSheet();

    // State
    const [activePanel, setActivePanel] = useState<ActivePanel>(null);
    const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
    const [selectedDestination, setSelectedDestination] = useState<DestinationOption | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<ReadonlySet<AccommodationType>>(new Set());
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    // Whether the user has interacted with each guests stepper independently.
    // The default value (2 adults, 0 children) is indistinguishable from
    // "untouched", so without these flags a user who deliberately sets 2
    // adults sees the placeholder again and assumes the value was not saved.
    // Split in two (rather than one combined `guestsTouched`) because
    // `buildSearchUrl` gates the `adults` param on touch alone: touching only
    // the children stepper must not emit an unasserted `adults=2` (BETA-161
    // round 2 — a single combined flag let a children-only interaction leak
    // the untouched adults default into the URL as a real filter).
    const [adultsTouched, setAdultsTouched] = useState(false);
    const [childrenTouched, setChildrenTouched] = useState(false);
    // Search inputs inside the destination and type panels. Filtered locally
    // against the pre-fetched lists — no extra API calls.
    const [destinationQuery, setDestinationQuery] = useState('');
    const [typeQuery, setTypeQuery] = useState('');
    const destinationSearchInputRef = useRef<HTMLInputElement | null>(null);
    const typeSearchInputRef = useRef<HTMLInputElement | null>(null);
    // Focus management for the mobile bottom-sheet (HOS-323 follow-up). The
    // portal moves the panel to the end of <body>, so without these a keyboard
    // user would tab through the entire page — visually covered by the
    // backdrop — before reaching the sheet's own controls (WCAG 2.4.3).
    /** The currently rendered panel element (only one is mounted at a time). */
    const panelRef = useRef<HTMLDivElement | null>(null);
    /** The panel's close (X) button — the entry point for focus on open. */
    const panelCloseButtonRef = useRef<HTMLButtonElement | null>(null);
    /** The trigger column that opened the active panel, to restore focus to. */
    const triggerRef = useRef<HTMLElement | null>(null);
    /** Whether a panel was open on the previous render of the restore effect. */
    const wasPanelOpenRef = useRef(false);

    // Click outside / ESC to close
    const handleClickOutside = useCallback((event: MouseEvent) => {
        const target = event.target as Node | null;
        if (!target || !barRef.current) return;
        if (barRef.current.contains(target)) return;
        // On mobile the open panel is portaled to <body> (HOS-323), so it is
        // no longer a descendant of the bar. Without this check the first tap
        // on a stepper button would read as "outside" and dismiss the sheet.
        if (target instanceof Element && target.closest(`[${PANEL_MARKER_ATTRIBUTE}]`)) return;
        setActivePanel(null);
    }, []);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActivePanel(null);
                return;
            }
            // Focus trap — bottom-sheet ONLY. In sheet mode the panel is a
            // modal: it is portaled to <body> and a backdrop covers the page,
            // so letting Tab escape into content the user cannot see is a
            // WCAG 2.4.3 failure. On desktop the same panel is a popover with
            // no backdrop and the rest of the page stays usable, so trapping
            // focus there would be a new bug, not a fix.
            if (event.key === 'Tab' && isMobileSheet && panelRef.current) {
                trapFocus(panelRef.current, event);
            }
        },
        [isMobileSheet]
    );

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
        if (activePanel === null) return;
        document.documentElement.setAttribute('data-search-panel-open', '');
        // Only lock scroll on mobile sheet sizes — desktop dropdowns are
        // popovers and shouldn't block page scroll. Read from the reactive
        // `isMobileSheet` (not an imperative matchMedia call) so that crossing
        // the breakpoint while a panel is open re-runs this effect: otherwise
        // rotating a tablet from portrait to landscape left <html> stuck at
        // `overflow: hidden` behind a small dropdown, and the mirror case
        // opened a full-screen sheet with no scroll lock at all.
        if (!isMobileSheet) {
            return () => {
                document.documentElement.removeAttribute('data-search-panel-open');
            };
        }
        // Captured per-run, immediately before the write, so a re-run triggered
        // by a mode change can never restore a stale 'hidden' set by this very
        // effect on a previous run.
        const previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.documentElement.removeAttribute('data-search-panel-open');
            document.documentElement.style.overflow = previousOverflow;
        };
    }, [activePanel, isMobileSheet]);

    /** Close the active panel (used by the mobile X button). */
    const closePanel = useCallback(() => setActivePanel(null), []);

    // Reset the per-panel search query whenever the user closes or switches
    // panels, and autofocus the input on the freshly opened panel so power
    // users can start typing right away. On mobile the panels render as
    // bottom-sheets; auto-focusing a text input there pops the virtual
    // keyboard, which overlaps the option list and blocks selection, so we
    // only autofocus on desktop popover sizes (>900px).
    // Reads the reactive `isMobileSheet` rather than calling matchMedia
    // imperatively, so the BETA-24 guard follows live breakpoint changes
    // instead of freezing whatever the viewport was when the panel opened.
    useEffect(() => {
        if (activePanel !== 'destination') {
            setDestinationQuery('');
        } else if (!isMobileSheet) {
            destinationSearchInputRef.current?.focus();
        }
        if (activePanel !== 'type') {
            setTypeQuery('');
        } else if (!isMobileSheet) {
            typeSearchInputRef.current?.focus();
        }
    }, [activePanel, isMobileSheet]);

    /**
     * Move focus into the sheet when it opens — bottom-sheet mode ONLY.
     *
     * The target is deliberately the panel's close (X) button and never the
     * destination/type search `<input>`: focusing a text input inside a mobile
     * sheet pops the virtual keyboard over the option list (BETA-24, guarded
     * by the effect above).
     *
     * `isMobileSheet` is a dependency for two reasons: it gates the behaviour,
     * and `PanelLayer` remounts the whole panel subtree when the breakpoint is
     * crossed (see its JSDoc) — without re-running here, focus would silently
     * land on `<body>` after such a remount.
     */
    useEffect(() => {
        if (!isMobileSheet || activePanel === null) return;
        panelCloseButtonRef.current?.focus();
    }, [activePanel, isMobileSheet]);

    /**
     * Restore focus to the trigger column that opened the sheet once it
     * closes, whatever closed it (ESC, backdrop, X button, click outside, or
     * picking an option). Sheet mode only — the desktop popover never stole
     * focus in the first place, so there is nothing to give back.
     */
    useEffect(() => {
        if (activePanel !== null) {
            wasPanelOpenRef.current = true;
            return;
        }
        if (!wasPanelOpenRef.current) return;
        wasPanelOpenRef.current = false;
        const trigger = triggerRef.current;
        triggerRef.current = null;
        if (!isMobileSheet) return;
        trigger?.focus();
    }, [activePanel, isMobileSheet]);

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

    // Panel toggle (measures viewport space to decide direction). `triggerEl`
    // is the column that initiated the toggle, remembered so focus can be
    // restored to it when the sheet closes.
    const togglePanel = useCallback((panel: ActivePanel, triggerEl: HTMLElement | null) => {
        triggerRef.current = triggerEl;
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
        // biome-ignore lint/a11y/useSemanticElements: <search> element has inconsistent browser support
        <div
            ref={barRef}
            className={styles.searchBar}
            role="search"
            aria-label={t('home.searchBar.searchAriaLabel', 'Buscar alojamientos')}
        >
            <div className={styles.inner}>
                {/* Col 1: Destination */}
                {/* biome-ignore lint/a11y/useSemanticElements: div contains nested divs which are invalid inside <button> */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'destination' && styles.colActive
                    )}
                    onClick={(e) => togglePanel('destination', e.currentTarget)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePanel('destination', e.currentTarget);
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={activePanel === 'destination'}
                    aria-haspopup="listbox"
                    aria-controls={
                        activePanel === 'destination' ? PANEL_IDS.destination : undefined
                    }
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
                {/* biome-ignore lint/a11y/useSemanticElements: div contains nested divs which are invalid inside <button> */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'type' && styles.colActive
                    )}
                    onClick={(e) => togglePanel('type', e.currentTarget)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePanel('type', e.currentTarget);
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={activePanel === 'type'}
                    aria-haspopup="listbox"
                    aria-controls={activePanel === 'type' ? PANEL_IDS.type : undefined}
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
                {/* biome-ignore lint/a11y/useSemanticElements: div contains nested divs which are invalid inside <button> */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'dates' && styles.colActive
                    )}
                    onClick={(e) => togglePanel('dates', e.currentTarget)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePanel('dates', e.currentTarget);
                        }
                    }}
                    onPointerEnter={preloadCalendar}
                    onFocus={preloadCalendar}
                    role="button"
                    tabIndex={0}
                    aria-expanded={activePanel === 'dates'}
                    aria-haspopup="dialog"
                    aria-controls={activePanel === 'dates' ? PANEL_IDS.dates : undefined}
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
                {/* biome-ignore lint/a11y/useSemanticElements: div contains nested divs which are invalid inside <button> */}
                <div
                    className={cn(styles.col, activePanel === 'guests' && styles.colActive)}
                    onClick={(e) => togglePanel('guests', e.currentTarget)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePanel('guests', e.currentTarget);
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={activePanel === 'guests'}
                    aria-haspopup="dialog"
                    aria-controls={activePanel === 'guests' ? PANEL_IDS.guests : undefined}
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
                                (adultsTouched ||
                                    childrenTouched ||
                                    adults !== 2 ||
                                    children !== 0) &&
                                    styles.valueSelected
                            )}
                        >
                            {!adultsTouched && !childrenTouched && adults === 2 && children === 0
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
                            children,
                            guestsTouched: adultsTouched
                        });
                        trackEvent(WebEvents.AccommodationSearched, {
                            destination_id: selectedDestination?.id ?? null,
                            accommodation_types: Array.from(selectedTypes),
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

            <PanelLayer portaled={isMobileSheet}>
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
                        ref={panelRef}
                        id={PANEL_IDS.destination}
                        className={cn(
                            styles.panel,
                            styles.destinationPanel,
                            openDirection === 'up' && styles.panelUp
                        )}
                        // biome-ignore lint/a11y/useSemanticElements: custom styled dropdown cannot use native <select>
                        role="listbox"
                        // No `aria-modal` here: it is only defined for dialog,
                        // alertdialog and window roles, so on a listbox it is
                        // invalid ARIA that an audit would flag. The sheet still
                        // BEHAVES modally (backdrop, scroll lock, focus trap) —
                        // that part is behaviour, not a property to assert.
                        data-search-panel=""
                    >
                        <PanelCloseHeader
                            ariaLabel={t('home.searchBar.closePanel', 'Cerrar panel')}
                            onClose={closePanel}
                            closeButtonRef={panelCloseButtonRef}
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
                                                role="img"
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
                        ref={panelRef}
                        id={PANEL_IDS.type}
                        className={cn(
                            styles.panel,
                            styles.typePanel,
                            openDirection === 'up' && styles.panelUp
                        )}
                        // biome-ignore lint/a11y/useSemanticElements: custom single-select dropdown cannot use native <select>
                        role="listbox"
                        // See the destination panel: `aria-modal` is not valid
                        // on a listbox role.
                        data-search-panel=""
                    >
                        <PanelCloseHeader
                            ariaLabel={t('home.searchBar.closePanel', 'Cerrar panel')}
                            onClose={closePanel}
                            closeButtonRef={panelCloseButtonRef}
                        />
                        <div className={styles.panelSearch}>
                            <input
                                ref={typeSearchInputRef}
                                type="text"
                                className="form-input"
                                value={typeQuery}
                                onChange={(event) => setTypeQuery(event.target.value)}
                                placeholder={t(
                                    'home.searchBar.typeSearchPlaceholder',
                                    'Buscá un tipo'
                                )}
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
                        ref={panelRef}
                        id={PANEL_IDS.dates}
                        className={cn(
                            styles.panel,
                            styles.calendarPanel,
                            openDirection === 'up' && styles.panelUp
                        )}
                        // biome-ignore lint/a11y/useSemanticElements: popover panel, not a modal — <dialog> API requires open/close management incompatible with conditional render
                        role="dialog"
                        aria-modal={isMobileSheet ? true : undefined}
                        aria-label={t('home.searchBar.datesLabel', 'Fechas')}
                        data-search-panel=""
                    >
                        <PanelCloseHeader
                            ariaLabel={t('home.searchBar.closePanel', 'Cerrar panel')}
                            onClose={closePanel}
                            closeButtonRef={panelCloseButtonRef}
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
                        ref={panelRef}
                        id={PANEL_IDS.guests}
                        className={cn(
                            styles.panel,
                            styles.guestsPanel,
                            openDirection === 'up' && styles.panelUp
                        )}
                        // biome-ignore lint/a11y/useSemanticElements: popover panel, not a modal — <dialog> API requires open/close management incompatible with conditional render
                        role="dialog"
                        aria-modal={isMobileSheet ? true : undefined}
                        aria-label={t('home.searchBar.guestsLabel', 'Huéspedes')}
                        data-search-panel=""
                    >
                        <PanelCloseHeader
                            ariaLabel={t('home.searchBar.closePanel', 'Cerrar panel')}
                            onClose={closePanel}
                            closeButtonRef={panelCloseButtonRef}
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
                                        onClick={() => {
                                            setAdultsTouched(true);
                                            setAdults((prev) => Math.max(1, prev - 1));
                                        }}
                                        disabled={adults <= 1}
                                        aria-label={t('search.fewerAdults', 'Fewer adults')}
                                    >
                                        -
                                    </button>
                                    <span className={styles.stepperValue}>{adults}</span>
                                    <button
                                        type="button"
                                        className={styles.stepperButton}
                                        onClick={() => {
                                            setAdultsTouched(true);
                                            setAdults((prev) => Math.min(10, prev + 1));
                                        }}
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
                                        onClick={() => {
                                            setChildrenTouched(true);
                                            setChildren((prev) => Math.max(0, prev - 1));
                                        }}
                                        disabled={children <= 0}
                                        aria-label={t('search.fewerChildren', 'Fewer children')}
                                    >
                                        -
                                    </button>
                                    <span className={styles.stepperValue}>{children}</span>
                                    <button
                                        type="button"
                                        className={styles.stepperButton}
                                        onClick={() => {
                                            setChildrenTouched(true);
                                            setChildren((prev) => Math.min(6, prev + 1));
                                        }}
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
            </PanelLayer>
        </div>
    );
}

/**
 * Escape hatch out of the hero's stacking context (HOS-323).
 *
 * On mobile the panels are `position: fixed` bottom-sheets at `z-index: 100`,
 * yet the sections below the hero paint on top of them. The culprit is NOT the
 * hero's base layering: at every width `.hero__container` is
 * `position: relative; z-index: 15` (HeroSection.astro), which beats the
 * `.section__container { z-index: 10 }` of the sections that follow, and
 * `.hero__bottom` sits at `z-index: 10` inside it.
 *
 * The enabler is `@media (max-width: 640px)`, which sets
 * `.hero__container { position: static }` (needed so the rotating hero photo
 * can anchor to `.hero` itself). A static element establishes no stacking
 * context, so the protective z-15 layer dissolves and the only positioned
 * ancestor left is the same media query's `.hero__bottom
 * { position: relative; z-index: 2 }`. The sheet's z-index: 100 then competes
 * only *within* that level-2 context, and the level-10 sections bury it. Taps
 * meant for the stepper hit the section behind it instead, which fires the
 * click-outside handler and closes the sheet. Reparenting the node to `<body>`
 * is the only way out of an ancestor context.
 *
 * The portal deliberately covers the whole 0–900px band even though the
 * burial itself only happens below 640px. The rule is "portal whenever the CSS
 * has made the panel a fixed sheet", which keeps the JS gate bound to the one
 * media query it must mirror (`MOBILE_SHEET_MEDIA_QUERY`) instead of to a
 * narrower burial window that would silently shift the next time the hero's
 * responsive layout is retuned.
 *
 * Desktop is deliberately left in place: there the panel is `position: absolute`
 * against `.searchBar`, so moving it would detach it from its containing block
 * and drop it at the top of the document.
 *
 * REMOUNT WARNING — crossing the breakpoint with a panel open destroys and
 * rebuilds the panel subtree. React never matches a `Fragment` fiber to a
 * `HostPortal` fiber, so flipping `portaled` is a delete + insert, not a move.
 * Consequences: DOM focus is lost (the focus effect in `SearchBarInner`
 * depends on `isMobileSheet` precisely so it can re-establish it),
 * `SearchBarCalendar`'s displayed month resets to `defaultMonth={today}`, and
 * the sheet's entry animation replays. Parent-owned state (`dateRange`,
 * `adults`, `children`, the panel queries) lives in `SearchBarInner` and
 * therefore survives untouched. This is accepted: the transition requires a
 * physical resize/rotation mid-interaction, and the alternative (always
 * portaling and re-implementing desktop positioning) is a much larger change.
 */
function PanelLayer({
    portaled,
    children
}: {
    readonly portaled: boolean;
    readonly children: ReactNode;
}) {
    // `portaled` can only be true after the mount effect has measured the
    // viewport, so `document` is guaranteed to exist by the time this runs.
    if (!portaled) return <>{children}</>;
    return createPortal(children, document.body);
}

/**
 * Sticky panel header rendered at the top of every mobile bottom-sheet
 * variant. Holds a close (X) button so users can dismiss the sheet without
 * tapping outside it. CSS hides it on viewports >900px where panels render
 * as desktop popovers and a dedicated close button is unnecessary.
 */
function PanelCloseHeader({
    ariaLabel,
    onClose,
    closeButtonRef
}: {
    readonly ariaLabel: string;
    readonly onClose: () => void;
    /**
     * Exposes the close button so the sheet can move focus onto it when it
     * opens. It is deliberately the focus target instead of the panel's search
     * input, which would pop the mobile virtual keyboard over the option list
     * (BETA-24).
     */
    readonly closeButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
    return (
        <div className={styles.panelHeader}>
            <button
                ref={closeButtonRef}
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
