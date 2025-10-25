import { z } from 'zod';
import { SubscriptionItemEntityTypeEnumSchema } from '../../enums/subscription-item-entity-type.schema.js';
import { SubscriptionItemSourceTypeEnumSchema } from '../../enums/subscription-item-source-type.schema.js';

/**
 * SubscriptionItem Query Schema
 *
 * Schema for filtering and searching subscription items with polymorphic criteria.
 */
export const SubscriptionItemQuerySchema = z.object({
    // Polymorphic source filtering
    sourceId: z.string().uuid().optional(),
    sourceType: SubscriptionItemSourceTypeEnumSchema.optional(),
    sourceIds: z.array(z.string().uuid()).optional(),
    sourceTypes: z.array(SubscriptionItemSourceTypeEnumSchema).optional(),

    // Polymorphic entity filtering
    linkedEntityId: z.string().uuid().optional(),
    entityType: SubscriptionItemEntityTypeEnumSchema.optional(),
    linkedEntityIds: z.array(z.string().uuid()).optional(),
    entityTypes: z.array(SubscriptionItemEntityTypeEnumSchema).optional(),

    // Combined polymorphic filtering
    polymorphicPairs: z
        .array(
            z.object({
                sourceId: z.string().uuid().optional(),
                sourceType: SubscriptionItemSourceTypeEnumSchema.optional(),
                linkedEntityId: z.string().uuid().optional(),
                entityType: SubscriptionItemEntityTypeEnumSchema.optional()
            })
        )
        .optional(),

    // Pagination and sorting
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'sourceType', 'entityType']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Lifecycle and audit
    includeDeleted: z.boolean().default(false),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional()
});

export type SubscriptionItemQuery = z.infer<typeof SubscriptionItemQuerySchema>;

/**
 * SubscriptionItem List Query Schema
 *
 * Simplified schema for basic subscription item listing.
 */
export const SubscriptionItemListQuerySchema = SubscriptionItemQuerySchema.pick({
    sourceId: true,
    sourceType: true,
    entityType: true,
    page: true,
    pageSize: true,
    sortBy: true,
    sortOrder: true,
    includeDeleted: true
});

export type SubscriptionItemListQuery = z.infer<typeof SubscriptionItemListQuerySchema>;

/**
 * SubscriptionItem by Source Query Schema
 *
 * Query schema for finding all items belonging to a specific source.
 */
export const SubscriptionItemBySourceQuerySchema = z.object({
    sourceId: z.string().uuid(),
    sourceType: SubscriptionItemSourceTypeEnumSchema.optional(),
    entityTypes: z.array(SubscriptionItemEntityTypeEnumSchema).optional(),
    includeDeleted: z.boolean().default(false)
});

export type SubscriptionItemBySourceQuery = z.infer<typeof SubscriptionItemBySourceQuerySchema>;

/**
 * SubscriptionItem by Entity Query Schema
 *
 * Query schema for finding all items pointing to a specific entity.
 */
export const SubscriptionItemByEntityQuerySchema = z.object({
    linkedEntityId: z.string().uuid(),
    entityType: SubscriptionItemEntityTypeEnumSchema.optional(),
    sourceTypes: z.array(SubscriptionItemSourceTypeEnumSchema).optional(),
    includeDeleted: z.boolean().default(false)
});

export type SubscriptionItemByEntityQuery = z.infer<typeof SubscriptionItemByEntityQuerySchema>;

/**
 * SubscriptionItem Stats Query Schema
 *
 * Schema for subscription item statistics and aggregation queries.
 */
export const SubscriptionItemStatsQuerySchema = z.object({
    groupBy: z.enum(['sourceType', 'entityType', 'combination']).default('entityType'),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sourceType: SubscriptionItemSourceTypeEnumSchema.optional(),
    entityType: SubscriptionItemEntityTypeEnumSchema.optional()
});

export type SubscriptionItemStatsQuery = z.infer<typeof SubscriptionItemStatsQuerySchema>;
