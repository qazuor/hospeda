/**
 * Utility functions for formatting data
 */

import type { BaseLocationType, PriceType } from '@repo/schemas';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formats a price in ARS currency
 * @param price - The price to format
 * @returns Formatted price string
 */
export const formatPrice = (price: PriceType): string => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: price.currency || 'ARS',
        maximumFractionDigits: 0
    }).format(price.price || 0);
};

/**
 * Formats a date to a localized string
 * @param date - Date string or Date object
 * @param formatStr - Date string format (default: 'd MMMM yyyy')
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, formatStr = 'd MMMM yyyy'): string {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return format(parsedDate, formatStr, { locale: es });
}

export function formatDateRange(start: Date, end?: Date): string {
    if (!start) return '';

    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;

    const sameDay =
        endDate &&
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate();

    if (!endDate || sameDay) {
        return format(startDate, "d 'de' MMMM 'de' yyyy", { locale: es });
    }

    const sameMonth =
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth();

    if (sameMonth) {
        return `${format(startDate, 'd', { locale: es })}–${format(endDate, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
    }

    const sameYear = startDate.getFullYear() === endDate.getFullYear();

    if (sameYear) {
        return `${format(startDate, "d 'de' MMM", { locale: es })} – ${format(
            endDate,
            "d 'de' MMMM 'de' yyyy",
            {
                locale: es
            }
        )}`;
    }

    return `${format(startDate, "d 'de' MMMM 'de' yyyy", { locale: es })} – ${format(
        endDate,
        "d 'de' MMMM 'de' yyyy",
        {
            locale: es
        }
    )}`;
}

/**
 * Formats a location string
 * @param location - Location object or string
 * @returns Formatted location string
 */
export const formatLocation = (location: BaseLocationType | string | undefined): string => {
    if (typeof location === 'string') {
        return location;
    }

    if (!location) {
        return 'Ubicación no especificada';
    }

    const parts = [];
    if ('city' in location && location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.country) parts.push(location.country);

    return parts.join(', ') || 'Ubicación no especificada';
};
