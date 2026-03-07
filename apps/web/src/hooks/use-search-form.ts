/**
 * @file use-search-form.ts
 * @description React hook managing the hero search form state.
 * Encapsulates all form fields (destination, accommodation type, guests, dates),
 * popover/drawer open states, computed labels, and increment/decrement actions.
 */
import { DEFAULT_LOCALE, createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';

/**
 * Manages the complete search form state for the hero section search bar.
 * Provides controlled values, setters, computed display labels, and
 * guest counter actions with min/max bounds.
 *
 * @param options - Configuration options
 * @param options.locale - Current locale for formatting dates and labels
 * @returns Object containing all form state, setters, computed labels, and actions
 *
 * @example
 * ```tsx
 * const form = useSearchForm({ locale: 'es' });
 * // form.destination, form.setDestination
 * // form.guestsLabel (e.g. "3 huespedes")
 * // form.incrementAdults(), form.decrementChildren()
 * ```
 */
export function useSearchForm({ locale = DEFAULT_LOCALE }: { locale?: SupportedLocale } = {}) {
    const t = createT(locale);
    const [destination, setDestination] = useState('');
    const [accommodationType, setAccommodationType] = useState('');
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [guestsOpen, setGuestsOpen] = useState(false);
    const [datesOpen, setDatesOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    /** Combined adult + children count */
    const totalGuests = adults + children;
    /** Formatted guests display label (e.g. "3 huespedes") */
    const guestsLabel =
        totalGuests === 1
            ? `1 ${t('home.searchBar.guest', 'huesped')}`
            : `${totalGuests} ${t('home.searchBar.guests', 'huespedes')}`;

    /** Formatted date range display label (e.g. "5 Mar - 10 Mar" or placeholder) */
    const datesLabel =
        dateRange?.from && dateRange?.to
            ? `${format(dateRange.from, 'd MMM', { locale: es })} - ${format(dateRange.to, 'd MMM', { locale: es })}`
            : dateRange?.from
              ? format(dateRange.from, 'd MMM yyyy', { locale: es })
              : t('home.searchBar.datesPlaceholder', 'Check-in / Check-out');

    /** Increment adults count (max 10) */
    const incrementAdults = () => setAdults((v) => Math.min(v + 1, 10));
    /** Decrement adults count (min 1) */
    const decrementAdults = () => setAdults((v) => Math.max(v - 1, 1));
    /** Increment children count (max 10) */
    const incrementChildren = () => setChildren((v) => Math.min(v + 1, 10));
    /** Decrement children count (min 0) */
    const decrementChildren = () => setChildren((v) => Math.max(v - 1, 0));

    return {
        destination,
        setDestination,
        accommodationType,
        setAccommodationType,
        adults,
        children,
        dateRange,
        setDateRange,
        guestsOpen,
        setGuestsOpen,
        datesOpen,
        setDatesOpen,
        drawerOpen,
        setDrawerOpen,
        guestsLabel,
        datesLabel,
        incrementAdults,
        decrementAdults,
        incrementChildren,
        decrementChildren
    } as const;
}

/**
 * Type representing the complete search form state returned by {@link useSearchForm}.
 * Includes all field values, setters, computed labels, popover states, and counter actions.
 */
export type SearchFormState = ReturnType<typeof useSearchForm>;
