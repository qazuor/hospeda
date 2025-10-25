import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientIdSchema, PricingPlanIdSchema, PurchaseIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';

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

    // Purchase timestamp - when the purchase was made
    purchasedAt: z.date({
        message: 'zodError.purchase.purchasedAt.required'
    }),

    // Base field groups following established patterns
    ...BaseLifecycleFields,
    ...BaseAdminFields
});

export type Purchase = z.infer<typeof PurchaseSchema>;
