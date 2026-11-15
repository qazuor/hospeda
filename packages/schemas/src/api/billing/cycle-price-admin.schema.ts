import { z } from 'zod';
import { BillingCycleSchema } from '../../catalog/plan-publication.schema.js';

/**
 * Zod contracts of the administrative action 19 — *set the price of a billing
 * cycle* (HOS-1515, piece B2.2, AC:B2:4, AC:B2:5 and AC:B2:10).
 *
 * Amounts are integers in minor currency units (centavos), never coerced. A
 * request is strict: an unknown key is a shape error. The cycle is the closed
 * `billing_option.cycle` list; the request never spells a cycle of its own.
 */

const PlanVersionIdSchema = z.string().uuid();
const AmountSchema = z.number().int().positive();

/** Preview body: which plan version, which cycle and the proposed amount. */
export const CyclePricePreviewRequestSchema = z
    .object({
        planVersionId: PlanVersionIdSchema,
        cycle: BillingCycleSchema,
        amount: AmountSchema
    })
    .strict();
/** Validated request for previewing a cycle price on a plan version. */
export type CyclePricePreviewRequest = z.infer<typeof CyclePricePreviewRequestSchema>;

/** Confirmation body: the preview plus the previous amount the actor saw. */
export const SetCyclePriceRequestSchema = z
    .object({
        planVersionId: PlanVersionIdSchema,
        cycle: BillingCycleSchema,
        amount: AmountSchema,
        expectedPreviousAmount: AmountSchema.nullable(),
        confirmed: z.literal(true)
    })
    .strict();
/** Validated confirmation with the previous amount observed in the preview. */
export type SetCyclePriceRequest = z.infer<typeof SetCyclePriceRequestSchema>;

/**
 * What the preview answers: what changes (previous and new amount, cycle), that
 * no customer is reached, and the human-readable confirmation.
 */
export const CyclePriceConfirmationSchema = z.object({
    planVersionId: PlanVersionIdSchema,
    cycle: BillingCycleSchema,
    currency: z.literal('ARS'),
    previousAmount: AmountSchema.nullable(),
    newAmount: AmountSchema,
    graceDays: z.number().int().nonnegative(),
    customersReached: z.literal(0),
    effectiveFrom: z.literal('ON_CONFIRMATION'),
    message: z.string().min(1)
});
/** Preview result describing the price change and its customer reach. */
export type CyclePriceConfirmation = z.infer<typeof CyclePriceConfirmationSchema>;

/** What the confirmed action answers: the written option and the audit event id. */
export const CyclePriceSetResponseSchema = z.object({
    billingOption: z.object({
        id: z.string().uuid(),
        planVersionId: PlanVersionIdSchema,
        cycle: BillingCycleSchema,
        amount: AmountSchema,
        currency: z.literal('ARS')
    }),
    previousAmount: AmountSchema.nullable(),
    newAmount: AmountSchema,
    domainEventId: z.string().uuid()
});
/** Confirmed price change, including the persisted option and domain event ID. */
export type CyclePriceSetResponse = z.infer<typeof CyclePriceSetResponseSchema>;
