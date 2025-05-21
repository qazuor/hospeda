/**
 * Utility functions for formatting data
 */

import type { BaseLocationType } from '@repo/types';

/**
 * Formats a price in ARS currency
 * @param price - The price to format
 * @returns Formatted price string
 */
export const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(price);
};

/**
 * Formats a date to a localized string
 * @param date - Date string or Date object
 * @param locale - Locale string (default: 'es-AR')
 * @returns Formatted date string
 */
export const formatDate = (date: string | Date, locale = 'es-AR'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

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
