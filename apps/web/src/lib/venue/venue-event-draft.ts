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
