/**
 * Local calendar-day windows for an IANA time zone — the shared primitive
 * behind every "daily series" in the platform (entity views, QR scans, ...).
 * @module utils/local-day
 *
 * WHY THIS MODULE EXISTS
 *
 * Every "group events by day" query in this repo bucketed by UTC calendar
 * day (`DATE_TRUNC('day', <col>)` with no time zone), and the JS side
 * generated its gap-fill range in UTC on purpose, to match. Argentina is
 * UTC-3, so anything that happened between 21:00 and midnight local time
 * landed on the WRONG calendar day everywhere at once (HOS-1169): five QR
 * scans at 22:02 Argentina time on 2026-09-04 were reported as
 * `{"2026-09-04": 1, "2026-09-05": 4}`.
 *
 * Fixing only the SQL side or only the JS side desynchronizes the two — the
 * SQL groups by one calendar and the gap-fill fills in another, producing
 * gaps or duplicate dates. This module is the single place BOTH sides derive
 * "today" and "N days ago" from, so a daily series's SQL grouping and its
 * zero-fill can never drift apart.
 *
 * Resolve by IANA zone name, never by a hardcoded offset: Argentina has not
 * observed DST since 2009, but a zone name survives a future policy change
 * and a bare `-3` does not.
 */

/** The platform's canonical market time zone (Argentina, fixed UTC-3 since 2009). */
export const MARKET_TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Input for {@link getLocalDateString}. */
export interface GetLocalDateStringInput {
    /** The instant to read. */
    readonly instant: Date;
    /** IANA time zone. Defaults to {@link MARKET_TIMEZONE}. */
    readonly timeZone?: string;
}

/**
 * Returns the calendar date (`'YYYY-MM-DD'`) that `instant` falls on in
 * `timeZone`, resolved via `Intl.DateTimeFormat` — never via a hardcoded
 * UTC offset, so the result stays correct even if the zone's offset policy
 * changes in the future.
 *
 * @param input - {@link GetLocalDateStringInput}.
 * @returns The local calendar date as `'YYYY-MM-DD'`.
 * @throws {Error} If the time zone's date parts cannot be resolved.
 *
 * @example
 * ```ts
 * // 2026-09-04T22:02:18-03:00 == 2026-09-05T01:02:18.000Z
 * getLocalDateString({ instant: new Date('2026-09-05T01:02:18.000Z') });
 * // '2026-09-04' — the Argentina calendar day, not the UTC one.
 * ```
 */
export function getLocalDateString({
    instant,
    timeZone = MARKET_TIMEZONE
}: GetLocalDateStringInput): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(instant);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;

    if (!(year && month && day)) {
        throw new Error(
            `getLocalDateString: could not resolve date parts for time zone "${timeZone}"`
        );
    }

    return `${year}-${month}-${day}`;
}

/** Input for the internal time zone offset lookup. */
interface GetTimeZoneOffsetMsInput {
    readonly instant: Date;
    readonly timeZone: string;
}

/**
 * Returns the offset (in ms) of `timeZone` from UTC at `instant` — positive
 * for zones ahead of UTC, negative for zones behind it (Buenos Aires is
 * always `-10800000`, i.e. -3h).
 *
 * Standard single-shot trick: format `instant` in the target zone, read the
 * wall-clock reading back as if it were UTC, and diff against the real
 * instant. This is exact for a fixed-offset zone (Argentina, no DST since
 * 2009) and correct for a DST zone everywhere except the instant of the
 * transition itself, which does not apply here.
 */
function getTimeZoneOffsetMs({ instant, timeZone }: GetTimeZoneOffsetMsInput): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).formatToParts(instant);

    const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);

    const asUtc = Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second')
    );

    return asUtc - instant.getTime();
}

/** Input for {@link getUtcInstantForLocalMidnight}. */
export interface GetUtcInstantForLocalMidnightInput {
    /** The local calendar date, as `'YYYY-MM-DD'`. */
    readonly date: string;
    /** IANA time zone. Defaults to {@link MARKET_TIMEZONE}. */
    readonly timeZone?: string;
}

