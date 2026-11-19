/**
 * venue venue-event schemas — the venue's own agenda (HOS-1042).
 *
 * Live music night, happy hour, dinner show, the Tuesday deal. Things that
 * happen AT the venue and that a diner may show up for.
 *
 * ## Recurrence is two shapes, on purpose
 *
 * The owner decision (2026-09-01) was explicit that «todos los jueves» is
 * enough and an iCal RRULE engine is not. So an entry is either:
 *
 * | `recurrence` | carries | means |
 * |---|---|---|
 * | `once` | `date` | it happens on that calendar day and then it is over |
 * | `weekly` | `weekday` | it happens that weekday, every week, until turned off |
 *
 * **Exactly one of the two fields is present, and the schema is what enforces
 * that.** A `once` entry with a `weekday` and no `date` is not a slightly-wrong
 * event — it is an event nobody can render, because there is no day to put it
 * on. So the refinement below rejects it rather than letting a nullable pair
 * reach the database and become the renderer's problem. The database carries no
 * CHECK for this (cross-column constraints belong to the extras carril) because
 * there is exactly one writer and it parses this schema first.
 *
 * ## What is deliberately absent
 *
 * No monthly, no biweekly, no daily, no end date, no exception list, no
 * multi-day set. Each is a branch in the "when does this next happen"
 * computation the public page runs on every render, and none is what the issue
 * asks for. A restaurant whose happy hour runs Monday to Friday writes five
 * entries today; making that one entry is a follow-up, and it is an added enum
 * value plus a branch, not a rewrite.
 *
 * No price and no capacity. The only ticketing it knows is an optional external
 * link (`ticketUrl`, HOS-2255) to wherever the venue already sells entries;
 * selling a seat here is a different product.
 *
 * @module entities/venue/subtypes/venue.event.schema
 */
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Limits
// ----------------------------------------------------------------------------

/**
 * How many entries one venue's agenda may hold.
 *
 * A ceiling, not a product tier: the tier decision (`venue-pro` and above
 * may keep an agenda at all) is an ENTITLEMENT, checked at the route. This
 * number exists so a single PUT cannot be used to write an unbounded number of
 * rows in one transaction — the same reason `venue_MENU_MAX_SECTIONS`
 * exists next to it.
 */
export const VENUE_EVENTS_MAX_ENTRIES = 30;

/**
 * Hard ceiling on the WHOLE document, past entries included (HOS-2254).
 *
 * `VENUE_EVENTS_MAX_ENTRIES` counts only entries that are not past, and the
 * schema cannot tell them apart (it does not know the time). This bound keeps
 * one PUT from writing an unbounded number of rows and stays well below the
 * page size the agenda read uses, so a stored agenda can always be read back.
 */
export const VENUE_EVENTS_MAX_TOTAL_ENTRIES = 100;

// ----------------------------------------------------------------------------
// Recurrence
// ----------------------------------------------------------------------------

/**
 * How a venue event repeats. Mirrors `venue_event_recurrence_enum`.
 *
 * Declared here rather than in `enums/` for the same reason
 * `venueMenuFileKindSchema` is: it describes one column of one vertical
 * and has no cross-entity consumer.
 */
export const VenueEventRecurrenceSchema = z.enum(['once', 'weekly'], {
    message: 'zodError.venue.eventRecurrence.invalid'
});
export type VenueEventRecurrence = z.infer<typeof VenueEventRecurrenceSchema>;

/**
 * `HH:MM` in 24-hour local venue time, the shape Postgres `time` round-trips.
 *
 * A string and not a number of minutes: the owner types a clock time, the page
 * prints a clock time, and the column stores a clock time. A minutes-since-
 * midnight integer would be three conversions in service of nothing.
 *
 * Seconds are rejected rather than trimmed. `18:00:00` and `18:00` would be the
 * same instant but two different strings, and a field that accepts both is a
 * field whose equality checks are wrong somewhere downstream.
 */
export const VenueEventTimeSchema = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'zodError.venue.eventTime.invalid' });

