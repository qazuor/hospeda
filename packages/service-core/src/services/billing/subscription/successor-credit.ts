import { addCalendarMonths } from '@repo/utils';
import { z } from 'zod';
import { scheduleSuccessorFirstCharge } from './start-succession.service.js';

const cycleSchema = z.enum(['monthly', 'quarterly', 'semiannual', 'annual']);
const creditInputSchema = z.strictObject({
    paidAmountMinor: z.number().int().nonnegative(),
    periodStart: z.date(),
    periodEnd: z.date(),
    now: z.date(),
    targetAmountMinor: z.number().int().positive(),
    targetCycle: cycleSchema
});
const scheduleInputSchema = z.strictObject({
    authorizationWindowEndsAt: z.date(),
    bornAt: z.date(),
    creditDays: z.number().int().nonnegative()
});
const DAY_MS = 24 * 60 * 60 * 1000;

/** The integer credit consumed by a successor under DEC-SUB-006(c), implication 6, AC:B8b:7. */
export interface SuccessorCredit {
    readonly creditDays: number;
    readonly unusedMinor: number;
}

/** Computes value credit with integer ratios and rounds days up so no paid value is lost. */
export function computeSuccessorCreditDays(
    input: z.input<typeof creditInputSchema>
): SuccessorCredit {
    const value = creditInputSchema.parse(input);
    const periodMs = value.periodEnd.getTime() - value.periodStart.getTime();
    if (periodMs <= 0) throw new RangeError('Covered period must have positive duration');
    const remainingMs = Math.max(
        0,
        Math.min(periodMs, value.periodEnd.getTime() - value.now.getTime())
    );
    const months = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[value.targetCycle];
    const targetEnd = addCalendarMonths({ from: value.now, months, dayOverflow: 'clamp' });
    const targetMs = targetEnd.getTime() - value.now.getTime();
    if (targetMs <= 0) throw new RangeError('Target cycle must have positive duration');
    const ceilRatio = (numerator: bigint, denominator: bigint): bigint =>
        (numerator + denominator - 1n) / denominator;
    const unusedMinor = Number(
        ceilRatio(BigInt(value.paidAmountMinor) * BigInt(remainingMs), BigInt(periodMs))
    );
    const creditDays = Number(
        ceilRatio(
            BigInt(value.paidAmountMinor) * BigInt(remainingMs) * BigInt(targetMs),
            BigInt(periodMs) * BigInt(value.targetAmountMinor) * BigInt(DAY_MS)
        )
    );
    if (!Number.isSafeInteger(unusedMinor) || !Number.isSafeInteger(creditDays))
        throw new RangeError('Successor credit exceeds the safe integer range');
    return { creditDays, unusedMinor };
}

/** Schedules the first charge after the B3 window or DEC-SUB-006 value credit, whichever is later. */
export function scheduleSuccessorFirstChargeWithCredit(
    input: z.input<typeof scheduleInputSchema>
): {
    readonly firstChargeAt: Date;
} {
    const value = scheduleInputSchema.parse(input);
    const defaultAt = scheduleSuccessorFirstCharge({
        authorizationWindowEndsAt: value.authorizationWindowEndsAt
    }).firstChargeAt;
    const creditAt = new Date(value.bornAt.getTime() + value.creditDays * DAY_MS);
    return { firstChargeAt: new Date(Math.max(defaultAt.getTime(), creditAt.getTime())) };
}
