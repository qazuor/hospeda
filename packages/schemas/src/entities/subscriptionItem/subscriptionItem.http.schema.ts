import { z } from 'zod';
import {
    SubscriptionItemCreateInputSchema,
    SubscriptionItemUpdateInputSchema
} from './subscriptionItem.crud.schema.js';
import { SubscriptionItemQuerySchema } from './subscriptionItem.query.schema.js';

/**
 * HTTP coercion schema for subscription item creation
 *
 * Handles HTTP-specific transformations for polymorphic data.
 */
export const SubscriptionItemCreateHttpSchema = SubscriptionItemCreateInputSchema;

export type SubscriptionItemCreateHttp = z.infer<typeof SubscriptionItemCreateHttpSchema>;

/**
 * HTTP coercion schema for subscription item updates
 *
 * Handles HTTP-specific transformations for update operations.
 */
export const SubscriptionItemUpdateHttpSchema = SubscriptionItemUpdateInputSchema;

export type SubscriptionItemUpdateHttp = z.infer<typeof SubscriptionItemUpdateHttpSchema>;

/**
 * HTTP coercion schema for subscription item queries
 *
 * Handles URL query parameter coercion for polymorphic filtering.
 */
export const SubscriptionItemQueryHttpSchema = SubscriptionItemQuerySchema.extend({
    // Boolean coercion for query parameters
    includeDeleted: z
        .union([z.boolean(), z.string().transform((val) => val === 'true')])
        .default(false),

    // Array coercion for multiple filtering
    sourceIds: z
        .union([
            z.array(z.string()),
            z.string().transform((val) => val.split(',').map((s) => s.trim()))
        ])
        .optional(),

    sourceTypes: z
        .union([
            z.array(z.string()),
            z.string().transform((val) => val.split(',').map((s) => s.trim()))
        ])
        .optional(),

    linkedEntityIds: z
        .union([
            z.array(z.string()),
            z.string().transform((val) => val.split(',').map((s) => s.trim()))
        ])
        .optional(),

    entityTypes: z
        .union([
            z.array(z.string()),
            z.string().transform((val) => val.split(',').map((s) => s.trim()))
        ])
        .optional()
});

export type SubscriptionItemQueryHttp = z.infer<typeof SubscriptionItemQueryHttpSchema>;

/**
 * Path parameter schema for subscription item operations
 *
 * Validates subscription item ID in URL paths.
 */
export const SubscriptionItemParamsSchema = z.object({
    id: z.string().uuid({
        message: 'zodError.subscriptionItem.id.invalidUuid'
    })
});

export type SubscriptionItemParams = z.infer<typeof SubscriptionItemParamsSchema>;

/**
 * Polymorphic path parameter schema
 *
 * For endpoints that need both the item ID and polymorphic context.
 */
export const SubscriptionItemPolymorphicParamsSchema = z.object({
    id: z.string().uuid({
        message: 'zodError.subscriptionItem.id.invalidUuid'
    }),
    sourceId: z
        .string()
        .uuid({
            message: 'zodError.subscriptionItem.sourceId.invalidUuid'
        })
        .optional(),
    linkedEntityId: z
        .string()
        .uuid({
            message: 'zodError.subscriptionItem.linkedEntityId.invalidUuid'
        })
        .optional()
});

export type SubscriptionItemPolymorphicParams = z.infer<
    typeof SubscriptionItemPolymorphicParamsSchema
>;
