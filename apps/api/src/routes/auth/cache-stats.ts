import { z } from '@hono/zod-openapi';
import { createSimpleRoute } from '../../utils/route-factory';
import { userCache } from '../../utils/user-cache';

/**
 * Cache statistics endpoint for monitoring and debugging
 * Returns comprehensive cache performance metrics
 */
export const cacheStatsRoute = createSimpleRoute({
    method: 'get',
    path: '/cache/stats',
    summary: 'Get user cache statistics',
    description: 'Returns comprehensive cache performance metrics for monitoring and debugging',
    tags: ['Auth', 'Monitoring'],
    options: { skipAuth: true }, // Allow monitoring without authentication
    responseSchema: z
        .object({
            cache: z.object({
                size: z.number().describe('Current number of cached users'),
                maxSize: z.number().describe('Maximum cache capacity'),
                hitCount: z.number().describe('Total cache hits since startup'),
                missCount: z.number().describe('Total cache misses since startup'),
                hitRate: z.number().min(0).max(1).describe('Cache hit rate (0-1)'),
                pendingQueries: z.number().describe('Number of queries currently in progress')
            }),
            performance: z.object({
                hitRatePercentage: z.string().describe('Hit rate as percentage'),
                totalRequests: z.number().describe('Total requests processed'),
                efficiency: z
                    .enum(['excellent', 'good', 'fair', 'poor'])
                    .describe('Cache efficiency rating')
            }),
            recommendations: z.array(z.string()).describe('Performance recommendations')
        })
        .openapi('CacheStatsResponse'),
    handler: async () => {
        const stats = userCache.getStats();
        const totalRequests = stats.hitCount + stats.missCount;
        const hitRatePercentage =
            totalRequests > 0 ? `${(stats.hitRate * 100).toFixed(1)}%` : '0.0%';

        // Determine efficiency rating
        let efficiency: 'excellent' | 'good' | 'fair' | 'poor';
        if (stats.hitRate >= 0.9) efficiency = 'excellent';
        else if (stats.hitRate >= 0.7) efficiency = 'good';
        else if (stats.hitRate >= 0.5) efficiency = 'fair';
        else efficiency = 'poor';

        // Generate recommendations
        const recommendations: string[] = [];

        if (stats.hitRate < 0.5 && totalRequests > 10) {
            recommendations.push(
                'Low hit rate detected. Consider increasing cache TTL or investigating cache invalidation patterns.'
            );
        }

        if (stats.size >= stats.maxSize * 0.9) {
            recommendations.push(
                'Cache is near capacity. Consider increasing max size or reducing TTL.'
            );
        }

        if (stats.pendingQueries > 5) {
            recommendations.push(
                'High number of pending queries. This may indicate slow database responses.'
            );
        }

        if (totalRequests === 0) {
            recommendations.push(
                'No cache activity detected. Verify that the cache is being used properly.'
            );
        }

        if (stats.hitRate >= 0.9 && totalRequests > 50) {
            recommendations.push('Excellent cache performance! Current configuration is optimal.');
        }

        return {
            cache: {
                size: stats.size,
                maxSize: stats.maxSize,
                hitCount: stats.hitCount,
                missCount: stats.missCount,
                hitRate: stats.hitRate,
                pendingQueries: stats.pendingQueries
            },
            performance: {
                hitRatePercentage,
                totalRequests,
                efficiency
            },
            recommendations
        };
    }
});
