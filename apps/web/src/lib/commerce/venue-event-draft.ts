/**
 * @file venue-event-draft.ts
 * @description Shared draft shape for the venue-agenda editor (HOS-1042).
 *
 * Split out of `CommerceVenueEventsManager.client.tsx` so
 * `CommerceVenueEventEntryCard.client.tsx` can import the SAME type rather
 * than a hand-copied twin — the two files together implement one form, and a
 * duplicated `EventDraft` is exactly the kind of drift that lets one file's
 * edit silently stop matching the other's.
 */

/**
 * One agenda entry, as held in form state. Ids are not carried — see
 * `GastronomyEventInputSchema`'s doc for why: the whole list is re-submitted
 * as a document, so a client-supplied id would be one the server has to
 * either trust or ignore.
 */
export interface EventDraft {
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
 * `GastronomyEventWeekdaySchema`. The labels themselves are NOT duplicated
 * here — both consumers reuse `gastronomy.detail.openingHours.<day>`, the
 * same keys the public opening-hours section and `GastronomyVenueEvents.astro`
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
