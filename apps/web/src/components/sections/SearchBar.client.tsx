/**
 * @file SearchBar.client.tsx
 * @description Interactive search bar island for the hero section. Provides four
 * inputs (destination, accommodation type, date range, guests) with dropdown
 * panels. Replaces the static SearchBar.astro stub with full interactivity.
 */

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { enUS as enLocale, es as esLocale, ptBR as ptLocale } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    AccommodationIcon,
    BuildingIcon,
    CalendarDotsIcon,
    HomeIcon,
    LocationIcon,
    SearchIcon,
    TentIcon,
    TreeIcon,
    UsersIcon
} from '@repo/icons';
import styles from './SearchBar.module.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** A city destination option pre-fetched at build time. */
interface DestinationOption {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
}

interface SearchBarProps {
    readonly locale: SupportedLocale;
    /** Pre-fetched destination options (cities only, from SSR). */
    readonly destinations: readonly DestinationOption[];
}

/** Which panel is currently open, or null when all closed. */
type ActivePanel = 'destination' | 'type' | 'dates' | 'guests' | null;

/* ------------------------------------------------------------------ */
/*  Accommodation type config                                          */
/* ------------------------------------------------------------------ */

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

/** Maps each accommodation type to a Phosphor icon component. */
const TYPE_ICONS: Record<
    AccommodationType,
    React.ComponentType<{ size?: number; weight?: string; 'aria-hidden'?: string }>
