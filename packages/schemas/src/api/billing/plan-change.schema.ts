import { z } from 'zod';
import { BillingIntervalEnum } from '../../enums/billing-interval.enum.js';
import { KeepSelectionsSchema } from './downgrade-preview.schema.js';

/**
 * Plan change status enum
 * Defines the result status of a plan change operation
 */
export enum PlanChangeStatusEnum {
    /** Plan change applied immediately (upgrade — pre-SPEC-141 D7) or scheduled (downgrade) — applies to the legacy synchronous flow. */
    ACTIVE = 'active',
    /** Plan change scheduled for end of billing period (downgrade) */
    SCHEDULED = 'scheduled',
    /**
     * Plan change requires upfront payment of the prorated delta before
     * taking effect (SPEC-141 D7 upgrade). The client must redirect the
     * user to `checkoutUrl` and resume the polling UX on return.
     */
    PENDING_PAYMENT = 'pending_payment'
}

/**
 * Zod schema for the PlanChangeStatusEnum
 */
export const PlanChangeStatusEnumSchema = z.nativeEnum(PlanChangeStatusEnum, {
    error: () => ({ message: 'zodError.billing.planChange.status.invalid' })
});

/**
 * Schema for plan change request body.
 *
 * Validates the input when a user requests to change their subscription plan.
 *
 * **Upgrade-path semantic for `keepSelections`** (SPEC-167 T-015, §4 decision 3):
 * The field is defined on the shared request schema and is optional for all
 * callers. For UPGRADES the route handler IGNORES the field entirely — it is
 * never forwarded to `initiatePaidPlanUpgrade` and has no effect on the upgrade
 * flow. This "silent ignore" avoids a schema fork (separate upgrade/downgrade
 * request types) and keeps the client contract simple: clients may always send
 * `keepSelections`; for upgrades it is a no-op. The route-level JSDoc and
 * OpenAPI description document this behaviour so API consumers are not confused.
 */
export const PlanChangeRequestSchema = z.object({
    /** The ID of the target plan to change to */
    newPlanId: z
        .string({
            message: 'zodError.billing.planChange.newPlanId.invalidType'
        })
        .min(1, { message: 'zodError.billing.planChange.newPlanId.min' })
        .max(100, { message: 'zodError.billing.planChange.newPlanId.max' }),
    /** The billing interval for the new plan */
    billingInterval: z.nativeEnum(BillingIntervalEnum, {
        error: () => ({ message: 'zodError.billing.planChange.billingInterval.invalid' })
    }),
    /**
     * Optional host selection for which items to keep active after a DOWNGRADE
     * applies (SPEC-167 T-015). Persisted into the scheduled-change metadata
     * and consumed by the `apply-scheduled-plan-changes` cron (T-013).
     *
     * **For UPGRADES**: this field is silently ignored by the route handler.
     * Clients may always send it; it has no effect on the upgrade flow.
     *
     * **For DOWNGRADES**: when present, its `accommodationIds`, `promotionIds`,
     * and `photoKeepMap` override the default keep order (most-recently-updated).
     * Absent or empty arrays fall back to the default sort at apply time.
     *
     * See {@link KeepSelectionsSchema} for the full field contract.
     */
    keepSelections: KeepSelectionsSchema.optional()
});

/** TypeScript type inferred from PlanChangeRequestSchema */
export type PlanChangeRequest = z.infer<typeof PlanChangeRequestSchema>;

/**
 * Variant of the plan-change response that fires when the change was
 * applied immediately (legacy synchronous flow — covers downgrades and
 * pre-SPEC-141 upgrades) OR scheduled for period end (downgrade).
 *
 * `status` is `'active'` for immediate-apply and `'scheduled'` for
 * deferred-apply; both share the same payload shape.
 */
export const PlanChangeAppliedResponseSchema = z.object({
    /** The result status of the plan change. */
    status: z.union([z.literal('active'), z.literal('scheduled')]),
    /** The subscription ID that was modified */
    subscriptionId: z
        .string({
            message: 'zodError.billing.planChange.subscriptionId.invalidType'
        })
        .min(1, { message: 'zodError.billing.planChange.subscriptionId.min' }),
    /** The plan ID before the change */
    previousPlanId: z
        .string({
            message: 'zodError.billing.planChange.previousPlanId.invalidType'
        })
        .min(1, { message: 'zodError.billing.planChange.previousPlanId.min' }),
    /** The new plan ID after the change */
    newPlanId: z
        .string({
            message: 'zodError.billing.planChange.newPlanId.invalidType'
        })
        .min(1, { message: 'zodError.billing.planChange.newPlanId.min' }),
    /** When the plan change takes effect (ISO 8601 datetime string) */
    effectiveAt: z
        .string({
            message: 'zodError.billing.planChange.effectiveAt.invalidType'
        })
        .datetime({ message: 'zodError.billing.planChange.effectiveAt.invalid' }),
    /** Prorated amount in ARS cents (only for upgrades) */
    proratedAmount: z
        .number({
            message: 'zodError.billing.planChange.proratedAmount.invalidType'
        })
        .min(0, { message: 'zodError.billing.planChange.proratedAmount.min' })
        .optional()
});

/**
 * Variant of the plan-change response returned by the SPEC-141 D7
 * upgrade flow when the user must pay a prorated delta BEFORE the
 * change applies. The client redirects to `checkoutUrl` and polls
 * `subscriptions/<localSubscriptionId>/status` on return (same UX as
 * SPEC-126 D2/D5 + SPEC-141 D1).
 */
export const PlanChangePendingPaymentResponseSchema = z.object({
    /** Discriminator literal for this variant. */
    status: z.literal('pending_payment'),
    /** Provider-hosted MP checkout URL the front-end must redirect to. */
    checkoutUrl: z.string().url({ message: 'zodError.billing.planChange.checkoutUrl.invalid' }),
    /** Local subscription id (the sub being upgraded). */
    localSubscriptionId: z.string().min(1),
    /** ISO 8601 timestamp after which the pending checkout can be considered abandoned. */
    expiresAt: z.string().datetime(),
    /** Target plan id the upgrade will move to upon successful payment. */
    newPlanId: z.string().min(1),
    /** Delta amount the user will be charged, in ARS centavos (always > 0 for true upgrades). */
    deltaCentavos: z.number().int().min(1)
});

/**
 * Discriminated-union schema for the plan-change response.
 *
 * - `status === 'active' | 'scheduled'` → legacy applied-or-scheduled
 *   payload (downgrades + pre-SPEC-141 path).
 * - `status === 'pending_payment'` → SPEC-141 D7 upgrade requires
 *   user payment of the prorated delta before the change applies.
 */
export const PlanChangeResponseSchema = z.discriminatedUnion('status', [
    PlanChangeAppliedResponseSchema,
    PlanChangePendingPaymentResponseSchema
]);

/** TypeScript type inferred from PlanChangeResponseSchema */
export type PlanChangeResponse = z.infer<typeof PlanChangeResponseSchema>;
export type PlanChangeAppliedResponse = z.infer<typeof PlanChangeAppliedResponseSchema>;
export type PlanChangePendingPaymentResponse = z.infer<
    typeof PlanChangePendingPaymentResponseSchema
>;
