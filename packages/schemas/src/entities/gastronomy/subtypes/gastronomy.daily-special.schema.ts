/**
 * Gastronomy daily-special schemas — the menú del día (HOS-1041).
 *
 * ## What separates this from the carta
 *
 * `gastronomy.menu.schema.ts` models the venue's PERMANENT menu — what it
 * cooks, all year. This models what it is cooking TODAY, and the difference is
 * entirely the validity window: a dish here names the days it is on offer and
 * stops being published when they pass, with nobody taking it down.
 *
 * That expiry is the reason the feature exists. Announcing the plato del día by
 * editing the listing's description already works; what does not work is
 * remembering to remove it, which is why listings carry last Tuesday's fish in
 * April. A field that rots in public is worse than no field.
 *
 * ## The window
 *
 * `validFrom` and `validUntil` are INCLUSIVE calendar dates (`YYYY-MM-DD`), so
 * a special offered only today has both set to today. Half-open windows are
 * where every off-by-one in this repo's date handling has come from, and the
 * owner-facing question ("hasta cuándo lo ofrecés") has an inclusive answer.
 *
 * The day they are compared against is resolved in the AR market timezone, not
 * UTC — see `gastronomy_daily_special.dbschema.ts` for why that matters at
 * 21:00 on a Friday.
 *
 * @module entities/gastronomy/subtypes/gastronomy.daily-special.schema
 */
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Limits
// ----------------------------------------------------------------------------

/**
 * How many specials one listing may publish in a single submission.
 *
 * A menú del día is often more than one plate — entrada, principal and postre
 * is the ordinary shape — so the cap is not one. It is small because this is
 * the DAY's offer, not a second carta: a venue typing twenty rows here is
 * describing its permanent menu and belongs in
 * `GastronomyMenuReplacePayloadSchema`.
 *
 * A ceiling, not a product tier. The tier decision (`gastronomy-pro` and above)
 * is an ENTITLEMENT, checked at the route — the same split the carta makes.
 */
export const GASTRONOMY_DAILY_SPECIALS_MAX = 10;

/**
 * The highest price a special may carry, in centavos (ARS 1.000.000).
 *
 * Same bound and same reason as the carta's
 * `GASTRONOMY_MENU_MAX_ITEM_PRICE_CENTS`: an integer of centavos typed by a
 * person, where a slipped decimal point is three orders of magnitude and
 * nothing else stands between the keyboard and the public page.
 */
export const GASTRONOMY_DAILY_SPECIAL_MAX_PRICE_CENTS = 100_000_000;

/**
 * The longest window a single special may span, in days (inclusive of both
 * ends).
 *
 * Thirty-one days, so "todo el mes" is expressible and "todo el año" is not.
 * The cap is what keeps the feature honest: a window long enough to outlive
 * anyone's memory of setting it is the rotting free-text field this replaces,
 * wearing an expiry date it will never reach.
 */
export const GASTRONOMY_DAILY_SPECIAL_MAX_WINDOW_DAYS = 31;

// ----------------------------------------------------------------------------
// Calendar-date primitive
// ----------------------------------------------------------------------------

/**
 * A bare `YYYY-MM-DD`, the shape a Postgres `date` column travels in.
 *
 * Deliberately NOT `z.coerce.date()`. These name a DAY, and coercing to a
 * `Date` re-introduces the instant — and with it the ambient timezone — that
 * `packages/utils/src/calendar-date.ts` documents as the single cause of four
 * separate off-by-one bugs in the August 2026 smoke. The value stays a string
 * from the owner's form field to the `date` column and back.
 *
 * The regex is not enough on its own: `2026-02-31` matches it. The refinement
 * rejects a day that does not exist, which every `Date` constructor would
 * otherwise roll silently forward into March.
 *
 * @param message - i18n key reported when the value is not a real calendar date.
 */
