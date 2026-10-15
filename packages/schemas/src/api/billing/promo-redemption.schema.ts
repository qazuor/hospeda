import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

export const RedeemPromoCodeRequestSchema = z.strictObject({
    code: z.string().trim().min(1).max(64),
    vertical: VerticalEnumSchema
});

export const RedeemPromoCodeResponseSchema = z.discriminatedUnion('kind', [
    z.strictObject({
        kind: z.literal('DISCOUNT'),
        redemptionId: z.uuid(),
        previousAmountMinor: z.number().int().nonnegative(),
        amountMinor: z.number().int().nonnegative(),
        currency: z.string().min(1),
        durationKind: z.enum(['FIRST_CHARGE', 'N_CHARGES', 'FOREVER']),
        remainingCharges: z.number().int().positive().nullable()
    }),
    z.strictObject({
        kind: z.literal('TRIAL_EXTENSION'),
        days: z.number().int().positive(),
        replay: z.boolean()
    })
]);

export type RedeemPromoCodeRequest = z.infer<typeof RedeemPromoCodeRequestSchema>;
export type RedeemPromoCodeResponse = z.infer<typeof RedeemPromoCodeResponseSchema>;
