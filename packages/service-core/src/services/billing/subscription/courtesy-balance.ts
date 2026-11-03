import { addCalendarMonths } from '@repo/utils';
import { z } from 'zod';

const inputSchema = z.strictObject({ startsAt: z.date(), endsAt: z.date(), now: z.date() });

/** Calendar months remaining under AC:B8b:10 and B/02 §2.4, rounding any fraction up. */
export function computeCourtesyBalanceMonths(input: {
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly now: Date;
}): { readonly months: number } {
    const { startsAt, endsAt, now } = inputSchema.parse(input);
    const from = startsAt > now ? startsAt : now;
    if (endsAt <= from) return { months: 0 };
    let months = 0;
    while (addCalendarMonths({ from, months: months + 1, dayOverflow: 'clamp' }) <= endsAt) {
        months++;
    }
    if (addCalendarMonths({ from, months, dayOverflow: 'clamp' }) < endsAt) months++;
    return { months };
}
