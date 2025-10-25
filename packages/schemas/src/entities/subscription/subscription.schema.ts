import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    ClientIdSchema,
    PricingPlanIdSchema,
    SubscriptionIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { SubscriptionStatusEnumSchema } from '../../enums/subscription-status.schema.js';

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
        startAt: z.date({
            message: 'zodError.subscription.startAt.required'
        }),

        endAt: z
            .date({
                message: 'zodError.subscription.endAt.invalid'
            })
            .nullable()
            .optional(),

        trialEndsAt: z
            .date({
                message: 'zodError.subscription.trialEndsAt.invalid'
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
            if (data.trialEndsAt && data.endAt) {
                return data.trialEndsAt <= data.endAt;
            }
            return true;
        },
        {
            message: 'zodError.subscription.trialEndsAt.mustBeBeforeEndDate',
            path: ['trialEndsAt']
        }
    )
    .refine(
        (data) => {
            // Validate that start date is before end date when end date is present
            if (data.endAt) {
                return data.startAt <= data.endAt;
            }
            return true;
        },
        {
            message: 'zodError.subscription.startAt.mustBeBeforeEndDate',
            path: ['startAt']
        }
    );

export type Subscription = z.infer<typeof SubscriptionSchema>;
