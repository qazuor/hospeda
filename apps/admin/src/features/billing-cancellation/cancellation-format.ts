import { formatCurrency, formatDate } from '@repo/i18n';
import { MARKET_TIMEZONE } from '@repo/utils';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: MARKET_TIMEZONE
};
export function formatCancellationDate({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: string;
}): string {
    return formatDate({ date: iso, locale, options: DATE_OPTIONS });
}
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