/**
 * Day of the week, `0` = Sunday … `6` = Saturday.
 *
 * Sunday-based to match JavaScript's `Date#getDay()`, which is what every
 * consumer computing "is it on today" already holds. Any other basis would need
 * a map at both ends, and the two maps would be free to disagree.
 */
export const VenueEventWeekdaySchema = z
    .number()
    .int({ message: 'zodError.venue.eventWeekday.int' })
    .min(0, { message: 'zodError.venue.eventWeekday.range' })
    .max(6, { message: 'zodError.venue.eventWeekday.range' });

/**
 * The calendar day of a `once` event, as `YYYY-MM-DD`.
 *
 * A plain date string, never a `Date` and never an ISO instant. "Friday the
 * 12th" at a restaurant in Concepción del Uruguay is a local calendar day; run
 * it through a timezone and it becomes Thursday the 11th somewhere, which is
 * the `toISOString()` shift this repo has been bitten by before.
 */
export const VenueEventDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'zodError.venue.eventDate.invalid' });

// ----------------------------------------------------------------------------
// Ticket link
// ----------------------------------------------------------------------------

/**
 * The external «Comprar entrada» link of an event (HOS-2255).
 *
 * Any `https` URL, no allow-list of ticket sellers (owner decision, 2026-11-16),
 * and no credentials in it. `http` is refused on purpose: the link is rendered
 * on a public page and opened by strangers. Rendering still goes through
 * `resolveSafeExternalUrl()` on the web side; this schema is the write-side half.
 */
export const VenueEventTicketUrlSchema = z
    .string()
    .trim()
    .max(2048, { message: 'zodError.venue.event.ticketUrl.max' })
    .url({ message: 'zodError.venue.event.ticketUrl.invalid' })
    .startsWith('https://', { message: 'zodError.venue.event.ticketUrl.httpsRequired' })
    .refine(
        (value) => {
            try {
                const parsed = new URL(value);
                return parsed.username === '' && parsed.password === '';
            } catch {
                return false;
            }
        },
        { message: 'zodError.venue.event.ticketUrl.credentials' }
    );

// ----------------------------------------------------------------------------
// Stored row
// ----------------------------------------------------------------------------

/**
 * The two audit-author columns, spelled once.
 *
 * Part of the STORED row and deliberately absent from the read projection
 * below: a diner reading an agenda has no business learning the UUID of whoever
 * last touched it. Same public/stored split the menu and FAQ schemas make.
 */
const EventAuthorFields = {
    /** User who created the row; `null` once that user is deleted. */
    createdById: z.string().uuid().nullish(),
    /** User who last updated the row; `null` once that user is deleted. */
    updatedById: z.string().uuid().nullish()
} as const;

/** One agenda entry, as stored. */
export const VenueEventSchema = z.object({
    /** Event ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The listing this entry belongs to. */
    venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** What the event is called. */
    title: z.string().min(1).max(150),
    /** Optional blurb. */
    description: z.string().max(500).nullable(),
    /** Whether this entry repeats. */
    recurrence: VenueEventRecurrenceSchema,
    /** The calendar day, for a `once` entry; `null` for a `weekly` one. */
    date: VenueEventDateSchema.nullable(),
    /** The weekday, for a `weekly` entry; `null` for a `once` one. */
    weekday: VenueEventWeekdaySchema.nullable(),
    /** When it starts, local venue time. */
    startTime: VenueEventTimeSchema,
    /** When it ends, or `null` when the venue does not say. */
    endTime: VenueEventTimeSchema.nullable(),
    /** External link to buy tickets, or `null` when the event has none (HOS-2255). */
    ticketUrl: VenueEventTicketUrlSchema.nullable(),
    /** Whether the entry is currently shown. */
    isActive: z.boolean(),
    /** Position within the agenda. */
    displayOrder: z.number().int().min(0),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    ...EventAuthorFields
});
export type VenueEvent = z.infer<typeof VenueEventSchema>;

/** An agenda entry as a reader sees it — the stored row minus its audit authors. */
export const VenueEventPublicSchema = VenueEventSchema.omit({
    createdById: true,
    updatedById: true
});
export type VenueEventPublic = z.infer<typeof VenueEventPublicSchema>;

