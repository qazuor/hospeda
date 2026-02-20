import type React from 'react';
import { useMemo, useState } from 'react';

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
    readonly locale: 'es' | 'en' | 'pt';
    /** Optional CSS class name */
    readonly className?: string;
}

/**
 * Day names by locale.
 */
const DAY_NAMES: Record<string, readonly string[]> = {
    es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    pt: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
};

/**
 * Month names by locale.
 */
const MONTH_NAMES: Record<string, readonly string[]> = {
    es: [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre'
    ],
    en: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ],
    pt: [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro'
    ]
};

/**
 * Interface for a calendar cell.
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
 * Formats a date for aria-label.
 *
 * @param date - Date to format
 * @param locale - Locale for formatting
 * @returns Formatted date string
 */
function formatDateForAriaLabel(date: Date, locale: 'es' | 'en' | 'pt'): string {
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    const monthName = MONTH_NAMES[locale]?.[monthIndex] || '';

    if (locale === 'es') {
        return `${day} de ${monthName.toLowerCase()} de ${year}`;
    }
    if (locale === 'en') {
        return `${monthName} ${day}, ${year}`;
    }
    // pt
    return `${day} de ${monthName.toLowerCase()} de ${year}`;
}

/**
 * Gets the first day of the month (0 = Sunday, 6 = Saturday).
 * Adjusted to Monday-based week (0 = Monday, 6 = Sunday).
 *
 * @param year - Year
 * @param month - Month (0-11)
 * @returns First day of month (0 = Monday, 6 = Sunday)
 */
function getFirstDayOfMonth(year: number, month: number): number {
    const firstDay = new Date(year, month, 1).getDay();
    // Convert Sunday (0) to 6, and shift Monday (1) to 0
    return firstDay === 0 ? 6 : firstDay - 1;
}

/**
 * Gets the number of days in a month.
 *
 * @param year - Year
 * @param month - Month (0-11)
 * @returns Number of days in the month
 */
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Generates the calendar grid for a given month.
 *
 * @param year - Year
 * @param month - Month (0-11)
 * @param events - Events to mark on the calendar
 * @param today - Today's date
 * @returns Array of calendar cells
 */
function generateCalendarGrid({
    year,
    month,
    events,
    today
}: {
    year: number;
    month: number;
    events: ReadonlyArray<CalendarEvent>;
    today: Date;
}): readonly CalendarCell[] {
    const cells: CalendarCell[] = [];
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInMonth = getDaysInMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    // Event dates set for fast lookup
    const eventDates = new Set(events.map((e) => e.date));

    const todayString = formatDateToISOString(today);

    // Previous month days (leading)
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

    // Current month days
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

    // Next month days (trailing)
    const remainingCells = 42 - cells.length; // 6 rows × 7 columns
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
 * Monthly calendar component that highlights dates with events and allows date selection.
 *
 * @example
 * ```tsx
 * const events = [
 *   { id: '1', name: 'Event 1', date: '2026-02-15' },
 *   { id: '2', name: 'Event 2', date: '2026-02-20' },
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

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    /**
     * Navigates to the previous month.
     */
    const handlePrevMonth = (): void => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    /**
     * Navigates to the next month.
     */
    const handleNextMonth = (): void => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    /**
     * Handles date selection.
     *
     * @param dateString - Date string in YYYY-MM-DD format
     */
    const handleDateClick = (dateString: string): void => {
        setSelectedDate(dateString);
        onDateSelect(dateString);
    };

    /**
     * Handles keyboard navigation in the calendar grid.
     *
     * @param event - Keyboard event
     * @param cell - Calendar cell
     * @param index - Cell index in the grid
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
        }

        if (targetIndex !== null && targetIndex >= 0 && targetIndex < calendarCells.length) {
            const targetCell = calendarCells[targetIndex];
            if (targetCell) {
                // Update current month if navigating to different month
                const targetDate = targetCell.date;
                if (targetDate.getMonth() !== month) {
                    setCurrentDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
                }

                // Focus the target button
                setTimeout(() => {
                    const buttons = document.querySelectorAll('[data-calendar-cell]');
                    const targetButton = buttons[targetIndex] as HTMLButtonElement | undefined;
                    targetButton?.focus();
                }, 0);
            }
        }
    };

    // Generate calendar cells
    const calendarCells = useMemo(() => {
        // Normalize today to start of day in local timezone
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return generateCalendarGrid({
            year,
            month,
            events,
            today
        });
    }, [year, month, events]);

    // Month name and navigation labels
    const monthName = MONTH_NAMES[locale]?.[month] || '';
    const prevMonthLabel =
        locale === 'es' ? 'Mes anterior' : locale === 'en' ? 'Previous month' : 'Mês anterior';
    const nextMonthLabel =
        locale === 'es' ? 'Mes siguiente' : locale === 'en' ? 'Next month' : 'Próximo mês';

    return (
        <div className={className}>
            {/* Header with month/year and navigation */}
            <div className="mb-4 flex items-center justify-between">
                <button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label={prevMonthLabel}
                    className="rounded p-2 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    <span aria-hidden="true">←</span>
                </button>

                <h2 className="font-bold text-xl">
                    {monthName} {year}
                </h2>

                <button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label={nextMonthLabel}
                    className="rounded p-2 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    <span aria-hidden="true">→</span>
                </button>
            </div>

            {/* Calendar grid */}
            {/* biome-ignore lint/a11y/useSemanticElements: div with role="grid" is the standard WAI-ARIA calendar pattern */}
            <div
                role="grid"
                className="overflow-hidden rounded-lg border border-gray-200"
            >
                {/* Day names header */}
                <div className="grid grid-cols-7 border-gray-200 border-b bg-gray-50">
                    {DAY_NAMES[locale]?.map((dayName) => (
                        <div
                            key={dayName}
                            className="p-2 text-center font-semibold text-gray-700 text-sm"
                        >
                            {dayName}
                        </div>
                    ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7">
                    {calendarCells.map((cell, index) => {
                        const isSelected = cell.dateString === selectedDate;
                        const ariaLabel = formatDateForAriaLabel(cell.date, locale);

                        return (
                            <button
                                key={cell.dateString}
                                type="button"
                                aria-label={ariaLabel}
                                {...(cell.isToday && { 'aria-current': 'date' as const })}
                                aria-selected={isSelected}
                                data-calendar-cell
                                onClick={() => handleDateClick(cell.dateString)}
                                onKeyDown={(e) => handleKeyDown(e, cell, index)}
                                className={`relative h-14 border-gray-200 border-r border-b p-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${cell.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
									${cell.isToday ? 'bg-blue-50 font-bold' : ''}
									${isSelected ? 'bg-primary font-bold text-white' : 'hover:bg-gray-50'}
									${cell.isToday && !isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
								`}
                            >
                                <span className="flex flex-col items-center justify-center">
                                    <span>{cell.date.getDate()}</span>
                                    {cell.hasEvent && (
                                        <span
                                            className={`mt-1 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`}
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
