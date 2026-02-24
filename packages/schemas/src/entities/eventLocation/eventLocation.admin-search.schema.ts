import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search schema for event locations.
 * Extends base admin search with location-specific filters.
 */
export const EventLocationAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by city */
    city: z.string().optional().describe('Filter by city name'),
    /** Minimum venue capacity */
    minCapacity: z.coerce.number().int().min(1).optional().describe('Minimum venue capacity'),
    /** Maximum venue capacity */
    maxCapacity: z.coerce.number().int().min(1).optional().describe('Maximum venue capacity'),
    /** Filter by verified status */
    isVerified: z.coerce.boolean().optional().describe('Filter by verified status')
});

export type EventLocationAdminSearch = z.infer<typeof EventLocationAdminSearchSchema>;
