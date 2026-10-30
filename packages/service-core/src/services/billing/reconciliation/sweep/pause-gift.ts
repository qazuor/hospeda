import { addCalendarMonths, getLocalDateString } from '@repo/utils';

function localDayNumber(date: Date): number {
    const [year, month, day] = getLocalDateString({ instant: date }).split('-').map(Number);
    return Math.floor(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / 86_400_000);
}

/**
 * Calculates the positive net days granted after a pause skips billing cycles.
 *
 * Charge dates are derived from the anchor and cycle length, while pause
 * boundaries are compared as local calendar days. Returns `null` when the
 * pause contains no skipped charge or does not yield positive gift days.
 *
 * @param input - Pause interval, anchor charge date, and billing cycle length.
 * @returns The first skipped charge, next charge after return, and gift days,
 *   or `null` when there is no positive gift.
 */
export function computePauseGift(input: {
    readonly pauseStartedAt: Date;
    readonly pauseEndedAt: Date;
    readonly anchorChargeAt: Date;
    readonly cycleMonths: number;
}): {
    readonly firstSkippedChargeAt: Date;
    readonly nextChargeAfterReturnAt: Date;
    readonly giftDays: number;
} | null {
    const anchorMonth =
        input.anchorChargeAt.getUTCFullYear() * 12 + input.anchorChargeAt.getUTCMonth();
    const startMonth =
        input.pauseStartedAt.getUTCFullYear() * 12 + input.pauseStartedAt.getUTCMonth();
    const endMonth = input.pauseEndedAt.getUTCFullYear() * 12 + input.pauseEndedAt.getUTCMonth();
    const span =
        Math.ceil(
            Math.max(Math.abs(anchorMonth - startMonth), Math.abs(anchorMonth - endMonth)) /
                input.cycleMonths
        ) + 2;
    const candidates = Array.from({ length: span * 2 + 1 }, (_, index) =>
        addCalendarMonths({
            from: input.anchorChargeAt,
            months: (index - span) * input.cycleMonths,
            dayOverflow: 'clamp'
        })
    ).sort((a, b) => a.getTime() - b.getTime());
    const start = localDayNumber(input.pauseStartedAt);
    const end = localDayNumber(input.pauseEndedAt);
    const firstSkippedChargeAt = candidates.find(
        (date) => localDayNumber(date) > start && localDayNumber(date) < end
    );
    if (!firstSkippedChargeAt) return null;
    const nextChargeAfterReturnAt = candidates.find((date) => localDayNumber(date) >= end);
    if (!nextChargeAfterReturnAt) return null;
    const giftDays =
        localDayNumber(nextChargeAfterReturnAt) -
        end -
        (localDayNumber(firstSkippedChargeAt) - start);
    return giftDays > 0 ? { firstSkippedChargeAt, nextChargeAfterReturnAt, giftDays } : null;
}
