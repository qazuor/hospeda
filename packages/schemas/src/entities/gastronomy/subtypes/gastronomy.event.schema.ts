/**
 * Gastronomy venue-event schemas — the venue's own agenda (HOS-1042).
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
 * No price, no capacity, no ticketing either. An agenda entry announces that
 * something happens; selling a seat for it is a different product.
 *
 * @module entities/gastronomy/subtypes/gastronomy.event.schema
 */
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Limits
// ----------------------------------------------------------------------------

/**
 * How many entries one venue's agenda may hold.
 *
 * A ceiling, not a product tier: the tier decision (`gastronomy-pro` and above
 * may keep an agenda at all) is an ENTITLEMENT, checked at the route. This
 * number exists so a single PUT cannot be used to write an unbounded number of
 * rows in one transaction — the same reason `GASTRONOMY_MENU_MAX_SECTIONS`
 * exists next to it.
 */
export const GASTRONOMY_EVENTS_MAX_ENTRIES = 30;

// ----------------------------------------------------------------------------
// Recurrence
// ----------------------------------------------------------------------------

/**
 * How a venue event repeats. Mirrors `gastronomy_event_recurrence_enum`.
 *
 * Declared here rather than in `enums/` for the same reason
 * `GastronomyMenuFileKindSchema` is: it describes one column of one vertical
 * and has no cross-entity consumer.
 */
export const GastronomyEventRecurrenceSchema = z.enum(['once', 'weekly'], {
    message: 'zodError.gastronomy.eventRecurrence.invalid'
});
export type GastronomyEventRecurrence = z.infer<typeof GastronomyEventRecurrenceSchema>;

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
export const GastronomyEventTimeSchema = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'zodError.gastronomy.eventTime.invalid' });

/**
 * Day of the week, `0` = Sunday … `6` = Saturday.
 *
 * Sunday-based to match JavaScript's `Date#getDay()`, which is what every
 * consumer computing "is it on today" already holds. Any other basis would need
 * a map at both ends, and the two maps would be free to disagree.
 */
export const GastronomyEventWeekdaySchema = z
    .number()
    .int({ message: 'zodError.gastronomy.eventWeekday.int' })
    .min(0, { message: 'zodError.gastronomy.eventWeekday.range' })
    .max(6, { message: 'zodError.gastronomy.eventWeekday.range' });

/**
 * The calendar day of a `once` event, as `YYYY-MM-DD`.
 *
 * A plain date string, never a `Date` and never an ISO instant. "Friday the
 * 12th" at a restaurant in Concepción del Uruguay is a local calendar day; run
 * it through a timezone and it becomes Thursday the 11th somewhere, which is
 * the `toISOString()` shift this repo has been bitten by before.
 */
export const GastronomyEventDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'zodError.gastronomy.eventDate.invalid' });

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
export const GastronomyEventSchema = z.object({
    /** Event ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The listing this entry belongs to. */
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** What the event is called. */
    title: z.string().min(1).max(150),
    /** Optional blurb. */
    description: z.string().max(500).nullable(),
    /** Whether this entry repeats. */
    recurrence: GastronomyEventRecurrenceSchema,
    /** The calendar day, for a `once` entry; `null` for a `weekly` one. */
    date: GastronomyEventDateSchema.nullable(),
    /** The weekday, for a `weekly` entry; `null` for a `once` one. */
    weekday: GastronomyEventWeekdaySchema.nullable(),
    /** When it starts, local venue time. */
    startTime: GastronomyEventTimeSchema,
    /** When it ends, or `null` when the venue does not say. */
    endTime: GastronomyEventTimeSchema.nullable(),
    /** Whether the entry is currently shown. */
    isActive: z.boolean(),
    /** Position within the agenda. */
    displayOrder: z.number().int().min(0),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    ...EventAuthorFields
});
export type GastronomyEvent = z.infer<typeof GastronomyEventSchema>;

