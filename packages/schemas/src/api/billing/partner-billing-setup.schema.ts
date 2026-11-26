import { z } from 'zod';
import {
    PlanPaymentMethodSchema,
    PlanPaymentMethodsSchema
} from './plan-payment-methods.schema.js';

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
    currency: z.string().length(3),
    /** Payment methods the option's plan version accepts (HOS-2196); the admin picks one. */
    paymentMethods: PlanPaymentMethodsSchema
});

/** Read-only action 6 confirmation data; no subscription is written (AC:V7:17, ACC:6). */
export const PartnerBillingSetupPreviewResponseSchema = z.strictObject({
    partner: z.strictObject({ id: z.uuid(), name: z.string().min(1) }),
    ownerUserId: z.uuid(),
    owner: z.strictObject({ name: z.string().min(1), email: z.email() }),
    options: z.array(PartnerBillingSetupOptionSchema),
    effect: z.literal(
        'Creates a subscription pending authorization: a manual one opens its first installment, a card one returns the Mercado Pago authorization link.'
    )
});

/** Explicitly confirmed action 6 request body (AC:V7:17, ACC:6). */
export const PartnerBillingSetupRequestSchema = z.strictObject({
    billingOptionId: z.uuid(),
    /**
     * The method the team chose for this Partner; the option's plan version must accept it. Defaults
     * to `MANUAL`, what this act did before the plan declared its methods (HOS-2196).
     */
    paymentMethod: PlanPaymentMethodSchema.default('MANUAL'),
    reason: z.string().trim().min(1).max(500),
    confirm: z.literal(true)
});

/** Successful action 6 result, with dates serialized as ISO strings (AC:V7:17, ACC:6). */
export const PartnerBillingSetupResponseSchema = z.strictObject({
    paymentMethod: PlanPaymentMethodSchema,
    subscriptionId: z.uuid(),
    /** The first installment; `null` for a card subscription. */
    manualPaymentId: z.uuid().nullable(),
    /** Start of the first installment; `null` for a card subscription. */
    periodStart: isoDateTime.nullable(),
    /**
     * Mercado Pago authorization link of a card subscription (single use, tied to this
     * subscription, valid while the pending window is open); `null` for a manual one.
     */
    checkoutUrl: z.url().nullable(),
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
