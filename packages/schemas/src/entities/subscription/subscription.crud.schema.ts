import { z } from 'zod';
import { SubscriptionIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { SubscriptionStatusEnum } from '../../enums/subscription-status.enum.js';
import { SubscriptionStatusEnumSchema } from '../../enums/subscription-status.schema.js';
import { SubscriptionSchema } from './subscription.schema.js';

/**
 * Subscription Create Input Schema
 *
 * Schema for creating new subscriptions with required fields only.
 * Includes business validation for trial periods and dates.
 */
export const SubscriptionCreateInputSchema = SubscriptionSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true,
    lifecycleState: true
}).extend({
    // Override with defaults and specific validation
    status: SubscriptionStatusEnumSchema.default(SubscriptionStatusEnum.ACTIVE),
    startAt: z.coerce.date().default(() => new Date())
});

export type SubscriptionCreateInput = z.infer<typeof SubscriptionCreateInputSchema>;

/**
 * Subscription Update Input Schema
 *
 * Schema for updating existing subscriptions.
 * Includes status transition validation.
 */
export const SubscriptionUpdateInputSchema = SubscriptionSchema.omit({
    id: true,
    clientId: true,
    pricingPlanId: true,
    createdAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true,
    lifecycleState: true
}).partial();

export type SubscriptionUpdateInput = z.infer<typeof SubscriptionUpdateInputSchema>;

/**
 * Subscription Status Update Schema
 *
 * Simplified schema for status-only updates with validation.
 */
export const SubscriptionStatusUpdateSchema = z.object({
    id: SubscriptionIdSchema,
    status: SubscriptionStatusEnumSchema,
    updatedById: UserIdSchema
});

export type SubscriptionStatusUpdate = z.infer<typeof SubscriptionStatusUpdateSchema>;
