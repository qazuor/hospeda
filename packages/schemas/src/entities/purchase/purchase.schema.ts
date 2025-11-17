import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    ClientIdSchema,
    DiscountCodeIdSchema,
    PaymentIdSchema,
    PurchaseIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { PriceCurrencyEnumSchema, PurchaseStatusEnumSchema } from '../../enums/index.js';
import { numericField } from '../../utils/index.js';
import { PricingPlanIdSchema } from '../pricingPlan/pricingPlan.schema.js';

/**
 * Purchase Schema - Business Model Entity
 *
 * This schema defines the complete structure of a Purchase entity
 * according to the new business model for Hospeda.
 * Represents a one-time purchase of a pricing plan by a client.
 */
export const PurchaseSchema = z.object({
    // Base fields
    id: PurchaseIdSchema,
    ...BaseAuditFields,

    // Purchase-specific core fields
    clientId: ClientIdSchema,
    pricingPlanId: PricingPlanIdSchema,

    // Billing information
    amount: numericField(
        z
            .number({ message: 'zodError.purchase.amount.required' })
            .positive({ message: 'zodError.purchase.amount.positive' })
    ),

    currency: PriceCurrencyEnumSchema,

    // Purchase status and state
    status: PurchaseStatusEnumSchema,

    // Quantity of items purchased
    quantity: z
        .number({ message: 'zodError.purchase.quantity.required' })
        .int({ message: 'zodError.purchase.quantity.int' })
        .positive({ message: 'zodError.purchase.quantity.positive' })
        .default(1),

    // Relations
    paymentId: PaymentIdSchema.nullable(),
    discountCodeId: DiscountCodeIdSchema.nullable().optional(),

    // Purchase timestamp - when the purchase was made
    purchasedAt: z.date({
        message: 'zodError.purchase.purchasedAt.required'
    }),

    // Base field groups following established patterns
    ...BaseLifecycleFields,
    ...BaseAdminFields
});

export type Purchase = z.infer<typeof PurchaseSchema>;
