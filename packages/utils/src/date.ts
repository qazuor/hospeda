/**
 * Date utility functions
 * @module utils/date
 */

import {
    addDays,
    addMonths,
    addYears,
    differenceInDays,
    differenceInHours,
    differenceInMinutes,
    format,
    formatDistance,
    formatRelative,
    isAfter,
    isBefore,
    isEqual,
    isValid,
    parse,
    parseISO
} from 'date-fns';

/**
 * Format a date using date-fns
 * @param date - Date to format
 * @param formatStr - Format string (default: 'yyyy-MM-dd')
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number, formatStr = 'yyyy-MM-dd'): string {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return format(dateObj, formatStr);
    } catch (_error) {
        return 'Invalid date';
    }
}

/**
 * Format a date relative to the current date
 * @param date - Date to format
 * @param baseDate - Base date (default: now)
 * @returns Relative date string
 */
export function formatRelativeDate(date: Date | string | number, baseDate = new Date()): string {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return formatRelative(dateObj, baseDate);
    } catch (_error) {
        return 'Invalid date';
    }
}

/**
 * Format the distance between two dates
 * @param date - Date to compare
 * @param baseDate - Base date (default: now)
 * @param options - Format distance options
 * @returns Distance string
 */
export function formatDateDistance(
    date: Date | string | number,
    baseDate = new Date(),
    options?: Parameters<typeof formatDistance>[2]
): string {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return formatDistance(dateObj, baseDate, options);
    } catch (_error) {
        return 'Invalid date';
    }
}

/**
 * Parse a date string using date-fns
 * @param dateStr - Date string to parse
 * @param formatStr - Format string
 * @param referenceDate - Reference date (default: now)
 * @returns Parsed date
 */
export function parseDate(dateStr: string, formatStr: string, referenceDate = new Date()): Date {
    return parse(dateStr, formatStr, referenceDate);
}

/**
 * Check if a date is valid
 * @param date - Date to check
 * @returns Whether the date is valid
 */
export function isValidDate(date: unknown): boolean {
    if (!date) return false;
    if (typeof date === 'string') {
        try {
            return parseISO(date) as unknown as boolean;
        } catch (_error) {
            return false;
        }
    }
    return isValid(date);
}

/**
 * Check if a date is before another date
 * @param date - Date to check
 * @param compareDate - Date to compare against
 * @returns Whether the date is before the compare date
 */
export function isDateBefore(
    date: Date | string | number,
    compareDate: Date | string | number
): boolean {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        const compareDateObj =
            typeof compareDate === 'string' ? parseISO(compareDate) : compareDate;
        return isBefore(dateObj, compareDateObj);
    } catch (_error) {
        return false;
    }
}

/**
 * Check if a date is after another date
 * @param date - Date to check
 * @param compareDate - Date to compare against
 * @returns Whether the date is after the compare date
 */
export function isDateAfter(
    date: Date | string | number,
    compareDate: Date | string | number
): boolean {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        const compareDateObj =
            typeof compareDate === 'string' ? parseISO(compareDate) : compareDate;
        return isAfter(dateObj, compareDateObj);
    } catch (_error) {
        return false;
    }
}

/**
 * Check if two dates are equal
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Whether the dates are equal
 */
export function areDatesEqual(
    date1: Date | string | number,
    date2: Date | string | number
): boolean {
    try {
        const dateObj1 = typeof date1 === 'string' ? parseISO(date1) : date1;
        const dateObj2 = typeof date2 === 'string' ? parseISO(date2) : date2;
        return isEqual(dateObj1, dateObj2);
    } catch (_error) {
        return false;
    }
}

/**
 * Get the difference in days between two dates
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Difference in days
 */
export function getDaysDifference(
    date1: Date | string | number,
    date2: Date | string | number
): number {
    try {
        const dateObj1 = typeof date1 === 'string' ? parseISO(date1) : date1;
        const dateObj2 = typeof date2 === 'string' ? parseISO(date2) : date2;
        return differenceInDays(dateObj1, dateObj2);
    } catch (_error) {
        return 0;
    }
}

/**
 * Get the difference in hours between two dates
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Difference in hours
 */
export function getHoursDifference(
    date1: Date | string | number,
    date2: Date | string | number
): number {
    try {
        const dateObj1 = typeof date1 === 'string' ? parseISO(date1) : date1;
        const dateObj2 = typeof date2 === 'string' ? parseISO(date2) : date2;
        return differenceInHours(dateObj1, dateObj2);
    } catch (_error) {
        return 0;
    }
}

/**
 * Get the difference in minutes between two dates
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Difference in minutes
 */
export function getMinutesDifference(
    date1: Date | string | number,
    date2: Date | string | number
): number {
    try {
        const dateObj1 = typeof date1 === 'string' ? parseISO(date1) : date1;
        const dateObj2 = typeof date2 === 'string' ? parseISO(date2) : date2;
        return differenceInMinutes(dateObj1, dateObj2);
    } catch (_error) {
        return 0;
    }
}

/**
 * Add days to a date
 * @param date - Date to add days to
 * @param days - Number of days to add
 * @returns New date
 */
export function addDaysToDate(date: Date | string | number, days: number): Date {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return addDays(dateObj, days);
    } catch (_error) {
        return new Date();
    }
}

/**
 * Add months to a date
 * @param date - Date to add months to
 * @param months - Number of months to add
 * @returns New date
 */
export function addMonthsToDate(date: Date | string | number, months: number): Date {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return addMonths(dateObj, months);
    } catch (_error) {
        return new Date();
    }
}

/**
 * Add years to a date
 * @param date - Date to add years to
 * @param years - Number of years to add
 * @returns New date
 */
export function addYearsToDate(date: Date | string | number, years: number): Date {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return addYears(dateObj, years);
    } catch (_error) {
        return new Date();
    }
}
