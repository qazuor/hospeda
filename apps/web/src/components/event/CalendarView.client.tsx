import { toBcp47Locale } from '@repo/i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@repo/icons';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Interface for a calendar event.
 */
export interface CalendarEvent {
    readonly id: string;
    readonly name: string;
    /** ISO date string (YYYY-MM-DD) */
    readonly date: string;
}

/**
 * Props for the CalendarView component.
 */
export interface CalendarViewProps {
    /** Array of events to display on the calendar */
    readonly events: ReadonlyArray<CalendarEvent>;
    /** Callback when a date is selected */
    readonly onDateSelect: (date: string) => void;
    /** Locale for date formatting and day names */
    readonly locale: SupportedLocale;
    /** Optional CSS class name */
    readonly className?: string;
}

/**
 * Generates localized short day names (Mon-Sun) using Intl.DateTimeFormat.
 * Week starts on Monday (ISO 8601).
 *
 * @param locale - Locale string for formatting
 * @returns Array of 7 short day name strings starting from Monday
 */
function getDayNames(locale: string): readonly string[] {
    const intlLocale = toBcp47Locale(locale);
    const formatter = new Intl.DateTimeFormat(intlLocale, { weekday: 'short' });
    // Jan 5, 2026 is a Monday
    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(2026, 0, 5 + i);
        const name = formatter.format(date);
        return name.charAt(0).toUpperCase() + name.slice(1).replace('.', '');
    });
}

/**
 * Generates localized full month names using Intl.DateTimeFormat.
 *
 * @param locale - Locale string for formatting
 * @returns Array of 12 full month name strings
 */
function getMonthNames(locale: string): readonly string[] {
    const intlLocale = toBcp47Locale(locale);
    const formatter = new Intl.DateTimeFormat(intlLocale, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => {
        const date = new Date(2026, i, 1);
        const name = formatter.format(date);
        return name.charAt(0).toUpperCase() + name.slice(1);
    });
}

/**
 * Interface for a single calendar grid cell.
 */
interface CalendarCell {
    readonly date: Date;
    readonly dateString: string;
    readonly isCurrentMonth: boolean;
    readonly isToday: boolean;
    readonly hasEvent: boolean;
}

/**
 * Formats a date to YYYY-MM-DD string.
 *
 * @param date - Date to format
 * @returns ISO date string (YYYY-MM-DD)
 */
function formatDateToISOString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formats a date as a localized string suitable for an aria-label.
 *
 * @param date - Date to format
 * @param locale - Locale for formatting
 * @returns Human-readable localized date string
 */
function formatDateForAriaLabel(date: Date, locale: SupportedLocale): string {
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const monthName = getMonthNames(locale)[monthIndex] ?? '';

    if (locale === 'en') {
        return `${monthName} ${day}, ${year}`;
    }
    // es and pt share the same "D de Month de YYYY" pattern
    return `${day} de ${monthName.toLowerCase()} de ${year}`;
}

/**
 * Gets the first day of the month offset for a Monday-based week.
 * Returns 0 for Monday through 6 for Sunday.
 *
 * @param year - Full year
 * @param month - Month index (0-11)
 * @returns First weekday of the month mapped to Monday-based index (0=Mon, 6=Sun)
 */
function getFirstDayOfMonth(year: number, month: number): number {
    const firstDay = new Date(year, month, 1).getDay();
    // Convert Sunday (0) to 6, shift Monday (1) to 0
    return firstDay === 0 ? 6 : firstDay - 1;
}

/**
 * Returns the number of days in the given month.
 *
 * @param year - Full year
 * @param month - Month index (0-11)
 * @returns Number of days in the month
 */
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Generates a 42-cell (6×7) calendar grid for the given month.
 * Includes leading cells from the previous month and trailing cells
 * from the next month to complete the grid.
 *
 * @param params - Grid generation parameters
 * @param params.year - Full year
 * @param params.month - Month index (0-11)
 * @param params.events - Events to mark on the calendar
 * @param params.today - Today's date (normalized to midnight)
 * @returns Immutable array of 42 calendar cells
 */