// ----------------------------------------------------------------------------
// Write payload
// ----------------------------------------------------------------------------

/**
 * The refinement that makes the two recurrence shapes real.
 *
 * Applied as a `superRefine` on the input object rather than modelled as a
 * `z.discriminatedUnion`, for one practical reason: the editor sends a single
 * flat row shape and flips `recurrence` in place, so a union would make every
 * client-side partial edit — the instant after the radio is toggled and before
 * the day is chosen — fail to parse as anything at all, with no field to hang
 * the message on. A refinement reports "this field is required", which is the
 * message a person can act on.
 *
 * @param value - The submitted entry.
 * @param ctx - Zod's issue collector.
 */
function refineRecurrenceShape(
    value: {
        recurrence: VenueEventRecurrence;
        date?: string | null | undefined;
        weekday?: number | null | undefined;
        startTime: string;
        endTime?: string | null | undefined;
    },
    ctx: z.RefinementCtx
): void {
    if (value.recurrence === 'once') {
        if (value.date === undefined || value.date === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['date'],
                message: 'zodError.venue.event.dateRequiredForOnce'
            });
        }
        if (value.weekday !== undefined && value.weekday !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['weekday'],
                message: 'zodError.venue.event.weekdayForbiddenForOnce'
            });
        }
    } else {
        if (value.weekday === undefined || value.weekday === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['weekday'],
                message: 'zodError.venue.event.weekdayRequiredForWeekly'
            });
        }
        if (value.date !== undefined && value.date !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['date'],
                message: 'zodError.venue.event.dateForbiddenForWeekly'
            });
        }
    }

    // An end BEFORE the start is rejected; an end EQUAL to the start is too,
    // since a zero-length event is not a thing a venue announces. An end that
    // is simply earlier in the clock — "22:00 a 02:00" — is a real and common
    // announcement, so it is NOT rejected here: see the note on
    // `venueEventInputSchema` for why this only catches the same-day case.
    if (
        value.endTime !== undefined &&
        value.endTime !== null &&
        value.endTime === value.startTime
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endTime'],
            message: 'zodError.venue.event.endTimeEqualsStart'
        });
    }
}

/**
 * One agenda entry as the owner submits it.
 *
 * Carries an OPTIONAL `id` (HOS-2291). The agenda is still written as a whole
 * document, but an entry that already exists must keep its identity across a
 * save, because other features point at it (clicks, reminders, guest lists, a
 * featured slot). An entry WITH an `id` updates that stored event; an entry
 * WITHOUT one is created; a stored event the document no longer mentions is
 * deleted.
 *
 * The id is never trusted: the service only honours one that belongs to THIS
 * venue's stored agenda. An id of another venue, or one that does not exist,
 * answers 404 and writes nothing, so a caller cannot update or re-parent an
 * event that is not theirs.
 *
 * ## Why an end time earlier than the start is accepted
 *
 * "Cena show, de 22:00 a 02:00" is an ordinary announcement, and it is the one
 * case where `endTime < startTime` is correct rather than a typo. The
 * alternative — demanding a date on the end, or an explicit "crosses midnight"
 * flag — asks the owner to describe something they already said in the only way
 * a person says it. So the refinement rejects only `endTime === startTime`, a
 * zero-length event, which no venue means.
 */
