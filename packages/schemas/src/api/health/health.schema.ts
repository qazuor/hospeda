import { z } from 'zod';

/**
 * Health Check API Schemas
 *
 * Schemas for health check endpoints including readiness, liveness, and database health.
 * These schemas provide consistent structure for monitoring and health check responses.
 */

// ============================================================================
// READINESS SCHEMAS
// ============================================================================

/**
 * Readiness check response schema
 * Indicates if the service is ready to serve requests
 */
export const HealthReadinessSchema = z.object({
    ready: z.boolean(),
    timestamp: z.string()
});

export type HealthReadiness = z.infer<typeof HealthReadinessSchema>;

// ============================================================================
// DATABASE HEALTH SCHEMAS
// ============================================================================

/**
 * Database health check response schema
 * Returns detailed status of database connection and performance
 */
export const HealthDatabaseSchema = z.object({
    status: z.enum(['up', 'down']),
    database: z.object({
        status: z.enum(['connected', 'disconnected']),
        responseTime: z.number().optional(),
        error: z.string().optional()
    }),
    timestamp: z.string(),
    uptime: z.number(),
    version: z.string(),
    environment: z.string()
});

export type HealthDatabase = z.infer<typeof HealthDatabaseSchema>;

// ============================================================================
// MAIN HEALTH SCHEMAS
// ============================================================================

/**
 * Main health check response schema
 * Returns overall health status of the API
 */
export const HealthSystemSchema = z.object({
    status: z.enum(['healthy', 'unhealthy']),
    timestamp: z.string(),
    uptime: z.number(),
    version: z.string(),
    environment: z.string()
});

export type HealthSystem = z.infer<typeof HealthSystemSchema>;

// ============================================================================
// LIVENESS SCHEMAS
// ============================================================================

/**
 * Liveness check response schema
 * Indicates if the service is alive (used in standardized response format)
 */
export const HealthLivenessDataSchema = z.object({
    alive: z.boolean(),
    timestamp: z.string()
});

/**
 * Complete liveness response with metadata
 * Used by liveness endpoints that follow the standard API response pattern
 */
export const HealthLivenessSchema = z.object({
    success: z.boolean(),
    data: HealthLivenessDataSchema,
    metadata: z.object({
        timestamp: z.string(),
        requestId: z.string()
    })
});

export type HealthLivenessData = z.infer<typeof HealthLivenessDataSchema>;
export type HealthLiveness = z.infer<typeof HealthLivenessSchema>;
