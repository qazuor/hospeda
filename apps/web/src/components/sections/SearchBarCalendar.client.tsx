/**
 * @file SearchBarCalendar.client.tsx
 * @description Date-range calendar panel for the hero SearchBar. Extracted into
 * its own module so it can be code-split and lazy-loaded only when the user
 * opens the dates panel. Bundles react-day-picker, its CSS, and the locale
 * imports outside of the SearchBar critical path.
 */

import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { enUS as enLocale, es as esLocale, ptBR as ptLocale } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './SearchBar.module.css';

/** Locale → react-day-picker locale object map. */
const CALENDAR_LOCALE_MAP = { es: esLocale, en: enLocale, pt: ptLocale } as const;

interface SearchBarCalendarProps {
    /** Active app locale used to localize month and weekday labels. */
    readonly locale: SupportedLocale;
    /** Currently selected date range, or undefined when nothing is selected. */
    readonly selected: DateRange | undefined;
    /** Called whenever the user picks or updates the range. */
    readonly onSelect: (range: DateRange | undefined) => void;
}

/**
 * Renders the react-day-picker month range selector with the SearchBar's
 * custom CSS-module styles applied. Designed to be lazy-loaded via
 * `React.lazy(() => import('./SearchBarCalendar.client'))`.
 */
export function SearchBarCalendar({ locale, selected, onSelect }: SearchBarCalendarProps) {
    const calendarLocale = CALENDAR_LOCALE_MAP[locale] ?? esLocale;
    const defaultClassNames = getDefaultClassNames();
    const today = new Date();

    return (
        <DayPicker
            mode="range"
            locale={calendarLocale}
            selected={selected}
            onSelect={onSelect}
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
    );
}

export default SearchBarCalendar;