const calendarDate = (message: string) =>
    z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message })
        .refine(
            (value) => {
                const [year, month, day] = value.split('-').map(Number) as [number, number, number];
                const probe = new Date(Date.UTC(year, month - 1, day));
                return (
                    probe.getUTCFullYear() === year &&
                    probe.getUTCMonth() === month - 1 &&
                    probe.getUTCDate() === day
                );
            },
            { message }
        );

/**
 * Whole days between two `YYYY-MM-DD` values, counting both ends.
 *
 * Computed in UTC on purpose — both operands are calendar dates, so the
 * arithmetic must not depend on where the process runs.
 *
 * @param from - The earlier day.
 * @param to - The later day.
 * @returns The inclusive span, e.g. `1` when the two are the same day.
 */
const inclusiveDaySpan = (from: string, to: string): number => {
    const MS_PER_DAY = 86_400_000;
    return (
        Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY) +
        1
    );
};

// ----------------------------------------------------------------------------
// Stored row
// ----------------------------------------------------------------------------

/**
 * The two audit-author columns, spelled once and kept OUT of the public
 * projection — a diner reading today's special has no business learning the
 * UUID of whoever typed it. Same split the carta's schemas make.
 */
const DailySpecialAuthorFields = {
    /** User who created the row; `null` once that user is deleted. */
    createdById: z.string().uuid().nullish(),
    /** User who last updated the row; `null` once that user is deleted. */
    updatedById: z.string().uuid().nullish()
} as const;

/** One special, as stored. */
export const GastronomyDailySpecialSchema = z.object({
    /** Daily-special ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The listing this special belongs to. */
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** The dish, as the venue announces it. */
    title: z.string().min(1).max(150),
    /** Optional detail. */
    description: z.string().max(500).nullable(),
    /** Price in centavos, or `null` for "a consultar". */
    priceCents: z.number().int().min(0).max(GASTRONOMY_DAILY_SPECIAL_MAX_PRICE_CENTS).nullable(),
    /** First day the special is shown, inclusive. */
    validFrom: calendarDate('zodError.gastronomy.dailySpecial.validFrom.invalid'),
    /** Last day the special is shown, inclusive. */
    validUntil: calendarDate('zodError.gastronomy.dailySpecial.validUntil.invalid'),
    /** Position among the listing's specials. */
    displayOrder: z.number().int().min(0),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    ...DailySpecialAuthorFields
});
export type GastronomyDailySpecial = z.infer<typeof GastronomyDailySpecialSchema>;

/** A special as a reader sees it — the stored row minus its audit authors. */
export const GastronomyDailySpecialPublicSchema = GastronomyDailySpecialSchema.omit({
    createdById: true,
    updatedById: true
});
export type GastronomyDailySpecialPublic = z.infer<typeof GastronomyDailySpecialPublicSchema>;

// ----------------------------------------------------------------------------
// Write payload
// ----------------------------------------------------------------------------

/**
 * One special as the owner submits it.
 *
 * Carries NO id, for the reason `GastronomyMenuItemInputSchema` states: the
 * specials are written as a whole document, so a client-supplied id would be
 * one the server has to either trust or ignore, and trusting one is how a
 * caller writes into somebody else's listing.
 */
