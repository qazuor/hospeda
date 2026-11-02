import { z } from 'zod';

/** Public fields returned when reading one subscription. */
export const SubscriptionReadSchema = z.object({
    id: z.string().uuid(),
    vertical: z.string().nullable(),
    /** Billing option the subscription is anchored to; lets a rejected attempt be restarted for the same plan (HOS-1979). */
    billingOptionId: z.string().uuid().nullable(),
    status: z.string(),
    class: z.string(),
    paymentMethod: z.string().nullable(),
    nextChargeAt: z.date().nullable(),
    serviceEndsAt: z.date().nullable(),
    createdAt: z.date()
});

/** One subscription response without amounts or provider details. */
export type SubscriptionRead = z.infer<typeof SubscriptionReadSchema>;
