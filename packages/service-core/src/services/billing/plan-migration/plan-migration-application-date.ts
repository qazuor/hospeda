import { BILLING_CYCLE_MONTHS, type BillingCycle } from '@repo/schemas';
import { addCalendarMonths, getLocalDateString } from '@repo/utils';

function shiftedLocalDay(day: string, days: number): string {
    const value = new Date(`${day}T12:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

/** First local charge day strictly after the completed notice, including annual cycles. */
export function computeApplicationDate(args: {
    readonly nextChargeAt: Date | null;
    readonly cycle: BillingCycle;
    readonly announcedAt: Date;
    readonly noticeDays: number;
}): string {
    const deadline = shiftedLocalDay(
        getLocalDateString({ instant: args.announcedAt }),
        args.noticeDays
    );
    if (!args.nextChargeAt) return shiftedLocalDay(deadline, 1);
    let candidate = args.nextChargeAt;
    while (getLocalDateString({ instant: candidate }) <= deadline) {
        candidate = addCalendarMonths({
            from: candidate,
            months: BILLING_CYCLE_MONTHS[args.cycle],
            dayOverflow: 'clamp'
        });
    }
    return getLocalDateString({ instant: candidate });
}
