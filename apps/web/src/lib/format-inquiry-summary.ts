import { formatCalendarDate, formatCalendarDateRange } from '@repo/utils';
import type { SupportedLocale } from './i18n';
import { createTranslations } from './i18n';

/** Separator between the dates and the guest count in the summary line. */
const SUMMARY_SEPARATOR = ' · ';

/** Booking context stored on a conversation by the inquiry form (HOS-2534). */
export interface InquirySummaryInput {
    readonly locale: SupportedLocale;
    /** Check-in calendar date (`YYYY-MM-DD`), when the visitor gave one. */
    readonly checkIn?: string | null;
    /** Check-out calendar date (`YYYY-MM-DD`), when the visitor gave one. */
    readonly checkOut?: string | null;
    /** Guest count, when the visitor gave one. */
    readonly guests?: number | null;
}

/**
 * Builds the one-line inquiry summary shown above the host's thread, e.g.
 * `12–15 dic · 2 huéspedes`. Dates are calendar days (UTC-pinned, never shifted
 * by the reader's timezone); a lone date reads «Desde el …» / «Hasta el …».
 *
 * @param input - Locale plus the optional stored booking fields.
 * @returns The summary, or `null` when the conversation carries none of them.
 */
export function formatInquirySummary({
    locale,
    checkIn,
    checkOut,
    guests
}: InquirySummaryInput): string | null {
    const { t, tPlural } = createTranslations(locale);
    const parts: string[] = [];

    // Bare language on purpose: ICU's `es-AR` range pattern is broken for short months.
    if (checkIn && checkOut) {
        const range = formatCalendarDateRange({ from: checkIn, to: checkOut, locale });
        if (range) parts.push(range);
    } else if (checkIn || checkOut) {
        const single = (checkIn ?? checkOut) as string;
        const date = formatCalendarDate({
            value: single,
            locale,
            options: { day: 'numeric', month: 'short' }
        });
        if (date) {
            parts.push(
                t(`conversations.thread.inquiry.${checkIn ? 'from' : 'until'}`, undefined, { date })
            );
        }
    }

    if (typeof guests === 'number' && guests > 0) {
        parts.push(tPlural('conversations.thread.inquiry.guests', guests));
    }

    return parts.length > 0 ? parts.join(SUMMARY_SEPARATOR) : null;
}
