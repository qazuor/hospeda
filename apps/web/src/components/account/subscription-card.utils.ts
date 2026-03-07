import { formatCurrency, formatDate, toBcp47Locale } from '@repo/i18n';

/**
 * Format a date string as a localized long date using @repo/i18n.
 *
 * @param dateString - ISO date string to format
 * @param locale - BCP-47 locale code (e.g. 'es', 'en', 'pt')
 * @returns Localized long date string
 */
export function formatLocalDate(dateString: string, locale: string): string {
    return formatDate({
        date: dateString,
        locale: toBcp47Locale(locale),
        options: { year: 'numeric', month: 'long', day: 'numeric' }
    });
}

/**
 * Format an ARS price as a localized currency string using @repo/i18n.
 * Example output: "$1.500 ARS/mes"
 *
 * @param amount - Amount in ARS
 * @param locale - BCP-47 locale code (e.g. 'es', 'en', 'pt')
 * @returns Formatted currency string with "/mes" suffix
 */
export function formatArsPrice(amount: number, locale: string): string {
    const formatted = formatCurrency({
        value: amount,
        locale: toBcp47Locale(locale),
        currency: 'ARS'
    });
    return `${formatted}/mes`;
}

/**
 * Compute remaining trial days from a trialEndsAt ISO string.
 * Returns 0 if the date is in the past.
 *
 * @param trialEndsAt - ISO date string for trial end date
 * @returns Number of days remaining (minimum 0)
 */
export function computeTrialDaysRemaining(trialEndsAt: string): number {
    const remaining = Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, remaining);
}
