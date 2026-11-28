import { z } from 'zod';

/**
 * Protected addon purchase request. It carries no payment data (HOS-2179 §6.2): a one-time
 * addon is paid on the provider's page and a recurring one at its checkout, so a `payment`,
 * a card token or any other extra field fails the strict shape with a 400. `payerEmail` is
 * only for a recurring addon; a one-time purchase neither asks for it nor sends it (P-8).
 */
export const AddonPurchaseRequestSchema = z.strictObject({
    productId: z.uuid(),
    targetId: z.uuid().nullable(),
    orderRequestId: z.string().min(1).max(64),
    addonVersionId: z.uuid(),
    payerEmail: z.email().optional()
});

/**
 * Protected addon purchase response. Both charge kinds answer the same way (HOS-2179 §7.5):
 * `checkoutUrl` is the sanitized provider link to redirect to, and `processing` says the
 * purchase is waiting with no link to follow (another screen holds it, or its page could not
 * be opened on this request).
 */
export const AddonPurchaseResponseSchema = z.strictObject({
    outcome: z.enum(['CREATED', 'EXISTING', 'PENDING_ELSEWHERE']),
    instanceId: z.uuid(),
    chargeKind: z.enum(['UNA_VEZ', 'PERIODICO']),
    processing: z.boolean(),
    checkoutUrl: z.url().optional()
});

/**
 * Owner-only read of an addon purchase. `productId`, `targetId` and `addonVersionId` are the
 * purchase identity (HOS-2680): the return screen re-sends them with a fresh order id to reopen
 * the same checkout, or to start a new purchase of the same add-on once this one closed.
 */
export const AddonPurchaseReadResponseSchema = z.strictObject({
    instanceId: z.uuid(),
    status: z.enum(['PENDING_AUTHORIZATION', 'ACTIVE', 'ABANDONED', 'EXPIRED', 'CANCELLED']),
    chargeKind: z.enum(['UNA_VEZ', 'PERIODICO']),
    processing: z.boolean(),
    productId: z.uuid(),
    targetId: z.uuid().nullable(),
    addonVersionId: z.uuid()
});
