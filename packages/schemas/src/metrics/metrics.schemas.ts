/**
 * Metrics schemas
 * Zod schemas for metrics-related data
 * @module schemas/metrics
 */

import { z } from 'zod';

/**
 * Metrics response schema
 * Used for API endpoint metrics responses
 */
export const MetricsResponseSchema = z.object({
    summary: z.object({
        totalRequests: z.number(),
        totalErrors: z.number(),
        globalErrorRate: z.number(),
        activeConnections: z.number(),
        timestamp: z.string()
    }),
    endpoints: z.array(
        z.object({
            endpoint: z.string(),
            requests: z.number(),
            errors: z.number(),
            errorRate: z.number(),
            avgResponseTime: z.number(),
            maxResponseTime: z.number(),
            minResponseTime: z.number()
        })
    )
});

export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;

/**
 * Metrics API response wrapper schemas
 * Consistent response format for metrics endpoints
 */
export const MetricsSuccessResponseSchema = z.object({
    success: z.boolean(),
    data: MetricsResponseSchema
});

export type MetricsSuccessResponse = z.infer<typeof MetricsSuccessResponseSchema>;

/**
 * Simple success response for metrics operations
 */
export const MetricsOperationResponseSchema = z.object({
    success: z.boolean(),
    message: z.string()
});

export type MetricsOperationResponse = z.infer<typeof MetricsOperationResponseSchema>;
