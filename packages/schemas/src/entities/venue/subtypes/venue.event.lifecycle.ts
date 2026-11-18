/**
 * venue.event.lifecycle.ts
 *
 * The ONE definition of when a venue's agenda entry is over (HOS-2254).
 *
 * The public API, the owner API, the editor's session grouping, the plan cap
 * (HOS-2263) and the cleanup cron all ask the same question: "is this event
 * past?". Every one of them calls {@link isVenueEventPast}; none compares
 * event dates on its own.
 *
 * Pure functions, no date library: the clock is injected (`now`) and read in
 * the venue's zone with `Intl.DateTimeFormat#formatToParts` (never with
 * `getHours()` of the host process), and every calendar computation is string
 * or `Date.UTC` arithmetic. `new Date('YYYY-MM-DD')` is never used: it parses
 * as UTC midnight and shifts the day in any zone west of Greenwich.
 *
 * @module entities/venue/subtypes/venue.event.lifecycle
 */
import type { VenueEvent } from './venue.event.schema.js';

/** Zone every venue lives in until a listing carries its own. */
export const VENUE_EVENT_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Local time (next day) at which a once-event WITHOUT end time stops being published. */
export const VENUE_EVENT_NO_END_GRACE_TIME = '06:00';

/** Days a past one-off event is kept before the cleanup cron deletes it. */
export const VENUE_EVENT_PAST_RETENTION_DAYS = 60;

/**
 * The fields {@link isVenueEventPast} reads. `date` and `endTime` may be absent
 * so a write payload (`VenueEventInput`) and a stored row both fit.
 */
export interface VenueEventTiming {
    readonly recurrence: VenueEvent['recurrence'];
    readonly date?: string | null | undefined;
    readonly startTime: string;
    readonly endTime?: string | null | undefined;
}

/** A calendar day and a clock time, both in the venue's zone. */
export interface VenueEventZonedMoment {
    /** `YYYY-MM-DD`. */
    readonly date: string;
    /** `HH:MM`. */
    readonly time: string;
}

const MS_PER_DAY = 86_400_000;

/**
 * Adds whole days to a `YYYY-MM-DD` string using UTC arithmetic only.
 *
 * @param input - `{ date, days }`.
 * @returns The shifted day as `YYYY-MM-DD`.
 */
function addDays(input: { readonly date: string; readonly days: number }): string {
    const [year = 0, month = 1, day = 1] = input.date.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day) + input.days * MS_PER_DAY);
    return shifted.toISOString().slice(0, 10);
}

/**
 * Reads an instant as a calendar day and clock time in a zone.
 *
 * @param input - `{ now, timeZone? }`.
 * @returns The day and `HH:MM` in that zone.
 */
export function getVenueEventZonedNow(input: {
    readonly now: Date;
    readonly timeZone?: string;
}): VenueEventZonedMoment {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: input.timeZone ?? VENUE_EVENT_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(input.now);
    const pick = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((part) => part.type === type)?.value ?? '';
    return {
        date: `${pick('year')}-${pick('month')}-${pick('day')}`,
        time: `${pick('hour')}:${pick('minute')}`
    };
}

/**
 * When a `once` event ends, in the venue's zone.
 *
 * - With `endTime`: `date + endTime`, one day later when the end is earlier on
 *   the clock than the start ("22:00 a 02:00" crosses midnight).
 * - Without `endTime`: `date + 1 day + 06:00`, so a "sabado 23:00" party does
 *   not vanish at 00:00 in the middle of the night.
 *
 * @param input - `{ event }`.
 * @returns The end, or `null` for a `weekly` event (it never ends) or a `once`
 *   event that has no date.
 */
export function getVenueEventEnd(input: {
    readonly event: VenueEventTiming;
}): VenueEventZonedMoment | null {
    const { event } = input;
    if (event.recurrence !== 'once' || !event.date) return null;
    if (!event.endTime) {
        return {
            date: addDays({ date: event.date, days: 1 }),
            time: VENUE_EVENT_NO_END_GRACE_TIME
        };
    }
    const crossesMidnight = event.endTime < event.startTime;
    return {
        date: crossesMidnight ? addDays({ date: event.date, days: 1 }) : event.date,
        time: event.endTime
    };
}

/**
 * Whether an agenda entry is over.
 *
 * A `weekly` entry is never past. A `once` entry is past when "now in the
 * zone" is STRICTLY after its end (see {@link getVenueEventEnd}).
 *
 * @param input - `event`, the injected `now`, an optional `timeZone` (defaults
 *   to {@link VENUE_EVENT_TIME_ZONE}) and an optional `olderThanDays`: the end
 *   must also be at least that many whole days behind (the cleanup cron passes
 *   {@link VENUE_EVENT_PAST_RETENTION_DAYS}; default 0).
 * @returns `true` when the event is past.
 */
export function isVenueEventPast(input: {
    readonly event: VenueEventTiming;
    readonly now: Date;
    readonly timeZone?: string;
    readonly olderThanDays?: number;
}): boolean {
    const end = getVenueEventEnd({ event: input.event });
    if (!end) return false;
    const limit = addDays({ date: end.date, days: input.olderThanDays ?? 0 });
    const zoned = getVenueEventZonedNow({ now: input.now, timeZone: input.timeZone });
    return `${zoned.date}T${zoned.time}` > `${limit}T${end.time}`;
}

/**
 * Whether an entry is published: switched on and not past.
 *
 * @param input - `{ event, now, timeZone? }`.
 * @returns `true` when the public page should show it.
 */
export function isVenueEventLive(input: {
    readonly event: VenueEventTiming & { readonly isActive: boolean };
    readonly now: Date;
    readonly timeZone?: string;
}): boolean {
    return input.event.isActive && !isVenueEventPast(input);
}

/**
 * Splits an agenda into the entries that are not past and the ones that are.
 * Order is preserved inside each side.
 *
 * @param input - `{ events, now, timeZone? }`.
 * @returns `{ current, past }`. `current` holds live AND switched-off entries:
 *   the plan cap counts both, a past entry counts for neither.
 */
export function partitionVenueEvents<T extends VenueEventTiming>(input: {
    readonly events: readonly T[];
    readonly now: Date;
    readonly timeZone?: string;
}): { readonly current: T[]; readonly past: T[] } {
    const current: T[] = [];
    const past: T[] = [];
    for (const event of input.events) {
        (isVenueEventPast({ event, now: input.now, timeZone: input.timeZone })
            ? past
            : current
        ).push(event);
    }
    return { current, past };
}

/**
 * Adds the calculated `isPast` flag to every entry (owner read).
 *
 * @param input - `{ events, now, timeZone? }`.
 * @returns The same entries, each with `isPast`.
 */
export function withVenueEventPastFlag<T extends VenueEventTiming>(input: {
    readonly events: readonly T[];
    readonly now: Date;
    readonly timeZone?: string;
}): Array<T & { isPast: boolean }> {
    return input.events.map((event) => ({
        ...event,
        isPast: isVenueEventPast({ event, now: input.now, timeZone: input.timeZone })
    }));
}
