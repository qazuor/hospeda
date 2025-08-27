import { adminLogger } from '@/utils/logger';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import {
    type CacheWarmingManager,
    type WarmingContext,
    getWarmingManager
} from '../strategies/cacheWarming';
import {
    type CacheStats,
    type MemoryOptimizationConfig,
    type MemoryOptimizationManager,
    getMemoryManager
} from '../strategies/memoryOptimization';
import {
    type InvalidationContext,
    type SmartInvalidationManager,
    getInvalidationManager
} from '../strategies/smartInvalidation';

/**
 * Advanced cache configuration
 */
export type AdvancedCacheConfig = {
    /** Memory optimization configuration */
    readonly memoryOptimization?: MemoryOptimizationConfig;
    /** Whether to enable automatic cache warming */
    readonly enableCacheWarming?: boolean;
    /** Whether to enable smart invalidation */
    readonly enableSmartInvalidation?: boolean;
    /** Whether to start monitoring immediately */
    readonly autoStart?: boolean;
    /** Debug mode for verbose logging */
    readonly debug?: boolean;
};

/**
 * Cache operation result
 */
export type CacheOperationResult = {
    readonly success: boolean;
    readonly executionTime: number;
    readonly details: string;
    readonly error?: string;
};

/**
 * Advanced cache analytics
 */
export type AdvancedCacheAnalytics = {
    readonly invalidation: ReturnType<SmartInvalidationManager['getAnalytics']>;
    readonly warming: ReturnType<CacheWarmingManager['getAnalytics']>;
    readonly memory: ReturnType<MemoryOptimizationManager['getCleanupAnalytics']>;
    readonly cacheStats: CacheStats;
};

