import { z } from 'zod';

/**
 * Supported entity types for ISR revalidation.
 * Each value corresponds to a content entity that can be revalidated on-demand.
 */
export const RevalidationEntityTypeEnum = z.enum([
    'accommodation',
    'destination',
    'event',
    'post',
    'accommodation_review',
    'destination_review',
    'tag',
    'amenity'
]);

/** Union type of all supported revalidation entity types */
export type RevalidationEntityType = z.infer<typeof RevalidationEntityTypeEnum>;

/**
 * RevalidationConfigSchema
 *
 * Defines the configuration for automatic ISR revalidation per entity type.
 * Each entity type has exactly one config record controlling its revalidation behavior.
 */
export const RevalidationConfigSchema = z.object({
    /** Unique identifier for the config record */
    id: z.string().uuid(),
    /** The entity type this configuration applies to */
    entityType: RevalidationEntityTypeEnum,
    /** Whether to automatically revalidate affected paths when the entity changes */
    autoRevalidateOnChange: z.boolean(),
    /** Interval in minutes for cron-based revalidation (1 minute to 1 week / 10080 minutes) */
    cronIntervalMinutes: z.number().int().min(1).max(10080),
    /** Seconds to wait after a change before triggering revalidation, to batch rapid updates */
    debounceSeconds: z.number().int().min(0).max(300),
    /** Whether this revalidation config is active */
    enabled: z.boolean(),
    /** Timestamp when this config was created */
    createdAt: z.coerce.date(),
    /** Timestamp when this config was last updated */
    updatedAt: z.coerce.date()
});

/** Revalidation configuration for a single entity type */
export type RevalidationConfig = z.infer<typeof RevalidationConfigSchema>;
