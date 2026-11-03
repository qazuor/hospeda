import { z } from 'zod';

/** Path identifiers for the administrative manual payment routes. */
export const ManualPaymentParamsSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid()
});

/** Path identifier for the installment list. */
export const ManualPaymentListParamsSchema = ManualPaymentParamsSchema.pick({
    subscriptionId: true
});

/** Optional receipt reference supplied when an administrator registers payment. */
export const ManualPaymentRegistrationBodySchema = z.strictObject({
    proofRef: z.string().min(1).max(500).optional()
});

const iso = z.iso.datetime();
const effect = z.enum(['S29', 'S5', 'S19', 'NONE']);

/** Read-only confirmation of MP1. */
export const ManualPaymentRegistrationPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid(),
    periodStart: iso,
    effect,
    nextChargeAt: iso
});

/** Result of MP1. */
export const ManualPaymentRegistrationResponseSchema = z.strictObject({
    outcome: z.literal('REGISTERED'),
    effect,
    receiptId: z.uuid(),
    receiptNumber: z.number().int(),
    nextChargeAt: iso
});

/** Read-only confirmation of MP2. */
export const ManualUnpaidPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid(),
    periodStart: iso,
    effect: z.literal('S6')
});

/** Result of MP2. */
export const ManualUnpaidResponseSchema = z.strictObject({
    outcome: z.literal('SUSPENDED'),
    notice: z.enum(['SENT', 'FAILED', 'NO_RECIPIENT'])
});

/** One installment shown to billing administrators. */
export const ManualPaymentListItemSchema = z.strictObject({
    id: z.uuid(),
    periodStart: iso,
    status: z.enum(['AWAITING', 'REGISTERED', 'DECLARED_UNPAID']),
    registeredBy: z.uuid().nullable(),
    registeredAt: iso.nullable(),
    proofRef: z.string().nullable()
});

/** Installments belonging to the requested subscription. */
export const ManualPaymentListResponseSchema = z.array(ManualPaymentListItemSchema);
