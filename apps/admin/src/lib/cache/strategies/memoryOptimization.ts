import { adminLogger } from '@/utils/logger';
import type { QueryClient } from '@tanstack/react-query';

import type {
    CacheStats,
    CleanupResult,
    MemoryOptimizationConfig
} from './memoryOptimization.types';

// Re-export types for backward compatibility
export type {
    CacheStats,
    CleanupResult,
    MemoryOptimizationConfig
} from './memoryOptimization.types';

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

    /** Start automatic memory monitoring */
    startMonitoring(): void {
        if (this.monitoringInterval) return;
        adminLogger.info('Starting cache memory monitoring');
        this.monitoringInterval = setInterval(() => {
            this.performAutomaticCleanup();
        }, this.config.gcInterval);
    }

    /** Stop automatic memory monitoring */
    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            adminLogger.info('Stopped cache memory monitoring');
        }
    }

    /** Get current cache statistics */
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

        const estimatedSizeMB = this.estimateCacheSize(allQueries);
        const memoryPressure = Math.min(
            estimatedSizeMB / this.config.maxCacheSizeMB,
            allQueries.length / this.config.maxQueries
        );

        const queryAges = allQueries
            .map((query) => now - (query.state.dataUpdatedAt || now))
            .filter((age) => age >= 0);

        return {
            totalQueries: allQueries.length,
            activeQueries: activeQueries.length,
            staleQueries: staleQueries.length,
            estimatedSizeMB,
            memoryPressure,
            oldestQueryAge: queryAges.length > 0 ? Math.max(...queryAges) : 0,
            newestQueryAge: queryAges.length > 0 ? Math.min(...queryAges) : 0
        };
    }

    /** Perform manual cache cleanup */
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

        let queriesRemoved = this.removeStaleQueries();

        if (
            force ||
            this.shouldCleanupBySize(initialStats) ||
            this.shouldCleanupByCount(initialStats)
        ) {
            queriesRemoved += this.removeExcessQueries();
        }

        this.queryClient.getQueryCache().clear();

        const finalStats = this.getCacheStats();
        const result: CleanupResult = {
            queriesRemoved,
            memoryFreedMB: Math.max(0, initialStats.estimatedSizeMB - finalStats.estimatedSizeMB),
            executionTime: Date.now() - startTime,
            trigger: 'manual'
        };

        this.recordCleanup(result);
        adminLogger.info(
            'Cache cleanup completed',
            JSON.stringify({
                queriesRemoved,
                memoryFreedMB: result.memoryFreedMB.toFixed(2),
                executionTime: result.executionTime
            })
        );

        return result;
    }

    /** Remove specific query patterns */
    removeQueryPatterns(patterns: readonly string[]): number {
        let removed = 0;
        const queryCache = this.queryClient.getQueryCache();

        for (const pattern of patterns) {
            const matchingQueries = queryCache.findAll({
                predicate: (query) => query.queryKey.join('.').includes(pattern)
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

    /** Get cleanup history and analytics */
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

    /** Clear cleanup history */
    clearAnalytics(): void {
        this.cleanupHistory.length = 0;
        adminLogger.debug('Cache cleanup analytics cleared');
    }

    private async performAutomaticCleanup(): Promise<void> {
        if (!this.config.autoCleanup) return;

        const stats = this.getCacheStats();
        const needsCleanup =
            this.shouldCleanupByPressure(stats) ||
            this.shouldCleanupBySize(stats) ||
            this.shouldCleanupByCount(stats);

        if (!needsCleanup) return;

        const trigger = this.shouldCleanupByPressure(stats) ? 'memory-pressure' : 'automatic';
        const startTime = Date.now();
        let queriesRemoved = this.removeStaleQueries();

        if (this.shouldCleanupBySize(stats) || this.shouldCleanupByCount(stats)) {
            queriesRemoved += this.removeExcessQueries();
        }

        const finalStats = this.getCacheStats();
        const result: CleanupResult = {
            queriesRemoved,
            memoryFreedMB: Math.max(0, stats.estimatedSizeMB - finalStats.estimatedSizeMB),
            executionTime: Date.now() - startTime,
            trigger
        };

        this.recordCleanup(result);
        adminLogger.info(
            'Automatic cache cleanup completed',
            JSON.stringify({
                trigger,
                queriesRemoved,
                memoryFreedMB: result.memoryFreedMB.toFixed(2)
            })
        );
    }

    private removeStaleQueries(): number {
        const queryCache = this.queryClient.getQueryCache();
        const now = Date.now();
        let removed = 0;

        const staleQueries = queryCache.findAll({
            predicate: (query) => {
                const age = now - (query.state.dataUpdatedAt || 0);
                return age > this.config.staleThreshold && query.getObserversCount() === 0;
            }
        });

        for (const query of staleQueries) {
            queryCache.remove(query);
            removed++;
        }
        return removed;
    }

    private removeExcessQueries(): number {
        const queryCache = this.queryClient.getQueryCache();
        const allQueries = queryCache.getAll();
        let removed = 0;

        const sortedQueries = allQueries
            .filter((query) => query.getObserversCount() === 0)
            .sort((a, b) => {
                const ageA = Date.now() - (a.state.dataUpdatedAt || 0);
                const ageB = Date.now() - (b.state.dataUpdatedAt || 0);
                if (ageA !== ageB) return ageB - ageA;
                return this.estimateQuerySize(b) - this.estimateQuerySize(a);
            });

        const stats = this.getCacheStats();
        const targetQueries = Math.floor(this.config.maxQueries * 0.8);
        const queriesToRemove = Math.max(0, stats.totalQueries - targetQueries);

        for (let i = 0; i < Math.min(queriesToRemove, sortedQueries.length); i++) {
            queryCache.remove(sortedQueries[i]);
            removed++;
        }
        return removed;
    }

    private shouldCleanupByPressure(stats: CacheStats): boolean {
        return stats.memoryPressure > this.config.memoryPressureThreshold;
    }

    private shouldCleanupBySize(stats: CacheStats): boolean {
        return stats.estimatedSizeMB > this.config.maxCacheSizeMB;
    }

    private shouldCleanupByCount(stats: CacheStats): boolean {
        return stats.totalQueries > this.config.maxQueries;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Query objects have dynamic structure from TanStack Query
    private estimateCacheSize(queries: readonly any[]): number {
        let totalSize = 0;
        for (const query of queries) {
            totalSize += this.estimateQuerySize(query);
        }
        return totalSize / (1024 * 1024);
    }

    // biome-ignore lint/suspicious/noExplicitAny: Query objects have dynamic structure from TanStack Query
    private estimateQuerySize(query: any): number {
        try {
            const data = query.state.data;
            if (!data) return 0;
            return JSON.stringify(data).length * 2;
        } catch {
            return 1024;
        }
    }

    private recordCleanup(result: CleanupResult): void {
        this.cleanupHistory.push(result);
        if (this.cleanupHistory.length > this.maxHistorySize) {
            this.cleanupHistory.splice(0, this.cleanupHistory.length - this.maxHistorySize);
        }
    }
}

/** Default memory optimization manager instance */
let defaultMemoryManager: MemoryOptimizationManager | null = null;

/** Get or create the default memory manager */
export const getMemoryManager = (
    queryClient: QueryClient,
    config?: MemoryOptimizationConfig
): MemoryOptimizationManager => {
    if (!defaultMemoryManager) {
        defaultMemoryManager = new MemoryOptimizationManager(queryClient, config);
    }
    return defaultMemoryManager;
};

/** Convenience function for cache cleanup */
export const cleanupCache = async (
    queryClient: QueryClient,
    force = false
): Promise<CleanupResult> => {
    const manager = getMemoryManager(queryClient);
    return manager.cleanup(force);
};
