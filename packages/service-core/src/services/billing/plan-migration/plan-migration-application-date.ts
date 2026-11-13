import { BILLING_CYCLE_MONTHS, type BillingCycle } from '@repo/schemas';
import { addCalendarMonths, getLocalDateString } from '@repo/utils';
import { z } from 'zod';

const notBeforeSchema = z.iso.date();

function shiftedLocalDay(day: string, days: number): string {
    const value = new Date(`${day}T12:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

/**
 * Resolves the application date of a plan migration: the first local charge day
 * of the `nextChargeAt` series that is strictly after the completed notice and,
 * when a floor is given, not earlier than that floor.
 *
 * HOS-2108: the stored date is a floor that only lands on a charge day. When a
 * paused subscription resumes into a different billing phase, the date the
 * customer already read may no longer be a charge day; the row then moves to the
 * first charge day that still honours the notice and is not earlier than it.
 *
 * @param args.nextChargeAt - The anchored next charge, or `null` when none is set
 * @param args.cycle - The billing cycle that advances the charge series
 * @param args.announcedAt - The instant the migration was announced
 * @param args.noticeDays - The notice length the deadline requires
 * @param args.notBefore - Optional local day (`YYYY-MM-DD`) the result cannot precede
 * @returns The application day as a local `YYYY-MM-DD`
 */
export function computeApplicationDate(args: {
    readonly nextChargeAt: Date | null;
    readonly cycle: BillingCycle;
    readonly announcedAt: Date;
    readonly noticeDays: number;
    readonly notBefore?: string;
}): string {
    const deadline = shiftedLocalDay(
        getLocalDateString({ instant: args.announcedAt }),
        args.noticeDays
    );
    const notBefore = args.notBefore === undefined ? null : notBeforeSchema.parse(args.notBefore);
    if (!args.nextChargeAt) {
        const next = shiftedLocalDay(deadline, 1);
        return notBefore !== null && notBefore > next ? notBefore : next;
    }
    let candidate = args.nextChargeAt;
    const pending = (day: string): boolean =>
        day <= deadline || (notBefore !== null && day < notBefore);
    while (pending(getLocalDateString({ instant: candidate }))) {
        candidate = addCalendarMonths({
            from: candidate,
            months: BILLING_CYCLE_MONTHS[args.cycle],
            dayOverflow: 'clamp'
        });
    }
    return getLocalDateString({ instant: candidate });
}