function generateCalendarGrid({
    year,
    month,
    events,
    today
}: {
    readonly year: number;
    readonly month: number;
    readonly events: ReadonlyArray<CalendarEvent>;
    readonly today: Date;
}): readonly CalendarCell[] {
    const cells: CalendarCell[] = [];
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInMonth = getDaysInMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    // Event date set for O(1) lookup
    const eventDates = new Set(events.map((e) => e.date));
    const todayString = formatDateToISOString(today);

    // Leading cells from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const date = new Date(year, month - 1, day);
        const dateString = formatDateToISOString(date);
        cells.push({
            date,
            dateString,
            isCurrentMonth: false,
            isToday: dateString === todayString,
            hasEvent: eventDates.has(dateString)
        });
    }

    // Current month cells
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateString = formatDateToISOString(date);
        cells.push({
            date,
            dateString,
            isCurrentMonth: true,
            isToday: dateString === todayString,
            hasEvent: eventDates.has(dateString)
        });
    }

    // Trailing cells from next month to fill 6 rows
    const remainingCells = 42 - cells.length;
    for (let day = 1; day <= remainingCells; day++) {
        const date = new Date(year, month + 1, day);
        const dateString = formatDateToISOString(date);
        cells.push({
            date,
            dateString,
            isCurrentMonth: false,
            isToday: dateString === todayString,
            hasEvent: eventDates.has(dateString)
        });
    }

    return cells;
}

/**
 * Custom monthly calendar component that marks dates containing events
 * and allows the user to select a date.
 *
 * Renders a full 6-row grid with locale-aware month/day names via
 * `Intl.DateTimeFormat`. Does not depend on any external date-picker library.
 * Keyboard navigation follows the WAI-ARIA grid pattern (arrow keys, Home, End).
 *
 * @example
 * ```tsx
 * const events = [
 *   { id: '1', name: 'Carnaval', date: '2026-02-15' },
 *   { id: '2', name: 'Feria del Rio', date: '2026-02-20' },
 * ];
 *
 * <CalendarView
 *   events={events}
 *   onDateSelect={(date) => console.log('Selected:', date)}
 *   locale="es"
 * />
 * ```
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/grid/
 */
