import { z } from 'zod';

/**
 * Supported entity types for ISR revalidation.
 * Each value corresponds to a content entity that can be revalidated on-demand.
 *
 * This list MUST stay in step with two things that already knew about the five
 * types below long before this enum did: the `EntityChangeData` union in
 * `@repo/service-core` (which the cache-tag mapper switches on) and the
 * `revalidation_config` table (seeded for `pointOfInterest`/`attraction`/
 * `gastronomy`/`experience` by data-migration 0036, and for `partner` by 0046).
 *
 * While it lagged, the drift was silent in the worst way: purges scheduled from
 * service hooks worked fine — they never pass through this enum — but every
 * surface that DOES was blind to those types. The admin log filter could not
 * filter them, "revalidate by type" could not name them, and
 * `POST /revalidate/entity` rejected them at validation, which is what made the
 * commerce revalidate button impossible to add (HOS-389 §4b).
 */
export const RevalidationEntityTypeEnum = z.enum([
    'accommodation',
    'destination',
    'event',
    'post',
    'accommodation_review',
    'destination_review',
    'tag',
    'amenity',
    'gastronomy',
    'experience',
    'pointOfInterest',
    'attraction',
    'partner'
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
    /** Whether to automatically revalidate affected cache tags when the entity changes */
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