/**
 * Advanced cache management hook
 *
 * Provides a unified interface for all cache strategies including
 * smart invalidation, cache warming, and memory optimization.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     invalidate,
 *     warmCache,
 *     cleanup,
 *     analytics,
 *     isMonitoring
 *   } = useAdvancedCache({
 *     memoryOptimization: {
 *       maxCacheSizeMB: 50,
 *       autoCleanup: true
 *     },
 *     enableCacheWarming: true,
 *     autoStart: true
 *   });
 *
 *   const handleUserUpdate = async (userData) => {
 *     // Update user data
 *     await updateUser(userData);
 *
 *     // Smart invalidation
 *     await invalidate({
 *       entity: 'user',
 *       operation: 'update',
 *       data: userData
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <p>Cache Size: {analytics.cacheStats.estimatedSizeMB.toFixed(2)}MB</p>
 *       <p>Total Queries: {analytics.cacheStats.totalQueries}</p>
 *       <button onClick={() => cleanup()}>Clean Cache</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useAdvancedCache = (config: AdvancedCacheConfig = {}) => {
    const queryClient = useQueryClient();
    const managersRef = useRef<{
        invalidation: SmartInvalidationManager | null;
        warming: CacheWarmingManager | null;
        memory: MemoryOptimizationManager | null;
    }>({ invalidation: null, warming: null, memory: null });

    const {
        memoryOptimization = {},
        enableCacheWarming = true,
        enableSmartInvalidation = true,
        autoStart = true,
        debug = false
    } = config;

    // Initialize managers
    useEffect(() => {
        if (enableSmartInvalidation) {
            managersRef.current.invalidation = getInvalidationManager(queryClient);
        }

        if (enableCacheWarming) {
            managersRef.current.warming = getWarmingManager(queryClient);
        }

        managersRef.current.memory = getMemoryManager(queryClient, memoryOptimization);

        if (autoStart && managersRef.current.memory) {
            managersRef.current.memory.startMonitoring();
        }

        if (debug) {
            adminLogger.info(
                'Advanced cache initialized',
                JSON.stringify({
                    smartInvalidation: enableSmartInvalidation,
                    cacheWarming: enableCacheWarming,
                    memoryOptimization: !!managersRef.current.memory,
                    autoStart
                })
            );
        }

        // Cleanup on unmount
        return () => {
            if (managersRef.current.memory) {
                managersRef.current.memory.stopMonitoring();
            }
        };
    }, [
        queryClient,
        enableCacheWarming,
        enableSmartInvalidation,
        autoStart,
        debug,
        memoryOptimization
    ]);

    /**
     * Trigger smart cache invalidation
     */
    const invalidate = useCallback(
        async (context: InvalidationContext): Promise<CacheOperationResult> => {
            const startTime = Date.now();

            try {
                if (!managersRef.current.invalidation) {
                    throw new Error('Smart invalidation is not enabled');
                }

                const results = await managersRef.current.invalidation.invalidate(context);
                const totalInvalidated = results.reduce((sum, r) => sum + r.queriesInvalidated, 0);

                return {
                    success: true,
                    executionTime: Date.now() - startTime,
                    details: `Invalidated ${totalInvalidated} queries using ${results.length} strategies`
                };
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                adminLogger.error(
                    'Cache invalidation failed:',
                    error instanceof Error ? error.message : String(error)
                );

                return {
                    success: false,
                    executionTime: Date.now() - startTime,
                    details: 'Invalidation failed',
                    error: errorMsg
                };
            }
        },
        []
    );

    /**
     * Trigger cache warming
     */
    const warmCache = useCallback(
        async (context: WarmingContext): Promise<CacheOperationResult> => {
            const startTime = Date.now();

            try {
                if (!managersRef.current.warming) {
                    throw new Error('Cache warming is not enabled');
                }

                const results = await managersRef.current.warming.warmCache(context);
                const totalWarmed = results.reduce((sum, r) => sum + r.queriesWarmed, 0);

                return {
                    success: true,
                    executionTime: Date.now() - startTime,
                    details: `Warmed ${totalWarmed} queries using ${results.length} strategies`
                };
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                adminLogger.error(
                    'Cache warming failed:',
                    error instanceof Error ? error.message : String(error)
                );

                return {
                    success: false,
                    executionTime: Date.now() - startTime,
                    details: 'Cache warming failed',
                    error: errorMsg
                };
            }
        },
        []
    );

    /**
     * Trigger cache cleanup
     */
    const cleanup = useCallback(async (force = false): Promise<CacheOperationResult> => {
        const startTime = Date.now();

        try {
            if (!managersRef.current.memory) {
                throw new Error('Memory optimization is not available');
            }

            const result = await managersRef.current.memory.cleanup(force);

            return {
                success: true,
                executionTime: Date.now() - startTime,
                details: `Removed ${result.queriesRemoved} queries, freed ${result.memoryFreedMB.toFixed(2)}MB`
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            adminLogger.error(
                'Cache cleanup failed:',
                error instanceof Error ? error.message : String(error)
            );

            return {
                success: false,
                executionTime: Date.now() - startTime,
                details: 'Cache cleanup failed',
                error: errorMsg
            };
        }
    }, []);

    /**
     * Warm cache for specific route
     */
    const warmRoute = useCallback(
        async (route: string): Promise<CacheOperationResult> => {
            return warmCache({ route, timestamp: Date.now() });
        },
        [warmCache]
    );

    /**
     * Invalidate specific patterns
     */
    const invalidatePatterns = useCallback(
        async (
            patterns: readonly string[],
            options: { exactMatch?: boolean; refetchActive?: boolean } = {}
        ): Promise<CacheOperationResult> => {
            const startTime = Date.now();

            try {
                if (!managersRef.current.invalidation) {
                    throw new Error('Smart invalidation is not enabled');
                }

                const result = await managersRef.current.invalidation.invalidatePatterns(
                    patterns,
                    options
                );

                return {
                    success: result.success,
                    executionTime: Date.now() - startTime,
                    details: `Invalidated ${result.queriesInvalidated} queries matching patterns`
                };
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                adminLogger.error(
                    'Pattern invalidation failed:',
                    error instanceof Error ? error.message : String(error)
                );

                return {
                    success: false,
                    executionTime: Date.now() - startTime,
                    details: 'Pattern invalidation failed',
                    error: errorMsg
                };
            }
        },
        []
    );

    /**
     * Start memory monitoring
     */
    const startMonitoring = useCallback((): void => {
        if (managersRef.current.memory) {
            managersRef.current.memory.startMonitoring();
        }
    }, []);

    /**
     * Stop memory monitoring
     */
    const stopMonitoring = useCallback((): void => {
        if (managersRef.current.memory) {
            managersRef.current.memory.stopMonitoring();
        }
    }, []);

    /**
     * Get comprehensive cache analytics
     */
    const getAnalytics = useCallback((): AdvancedCacheAnalytics | null => {
        try {
            const invalidation = managersRef.current.invalidation?.getAnalytics() ?? {
                totalInvalidations: 0,
                averageExecutionTime: 0,
                successRate: 100,
                topStrategies: [],
                recentResults: []
            };

            const warming = managersRef.current.warming?.getAnalytics() ?? {
                totalWarmings: 0,
                averageExecutionTime: 0,
                successRate: 100,
                topStrategies: [],
                recentResults: []
            };

            const memory = managersRef.current.memory?.getCleanupAnalytics() ?? {
                totalCleanups: 0,
                totalQueriesRemoved: 0,
                totalMemoryFreedMB: 0,
                averageExecutionTime: 0,
                cleanupsByTrigger: {},
                recentCleanups: []
            };

            const cacheStats = managersRef.current.memory?.getCacheStats() ?? {
                totalQueries: 0,
                activeQueries: 0,
                staleQueries: 0,
                estimatedSizeMB: 0,
                memoryPressure: 0,
                oldestQueryAge: 0,
                newestQueryAge: 0
            };

            return {
                invalidation,
                warming,
                memory,
                cacheStats
            };
        } catch (error) {
            adminLogger.error(
                'Failed to get cache analytics:',
                error instanceof Error ? error.message : String(error)
            );
            return null;
        }
    }, []);

    /**
     * Clear all analytics
     */
    const clearAnalytics = useCallback((): void => {
        managersRef.current.invalidation?.clearAnalytics();
        managersRef.current.warming?.clearAnalytics();
        managersRef.current.memory?.clearAnalytics();
    }, []);

    // Get current analytics
    const analytics = getAnalytics();

    return {
        // Core operations
        invalidate,
        warmCache,
        cleanup,

        // Convenience methods
        warmRoute,
        invalidatePatterns,

        // Monitoring control
        startMonitoring,
        stopMonitoring,
        isMonitoring: managersRef.current.memory !== null,

        // Analytics
        analytics,
        getAnalytics,
        clearAnalytics,

        // Managers (for advanced usage)
        managers: {
            invalidation: managersRef.current.invalidation,
            warming: managersRef.current.warming,
            memory: managersRef.current.memory
        }
    };
};
