import { addCalendarMonths } from '@repo/utils';
import { z } from 'zod';

const inputSchema = z.strictObject({
    now: z.date(),
    balanceMonths: z.number().int().positive(),
    creditEndsAt: z.date().nullable()
});

/** Computes the S9 courtesy window, beginning after unconsumed successor credit when present. */
export function computeReissueWindow(input: {
    readonly now: Date;
    readonly balanceMonths: number;
    readonly creditEndsAt: Date | null;
}): { readonly startsAt: Date; readonly endsAt: Date } {
    const value = inputSchema.parse(input);
    const startsAt =
        value.creditEndsAt && value.creditEndsAt > value.now ? value.creditEndsAt : value.now;
    return {
        startsAt,
        endsAt: addCalendarMonths({
            from: startsAt,
            months: value.balanceMonths,
            dayOverflow: 'clamp'
        })
    };
}
