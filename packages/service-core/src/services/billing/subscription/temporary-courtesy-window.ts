import { addCalendarMonths } from '@repo/utils';
import { z } from 'zod';

/**
 * Reopen a courtesy pause one day before the next charge anchor. RP10 advances
 * provider dates that are already due on resume, while the hourly pause-end
 * cron can run up to an hour late; the lead prevents skipping one extra charge.
 */
export const COURTESY_RESUME_LEAD_MS = 24 * 60 * 60 * 1000;

const anchorInputSchema = z.strictObject({
    nextChargeAt: z.date().nullable(),
    now: z.date(),
    cycleMonths: z.number().int().positive()
});
const windowInputSchema = z.strictObject({ anchor: z.date(), months: z.number().int().positive() });

/** Resolve a usable next-charge anchor, advancing missed cycles beyond `now`. */
export function resolveCourtesyAnchor(input: {
    readonly nextChargeAt: Date | null;
    readonly now: Date;
    readonly cycleMonths: number;
}): Date {
    const { nextChargeAt, now, cycleMonths } = anchorInputSchema.parse(input);
    if (!nextChargeAt) return now;
    let anchor = nextChargeAt;
    while (anchor <= now) {
        anchor = addCalendarMonths({ from: anchor, months: cycleMonths, dayOverflow: 'clamp' });
    }
    return anchor;
}

/** Build a courtesy grant window whose end precedes the next unsuppressed charge. */
export function computeTemporaryCourtesyWindow(input: {
    readonly anchor: Date;
    readonly months: number;
}): { readonly startsAt: Date; readonly endsAt: Date } {
    const { anchor, months } = windowInputSchema.parse(input);
    return {
        startsAt: anchor,
        endsAt: new Date(
            addCalendarMonths({ from: anchor, months, dayOverflow: 'clamp' }).getTime() -
                COURTESY_RESUME_LEAD_MS
        )
    };
}
