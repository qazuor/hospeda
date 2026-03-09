/**
 * Memory optimization type definitions
 *
 * Types for cache statistics, cleanup results, and configuration
 * used by MemoryOptimizationManager.
 */

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