> = {
    HOTEL: BuildingIcon,
    APARTMENT: BuildingIcon,
    HOUSE: HomeIcon,
    COUNTRY_HOUSE: HomeIcon,
    CABIN: TreeIcon,
    HOSTEL: BuildingIcon,
    CAMPING: TentIcon,
    ROOM: AccommodationIcon,
    MOTEL: BuildingIcon,
    RESORT: BuildingIcon
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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

function SearchBarInner({ locale, destinations }: SearchBarProps) {
    const { t } = createTranslations(locale);
    const barRef = useRef<HTMLDivElement>(null);

    /* --- State --- */
    const [activePanel, setActivePanel] = useState<ActivePanel>(null);
    const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
    const [selectedDestination, setSelectedDestination] = useState<DestinationOption | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<ReadonlySet<AccommodationType>>(new Set());
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);

    /* --- Click outside / ESC to close --- */
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

    /* --- Panel toggle (measures viewport space to decide direction) --- */
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

    /* --- Destination handlers --- */
    const handleSelectDestination = useCallback((dest: DestinationOption | null) => {
        setSelectedDestination(dest);
        setActivePanel(null);
    }, []);

    /* --- Type handlers --- */
    const handleToggleType = useCallback((type: AccommodationType) => {
        setSelectedTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    }, []);

    const handleSelectAllTypes = useCallback(() => {
        setSelectedTypes(new Set(ACCOMMODATION_TYPES));
    }, []);

    const handleClearTypes = useCallback(() => {
        setSelectedTypes(new Set());
    }, []);

    /* --- Date display --- */
    const formatDateShort = useCallback((date: Date): string => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    }, []);

    /* --- Type display value --- */
    const getTypeDisplayValue = useCallback((): string | null => {
        if (selectedTypes.size === 0) return null;
        if (selectedTypes.size === ACCOMMODATION_TYPES.length) {
            return t('home.searchBar.allTypes', 'Todos los tipos');
        }
        const typesArray = Array.from(selectedTypes);
        const firstName = t(`home.searchBar.types.${typesArray[0]}`, typesArray[0] ?? '');
        if (typesArray.length === 1) return firstName;
        const remaining = typesArray.length - 1;
        return `${firstName} & ${remaining} +`;
    }, [selectedTypes, t]);

    /* --- Guests display value --- */
    const guestsDisplay = t('home.searchBar.guestsSummary', '{adults} adultos, {children} niños', {
        adults,
        children
    });

    /* --- Date locale for react-day-picker --- */
    const calendarLocaleMap = { es: esLocale, en: enLocale, pt: ptLocale } as const;
    const calendarLocale = calendarLocaleMap[locale] ?? esLocale;
    const defaultClassNames = getDefaultClassNames();
    const today = new Date();

    return (
        <div
            ref={barRef}
            className={styles.searchBar}
            role="search"
            aria-label={t('home.searchBar.searchAriaLabel', 'Buscar alojamientos')}
        >
            <div className={styles.inner}>
                {/* --- Col 1: Destination --- */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'destination' && styles.colActive
                    )}
                    onClick={() => togglePanel('destination')}
                    onKeyDown={(e) => e.key === 'Enter' && togglePanel('destination')}
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

                {/* --- Col 2: Type --- */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'type' && styles.colActive
                    )}
                    onClick={() => togglePanel('type')}
                    onKeyDown={(e) => e.key === 'Enter' && togglePanel('type')}
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

                {/* --- Col 3: Dates --- */}
                <div
                    className={cn(
                        styles.col,
                        styles.colDivider,
                        activePanel === 'dates' && styles.colActive
                    )}
                    onClick={() => togglePanel('dates')}
                    onKeyDown={(e) => e.key === 'Enter' && togglePanel('dates')}
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

                {/* --- Col 4: Guests --- */}
                <div
                    className={cn(styles.col, activePanel === 'guests' && styles.colActive)}
                    onClick={() => togglePanel('guests')}
                    onKeyDown={(e) => e.key === 'Enter' && togglePanel('guests')}
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

                {/* --- Search button --- */}
                <button
                    type="button"
                    className={styles.button}
                    aria-label={t('home.searchBar.ctaLabel', 'Buscar')}
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

            {/* === Panels (rendered below the bar) === */}

            {/* --- Destination panel --- */}
            {activePanel === 'destination' && (
                <div
                    className={cn(
                        styles.panel,
                        styles.destinationPanel,
                        openDirection === 'up' && styles.panelUp
                    )}
                    role="listbox"
                >
                    {/* Clear option */}
                    {selectedDestination && (
                        <button
                            type="button"
                            className={cn(styles.dropdownItem, styles.dropdownItemClear)}
                            onClick={() => handleSelectDestination(null)}
                            role="option"
                            aria-selected={false}
                        >
                            {t('home.searchBar.clearTypes', 'Limpiar')}
                        </button>
                    )}
                    {destinations.map((dest) => (
                        <button
                            key={dest.id}
                            type="button"
                            className={cn(
                                styles.dropdownItem,
                                selectedDestination?.id === dest.id && styles.dropdownItemActive
                            )}
                            onClick={() => handleSelectDestination(dest)}
                            role="option"
                            aria-selected={selectedDestination?.id === dest.id}
                        >
                            {dest.name}
                        </button>
                    ))}
                    {destinations.length === 0 && (
                        <div
                            className={styles.dropdownItem}
                            style={{ cursor: 'default', opacity: 0.5 }}
                        >
                            {t('home.searchBar.loadingText', 'Cargando...')}
                        </div>
                    )}
                </div>
            )}

            {/* --- Type panel --- */}
            {activePanel === 'type' && (
                <div
                    className={cn(
                        styles.panel,
                        styles.typePanel,
                        openDirection === 'up' && styles.panelUp
                    )}
                    role="listbox"
                    aria-multiselectable="true"
                >
                    <div className={styles.typeActions}>
                        <button
                            type="button"
                            className={styles.typeActionButton}
                            onClick={handleSelectAllTypes}
                        >
                            {t('home.searchBar.allTypes', 'Todos los tipos')}
                        </button>
                        <button
                            type="button"
                            className={styles.typeActionButton}
                            onClick={handleClearTypes}
                        >
                            {t('home.searchBar.clearTypes', 'Limpiar')}
                        </button>
                    </div>
                    <div className={styles.typeList}>
                        {ACCOMMODATION_TYPES.map((type) => {
                            const IconComponent = TYPE_ICONS[type];
                            const isChecked = selectedTypes.has(type);
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    className={styles.typeItem}
                                    onClick={() => handleToggleType(type)}
                                    role="option"
                                    aria-selected={isChecked}
                                >
                                    <span
                                        className={cn(
                                            styles.checkbox,
                                            isChecked && styles.checkboxChecked
                                        )}
                                    >
                                        {isChecked && (
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 12 12"
                                                fill="none"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d="M2.5 6L5 8.5L9.5 3.5"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        )}
                                    </span>
                                    <span className={styles.typeItemIcon}>
                                        <IconComponent
                                            size={16}
                                            weight="regular"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <span className={styles.typeItemLabel}>
                                        {t(`home.searchBar.types.${type}`, type)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- Calendar panel --- */}
            {activePanel === 'dates' && (
                <div
                    className={cn(
                        styles.panel,
                        styles.calendarPanel,
                        openDirection === 'up' && styles.panelUp
                    )}
                    role="dialog"
                    aria-label={t('home.searchBar.datesLabel', 'Fechas')}
                >
                    <DayPicker
                        mode="range"
                        locale={calendarLocale}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        disabled={{ before: today }}
                        defaultMonth={today}
                        classNames={{
                            root: `${defaultClassNames.root} ${styles.calendarRoot}`,
                            months: styles.calendarMonths,
                            month_caption: `${defaultClassNames.month_caption} ${styles.calendarCaption}`,
                            weekday: `${defaultClassNames.weekday} ${styles.calendarWeekday}`,
                            nav: `${defaultClassNames.nav} ${styles.calendarNav}`,
                            day_button: `${defaultClassNames.day_button} ${styles.calendarDayButton}`,
                            today: `${defaultClassNames.today} ${styles.calendarToday}`,
                            disabled: `${defaultClassNames.disabled} ${styles.calendarDisabled}`
                        }}
                    />
                </div>
            )}

            {/* --- Guests panel --- */}
            {activePanel === 'guests' && (
                <div
                    className={cn(
                        styles.panel,
                        styles.guestsPanel,
                        openDirection === 'up' && styles.panelUp
                    )}
                    role="dialog"
                    aria-label={t('home.searchBar.guestsLabel', 'Huéspedes')}
                >
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
            )}
        </div>
    );
}
