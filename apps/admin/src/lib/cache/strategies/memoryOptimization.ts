import { adminLogger } from '@/utils/logger';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Memory optimization configuration
 */
export type MemoryOptimizationConfig = {
    /** Maximum cache size in MB */
    readonly maxCacheSizeMB?: number;
    /** Maximum number of queries to keep in cache */
    readonly maxQueries?: number;
    /** Garbage collection interval in milliseconds */
    readonly gcInterval?: number;
    /** Stale time threshold for cleanup (ms) */
    readonly staleThreshold?: number;
    /** Whether to enable automatic cleanup */
    readonly autoCleanup?: boolean;
    /** Memory pressure threshold (0-1) */
    readonly memoryPressureThreshold?: number;
};

/**
 * Cache statistics
 */
export type CacheStats = {
    readonly totalQueries: number;
    readonly activeQueries: number;
    readonly staleQueries: number;
    readonly estimatedSizeMB: number;
    readonly memoryPressure: number;
    readonly oldestQueryAge: number;
    readonly newestQueryAge: number;
};

/**
 * Cleanup result
 */
export type CleanupResult = {
    readonly queriesRemoved: number;
    readonly memoryFreedMB: number;
    readonly executionTime: number;
    readonly trigger: 'manual' | 'automatic' | 'memory-pressure' | 'scheduled';
};

/**
 * Memory optimization and cache management
 *
 * Monitors cache memory usage and automatically cleans up stale or
 * unnecessary queries to prevent memory leaks and maintain performance.
 *
 * @example
 * ```tsx
 * const memoryManager = new MemoryOptimizationManager(queryClient, {
 *   maxCacheSizeMB: 50,
 *   maxQueries: 1000,
 *   autoCleanup: true,
 *   gcInterval: 5 * 60 * 1000 // 5 minutes
 * });
 *
 * // Start monitoring
 * memoryManager.startMonitoring();
 *
 * // Manual cleanup
 * const result = await memoryManager.cleanup();
 * console.log(`Freed ${result.memoryFreedMB}MB`);
 * ```
 */
export class MemoryOptimizationManager {
    private readonly queryClient: QueryClient;
    private readonly config: Required<MemoryOptimizationConfig>;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private readonly cleanupHistory: CleanupResult[] = [];
    private readonly maxHistorySize = 20;

    constructor(queryClient: QueryClient, config: MemoryOptimizationConfig = {}) {
        this.queryClient = queryClient;
        this.config = {
            maxCacheSizeMB: config.maxCacheSizeMB ?? 100,
            maxQueries: config.maxQueries ?? 2000,
            gcInterval: config.gcInterval ?? 5 * 60 * 1000, // 5 minutes
            staleThreshold: config.staleThreshold ?? 30 * 60 * 1000, // 30 minutes
            autoCleanup: config.autoCleanup ?? true,
            memoryPressureThreshold: config.memoryPressureThreshold ?? 0.8
        };
    }

    /**
     * Start automatic memory monitoring
     */
    startMonitoring(): void {
        if (this.monitoringInterval) {
            return; // Already monitoring
        }

        adminLogger.info('Starting cache memory monitoring');

        this.monitoringInterval = setInterval(() => {
            this.performAutomaticCleanup();
        }, this.config.gcInterval);
    }

