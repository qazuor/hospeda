/**
 * Unit tests for the menú del día's write payload (HOS-1041).
 *
 * The window is the whole feature, so these concentrate on it: the shape of a
 * calendar date, the two ways a window can be nonsense, and the cases that look
 * like edge cases and are actually the ordinary ones (a special valid for
 * exactly today).
 */

import { describe, expect, it } from 'vitest';
import {
    GASTRONOMY_DAILY_SPECIAL_MAX_WINDOW_DAYS,
    GASTRONOMY_DAILY_SPECIALS_MAX,
    GastronomyDailySpecialInputSchema,
    GastronomyDailySpecialsReplacePayloadSchema
} from '../subtypes/gastronomy.daily-special.schema.js';

/** A valid special, spread-and-overridden per case. */
const base = {
    title: 'Milanesa a la napolitana con puré',
    validFrom: '2026-09-03',
    validUntil: '2026-09-03'
};

describe('GastronomyDailySpecialInputSchema — the window', () => {
    it('accepts a one-day special, both bounds on the same date', () => {
        // The DEFINING case, not an edge one: "menú del día" means today, and
        // an inclusive window expresses that as from === until. A half-open
        // window would need `until` to be tomorrow, and this assertion is what
        // stops someone changing it to one.
        const result = GastronomyDailySpecialInputSchema.safeParse(base);

        expect(result.success).toBe(true);
    });

    it('accepts a multi-day window', () => {
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            validFrom: '2026-09-03',
            validUntil: '2026-09-10'
        });

        expect(result.success).toBe(true);
    });

    it('rejects a window that ends before it starts', () => {
        // Such a row matches NOTHING on any day, so it would be stored,
        // published to nobody, and leave the owner with an empty public page
        // and no explanation. Refused at the edge instead.
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            validFrom: '2026-09-10',
            validUntil: '2026-09-03'
        });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
            'zodError.gastronomy.dailySpecial.validUntil.beforeValidFrom'
        );
    });

    it('accepts a window exactly at the maximum length', () => {
        // 31 inclusive days: 1 Sep through 1 Oct is 31 days counting both ends.
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            validFrom: '2026-09-01',
            validUntil: '2026-10-01'
        });

        expect(GASTRONOMY_DAILY_SPECIAL_MAX_WINDOW_DAYS).toBe(31);
        expect(result.success).toBe(true);
    });

    it('rejects a window one day past the maximum', () => {
        // The boundary is asserted from BOTH sides — a cap tested only from the
        // rejecting side passes just as happily when it is off by one.
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            validFrom: '2026-09-01',
            validUntil: '2026-10-02'
        });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
            'zodError.gastronomy.dailySpecial.validUntil.windowTooLong'
        );
    });

    it('rejects a date that is not a real day', () => {
        // `2026-02-31` matches the regex. Every `Date` constructor rolls it
        // silently forward into March, which would publish a special on a day
        // the owner never chose.
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            validFrom: '2026-02-31',
            validUntil: '2026-02-31'
        });

        expect(result.success).toBe(false);
    });

    it('rejects a date that is not YYYY-MM-DD', () => {
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            validFrom: '03/09/2026',
            validUntil: '03/09/2026'
        });

        expect(result.success).toBe(false);
    });

    it('rejects a full ISO instant, keeping the value a calendar date', () => {
        // Accepting an instant is how the ambient timezone gets back into a
        // value that names a day — the bug `packages/utils/src/calendar-date.ts`
        // documents four times over.
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            validFrom: '2026-09-03T00:00:00.000Z',
            validUntil: '2026-09-03T00:00:00.000Z'
        });

        expect(result.success).toBe(false);
    });

    it('requires both bounds — a special with no expiry is the bug this replaces', () => {
        const noUntil = GastronomyDailySpecialInputSchema.safeParse({
            title: base.title,
            validFrom: '2026-09-03'
        });
        const noFrom = GastronomyDailySpecialInputSchema.safeParse({
            title: base.title,
            validUntil: '2026-09-03'
        });

        expect(noUntil.success).toBe(false);
        expect(noFrom.success).toBe(false);
    });
});

describe('GastronomyDailySpecialInputSchema — the dish', () => {
    it('keeps a zero price as zero rather than treating it as absent', () => {
        // `0` is a real price. The service uses `?? null` for exactly this
        // reason, and the schema has to let a zero through for that to matter.
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            priceCents: 0
        });

        expect(result.success).toBe(true);
        expect(result.data?.priceCents).toBe(0);
    });

    it('accepts an omitted price as "a consultar"', () => {
        const result = GastronomyDailySpecialInputSchema.safeParse(base);

        expect(result.success).toBe(true);
        expect(result.data?.priceCents ?? null).toBeNull();
    });

    it('rejects a fractional price — centavos are integers', () => {
        const result = GastronomyDailySpecialInputSchema.safeParse({
            ...base,
            priceCents: 1850.5
        });

        expect(result.success).toBe(false);
    });

    it('rejects an empty title', () => {
        const result = GastronomyDailySpecialInputSchema.safeParse({ ...base, title: '   ' });

        expect(result.success).toBe(false);
    });
});

describe('GastronomyDailySpecialsReplacePayloadSchema', () => {
    it('accepts an empty document as "take the menú del día down"', () => {
        // The manual escape hatch beside the automatic expiry, for the venue
        // that sold out at 13:00.
        const result = GastronomyDailySpecialsReplacePayloadSchema.safeParse({ specials: [] });

        expect(result.success).toBe(true);
        expect(result.data?.specials).toEqual([]);
    });

    it('accepts exactly the maximum number of specials', () => {
        const result = GastronomyDailySpecialsReplacePayloadSchema.safeParse({
            specials: Array.from({ length: GASTRONOMY_DAILY_SPECIALS_MAX }, () => ({ ...base }))
        });

        expect(result.success).toBe(true);
    });

    it('rejects one more than the maximum', () => {
        const result = GastronomyDailySpecialsReplacePayloadSchema.safeParse({
            specials: Array.from({ length: GASTRONOMY_DAILY_SPECIALS_MAX + 1 }, () => ({
                ...base
            }))
        });

        expect(result.success).toBe(false);
    });

    it('rejects the whole document when ONE special has a backwards window', () => {
        // Per-item validation has to survive being nested in the array, which
        // is not automatic if someone later swaps the item schema for a looser
        // one at the array level.
        const result = GastronomyDailySpecialsReplacePayloadSchema.safeParse({
            specials: [{ ...base }, { ...base, validFrom: '2026-09-10', validUntil: '2026-09-03' }]
        });

        expect(result.success).toBe(false);
    });
});