export const GastronomyDailySpecialInputSchema = z
    .object({
        /** The dish, as the venue announces it. */
        title: z
            .string()
            .trim()
            .min(1, { message: 'zodError.gastronomy.dailySpecial.title.min' })
            .max(150, { message: 'zodError.gastronomy.dailySpecial.title.max' }),
        /** Optional detail. Empty string and `null` both mean "none". */
        description: z
            .string()
            .trim()
            .max(500, { message: 'zodError.gastronomy.dailySpecial.description.max' })
            .nullish(),
        /**
         * Price in CENTAVOS — never pesos, never a float. `null` (or omitted)
         * is the honest value for "a consultar"; a zero would publish the dish
         * as free.
         */
        priceCents: z
            .number()
            .int({ message: 'zodError.gastronomy.dailySpecial.priceCents.int' })
            .min(0, { message: 'zodError.gastronomy.dailySpecial.priceCents.min' })
            .max(GASTRONOMY_DAILY_SPECIAL_MAX_PRICE_CENTS, {
                message: 'zodError.gastronomy.dailySpecial.priceCents.max'
            })
            .nullish(),
        /** First day the special is shown, inclusive. `YYYY-MM-DD`. */
        validFrom: calendarDate('zodError.gastronomy.dailySpecial.validFrom.invalid'),
        /** Last day the special is shown, inclusive. `YYYY-MM-DD`. */
        validUntil: calendarDate('zodError.gastronomy.dailySpecial.validUntil.invalid')
    })
    .superRefine((value, ctx) => {
        // A window that ends before it starts matches NOTHING, on any day. It
        // is not a special that is merely expired — it is one that can never be
        // published, and the owner would see an empty page with no explanation
        // of why. Refused at the edge rather than stored and silently ignored.
        if (value.validUntil < value.validFrom) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['validUntil'],
                message: 'zodError.gastronomy.dailySpecial.validUntil.beforeValidFrom'
            });
            return;
        }

        if (
            inclusiveDaySpan(value.validFrom, value.validUntil) >
            GASTRONOMY_DAILY_SPECIAL_MAX_WINDOW_DAYS
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['validUntil'],
                message: 'zodError.gastronomy.dailySpecial.validUntil.windowTooLong'
            });
        }
    });
export type GastronomyDailySpecialInput = z.input<typeof GastronomyDailySpecialInputSchema>;

/**
 * The whole set of specials, submitted as ONE document
 * (`PUT .../daily-specials`).
 *
 * Whole-document replace for the reason the carta gives: these are text rows
 * with nothing outside the database to orphan, and the owner edits them as one
 * thought — today's three plates, retyped together. Per-row endpoints would let
 * that half-succeed and publish a menú del día the owner never described.
 *
 * It has one property the carta's does not, and it is a happy one: because the
 * write replaces the listing's specials wholesale, last week's expired rows are
 * cleared out the next time the owner saves. Nothing accumulates.
 */
export const GastronomyDailySpecialsReplacePayloadSchema = z.object({
    /**
     * The specials, in display order. An EMPTY array is a legitimate submission
     * and means "take the menú del día down" — which is the manual escape hatch
     * beside the automatic one, for the owner who sold out at 13:00.
     */
    specials: z
        .array(GastronomyDailySpecialInputSchema)
        .max(GASTRONOMY_DAILY_SPECIALS_MAX, {
            message: 'zodError.gastronomy.dailySpecials.max'
        })
        .default([])
});
export type GastronomyDailySpecialsReplacePayload = z.input<
    typeof GastronomyDailySpecialsReplacePayloadSchema
>;

// ----------------------------------------------------------------------------
// Service input / output
// ----------------------------------------------------------------------------

/** Service input for reading a listing's specials. */
export const GastronomyDailySpecialsGetInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /**
     * When set, only the specials valid on this day are returned — the public
     * read. Omit for the OWNER's read, which must show the ones that have not
     * started yet and the ones that have already elapsed, or the editor would
     * silently drop rows the owner is in the middle of scheduling.
     */
    validOn: calendarDate('zodError.gastronomy.dailySpecial.validOn.invalid').optional()
});
export type GastronomyDailySpecialsGetInput = z.infer<typeof GastronomyDailySpecialsGetInputSchema>;

/** Service input for replacing a listing's specials. */
export const GastronomyDailySpecialsReplaceInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    specials: GastronomyDailySpecialsReplacePayloadSchema
});
export type GastronomyDailySpecialsReplaceInput = z.input<
    typeof GastronomyDailySpecialsReplaceInputSchema
>;

/** What a daily-specials read answers with. */
export const GastronomyDailySpecialsOutputSchema = z.object({
    /** The specials, ordered. Empty when the venue has published none. */
    specials: z.array(GastronomyDailySpecialPublicSchema)
});
export type GastronomyDailySpecialsOutput = z.infer<typeof GastronomyDailySpecialsOutputSchema>;