    /**
     * Stop automatic memory monitoring
     */
    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            adminLogger.info('Stopped cache memory monitoring');
        }
    }

    /**
     * Get current cache statistics
     */
    getCacheStats(): CacheStats {
        const queryCache = this.queryClient.getQueryCache();
        const allQueries = queryCache.getAll();

        const now = Date.now();
        const activeQueries = allQueries.filter(
            (query) => query.state.status === 'pending' || query.getObserversCount() > 0
        );
        const staleQueries = allQueries.filter((query) => {
            const lastUpdated = query.state.dataUpdatedAt || 0;
            return now - lastUpdated > this.config.staleThreshold;
        });

        // Estimate memory usage (rough approximation)
        const estimatedSizeMB = this.estimateCacheSize(allQueries);

        // Calculate memory pressure
        const memoryPressure = Math.min(
            estimatedSizeMB / this.config.maxCacheSizeMB,
            allQueries.length / this.config.maxQueries
        );

        // Find oldest and newest queries
        const queryAges = allQueries
            .map((query) => now - (query.state.dataUpdatedAt || now))
            .filter((age) => age >= 0);

        const oldestQueryAge = queryAges.length > 0 ? Math.max(...queryAges) : 0;
        const newestQueryAge = queryAges.length > 0 ? Math.min(...queryAges) : 0;

        return {
            totalQueries: allQueries.length,
            activeQueries: activeQueries.length,
            staleQueries: staleQueries.length,
            estimatedSizeMB,
            memoryPressure,
            oldestQueryAge,
            newestQueryAge
        };
    }

    /**
     * Perform manual cache cleanup
     */
    async cleanup(force = false): Promise<CleanupResult> {
        const startTime = Date.now();
        const initialStats = this.getCacheStats();

        adminLogger.info(
            'Starting manual cache cleanup',
            JSON.stringify({
                initialQueries: initialStats.totalQueries,
                initialSizeMB: initialStats.estimatedSizeMB
            })
        );

        let queriesRemoved = 0;

        // Remove stale queries
        queriesRemoved += this.removeStaleQueries();

        // Remove excess queries if over limits
        if (
            force ||
            this.shouldCleanupBySize(initialStats) ||
            this.shouldCleanupByCount(initialStats)
        ) {
            queriesRemoved += this.removeExcessQueries();
        }

        // Force garbage collection on remaining queries
        this.queryClient.getQueryCache().clear();

        const finalStats = this.getCacheStats();
        const memoryFreedMB = Math.max(
            0,
            initialStats.estimatedSizeMB - finalStats.estimatedSizeMB
        );
        const executionTime = Date.now() - startTime;

        const result: CleanupResult = {
            queriesRemoved,
            memoryFreedMB,
            executionTime,
            trigger: 'manual'
        };

        this.recordCleanup(result);

        adminLogger.info(
            'Cache cleanup completed',
            JSON.stringify({
                queriesRemoved,
                memoryFreedMB: memoryFreedMB.toFixed(2),
                executionTime
            })
        );

        return result;
    }

    /**
     * Remove specific query patterns
     */
    removeQueryPatterns(patterns: readonly string[]): number {
        let removed = 0;
        const queryCache = this.queryClient.getQueryCache();

        for (const pattern of patterns) {
            const matchingQueries = queryCache.findAll({
                predicate: (query) => {
                    const queryKey = query.queryKey.join('.');
                    return queryKey.includes(pattern);
                }
            });

            for (const query of matchingQueries) {
                queryCache.remove(query);
                removed++;
            }
        }

        adminLogger.debug(
            `Removed ${removed} queries matching patterns:`,
            JSON.stringify(patterns)
        );
        return removed;
    }

    /**
     * Get cleanup history and analytics
     */
    getCleanupAnalytics(): {
        readonly totalCleanups: number;
        readonly totalQueriesRemoved: number;
        readonly totalMemoryFreedMB: number;
        readonly averageExecutionTime: number;
        readonly cleanupsByTrigger: Record<string, number>;
        readonly recentCleanups: readonly CleanupResult[];
    } {
        const totalCleanups = this.cleanupHistory.length;
        const totalQueriesRemoved = this.cleanupHistory.reduce(
            (sum, c) => sum + c.queriesRemoved,
            0
        );
        const totalMemoryFreedMB = this.cleanupHistory.reduce((sum, c) => sum + c.memoryFreedMB, 0);
        const averageExecutionTime =
            totalCleanups > 0
                ? this.cleanupHistory.reduce((sum, c) => sum + c.executionTime, 0) / totalCleanups
                : 0;

        const cleanupsByTrigger: Record<string, number> = {};
        for (const cleanup of this.cleanupHistory) {
            cleanupsByTrigger[cleanup.trigger] = (cleanupsByTrigger[cleanup.trigger] || 0) + 1;
        }

        return {
            totalCleanups,
            totalQueriesRemoved,
            totalMemoryFreedMB,
            averageExecutionTime,
            cleanupsByTrigger,
            recentCleanups: this.cleanupHistory.slice(-5)
        };
    }

    /**
     * Clear cleanup history
     */
    clearAnalytics(): void {
        this.cleanupHistory.length = 0;
        adminLogger.debug('Cache cleanup analytics cleared');
    }

    /**
     * Perform automatic cleanup based on configuration
     */
    private async performAutomaticCleanup(): Promise<void> {
        if (!this.config.autoCleanup) {
            return;
        }

        const stats = this.getCacheStats();

        // Check if cleanup is needed
        const needsCleanup =
            this.shouldCleanupByPressure(stats) ||
            this.shouldCleanupBySize(stats) ||
            this.shouldCleanupByCount(stats);

        if (!needsCleanup) {
            return;
        }

        const trigger = this.shouldCleanupByPressure(stats) ? 'memory-pressure' : 'automatic';

        const startTime = Date.now();

        let queriesRemoved = 0;

        // Remove stale queries first
        queriesRemoved += this.removeStaleQueries();

        // Remove excess queries if still needed
        if (this.shouldCleanupBySize(stats) || this.shouldCleanupByCount(stats)) {
            queriesRemoved += this.removeExcessQueries();
        }

        const finalStats = this.getCacheStats();
        const memoryFreedMB = Math.max(0, stats.estimatedSizeMB - finalStats.estimatedSizeMB);

        const result: CleanupResult = {
            queriesRemoved,
            memoryFreedMB,
            executionTime: Date.now() - startTime,
            trigger
        };

        this.recordCleanup(result);

        adminLogger.info(
            'Automatic cache cleanup completed',
            JSON.stringify({
                trigger,
                queriesRemoved,
                memoryFreedMB: memoryFreedMB.toFixed(2)
            })
        );
    }

    /**
     * Remove stale queries from cache
     */
    private removeStaleQueries(): number {
        const queryCache = this.queryClient.getQueryCache();
        const now = Date.now();
        let removed = 0;

        const staleQueries = queryCache.findAll({
            predicate: (query) => {
                const lastUpdated = query.state.dataUpdatedAt || 0;
                const age = now - lastUpdated;
                return age > this.config.staleThreshold && query.getObserversCount() === 0;
            }
        });

        for (const query of staleQueries) {
            queryCache.remove(query);
            removed++;
        }

        return removed;
    }

    /**
     * Remove excess queries to stay within limits
     */
    private removeExcessQueries(): number {
        const queryCache = this.queryClient.getQueryCache();
        const allQueries = queryCache.getAll();
        let removed = 0;

        // Sort queries by priority (least important first)
        const sortedQueries = allQueries
            .filter((query) => query.getObserversCount() === 0) // Only remove unobserved queries
            .sort((a, b) => {
                // Prioritize by: age (older first), then by size (larger first)
                const ageA = Date.now() - (a.state.dataUpdatedAt || 0);
                const ageB = Date.now() - (b.state.dataUpdatedAt || 0);

                if (ageA !== ageB) {
                    return ageB - ageA; // Older queries first
                }

                // Estimate size by data complexity (rough heuristic)
                const sizeA = this.estimateQuerySize(a);
                const sizeB = this.estimateQuerySize(b);
                return sizeB - sizeA; // Larger queries first
            });

        // Remove queries until we're under limits
        const stats = this.getCacheStats();
        const targetQueries = Math.floor(this.config.maxQueries * 0.8); // 80% of max
        const queriesToRemove = Math.max(0, stats.totalQueries - targetQueries);

        for (let i = 0; i < Math.min(queriesToRemove, sortedQueries.length); i++) {
            queryCache.remove(sortedQueries[i]);
            removed++;
        }

        return removed;
    }

    /**
     * Check if cleanup is needed due to memory pressure
     */
    private shouldCleanupByPressure(stats: CacheStats): boolean {
        return stats.memoryPressure > this.config.memoryPressureThreshold;
    }

    /**
     * Check if cleanup is needed due to cache size
     */
    private shouldCleanupBySize(stats: CacheStats): boolean {
        return stats.estimatedSizeMB > this.config.maxCacheSizeMB;
    }

    /**
     * Check if cleanup is needed due to query count
     */
    private shouldCleanupByCount(stats: CacheStats): boolean {
        return stats.totalQueries > this.config.maxQueries;
    }

    /**
     * Estimate total cache size in MB
     */
    // biome-ignore lint/suspicious/noExplicitAny: Query objects have dynamic structure from TanStack Query
    private estimateCacheSize(queries: readonly any[]): number {
        let totalSize = 0;

        for (const query of queries) {
            totalSize += this.estimateQuerySize(query);
        }

        return totalSize / (1024 * 1024); // Convert to MB
    }

    /**
     * Estimate individual query size in bytes
     */
    // biome-ignore lint/suspicious/noExplicitAny: Query objects have dynamic structure from TanStack Query
    private estimateQuerySize(query: any): number {
        try {
            // Rough estimation based on JSON serialization
            const data = query.state.data;
            if (!data) return 0;

            const serialized = JSON.stringify(data);
            return serialized.length * 2; // Approximate UTF-16 encoding
        } catch {
            return 1024; // Default 1KB if estimation fails
        }
    }

    /**
     * Record cleanup result for analytics
     */
    private recordCleanup(result: CleanupResult): void {
        this.cleanupHistory.push(result);

        // Keep only recent history
        if (this.cleanupHistory.length > this.maxHistorySize) {
            this.cleanupHistory.splice(0, this.cleanupHistory.length - this.maxHistorySize);
        }
    }
}

/**
 * Default memory optimization manager instance
 */
let defaultMemoryManager: MemoryOptimizationManager | null = null;

/**
 * Get or create the default memory manager
 */
export const getMemoryManager = (
    queryClient: QueryClient,
    config?: MemoryOptimizationConfig
): MemoryOptimizationManager => {
    if (!defaultMemoryManager) {
        defaultMemoryManager = new MemoryOptimizationManager(queryClient, config);
    }
    return defaultMemoryManager;
};

/**
 * Convenience function for cache cleanup
 */
export const cleanupCache = async (
    queryClient: QueryClient,
    force = false
): Promise<CleanupResult> => {
    const manager = getMemoryManager(queryClient);
    return manager.cleanup(force);
};
