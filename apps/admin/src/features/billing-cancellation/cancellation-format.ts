import { formatCurrency, formatDate } from '@repo/i18n';
import { MARKET_TIMEZONE } from '@repo/utils';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: MARKET_TIMEZONE
};
/** Formats a cancellation-related ISO date using the requested locale and market timezone.
 * @param input - ISO date and locale used for formatting.
 * @returns The localized date string.
 */
export function formatCancellationDate({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: string;
}): string {
    return formatDate({ date: iso, locale, options: DATE_OPTIONS });
}
/** Formats a price stored as integer cents using the requested locale and currency.
 * @param input - Amount in cents, locale, and currency code.
 * @returns The localized currency string.
 */
export function formatCancellationAmount({
    cents,
    locale,
    currency
}: {
    readonly cents: number;
    readonly locale: string;
    readonly currency: string;
}): string {
    return formatCurrency({ value: cents / 100, locale, currency });
}