export function CalendarView({
    events,
    onDateSelect,
    locale,
    className = ''
}: CalendarViewProps): React.JSX.Element {
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const { t } = useTranslation({ locale, namespace: 'events' });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    /**
     * Navigates the calendar to the previous month.
     */
    const handlePrevMonth = (): void => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    /**
     * Navigates the calendar to the next month.
     */
    const handleNextMonth = (): void => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    /**
     * Selects a date and invokes the parent callback.
     *
     * @param dateString - ISO date string (YYYY-MM-DD)
     */
    const handleDateClick = (dateString: string): void => {
        setSelectedDate(dateString);
        onDateSelect(dateString);
    };

    /**
     * Handles keyboard navigation within the calendar grid.
     * Supports arrow keys, Home, End, Enter, and Space.
     *
     * @param event - React keyboard event from the cell button
     * @param cell - The calendar cell receiving the event
     * @param index - The cell's position in the flat 42-cell array
     */
    const handleKeyDown = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        cell: CalendarCell,
        index: number
    ): void => {
        let targetIndex: number | null = null;

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                targetIndex = index - 1;
                break;
            case 'ArrowRight':
                event.preventDefault();
                targetIndex = index + 1;
                break;
            case 'ArrowUp':
                event.preventDefault();
                targetIndex = index - 7;
                break;
            case 'ArrowDown':
                event.preventDefault();
                targetIndex = index + 7;
                break;
            case 'Home':
                event.preventDefault();
                targetIndex = 0;
                break;
            case 'End':
                event.preventDefault();
                targetIndex = calendarCells.length - 1;
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                handleDateClick(cell.dateString);
                return;
            default:
                return;
        }

        if (targetIndex !== null && targetIndex >= 0 && targetIndex < calendarCells.length) {
            const targetCell = calendarCells[targetIndex];
            if (targetCell) {
                // Switch displayed month when navigating into an adjacent month
                const targetDate = targetCell.date;
                if (targetDate.getMonth() !== month) {
                    setCurrentDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
                }

                // Focus the target cell after React re-renders
                setTimeout(() => {
                    const buttons = document.querySelectorAll('[data-calendar-cell]');
                    const targetButton = buttons[targetIndex] as HTMLButtonElement | undefined;
                    targetButton?.focus();
                }, 0);
            }
        }
    };

    // Memoize calendar grid so it only rebuilds when month, year, or events change
    const calendarCells = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return generateCalendarGrid({ year, month, events, today });
    }, [year, month, events]);

    const dayNames = useMemo(() => getDayNames(locale), [locale]);
    const monthNames = useMemo(() => getMonthNames(locale), [locale]);
    const monthName = monthNames[month] ?? '';
    const prevMonthLabel = t('calendar.prevMonth');
    const nextMonthLabel = t('calendar.nextMonth');

    return (
        <div className={className}>
            {/* Month/year header with navigation controls */}
            <div className="mb-4 flex items-center justify-between">
                <button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label={prevMonthLabel}
                    className="rounded p-2 transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    <ChevronLeftIcon
                        size="sm"
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>

                <h2 className="font-bold text-foreground text-xl">
                    {monthName} {year}
                </h2>

                <button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label={nextMonthLabel}
                    className="rounded p-2 transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    <ChevronRightIcon
                        size="sm"
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>
            </div>

            {/* Calendar grid (WAI-ARIA grid pattern) */}
            {/* biome-ignore lint/a11y/useSemanticElements: div with role="grid" is the standard WAI-ARIA calendar pattern */}
            <div
                role="grid"
                className="overflow-hidden rounded-lg border border-border"
            >
                {/* Day-name column headers */}
                <div className="grid grid-cols-7 border-border border-b bg-muted/50">
                    {dayNames.map((dayName) => (
                        <div
                            key={dayName}
                            // biome-ignore lint/a11y/useSemanticElements: columnheader role on div is correct for custom calendar grid
                            role="columnheader"
                            className="p-2 text-center font-semibold text-muted-foreground text-sm"
                        >
                            {dayName}
                        </div>
                    ))}
                </div>

                {/* Date cells */}
                <div className="grid grid-cols-7">
                    {calendarCells.map((cell, index) => {
                        const isSelected = cell.dateString === selectedDate;
                        const ariaLabel = formatDateForAriaLabel(cell.date, locale);

                        return (
                            <button
                                key={cell.dateString}
                                type="button"
                                // biome-ignore lint/a11y/useSemanticElements: gridcell role on button is correct for custom calendar grid
                                role="gridcell"
                                aria-label={ariaLabel}
                                {...(cell.isToday && { 'aria-current': 'date' as const })}
                                aria-selected={isSelected}
                                data-calendar-cell
                                onClick={() => handleDateClick(cell.dateString)}
                                onKeyDown={(e) => handleKeyDown(e, cell, index)}
                                className={[
                                    'relative h-14 border-border border-r border-b p-2 transition-colors',
                                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
                                    cell.isCurrentMonth
                                        ? 'text-foreground'
                                        : 'text-muted-foreground',
                                    cell.isToday && !isSelected
                                        ? 'font-bold ring-2 ring-primary ring-inset'
                                        : '',
                                    isSelected
                                        ? 'bg-primary font-bold text-primary-foreground'
                                        : 'hover:bg-primary/10 hover:text-primary'
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                            >
                                <span className="flex flex-col items-center justify-center">
                                    <span>{cell.date.getDate()}</span>
                                    {cell.hasEvent && (
                                        <span
                                            className={`mt-1 h-1.5 w-1.5 rounded-full ${
                                                isSelected ? 'bg-primary-foreground' : 'bg-primary'
                                            }`}
                                            aria-hidden="true"
                                        />
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
