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
        nextChargeAt: z.date().nullable(),
        hasCreditedCharge: z.boolean()
    })
});

/**
 * Resolves the AC:B8b:18 successor window against PLAZO:15 and the provider's charge day.
 *
 * HOS-2223: the window is cut at the predecessor's `next_charge_at` only once that date
 * ends a paid cycle, that is, once the predecessor has a credited charge
 * (`predecessor.hasCreditedCharge`, read by `readHasCreditedCharge` in
 * `successor-window-credit.ts`). Before
 * that, S2 copied the provider's first-charge instant (minutes after authorizing), which
 * is not the end of any cycle, so the full window is offered as if the date were unknown.
 *
 * @param input.predecessor.hasCreditedCharge - Whether the predecessor holds an open
 *   covered period (a credited automatic or manual payment)
 */
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
        predecessor.nextChargeAt === null ||
        !predecessor.hasCreditedCharge
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