/**
 * Returns the UTC instant corresponding to local midnight (00:00:00) of
 * `date` in `timeZone`. For Buenos Aires, `'2026-09-04'` maps to
 * `2026-09-04T03:00:00.000Z` (00:00 -03:00).
 *
 * @param input - {@link GetUtcInstantForLocalMidnightInput}.
 * @returns The UTC instant of local midnight, suitable for a
 *   `WHERE <col> >= $windowStart` bound against a `timestamptz` column.
 * @throws {Error} If `date` is not a well-formed `'YYYY-MM-DD'` string.
 */
export function getUtcInstantForLocalMidnight({
    date,
    timeZone = MARKET_TIMEZONE
}: GetUtcInstantForLocalMidnightInput): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`getUtcInstantForLocalMidnight: invalid date "${date}"`);
    }

    // Read the parts by position rather than through capture groups. The test
    // above already fixed the shape, so the offsets are exact — and this avoids
    // casting `RegExpExecArray` (typed as possibly-sparse) into a fixed-length
    // tuple just to convince the compiler of something the regex guarantees.
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));

    // First guess: this calendar date at UTC midnight. The real local
    // midnight is this guess shifted by the zone's offset at that instant.
    const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const offsetMs = getTimeZoneOffsetMs({ instant: guess, timeZone });
    return new Date(guess.getTime() - offsetMs);
}

/** Input for {@link getLocalDayWindow}. */
export interface GetLocalDayWindowInput {
    /** "Now" — defaults to `new Date()`. Pass explicitly in tests (`vi.setSystemTime` also works). */
    readonly now?: Date;
    /** Number of calendar days in the window, inclusive of today. Must be >= 1. */
    readonly windowDays: number;
    /** IANA time zone. Defaults to {@link MARKET_TIMEZONE}. */
    readonly timeZone?: string;
}

/** Output of {@link getLocalDayWindow}. */
export interface LocalDayWindow {
    /**
     * The UTC instant of local midnight of the OLDEST day in the window.
     * Pass this straight into a `WHERE <col> >= $windowStart` SQL bound.
     */
    readonly windowStart: Date;
    /**
     * Every calendar date (`'YYYY-MM-DD'`, local) in the window, oldest
     * first, exactly `windowDays` entries — the gap-fill range for the
     * matching SQL query.
     */
    readonly dates: string[];
}

/**
 * Computes the local calendar-day window `[today - (windowDays - 1) .. today]`
 * (inclusive) in `timeZone`.
 *
 * This is the single source of both the `windowStart` SQL bound and the JS
 * gap-fill date range for a daily series, so the SQL's
 * `DATE_TRUNC('day', <col> AT TIME ZONE '<zone>')` grouping and the
 * service-layer zero-fill can never disagree on what "today" or "N days ago"
 * means.
 *
 * @param input - {@link GetLocalDayWindowInput}.
 * @returns {@link LocalDayWindow}.
 * @throws {Error} If `windowDays` is less than 1.
 *
 * @example
 * ```ts
 * // Under vi.setSystemTime(new Date('2026-09-04T12:00:00Z')):
 * getLocalDayWindow({ windowDays: 3 });
 * // {
 * //   windowStart: 2026-09-02T03:00:00.000Z, // local midnight of the oldest day
 * //   dates: ['2026-09-02', '2026-09-03', '2026-09-04']
 * // }
 * ```
 */
