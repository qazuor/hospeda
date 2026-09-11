/**
 * @file experience-duration.ts
 * @description Turns a stored duration in minutes into something a traveller
 * reads (HOS-898).
 *
 * ## Why the column is a number and this file exists
 *
 * A free-text duration ("2 horas aprox") is typed once, in one language, and
 * then shown untranslated on the English and Portuguese fichas. Storing an
 * integer moves the wording to render time, which is here — and makes the value
 * comparable and sortable later, which prose never is.
 *
 * ## The units it picks
 *
 * Days appear only at 1440 minutes and above, because a three-day trip rendered
 * as "72 h" is technically right and useless. Below that it is hours and
 * minutes, and a component that is zero is dropped: 120 reads "2 h", not
 * "2 h 0 min". Under an hour it is minutes alone.
 *
 * The unit words come from i18n so the three locales can disagree about
 * abbreviations; the NUMBERS are formatted with `Intl.NumberFormat` for the
 * active locale rather than interpolated raw, because a four-digit minute count
 * has a thousands separator and it differs by language.
 */

/** One day, in minutes — the threshold at which the day component appears. */
const MINUTES_PER_DAY = 24 * 60;

/** One hour, in minutes. */
const MINUTES_PER_HOUR = 60;

/**
 * The i18n unit labels this formatter needs, resolved by the caller.
 *
 * Passed in rather than resolved here so the function stays pure and testable:
 * `createTranslations` reaches for locale files and would make every assertion
 * below depend on the i18n bundle instead of on the arithmetic.
 */
export interface DurationUnitLabels {
    /** Short label for days, e.g. "d". */
    readonly day: string;
    /** Short label for hours, e.g. "h". */
    readonly hour: string;
    /** Short label for minutes, e.g. "min". */
    readonly minute: string;
}

/**
 * Formats a stored duration for display.
 *
 * @param totalMinutes - The persisted duration, or `null`/invalid.
 * @param labels - Locale-resolved unit labels.
 * @param locale - BCP-47 tag used to format the numbers themselves.
 * @returns The formatted duration, or `null` when there is nothing to show.
 *
 * @example
 * formatDurationMinutes({ totalMinutes: 150, labels, locale: 'es' }) // "2 h 30 min"
 * formatDurationMinutes({ totalMinutes: 45, labels, locale: 'es' })  // "45 min"
 * formatDurationMinutes({ totalMinutes: 4320, labels, locale: 'es' })// "3 d"
 */
export function formatDurationMinutes({
    totalMinutes,
    labels,
    locale
}: {
    readonly totalMinutes: number | null;
    readonly labels: DurationUnitLabels;
    readonly locale: string;
}): string | null {
    // `<= 0` and not just `null`: zero is not a duration, and a negative one is
    // a corrupt row. Both must render nothing rather than "0 min", which reads
    // as a declared duration of no time at all.
    if (totalMinutes === null || !Number.isFinite(totalMinutes) || totalMinutes <= 0) {
        return null;
    }

    const whole = Math.floor(totalMinutes);
    const days = Math.floor(whole / MINUTES_PER_DAY);
    const hours = Math.floor((whole % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
    const minutes = whole % MINUTES_PER_HOUR;

    const number = new Intl.NumberFormat(locale);
    const parts: string[] = [];
    if (days > 0) parts.push(`${number.format(days)} ${labels.day}`);
    if (hours > 0) parts.push(`${number.format(hours)} ${labels.hour}`);
    // The minutes component is dropped once days are in play: "3 d 0 h 12 min"
    // is precision nobody asked an excursion for, and the leading unit already
    // answers the question the reader had.
    if (minutes > 0 && days === 0) parts.push(`${number.format(minutes)} ${labels.minute}`);

    return parts.join(' ');
}
