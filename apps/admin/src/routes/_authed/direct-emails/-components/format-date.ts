/**
 * @file format-date.ts
 * @description Date helpers shared by the direct email screens (HOS-2685).
 */

/**
 * Formats a date and time for a table cell.
 *
 * @param input.value - Date, ISO string, or nullish.
 * @param input.locale - BCP 47 locale (the admin UI locale).
 * @returns The formatted text, or an em dash when the value is missing or invalid.
 */
export function formatDateTime({
    value,
    locale
}: {
    readonly value: string | Date | null | undefined;
    readonly locale: string;
}): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        date
    );
}
