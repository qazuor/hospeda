/**
 * Authentication API Schemas
 *
 * Schemas for authentication endpoints including actor information,
 * cache statistics, and authentication status responses.
 */
import { z } from 'zod';

/**
 * Actor schema representing authenticated users and guests
 */
export const ActorSchema = z.object({
    id: z.string().describe('Actor unique identifier'),
    role: z.string().describe('Actor role (USER, ADMIN, GUEST, etc.)'),
    permissions: z.array(z.string()).describe('Array of permission strings')
});

export type Actor = z.infer<typeof ActorSchema>;

/**
 * Auth status response schema for /auth/me endpoint
 */
export const AuthMeResponseSchema = z.object({
    actor: ActorSchema,
    isAuthenticated: z.boolean().describe('Whether the actor is authenticated (not a guest)')
});

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

/**
 * Authentication status response schema for /auth/status endpoint
 */
export const AuthStatusResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        isAuthenticated: z.boolean().describe('Whether user is authenticated'),
        userId: z.string().nullish().describe('Clerk user ID if authenticated'),
        actor: ActorSchema
    }),
    metadata: z.object({
        timestamp: z.string().describe('Response timestamp'),
        requestId: z.string().describe('Unique request identifier')
    })
});

export type AuthStatusResponse = z.infer<typeof AuthStatusResponseSchema>;

/**
 * Cache statistics schema for cache performance monitoring
 */
export const CacheStatsSchema = z.object({
    size: z.number().describe('Current number of cached users'),
    maxSize: z.number().describe('Maximum cache capacity'),
    hitCount: z.number().describe('Total cache hits since startup'),
    missCount: z.number().describe('Total cache misses since startup'),
    hitRate: z.number().min(0).max(1).describe('Cache hit rate (0-1)'),
    pendingQueries: z.number().describe('Number of queries currently in progress')
});

export type CacheStats = z.infer<typeof CacheStatsSchema>;

/**
 * Cache performance metrics schema
 */
export const CachePerformanceSchema = z.object({
    hitRatePercentage: z.string().describe('Hit rate as percentage'),
    totalRequests: z.number().describe('Total requests processed'),
    efficiency: z.enum(['excellent', 'good', 'fair', 'poor']).describe('Cache efficiency rating')
});

export type CachePerformance = z.infer<typeof CachePerformanceSchema>;

/**
 * Complete cache statistics response schema for /auth/cache/stats endpoint
 */
export const CacheStatsResponseSchema = z.object({
    cache: CacheStatsSchema,
    performance: CachePerformanceSchema,
    recommendations: z.array(z.string()).describe('Performance recommendations')
});

export type CacheStatsResponse = z.infer<typeof CacheStatsResponseSchema>;

/**
 * Sync operation result schema for webhook/sync endpoints
 */
export const SyncUserResponseSchema = z.object({
    user: z.object({ id: z.string() }).passthrough().describe('User sync result')
});

export type SyncUserResponse = z.infer<typeof SyncUserResponseSchema>;
