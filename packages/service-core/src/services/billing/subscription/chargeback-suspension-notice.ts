import type { SelectPayment, SelectSubscription } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import { readArrearsSuspensionNoticeContent } from './arrears-suspension-notice';

/** Chargeback notice facts, as plain JSON for the outbox (AC:B7:10, row 10-ter). */
export const ChargebackSuspensionNoticeContentSchema = z.strictObject({
    vertical: z.string().min(1),
    paymentMethod: z.literal('CARD'),
    touristVipLost: z.boolean(),
    oneTimeAddons: z.array(
        z.strictObject({
            name: z.string().min(1),
            remainingDays: z.number().int().positive()
        })
    ),
    chargedBackPayment: z.strictObject({
        amountMinor: z.number().int().nonnegative(),
        currency: z.string().min(1),
        chargedOn: z.iso.date()
    }),
    courtesyEnded: z.boolean()
});

/** Validated content for the chargeback suspension notice. */
export interface ChargebackSuspensionNoticeContent
    extends z.infer<typeof ChargebackSuspensionNoticeContentSchema> {}

/**
 * Reads tourist and addon losses with S6's existing reader. The payment day uses
 * Etc/GMT+4, meaning UTC-4 because the POSIX time-zone sign is inverted.
 */
export async function readChargebackSuspensionNoticeContent(input: {
    readonly subscription: SelectSubscription;
    readonly payment: SelectPayment;
    readonly courtesyEnded: boolean;
    readonly now: Date;
}): Promise<ChargebackSuspensionNoticeContent> {
    const arrears = await readArrearsSuspensionNoticeContent({
        subscription: input.subscription,
        now: input.now
    });
    return ChargebackSuspensionNoticeContentSchema.parse({
        vertical: arrears.vertical,
        paymentMethod: arrears.paymentMethod,
        touristVipLost: arrears.touristVipLost,
        oneTimeAddons: arrears.oneTimeAddons,
        chargedBackPayment: {
            amountMinor: input.payment.amount,
            currency: input.payment.currency,
            chargedOn: getLocalDateString({ instant: input.payment.factAt, timeZone: 'Etc/GMT+4' })
        },
        courtesyEnded: input.courtesyEnded
    });
}