export function getLocalDayWindow({
    now = new Date(),
    windowDays,
    timeZone = MARKET_TIMEZONE
}: GetLocalDayWindowInput): LocalDayWindow {
    if (windowDays < 1) {
        throw new Error(`getLocalDayWindow: windowDays must be >= 1, got ${windowDays}`);
    }

    const todayLocal = getLocalDateString({ instant: now, timeZone });
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayLocal);
    // biome-ignore lint/style/noNonNullAssertion: getLocalDateString always returns a well-formed 'YYYY-MM-DD' string.
    const [, yearStr, monthStr, dayStr] = match!;
    const todayAnchorUtcMs = Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr));

    const dates: string[] = [];
    for (let dayOffset = windowDays - 1; dayOffset >= 0; dayOffset--) {
        const dayMs = todayAnchorUtcMs - dayOffset * 24 * 60 * 60 * 1000;
        const d = new Date(dayMs);
        dates.push(
            `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        );
    }

    // biome-ignore lint/style/noNonNullAssertion: windowDays >= 1 guarantees at least one entry.
    const oldestDate = dates[0]!;
    const windowStart = getUtcInstantForLocalMidnight({ date: oldestDate, timeZone });

    return { windowStart, dates };
}

/** Input for {@link getLocalMonthWindow}. */
export interface GetLocalMonthWindowInput {
    /** Any instant inside the wanted calendar month. */
    readonly instant: Date;
    /** IANA time zone. Defaults to {@link MARKET_TIMEZONE}. */
    readonly timeZone?: string;
}

/** Result of {@link getLocalMonthWindow}. */
export interface LocalMonthWindow {
    /** UTC instant of local midnight on the FIRST day of the month. Inclusive bound. */
    readonly monthStart: Date;
    /** UTC instant of local midnight on the first day of the NEXT month. EXCLUSIVE bound. */
    readonly nextMonthStart: Date;
    /** The month's first day as `'YYYY-MM-01'`, for a `date` column. */
    readonly monthLabel: string;
}

/**
 * Returns the half-open UTC window `[monthStart, nextMonthStart)` covering the
 * local calendar month that `instant` falls in, plus that month's label.
 *
 * The month sibling of {@link getLocalDayWindow}, and it exists for the same
 * reason: a "month" is a local calendar concept, but the column being filtered
 * is a `timestamptz`, so the boundaries have to be resolved to UTC instants once
 * — here — instead of being re-derived inside SQL on every row.
 *
 * ## Why callers should filter on these bounds rather than on `DATE_TRUNC`
 *
 * `WHERE DATE_TRUNC('month', col AT TIME ZONE $tz) = …` is not sargable: it
 * wraps the indexed column in a function, so Postgres cannot use the index and
 * scans the whole table. `WHERE col >= $start AND col < $end` uses it.
 *
 * It also removes the time zone from the statement altogether, which sidesteps
 * a sharper trap: a plain string interpolated into a Drizzle `sql` template
 * emits a distinct PLACEHOLDER at each site, and Postgres compares `GROUP BY`
 * expressions by node identity, so `DATE_TRUNC(..., $1)` in the SELECT does not
 * match `DATE_TRUNC(..., $5)` in the GROUP BY and the statement is rejected at
 * parse time. `marketTimezoneSql()` in `@repo/db` exists for the cases that
 * genuinely need the zone inside SQL; this helper is for the cases that can
 * avoid needing it at all.
 *
 * The bound is HALF-OPEN on purpose. A closed `<=` bound would need the last
 * microsecond of the month and would either include or exclude an event landing
 * exactly on the boundary depending on the column's precision.
 *
 * @param input - {@link GetLocalMonthWindowInput}.
 * @returns {@link LocalMonthWindow}.
 *
 * @example
 * ```ts
 * // Any instant in September 2026, Buenos Aires:
 * getLocalMonthWindow({ instant: new Date('2026-09-14T12:00:00.000Z') });
 * // monthStart      2026-09-01T03:00:00.000Z
 * // nextMonthStart  2026-10-01T03:00:00.000Z
 * // monthLabel      '2026-09-01'
 * ```
 */
export function getLocalMonthWindow({
    instant,
    timeZone = MARKET_TIMEZONE
}: GetLocalMonthWindowInput): LocalMonthWindow {
    const localDate = getLocalDateString({ instant, timeZone });
    const year = Number(localDate.slice(0, 4));
    const month = Number(localDate.slice(5, 7));

    // Integer arithmetic on an already-localised date, NOT `Date.setMonth`:
    // that mutator reads and writes in the process's own zone, and on the 31st
    // it rolls forward into the following month (31 March minus one month is
    // 3 March). `scripts/check-local-date-math.sh` rejects it for that reason.
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;

    const pad = (n: number): string => String(n).padStart(2, '0');
    const monthLabel = `${year}-${pad(month)}-01`;

    return {
        monthStart: getUtcInstantForLocalMidnight({ date: monthLabel, timeZone }),
        nextMonthStart: getUtcInstantForLocalMidnight({
            date: `${nextYear}-${pad(nextMonth)}-01`,
            timeZone
        }),
        monthLabel
    };
}
