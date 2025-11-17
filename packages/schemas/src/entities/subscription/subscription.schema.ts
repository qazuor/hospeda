import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientIdSchema, SubscriptionIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { SubscriptionStatusEnumSchema } from '../../enums/subscription-status.schema.js';
import { PricingPlanIdSchema } from '../pricingPlan/pricingPlan.schema.js';

/**
 * Subscription Schema - Business Model Entity
 *
 * This schema defines the complete structure of a Subscription entity
 * according to the new business model for Hospeda.
 * Represents a recurring subscription to a pricing plan by a client.
 */
export const SubscriptionSchema = z
    .object({
        // Base fields
        id: SubscriptionIdSchema,
        ...BaseAuditFields,

        // Subscription-specific core fields
        clientId: ClientIdSchema,
        pricingPlanId: PricingPlanIdSchema,
        status: SubscriptionStatusEnumSchema,

        // Date fields for subscription lifecycle
        startDate: z.date({
            message: 'zodError.subscription.startDate.required'
        }),

        endDate: z
            .date({
                message: 'zodError.subscription.endDate.invalid'
            })
            .nullable()
            .optional(),

        trialEndDate: z
            .date({
                message: 'zodError.subscription.trialEndDate.invalid'
            })
            .nullable()
            .optional(),

        // Base field groups following established patterns
        ...BaseLifecycleFields,
        ...BaseAdminFields
    })
    .refine(
        (data) => {
            // Validate that trial end date is before subscription end date when both are present
            if (data.trialEndDate && data.endDate) {
                return data.trialEndDate <= data.endDate;
            }
            return true;
        },
        {
            message: 'zodError.subscription.trialEndDate.mustBeBeforeEndDate',
            path: ['trialEndDate']
        }
    )
    .refine(
        (data) => {
            // Validate that start date is before end date when end date is present
            if (data.endDate) {
                return data.startDate <= data.endDate;
            }
            return true;
        },
        {
            message: 'zodError.subscription.startDate.mustBeBeforeEndDate',
            path: ['startDate']
        }
    );

export type Subscription = z.infer<typeof SubscriptionSchema>;
