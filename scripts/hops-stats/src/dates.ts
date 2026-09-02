/**
 * The date N days ago, in the machine's LOCAL calendar, as `YYYY-MM-DD`.
 *
 * `toISOString().slice(0, 10)` is the obvious way to write this and it is wrong
 * outside UTC: it formats the instant in UTC, so anywhere west of Greenwich the
 * evening is already "tomorrow" there and every window silently shifts a day.
 * Measured in UTC-3 at 21:30, `daysAgo(7)` returned the date for 6 days ago and
 * the weekly commit count came out at half its real value — a number that looks
 * perfectly plausible and is simply wrong.
 *
 * git interprets a bare `YYYY-MM-DD` in `--since` as local midnight, which is
 * what a reader means by "the last seven days".
 *
 * @param days - How many days back to go.
 * @returns The local date, zero-padded, ready for `git --since=`.
 */
export function daysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}
