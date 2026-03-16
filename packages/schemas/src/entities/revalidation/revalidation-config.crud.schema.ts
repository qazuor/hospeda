import { z } from 'zod';

/**
 * UpdateRevalidationConfigInputSchema
 *
 * Input schema for updating a revalidation config record (PATCH semantics).
 * All fields are optional — only provided fields will be updated.
 */
export const UpdateRevalidationConfigInputSchema = z.object({
    /** Whether to automatically revalidate affected paths when the entity changes */
    autoRevalidateOnChange: z.boolean().optional(),
    /** Interval in minutes for cron-based revalidation (1 minute to 1 week / 10080 minutes) */
    cronIntervalMinutes: z.number().int().min(1).max(10080).optional(),
    /** Seconds to wait after a change before triggering revalidation */
    debounceSeconds: z.number().int().min(0).max(300).optional(),
    /** Whether this revalidation config is active */
    enabled: z.boolean().optional()
});

/** Input type for updating a revalidation configuration */
export type UpdateRevalidationConfigInput = z.infer<typeof UpdateRevalidationConfigInputSchema>;
