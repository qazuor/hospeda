import { z } from 'zod';

/**
 * Health Check Schemas
 *
 * This file contains schemas specifically for health check endpoints:
 * - Basic health status
 * - Database health status
 * - Liveness checks
 * - Readiness checks
 */

// ============================================================================
// BASIC HEALTH DATA SCHEMA
// ============================================================================

/**
 * Schema for basic health check data
 * Used by the main /health endpoint
 */
export const HealthDataSchema = z.object({
    status: z.enum(['healthy', 'unhealthy'], {
        message: 'zodError.health.status.invalidType'
    }),
    timestamp: z.string({
        message: 'zodError.health.timestamp.invalidType'
    }),
    uptime: z
        .number({
            message: 'zodError.health.uptime.invalidType'
        })
        .min(0, { message: 'zodError.health.uptime.min' }),
    version: z.string({
        message: 'zodError.health.version.invalidType'
    }),
    environment: z.string({
        message: 'zodError.health.environment.invalidType'
    })
});
export type HealthData = z.infer<typeof HealthDataSchema>;

// ============================================================================
// DATABASE HEALTH DATA SCHEMA
// ============================================================================

/**
 * Schema for database health check data
 * Used by the /health/db endpoint
 */
export const DatabaseHealthDataSchema = z.object({
    status: z.enum(['up', 'down'], {
        message: 'zodError.health.database.status.invalidType'
    }),
    database: z.object({
        status: z.enum(['connected', 'disconnected'], {
            message: 'zodError.health.database.connection.status.invalidType'
        }),
        responseTime: z
            .number({
                message: 'zodError.health.database.responseTime.invalidType'
            })
            .min(0, { message: 'zodError.health.database.responseTime.min' })
            .optional(),
        error: z
            .string({
                message: 'zodError.health.database.error.invalidType'
            })
            .optional()
    }),
    timestamp: z.string({
        message: 'zodError.health.timestamp.invalidType'
    }),
    uptime: z
        .number({
            message: 'zodError.health.uptime.invalidType'
        })
        .min(0, { message: 'zodError.health.uptime.min' }),
    version: z.string({
        message: 'zodError.health.version.invalidType'
    }),
    environment: z.string({
        message: 'zodError.health.environment.invalidType'
    })
});
export type DatabaseHealthData = z.infer<typeof DatabaseHealthDataSchema>;

// ============================================================================
// LIVENESS DATA SCHEMA
// ============================================================================

/**
 * Schema for liveness check data
 * Used by the /health/live endpoint
 */
export const LivenessDataSchema = z.object({
    alive: z.boolean({
        message: 'zodError.health.liveness.alive.invalidType'
    }),
    timestamp: z.string({
        message: 'zodError.health.timestamp.invalidType'
    })
});
export type LivenessData = z.infer<typeof LivenessDataSchema>;

// ============================================================================
// READINESS DATA SCHEMA
// ============================================================================

/**
 * Schema for readiness check data
 * Used by the /health/ready endpoint
 */
export const ReadinessDataSchema = z.object({
    ready: z.boolean({
        message: 'zodError.health.readiness.ready.invalidType'
    }),
    timestamp: z.string({
        message: 'zodError.health.timestamp.invalidType'
    })
});
export type ReadinessData = z.infer<typeof ReadinessDataSchema>;

// ============================================================================
// METADATA SCHEMA
// ============================================================================

/**
 * Schema for health check response metadata
 * Used in all health check responses
 */
export const HealthMetadataSchema = z.object({
    timestamp: z.string({
        message: 'zodError.health.metadata.timestamp.invalidType'
    }),
    requestId: z.string({
        message: 'zodError.health.metadata.requestId.invalidType'
    })
});
export type HealthMetadata = z.infer<typeof HealthMetadataSchema>;

// ============================================================================
// COMPLETE RESPONSE SCHEMAS
// ============================================================================

/**
 * Complete health check response schema
 * Combines success response structure with health data
 */
export const HealthResponseSchema = z.object({
    data: HealthDataSchema,
    metadata: HealthMetadataSchema
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Complete database health check response schema
 * Combines success response structure with database health data
 */
export const DatabaseHealthResponseSchema = z.object({
    data: DatabaseHealthDataSchema,
    metadata: HealthMetadataSchema
});
export type DatabaseHealthResponse = z.infer<typeof DatabaseHealthResponseSchema>;

/**
 * Complete liveness check response schema
 * Combines success response structure with liveness data
 */
export const LivenessResponseSchema = z.object({
    success: z.boolean({
        message: 'zodError.response.success.invalidType'
    }),
    data: LivenessDataSchema,
    metadata: HealthMetadataSchema
});
export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;

/**
 * Complete readiness check response schema
 * Combines success response structure with readiness data
 */
export const ReadinessResponseSchema = z.object({
    success: z.boolean({
        message: 'zodError.response.success.invalidType'
    }),
    data: ReadinessDataSchema,
    metadata: HealthMetadataSchema
});
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
