import { z } from 'zod';

/** Request body for claiming an approved Partner with its single-use link. */
export const PartnerClaimRequestSchema = z.object({
    partnerId: z.string().uuid(),
    secret: z.string().max(512)
});

/** Successful Partner claim response. */
export const PartnerClaimResponseSchema = z.object({
    claimed: z.literal(true),
    partnerId: z.string().uuid(),
    emailVerified: z.boolean()
});