export const VenueEventInputSchema = z
    .object({
        /**
         * Id of the stored event this entry updates. Omit it for a new entry.
         * See the note above: an id that is not one of this venue's own events
         * is refused by the service, never created or re-parented.
         */
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).optional(),
        /** What the event is called. */
        title: z
            .string()
            .trim()
            .min(1, { message: 'zodError.venue.event.title.min' })
            .max(150, { message: 'zodError.venue.event.title.max' }),
        /** Optional blurb. Empty string and `null` both mean "none". */
        description: z
            .string()
            .trim()
            .max(500, { message: 'zodError.venue.event.description.max' })
            .nullish(),
        /** Whether this entry repeats. */
        recurrence: VenueEventRecurrenceSchema,
        /** Required when `recurrence` is `once`, forbidden otherwise. */
        date: VenueEventDateSchema.nullish(),
        /** Required when `recurrence` is `weekly`, forbidden otherwise. */
        weekday: VenueEventWeekdaySchema.nullish(),
        /** When it starts, local venue time. */
        startTime: VenueEventTimeSchema,
        /** When it ends, or omitted when the venue does not say. */
        endTime: VenueEventTimeSchema.nullish(),
        /**
         * Optional external ticket link (HOS-2255). Omitted, `null` and `''` all
         * mean "none" (the service stores `NULL`); `''` is turned into `null`
         * here so the empty input of the editor is not an `https` violation.
         */
        ticketUrl: z.preprocess(
            (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
            VenueEventTicketUrlSchema.nullish()
        ),
        /** Whether the entry is shown. Defaults to `true`. */
        isActive: z.boolean().default(true)
    })
    .superRefine(refineRecurrenceShape);
export type VenueEventInput = z.input<typeof VenueEventInputSchema>;

/**
 * The whole agenda, submitted as ONE document (`PUT .../events`).
 *
 * Replace-the-document rather than per-row endpoints, for the reason
 * {@link VenueMenuReplacePayloadSchema} spells out at length and which
 * applies here unchanged: nothing outside the database is created by an agenda
 * entry, so nothing can be orphaned by a save that never happens; and reordering
 * three entries while deleting a fourth is ONE thought, which as one document is
 * ONE transaction and as four requests is four ways to half-succeed.
 */
export const VenueEventsReplacePayloadSchema = z.object({
    /**
     * The entries, in order. An EMPTY array is a legitimate submission and
     * means "take the agenda down" — a venue that stopped doing live music
     * needs a way to say so.
     */
    // The 30-entry ceiling applies to entries that are NOT past (HOS-2254): the
    // service enforces it with `partitionVenueEvents`, because the schema does
    // not know the time. This bound is only the hard cap on the whole document.
    events: z
        .array(VenueEventInputSchema)
        .max(VENUE_EVENTS_MAX_TOTAL_ENTRIES, { message: 'zodError.venue.events.maxTotal' })
        .default([])
});
export type VenueEventsReplacePayload = z.input<typeof VenueEventsReplacePayloadSchema>;

// ----------------------------------------------------------------------------
// Service input / output
// ----------------------------------------------------------------------------

/** Service input for reading a listing's agenda. */
export const VenueEventsGetInputSchema = z.object({
    venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type VenueEventsGetInput = z.infer<typeof VenueEventsGetInputSchema>;

/** Service input for replacing a listing's agenda. */
export const VenueEventsReplaceInputSchema = z.object({
    venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    agenda: VenueEventsReplacePayloadSchema
});
export type VenueEventsReplaceInput = z.input<typeof VenueEventsReplaceInputSchema>;

/**
 * What an agenda read answers with.
 *
 * An object with one array rather than a bare array: the menu read learned the
 * hard way that a payload which is literally a list cannot grow a sibling field
 * later without breaking every consumer that indexed into it.
 */
export const VenueEventsOutputSchema = z.object({
    /** The agenda, ordered by `displayOrder`. Empty when the venue has none. */
    events: z.array(VenueEventPublicSchema)
});
export type VenueEventsOutput = z.infer<typeof VenueEventsOutputSchema>;

/**
 * An agenda entry as its OWNER reads it (HOS-2254): the public shape plus the
 * calculated `isPast`. Never persisted; computed by `isVenueEventPast` on the
 * server so the editor does not depend on the browser's clock.
 */
export const VenueEventOwnerSchema = VenueEventPublicSchema.extend({
    isPast: z.boolean()
});
export type VenueEventOwner = z.infer<typeof VenueEventOwnerSchema>;

/** What the owner's agenda read and write answer with. */
export const VenueEventsOwnerOutputSchema = z.object({
    /** The agenda, ordered by `displayOrder`, past entries included. */
    events: z.array(VenueEventOwnerSchema)
});
export type VenueEventsOwnerOutput = z.infer<typeof VenueEventsOwnerOutputSchema>;
