import { z } from 'zod';
import { PurchaseIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { PurchaseSchema } from './purchase.schema.js';

/**
 * Purchase Create Input Schema
 *
 * Schema for creating new purchases (one-time transactions).
 * Most fields are required since purchases are immediate transactions.
 */
export const PurchaseCreateInputSchema = PurchaseSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true,
    lifecycleState: true
}).extend({
    // Override with defaults and specific validation
    purchasedAt: z.coerce.date().default(() => new Date()),
    createdById: UserIdSchema,
    updatedById: UserIdSchema
});

export type PurchaseCreateInput = z.infer<typeof PurchaseCreateInputSchema>;

/**
 * Purchase Update Input Schema
 *
 * Schema for updating existing purchases.
 * Limited updates since purchases are typically immutable after creation.
 */
export const PurchaseUpdateInputSchema = PurchaseSchema.omit({
    id: true,
    clientId: true,
    pricingPlanId: true,
    purchasedAt: true, // Cannot change purchase date
    createdAt: true,
    createdById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true,
    lifecycleState: true
})
    .partial()
    .extend({
        updatedById: UserIdSchema
    });

export type PurchaseUpdateInput = z.infer<typeof PurchaseUpdateInputSchema>;

/**
 * Purchase Cancel Schema
 *
 * Schema for cancelling/refunding a purchase.
 */
export const PurchaseCancelSchema = z.object({
    id: PurchaseIdSchema,
    reason: z
        .string()
        .min(1, { message: 'zodError.purchase.cancelReason.required' })
        .max(500, { message: 'zodError.purchase.cancelReason.maxLength' }),
    updatedById: UserIdSchema
});

export type PurchaseCancel = z.infer<typeof PurchaseCancelSchema>;
