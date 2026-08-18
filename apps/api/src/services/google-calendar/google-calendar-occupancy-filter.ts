/**
 * Which Google Calendar entries count as occupancy (H-131).
 *
 * ## What went wrong
 *
 * The sync connects the host's **primary** calendar — the one holding their
 * private life — and treated every non-cancelled entry on it as a booking. In
 * production that imported five contact birthdays, each expanded 30 years
 * forward by `singleEvents=true`, and wrote 302 blocked days reaching
 * 2056-04-26 across two accommodations. The rows carried titles like
 * "Delfina Asrilevich - Cumpleaños".
 *
 * A blocked day removes the listing from date searches, so a host who connects
 * their personal calendar quietly disappears from results on those days, every
 * year, forever — with no note explaining why.
 *
 * ## The rule
 *
 * An entry occupies the accommodation only if the owner treats it as occupying
 * *their own* time. Two independent signals say it does not, and both are
 * checked because neither is reliably present on its own:
 *
 * - `eventType` — Google's own classification. Contact birthdays arrive as
 *   `'birthday'`; `'workingLocation'`, `'focusTime'` and `'fromGmail'` are
 *   likewise synthesised entries nobody booked.
 * - `transparency` — `'transparent'` means "free" on the owner's own calendar.
 *   Google sets it on birthdays and most informational all-day entries.
 *
 * `'outOfOffice'` is deliberately NOT excluded: a host marking themselves away
 * plausibly means the place is unavailable, and excluding it would be the
 * opposite failure (a booked-out property still showing as free).
 *
 * Note that same-day timed events already contribute nothing — the half-open
 * `[start, end)` range makes them empty — so an ordinary meeting on the host's
 * calendar was never the problem. All-day and multi-day entries are.
 *
 * @module services/google-calendar/google-calendar-occupancy-filter
 */

import type { GoogleCalendarEvent } from './google-calendar-client.js';

/**
 * `eventType` values that are Google-synthesised entries rather than something
 * the owner scheduled. See the module doc for why `'outOfOffice'` is absent.
 */
const NON_OCCUPYING_EVENT_TYPES: ReadonlySet<string> = new Set([
    'birthday',
    'workingLocation',
    'focusTime',
    'fromGmail'
]);

/**
 * Why an event was excluded from occupancy — used for logging so a host asking
 * "why is my calendar not blocking anything" gets an answer.
 */
export type OccupancyExclusionReason = 'cancelled' | 'non-occupying-type' | 'transparent';

/**
 * Decides whether a Google Calendar entry should block days on the
 * accommodation.
 *
 * @param input.event - The calendar entry as returned by `events.list`.
 * @returns `{ include: true }`, or `{ include: false, reason }`.
 *
 * @example
 * ```ts
 * classifyOccupancyEvent({ event: { id: '1', eventType: 'birthday' } });
 * // → { include: false, reason: 'non-occupying-type' }
 * ```
 */
export function classifyOccupancyEvent(input: {
    event: GoogleCalendarEvent;
}):
    | { readonly include: true }
    | { readonly include: false; readonly reason: OccupancyExclusionReason } {
    const { event } = input;

    if (event.status === 'cancelled') {
        return { include: false, reason: 'cancelled' };
    }

    // An absent eventType means an older API response — treat as 'default'.
    if (event.eventType !== undefined && NON_OCCUPYING_EVENT_TYPES.has(event.eventType)) {
        return { include: false, reason: 'non-occupying-type' };
    }

    // 'opaque' is Google's default and is what an absent value means.
    if (event.transparency === 'transparent') {
        return { include: false, reason: 'transparent' };
    }

    return { include: true };
}

/**
 * Convenience predicate over {@link classifyOccupancyEvent}.
 *
 * @param input.event - The calendar entry to test.
 * @returns `true` when the entry should produce occupancy rows.
 */
export function isOccupyingEvent(input: { event: GoogleCalendarEvent }): boolean {
    return classifyOccupancyEvent(input).include;
}
