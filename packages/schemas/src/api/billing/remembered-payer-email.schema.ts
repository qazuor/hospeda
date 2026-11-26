import { z } from 'zod';

/**
 * The payer email remembered for the authenticated account (HOS-2616).
 *
 * It is the email DECLARED on the account's last approved subscription or complement charge.
 * It only prefills a checkout: it is never a confirmed email and no code may read it as the
 * payer's identity. `null` when no charge was ever approved with a declared email.
 */
export const RememberedPayerEmailResponseSchema = z.object({
    rememberedPayerEmail: z.string().nullable()
});

/** Response of `GET /protected/billing-subscription/payer-email`. */
export type RememberedPayerEmailResponse = z.infer<typeof RememberedPayerEmailResponseSchema>;
