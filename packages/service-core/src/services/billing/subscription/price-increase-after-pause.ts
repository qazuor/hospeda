import { z } from 'zod';

const inputSchema = z.strictObject({
    nextChargeAt: z.date(),
    announcedAt: z.date(),
    noticeDays: z.number().int().min(60),
    everyMonths: z.number().int().min(1).max(12)
});

/**
 * AC:B8b:4 and DEC-SUB-010 implication 3: a paused price increase waits for
 * the first resumed charge that honours the notice. B12 consumes this rule
 * when S37 mutates the provider amount.
 */
export function firstChargeHonouringNotice(input: {
    readonly nextChargeAt: Date;
    readonly announcedAt: Date;
    readonly noticeDays: number;
    readonly everyMonths: number;
}): { readonly chargeAt: Date } {
    const value = inputSchema.parse(input);
    const noticeEndsAt = new Date(value.announcedAt);
    noticeEndsAt.setUTCDate(noticeEndsAt.getUTCDate() + value.noticeDays);
    let months = 0;
    let chargeAt: Date;
    do {
        chargeAt = new Date(value.nextChargeAt);
        chargeAt.setUTCMonth(chargeAt.getUTCMonth() + months);
        months += value.everyMonths;
    } while (chargeAt < noticeEndsAt);
    return { chargeAt };
}
