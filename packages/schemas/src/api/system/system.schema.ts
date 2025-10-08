import { z } from 'zod';

/**
 * System API Schemas
 *
 * Schemas for system-level API endpoints like version, health checks, and ping.
 * These schemas provide consistent structure for system information endpoints.
 */

// ============================================================================
// VERSION SCHEMAS
// ============================================================================

/**
 * System version information schema
 * Used by version endpoints to provide API build and environment information
 */
export const SystemVersionSchema = z.object({
    version: z.string(),
    environment: z.string(),
    buildTime: z.string(),
    commit: z.string().optional()
});

export type SystemVersion = z.infer<typeof SystemVersionSchema>;

// ============================================================================
// HEALTH CHECK SCHEMAS
// ============================================================================

/**
 * Basic health check schema
 * Used for lightweight health check endpoints
 */
export const SystemHealthSchema = z.object({
    status: z.string(),
    timestamp: z.string(),
    uptime: z.number()
});

export type SystemHealth = z.infer<typeof SystemHealthSchema>;

// ============================================================================
// PING SCHEMAS
// ============================================================================

/**
 * Ping response schema
 * Used for simple ping/pong endpoints to test connectivity
 */
export const SystemPingSchema = z.object({
    message: z.string(),
    timestamp: z.string(),
    requestId: z.string()
});

export type SystemPing = z.infer<typeof SystemPingSchema>;
