import { getLocalDateString, getUtcInstantForLocalMidnight } from '@repo/utils';
import { z } from 'zod';

/** Provider calendar zone, UTC-4; POSIX reverses the sign in Etc/GMT names. */
export const PROVIDER_TIME_ZONE = 'Etc/GMT+4';

const inputSchema = z.strictObject({
    now: z.date(),
    cardHours: z.number().positive(),
    minimumRemainingHours: z.number().nonnegative(),
    predecessor: z.strictObject({
        status: z.string(),
        paymentMethod: z.string().nullable(),
        nextChargeAt: z.date().nullable()
    })
});

/** Resolves the AC:B8b:18 successor window against PLAZO:15 and the provider's charge day. */
export function resolveSuccessorWindow(
    input: z.input<typeof inputSchema>
):
    | { readonly kind: 'OFFERED'; readonly endsAt: Date; readonly reduced: boolean }
    | { readonly kind: 'NOT_OFFERED'; readonly availableFrom: Date } {
    const value = inputSchema.parse(input);
    const fullEndsAt = new Date(value.now.getTime() + value.cardHours * 60 * 60 * 1000);
    const { predecessor } = value;
    if (
        predecessor.status !== 'ACTIVE' ||
        predecessor.paymentMethod !== 'CARD' ||
        predecessor.nextChargeAt === null
    )
        return { kind: 'OFFERED', endsAt: fullEndsAt, reduced: false };
    const cutoff = getUtcInstantForLocalMidnight({
        date: getLocalDateString({
            instant: predecessor.nextChargeAt,
            timeZone: PROVIDER_TIME_ZONE
        }),
        timeZone: PROVIDER_TIME_ZONE
    });
    const reduced = cutoff.getTime() < fullEndsAt.getTime();
    const endsAt = reduced ? cutoff : fullEndsAt;
    if (endsAt.getTime() - value.now.getTime() < value.minimumRemainingHours * 60 * 60 * 1000)
        return { kind: 'NOT_OFFERED', availableFrom: predecessor.nextChargeAt };
    return { kind: 'OFFERED', endsAt, reduced };
}
