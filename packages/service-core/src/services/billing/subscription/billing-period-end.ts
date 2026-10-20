import { z } from 'zod';

const inputSchema = z.strictObject({
    periodStart: z.date(),
    everyMonths: z.number().int().min(1).max(12)
});

/** Input of {@link billingPeriodEnd}. */
export interface BillingPeriodEndInput {
    /** Start of the paid period: the payment's open `covered_period.period_start` (P1 wrote it). */
    readonly periodStart: Date;
    /** The authorization's cadence, reread by id (`AuthorizationSnapshot.cadence.everyMonths`). */
    readonly everyMonths: number;
}

/** Output of {@link billingPeriodEnd}. */
export interface BillingPeriodEndResult {
    /** The end of the paid period: the service end S7 writes on `CANCEL_SCHEDULED`. */
    readonly periodEnd: Date;
}

/**
 * The end of a paid billing period (HOS-1560, H2): `periodStart` plus `everyMonths`
 * calendar months, computed in UTC, with the day of month clamped to the last day
 * of the target month (31 Jan + 1 → 28/29 Feb). The time of day is kept.
 *
 * UTC on purpose: every `timestamp` column is `timestamptz`, so local-time month
 * arithmetic would ask a UTC instant what month it is somewhere else
 * (`check:local-date-math`).
 *
 * @param input.periodStart - Start of the paid period
 * @param input.everyMonths - Months per billing cycle (1..12)
 * @returns The instant the paid period ends
 */
export function billingPeriodEnd(input: BillingPeriodEndInput): BillingPeriodEndResult {
    const { periodStart, everyMonths } = inputSchema.parse(input);
    const end = new Date(periodStart.getTime());
    // Day 1 first, so moving the month never overflows into the next one.
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + everyMonths);
    const lastDayOfTarget = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)
    ).getUTCDate();
    end.setUTCDate(Math.min(periodStart.getUTCDate(), lastDayOfTarget));
    return { periodEnd: end };
}
