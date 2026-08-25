import { z } from 'zod';
import { I18nTextSchema } from './i18n.schema.js';

// ============================================================================
// HH:mm time string — matches 00:00 through 23:59.
// ============================================================================

/** Pattern for a 24-hour time string in HH:mm format. */
const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Zod schema for a 24-hour time string in HH:mm format.
 * Accepts values from "00:00" to "23:59".
 *
 * @example
 * HHmmSchema.parse("09:30")  // ok
 * HHmmSchema.parse("24:00")  // throws
 */
export const HHmmSchema = z
    .string()
    .regex(HH_MM_REGEX, { message: 'zodError.common.openingHours.shift.invalidTime' });

// ============================================================================
// Shift — a single open/close time window within a day.
// ============================================================================

/**
 * A single operating-hours shift: an open time and a close time in HH:mm format.
 *
 * ## `close` BEFORE `open` means the shift crosses midnight (HOS-813)
 *
 * This schema used to require `close > open`, which made a night shift
 * unrepresentable: a bar, a brewery or a parrilla that works 22:00—02:00 was
 * rejected, and so were the nocturnal bird-watching, dawn fishing and sunrise
 * boat trips on the experiences side. That is the working schedule of a whole
 * category of listing, not an edge case.
 *
 * So the ordering rule is gone and `close < open` is now MEANINGFUL: the window
 * runs from `open` on the given day to `close` on the NEXT day. The data model
 * is unchanged — still two plain `HH:mm` strings, no day offset, no duration —
 * because the wrap is derivable from the pair alone, and every consumer that
 * needs it already derives it (see `computeOpenNowStatus` in
 * `apps/web/src/lib/gastronomy-hours.ts`, which has handled the wrap since
 * SPEC-239).
 *
 * The ONE remaining rule is `close !== open`, kept because that pair is
 * genuinely ambiguous — it reads equally as a zero-length shift and as a 24-hour
 * one, and nothing in the value says which. A venue open around the clock is
 * expressed as `00:00—23:59`.
 *
 * @example
 * ShiftSchema.parse({ open: "09:00", close: "18:00" }) // ok — same-day
 * ShiftSchema.parse({ open: "22:00", close: "02:00" }) // ok — crosses midnight
 * ShiftSchema.parse({ open: "10:00", close: "10:00" }) // throws — ambiguous
 */
export const ShiftSchema = z
    .object({
        /**
         * Opening time in HH:mm (24-hour) format.
         * @example "09:00"
         */
        open: HHmmSchema,
        /**
         * Closing time in HH:mm (24-hour) format.
         *
         * May be EARLIER than `open`, which means the shift runs past midnight
         * into the following day. It may not be EQUAL to `open` (see the schema
         * doc for why that pair is rejected).
         *
         * @example "18:00"
         * @example "02:00" // open "22:00" — closes at 2am the next day
         */
        close: HHmmSchema
    })
    .refine(
        (shift) => {
            // Both are zero-padded HH:mm, so string equality is time equality.
            return shift.close !== shift.open;
        },
        {
            message: 'zodError.common.openingHours.shift.sameOpenAndClose',
            path: ['close']
        }
    );

export type Shift = z.infer<typeof ShiftSchema>;

// ============================================================================
// DaySchedule — the schedule for a single day of the week.
// ============================================================================

/**
 * Operating schedule for a single day.
 * A day can be marked as closed (no service), or carry one or more shifts.
 *
 * @example
 * // Open with two shifts
 * { closed: false, shifts: [{ open: "09:00", close: "13:00" }, { open: "17:00", close: "22:00" }] }
 *
 * @example
 * // Closed
 * { closed: true, shifts: [] }
 */
export const DayScheduleSchema = z.object({
    /**
     * Whether the venue is closed on this day.
     * Defaults to `false` (open).
     */
    closed: z.boolean().default(false),
    /**
     * Operating shifts for this day.
     * An empty array means no defined shifts (e.g. venue is closed or open 24h with no slots).
     */
    shifts: z.array(ShiftSchema)
});

export type DaySchedule = z.infer<typeof DayScheduleSchema>;

// ============================================================================
// OpeningHoursSchema — full weekly opening-hours block.
// ============================================================================

/**
 * Full weekly opening-hours schema for a commerce listing.
 *
 * Contains a schedule object with seven day keys (`mon` through `sun`),
 * each following {@link DayScheduleSchema}. Optional timezone, notes, and
 * localized notes fields are also included.
 *
 * The semantic default timezone is `America/Argentina/Buenos_Aires` when not
 * specified by the consumer.
 *
 * @example
 * ```ts
 * const hours: OpeningHours = {
 *   timezone: "America/Argentina/Buenos_Aires",
 *   days: {
 *     mon: { closed: false, shifts: [{ open: "09:00", close: "22:00" }] },
 *     tue: { closed: false, shifts: [{ open: "09:00", close: "22:00" }] },
 *     wed: { closed: false, shifts: [{ open: "09:00", close: "22:00" }] },
 *     thu: { closed: false, shifts: [{ open: "09:00", close: "22:00" }] },
 *     fri: { closed: false, shifts: [{ open: "09:00", close: "23:00" }] },
 *     sat: { closed: false, shifts: [{ open: "10:00", close: "23:00" }] },
 *     sun: { closed: true, shifts: [] },
 *   }
 * };
 * ```
 */
export const OpeningHoursSchema = z.object({
    /**
     * IANA timezone identifier for interpreting the opening hours.
     * Defaults to `"America/Argentina/Buenos_Aires"` when omitted.
     */
    timezone: z.string().default('America/Argentina/Buenos_Aires'),

    /** Weekly schedule, keyed by ISO day abbreviation (mon–sun). */
    days: z.object({
        mon: DayScheduleSchema,
        tue: DayScheduleSchema,
        wed: DayScheduleSchema,
        thu: DayScheduleSchema,
        fri: DayScheduleSchema,
        sat: DayScheduleSchema,
        sun: DayScheduleSchema
    }),

    /**
     * Optional free-text notes about opening hours (e.g. "Closed on holidays").
     * Plain-text; use `notesI18n` for multi-locale notes.
     */
    notes: z.string().optional(),

    /**
     * Localized opening-hours notes in Spanish, English, and Portuguese.
     * Optional — only populated when multi-language notes are provided.
     */
    notesI18n: I18nTextSchema.optional()
});

export type OpeningHours = z.infer<typeof OpeningHoursSchema>;

// ============================================================================
// OpeningHoursFields — spread const for use in entity schemas.
// ============================================================================

/**
 * Spread const containing the `openingHours` field definition.
 * Use this to compose {@link OpeningHoursSchema} into entity schemas:
 *
 * @example
 * ```ts
 * const GastronomySchema = z.object({
 *   id: z.string().uuid(),
 *   name: z.string(),
 *   ...OpeningHoursFields,
 * });
 * ```
 */
export const OpeningHoursFields = {
    /**
     * Weekly operating hours for this commerce listing.
     * Uses `.nullish()` (not just `.optional()`) because Drizzle/pg returns
     * `null` for unset JSONB columns — Zod `.optional()` only accepts `undefined`.
     * SPEC-240: discovered via smoke test (T-039) when public endpoint returned 500.
     */
    openingHours: OpeningHoursSchema.nullish()
} as const;
