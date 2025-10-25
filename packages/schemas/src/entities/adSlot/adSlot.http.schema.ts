import { z } from 'zod';

/**
 * AdSlot HTTP Schemas
 *
 * Simplified HTTP coercion schemas for URL parameters and query strings
 * related to ad slots. These handle string-to-type conversions for web requests.
 */

// HTTP coercion for ad slot ID parameter
export const AdSlotIdParamSchema = z.object({
    id: z.string().uuid({ message: 'zodError.adSlot.id.invalidFormat' })
});

// HTTP query parameters for ad slot listing
export const AdSlotListParamsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    q: z.string().optional(),

    // Filter parameters
    isActive: z.coerce.boolean().optional(),
    placementPage: z.string().optional(),
    position: z.string().optional(),
    pricingModel: z.string().optional(),
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    isTestSlot: z.coerce.boolean().optional()
});

// HTTP parameters for availability check
export const AdSlotAvailabilityParamsSchema = z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    slotIds: z.string().transform((val) => val.split(',').filter(Boolean)),
    includeBlackout: z.coerce.boolean().default(false)
});

// HTTP parameters for performance analytics
export const AdSlotPerformanceParamsSchema = z.object({
    slotIds: z.string().transform((val) => val.split(',').filter(Boolean)),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
    metrics: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional()
});

export type AdSlotIdParam = z.infer<typeof AdSlotIdParamSchema>;
export type AdSlotListParams = z.infer<typeof AdSlotListParamsSchema>;
export type AdSlotAvailabilityParams = z.infer<typeof AdSlotAvailabilityParamsSchema>;
export type AdSlotPerformanceParams = z.infer<typeof AdSlotPerformanceParamsSchema>;