/** An agenda entry as a reader sees it — the stored row minus its audit authors. */
export const GastronomyEventPublicSchema = GastronomyEventSchema.omit({
    createdById: true,
    updatedById: true
});
export type GastronomyEventPublic = z.infer<typeof GastronomyEventPublicSchema>;

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
        recurrence: GastronomyEventRecurrence;
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
                message: 'zodError.gastronomy.event.dateRequiredForOnce'
            });
        }
        if (value.weekday !== undefined && value.weekday !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['weekday'],
                message: 'zodError.gastronomy.event.weekdayForbiddenForOnce'
            });
        }
    } else {
        if (value.weekday === undefined || value.weekday === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['weekday'],
                message: 'zodError.gastronomy.event.weekdayRequiredForWeekly'
            });
        }
        if (value.date !== undefined && value.date !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['date'],
                message: 'zodError.gastronomy.event.dateForbiddenForWeekly'
            });
        }
    }

    // An end BEFORE the start is rejected; an end EQUAL to the start is too,
    // since a zero-length event is not a thing a venue announces. An end that
    // is simply earlier in the clock — "22:00 a 02:00" — is a real and common
    // announcement, so it is NOT rejected here: see the note on
    // `GastronomyEventInputSchema` for why this only catches the same-day case.
    if (
        value.endTime !== undefined &&
        value.endTime !== null &&
        value.endTime === value.startTime
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endTime'],
            message: 'zodError.gastronomy.event.endTimeEqualsStart'
        });
    }
}

/**
 * One agenda entry as the owner submits it.
 *
 * Carries NO id. The agenda is written as a whole document (see
 * {@link GastronomyEventsReplacePayloadSchema}), so an id supplied by the
 * client would be an id the server has to either trust or ignore — and trusting
 * one is how a caller writes an event into somebody else's listing. Same
 * reasoning `GastronomyMenuItemInputSchema` states.
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
export const GastronomyEventInputSchema = z
    .object({
        /** What the event is called. */
        title: z
            .string()
            .trim()
            .min(1, { message: 'zodError.gastronomy.event.title.min' })
            .max(150, { message: 'zodError.gastronomy.event.title.max' }),
        /** Optional blurb. Empty string and `null` both mean "none". */
        description: z
            .string()
            .trim()
            .max(500, { message: 'zodError.gastronomy.event.description.max' })
            .nullish(),
        /** Whether this entry repeats. */
        recurrence: GastronomyEventRecurrenceSchema,
        /** Required when `recurrence` is `once`, forbidden otherwise. */
        date: GastronomyEventDateSchema.nullish(),
        /** Required when `recurrence` is `weekly`, forbidden otherwise. */
        weekday: GastronomyEventWeekdaySchema.nullish(),
        /** When it starts, local venue time. */
        startTime: GastronomyEventTimeSchema,
        /** When it ends, or omitted when the venue does not say. */
        endTime: GastronomyEventTimeSchema.nullish(),
        /** Whether the entry is shown. Defaults to `true`. */
        isActive: z.boolean().default(true)
    })
    .superRefine(refineRecurrenceShape);
export type GastronomyEventInput = z.input<typeof GastronomyEventInputSchema>;

/**
 * The whole agenda, submitted as ONE document (`PUT .../events`).
 *
 * Replace-the-document rather than per-row endpoints, for the reason
 * {@link GastronomyMenuReplacePayloadSchema} spells out at length and which
 * applies here unchanged: nothing outside the database is created by an agenda
 * entry, so nothing can be orphaned by a save that never happens; and reordering
 * three entries while deleting a fourth is ONE thought, which as one document is
 * ONE transaction and as four requests is four ways to half-succeed.
 */
export const GastronomyEventsReplacePayloadSchema = z.object({
    /**
     * The entries, in order. An EMPTY array is a legitimate submission and
     * means "take the agenda down" — a venue that stopped doing live music
     * needs a way to say so.
     */
    events: z
        .array(GastronomyEventInputSchema)
        .max(GASTRONOMY_EVENTS_MAX_ENTRIES, {
            message: 'zodError.gastronomy.events.max'
        })
        .default([])
});
export type GastronomyEventsReplacePayload = z.input<typeof GastronomyEventsReplacePayloadSchema>;

// ----------------------------------------------------------------------------
// Service input / output
// ----------------------------------------------------------------------------

/** Service input for reading a listing's agenda. */
export const GastronomyEventsGetInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});
export type GastronomyEventsGetInput = z.infer<typeof GastronomyEventsGetInputSchema>;

/** Service input for replacing a listing's agenda. */
export const GastronomyEventsReplaceInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    agenda: GastronomyEventsReplacePayloadSchema
});
export type GastronomyEventsReplaceInput = z.input<typeof GastronomyEventsReplaceInputSchema>;

/**
 * What an agenda read answers with.
 *
 * An object with one array rather than a bare array: the menu read learned the
 * hard way that a payload which is literally a list cannot grow a sibling field
 * later without breaking every consumer that indexed into it.
 */
export const GastronomyEventsOutputSchema = z.object({
    /** The agenda, ordered by `displayOrder`. Empty when the venue has none. */
    events: z.array(GastronomyEventPublicSchema)
});
export type GastronomyEventsOutput = z.infer<typeof GastronomyEventsOutputSchema>;
