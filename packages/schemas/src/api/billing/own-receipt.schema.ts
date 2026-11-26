import { z } from 'zod';

/**
 * One receipt in the authenticated account's own list (HOS-2566). Amounts are in
 * the currency's minor unit; a manual payment stores none, so both are null.
 */
export const OwnReceiptSchema = z.object({
    id: z.string().uuid(),
    receiptNumber: z.number().int().positive(),
    issuedAt: z.string().datetime(),
    amountMinor: z.number().int().nonnegative().nullable(),
    currency: z.string().length(3).nullable(),
    conceptKind: z.enum(['PLAN', 'ADDON']),
    conceptName: z.string().nullable()
});
/** One receipt of the account's own list. */
export type OwnReceipt = z.infer<typeof OwnReceiptSchema>;

/** Response of `GET /api/v1/protected/billing-subscription/receipts`. */
export const OwnReceiptsResponseSchema = z.object({
    receipts: z.array(OwnReceiptSchema)
});
/** Response of the own-receipts list. */
export type OwnReceiptsResponse = z.infer<typeof OwnReceiptsResponseSchema>;
