import { z } from 'zod';
import { RevalidationStatusEnum, RevalidationTriggerEnum } from './revalidation-log.schema.js';

/**
 * RevalidationLogFilterSchema
 *
 * Query filter schema for listing revalidation log entries.
 * All fields are optional — omitted fields are not applied as filters.
 * Includes pagination via `page` and `pageSize` to prevent unbounded result sets.
 */
export const RevalidationLogFilterSchema = z.object({
    /** Filter by entity type (e.g., `accommodation`, `destination`) */
    entityType: z.string().optional(),
    /** Filter by specific entity ID */
    entityId: z.string().optional(),
    /** Filter by what triggered the revalidation */
    trigger: RevalidationTriggerEnum.optional(),
    /** Filter by revalidation outcome */
    status: RevalidationStatusEnum.optional(),
    /** Return only log entries created on or after this date */
    fromDate: z.coerce.date().optional(),
    /** Return only log entries created on or before this date */
    toDate: z.coerce.date().optional(),
    /** Page number (1-based) */
    page: z.coerce.number().int().min(1).default(1),
    /** Number of items per page (max 100) */
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/** Query filter type for listing revalidation logs */
export type RevalidationLogFilter = z.infer<typeof RevalidationLogFilterSchema>;
