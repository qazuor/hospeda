import { z } from 'zod';
import {
    SubscriptionCreateInputSchema,
    SubscriptionUpdateInputSchema
} from './subscription.crud.schema.js';
import { SubscriptionQuerySchema } from './subscription.query.schema.js';

/**
 * HTTP coercion schema for subscription creation
 *
 * Handles HTTP-specific transformations like string-to-date conversion
 * and boolean coercion for form data and query parameters.
 */
export const SubscriptionCreateHttpSchema = SubscriptionCreateInputSchema.extend({
    // HTTP date coercion for form inputs
    startAt: z.coerce.date().default(() => new Date()),
    endAt: z.coerce.date().optional(),
    trialEndsAt: z.coerce.date().optional()
});

export type SubscriptionCreateHttp = z.infer<typeof SubscriptionCreateHttpSchema>;

/**
 * HTTP coercion schema for subscription updates
 *
 * Handles HTTP-specific transformations for update operations.
 */
export const SubscriptionUpdateHttpSchema = SubscriptionUpdateInputSchema.extend({
    // HTTP date coercion for form inputs
    endAt: z.coerce.date().optional(),
    trialEndsAt: z.coerce.date().optional()
});

export type SubscriptionUpdateHttp = z.infer<typeof SubscriptionUpdateHttpSchema>;

/**
 * HTTP coercion schema for subscription queries
 *
 * Handles URL query parameter coercion for filtering and searching.
 */
export const SubscriptionQueryHttpSchema = SubscriptionQuerySchema.extend({
    // Boolean coercion for query parameters
    hasActiveTrial: z
        .union([z.boolean(), z.string().transform((val) => val === 'true')])
        .optional(),
    isActive: z.union([z.boolean(), z.string().transform((val) => val === 'true')]).optional(),
    isExpired: z.union([z.boolean(), z.string().transform((val) => val === 'true')]).optional(),
    isCancelled: z.union([z.boolean(), z.string().transform((val) => val === 'true')]).optional(),
    includeDeleted: z
        .union([z.boolean(), z.string().transform((val) => val === 'true')])
        .default(false),

    // Array coercion for multiple status filtering
    statuses: z
        .union([
            z.array(z.string()),
            z.string().transform((val) => val.split(',').map((s) => s.trim()))
        ])
        .optional()
});

export type SubscriptionQueryHttp = z.infer<typeof SubscriptionQueryHttpSchema>;

/**
 * Path parameter schema for subscription operations
 *
 * Validates subscription ID in URL paths.
 */
export const SubscriptionParamsSchema = z.object({
    id: z.string().uuid({
        message: 'zodError.subscription.id.invalidUuid'
    })
});

export type SubscriptionParams = z.infer<typeof SubscriptionParamsSchema>;
