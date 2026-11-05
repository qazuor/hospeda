import { z } from 'zod';

const isoDateTime = z.iso.datetime();
const billingCycle = z.enum(['monthly', 'quarterly', 'semiannual', 'annual']);

/** Partner path parameters for AC:V7:17 ACC:6. */
export const PartnerBillingSetupParamsSchema = z.strictObject({ id: z.uuid() });

/** One currently sellable billing option shown during action 6 preview (AC:V7:17, ACC:6). */
export const PartnerBillingSetupOptionSchema = z.strictObject({
    billingOptionId: z.uuid(),
    planVersionId: z.uuid(),
    planName: z.string().min(1),
    planSlug: z.string().min(1),
    cycle: billingCycle,
    amountMinor: z.number().int().nonnegative(),
    currency: z.string().length(3)
});

/** Read-only action 6 confirmation data; no subscription is written (AC:V7:17, ACC:6). */
export const PartnerBillingSetupPreviewResponseSchema = z.strictObject({
    partner: z.strictObject({ id: z.uuid(), name: z.string().min(1) }),
    ownerUserId: z.uuid(),
    method: z.literal('MANUAL'),
    options: z.array(PartnerBillingSetupOptionSchema),
    effect: z.literal(
        'Creates a subscription pending authorization and opens its first installment.'
    )
});

/** Explicitly confirmed action 6 request body (AC:V7:17, ACC:6). */
export const PartnerBillingSetupRequestSchema = z.strictObject({
    billingOptionId: z.uuid(),
    reason: z.string().trim().min(1).max(500),
    confirm: z.literal(true)
});

/** Successful action 6 result, with dates serialized as ISO strings (AC:V7:17, ACC:6). */
export const PartnerBillingSetupResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid(),
    periodStart: isoDateTime,
    authorizationWindowEndsAt: isoDateTime,
    created: z.boolean()
});

/** Inferred preview payload type for AC:V7:17 ACC:6. */
export type PartnerBillingSetupPreviewResponse = z.infer<
    typeof PartnerBillingSetupPreviewResponseSchema
>;
/** Inferred action 6 request type for AC:V7:17 ACC:6. */
export type PartnerBillingSetupRequest = z.infer<typeof PartnerBillingSetupRequestSchema>;
/** Inferred action 6 response type for AC:V7:17 ACC:6. */
export type PartnerBillingSetupResponse = z.infer<typeof PartnerBillingSetupResponseSchema>;
