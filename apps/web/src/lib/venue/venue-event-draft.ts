/**
 * @file venue-event-draft.ts
 * @description Shared draft shape for the venue-agenda editor (HOS-1042).
 *
 * Split out of `ListingVenueEventsManager.client.tsx` so
 * `ListingVenueEventEntryCard.client.tsx` can import the SAME type rather
 * than a hand-copied twin — the two files together implement one form, and a
 * duplicated `EventDraft` is exactly the kind of drift that lets one file's
 * edit silently stop matching the other's.
 */

import {
    getVenueEventZonedNow,
    isVenueEventPast,
    VENUE_EVENTS_MAX_ENTRIES,
    VENUE_EVENTS_MAX_TOTAL_ENTRIES
} from '@repo/schemas';
import type { TranslationFn } from '@/lib/i18n';

/**
 * One agenda entry, as held in form state. `id` is the stored event's id for a
 * row loaded from the API and is sent back on save so the event keeps its
 * identity (HOS-2291); a row the owner just added has none and is created.
 */
export interface EventDraft {
    /** Stored event id; absent on a row added in this session. */
    id?: string;
    title: string;
    description: string;
    recurrence: 'once' | 'weekly';
    /** `YYYY-MM-DD`. Meaningful, and sent, only when `recurrence === 'once'`. */
    date: string;
    /** `0`-`6`. Meaningful, and sent, only when `recurrence === 'weekly'`. */
    weekday: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
    /**
     * Whether the API reported this stored event as past (HOS-2254). Calculated
     * on the server in the venue's zone, never from the browser's clock. Absent
     * on a row added in this session, which counts as live.
     */
    isPast?: boolean;
}

/**
 * `Date#getDay()` order: `0` = Sunday … `6` = Saturday, matching
 * `VenueEventWeekdaySchema`. The labels themselves are NOT duplicated
 * here — both consumers reuse the existing opening-hours locale keys, the
 * same keys the public opening-hours section and `VenueEvents.astro`
 * already read.
 */
export const WEEKDAY_I18N_KEYS = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
] as const;

/** A blank entry, as `Agregar evento` appends it. */
export const EMPTY_DRAFT: EventDraft = {
    title: '',
    description: '',
    recurrence: 'weekly',
    date: '',
    weekday: 1,
    startTime: '',
    endTime: '',
    isActive: true
};

/** One agenda entry, as `GET .../events` returns it. */
export interface VenueEventRow {
    readonly id: string;
    readonly title: string;
    readonly description: string | null;
    readonly recurrence: 'once' | 'weekly';
    readonly date: string | null;
    readonly weekday: number | null;
    readonly startTime: string;
    readonly endTime: string | null;
    readonly isActive: boolean;
    /** Calculated by the API in the venue's zone (HOS-2254). */
    readonly isPast?: boolean;
}

/**
 * Turns a stored event into form state, keeping its id (HOS-2291) and the
 * server's `isPast` (HOS-2254).
 *
 * @param event - The row from the API.
 * @returns The draft.
 */
export function draftFromRow(event: VenueEventRow): EventDraft {
    return {
        id: event.id,
        title: event.title,
        description: event.description ?? '',
        recurrence: event.recurrence,
        date: event.date ?? '',
        weekday: event.weekday ?? 1,
        startTime: event.startTime,
        endTime: event.endTime ?? '',
        isActive: event.isActive,
        isPast: event.isPast === true
    };
}

/** How many entries count against the agenda ceiling: every one that is not past. */
export function countCurrent(list: readonly EventDraft[]): number {
    return list.filter((entry) => !entry.isPast).length;
}

/** Moves one entry of an array, returning a new array. Out-of-range is a no-op. */
export function movedBy<T>(list: readonly T[], index: number, delta: number): T[] {
    const target = index + delta;
    if (target < 0 || target >= list.length) {
        return [...list];
    }
    const next = [...list];
    const [moved] = next.splice(index, 1);
    if (moved !== undefined) {
        next.splice(target, 0, moved);
    }
    return next;
}

/**
 * Today in the venue's zone, `YYYY-MM-DD`. Used as the `min` of the date input
 * of an entry that has no id: a hint only, the API is the one that refuses a
 * new event dated in the past.
 *
 * @returns The day.
 */
export function todayInVenueZone(): string {
    return getVenueEventZonedNow({ now: new Date() }).date;
}

/**
 * Turns a refused save (HTTP 400) into the specific sentence the owner needs.
 *
 * The API answers with stable i18n keys in `error.message`; anything else is not
 * ours to explain and yields `null` (the caller falls back to the generic error).
 * For a new event dated in the past the offending titles are listed, found with
 * the browser clock: good enough to point at the entry, never used to decide.
 *
 * @param input - `{ message, entries, t }`.
 * @returns The message, or `null` when the error is not one of ours.
 */
export function describeAgendaSaveError(input: {
    readonly message: string | undefined;
    readonly entries: readonly EventDraft[];
    readonly t: TranslationFn;
}): string | null {
    const { message, entries, t } = input;
    if (!message) {
        return null;
    }
    if (message.includes('zodError.venue.events.newPast')) {
        const now = new Date();
        const titles = entries
            .filter(
                (entry) =>
                    !entry.id &&
                    entry.recurrence === 'once' &&
                    entry.date.length > 0 &&
                    isVenueEventPast({
                        event: {
                            recurrence: 'once',
                            date: entry.date,
                            startTime: entry.startTime,
                            endTime: entry.endTime || null
                        },
                        now
                    })
            )
            .map((entry) => entry.title.trim())
            .filter((title) => title.length > 0);
        const base = t(
            'venue.owner.editor.venueEventsManager.errorNewPast',
            'No se puede crear un evento con fecha pasada'
        );
        return titles.length > 0 ? `${base}: ${titles.join(', ')}` : base;
    }
    if (message.includes('zodError.venue.events.maxTotal')) {
        return t(
            'venue.owner.editor.venueEventsManager.errorMaxTotal',
            'La agenda no puede tener más de {{max}} eventos en total',
            { max: VENUE_EVENTS_MAX_TOTAL_ENTRIES }
        );
    }
    if (message.includes('zodError.venue.events.max')) {
        return t(
            'venue.owner.editor.venueEventsManager.errorMaxCurrent',
            'La agenda no puede tener más de {{max}} eventos',
            {
                max: VENUE_EVENTS_MAX_ENTRIES
            }
        );
    }
    return null;
}
