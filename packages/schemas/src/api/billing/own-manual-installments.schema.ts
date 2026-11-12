import { z } from 'zod';

/** One open manual installment of the caller (HOS-1782, PM-617). */
export const OwnManualInstallmentSchema = z.object({
    subscriptionId: z.string().uuid(),
    manualPaymentId: z.string().uuid(),
    vertical: z.string(),
    plan: z.object({ slug: z.string(), name: z.string() }),
    /** Expected amount in minor units; null when the policy cannot compute it. */
    amount: z
        .object({ amountMinor: z.number().int().nonnegative(), currency: z.literal('ARS') })
        .nullable(),
    periodStart: z.string().datetime(),
    dueAt: z.string().datetime()
});

/** Response containing the caller's open manual installments. */
export const OwnManualInstallmentsResponseSchema = z.object({
    installments: z.array(OwnManualInstallmentSchema)
});

/** Type of the caller's open manual installments response. */
export type OwnManualInstallmentsResponse = z.infer<typeof OwnManualInstallmentsResponseSchema>;
