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

/** Optional proof for an MP4 payment received after declaration. */
export const LateManualPaymentBodySchema = ManualPaymentRegistrationBodySchema;

/** Optional proof for an MP6 transfer without an open installment. */
export const UnallocatedManualPaymentBodySchema = ManualPaymentRegistrationBodySchema;

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

/** Read-only confirmation of MP4. */
export const LateManualPaymentPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid(),
    periodStart: iso,
    reimputedPeriodStart: iso.nullable(),
    nextChargeAt: iso,
    effect: z.enum(['S7', 'S19'])
});

/** Result of MP4. */
export const LateManualPaymentResponseSchema = z.strictObject({
    effect: z.enum(['S7', 'S19']),
    nextChargeAt: iso,
    periodStart: iso,
    reimputedFrom: iso.nullable(),
    receiptId: z.uuid().nullable()
});

/** Read-only confirmation of MP6. */
export const UnallocatedManualPaymentPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    periodStart: iso,
    mark: z.enum(['COBRO_DUPLICADO', 'COBRO_POSTERIOR_A_LA_BAJA'])
});

/** Result of MP6. */
export const UnallocatedManualPaymentResponseSchema = z.strictObject({
    manualPaymentId: z.uuid(),
    periodStart: iso,
    markId: z.uuid(),
    mark: z.enum(['COBRO_DUPLICADO', 'COBRO_POSTERIOR_A_LA_BAJA']),
    outcome: z.enum(['OPENED', 'ACCUMULATED'])
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
