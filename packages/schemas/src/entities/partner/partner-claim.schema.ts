import { z } from 'zod';
import { StrongPasswordSchema } from '../../common/password.schema.js';

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

/** Public request to inspect the account associated with a valid claim link. */
export const PartnerClaimLookupRequestSchema = PartnerClaimRequestSchema.strict();

/** Public lookup result, disclosed only after verifying the claim secret. */
export const PartnerClaimLookupResponseSchema = z.object({
    email: z.string().email(),
    accountExists: z.boolean()
});

/** Protected request to check whether the signed-in account may claim a Partner. */
export const PartnerClaimCheckRequestSchema = PartnerClaimRequestSchema.strict();

/**
 * Protected check result. It carries only a boolean: the claim mailbox must never
 * reach an account that is not its owner (HOS-2353).
 */
export const PartnerClaimCheckResponseSchema = z
    .object({
        emailMatches: z.boolean()
    })
    .strict();

/** Public token-bound signup request. Email is deliberately absent and unknown fields fail. */
export const PartnerClaimSignUpRequestSchema = PartnerClaimRequestSchema.extend({
    password: StrongPasswordSchema
}).strict();

/** Successful token-bound account creation and Partner claim. */
export const PartnerClaimSignUpResponseSchema = z.object({
    claimed: z.literal(true),
    partnerId: z.string().uuid(),
    email: z.string().email()
});
