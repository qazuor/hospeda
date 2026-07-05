// Advanced cache management hook

export type { CacheMonitorProps } from '../../components/cache/CacheMonitor';
// Cache monitoring component
export { CacheMonitor } from '../../components/cache/CacheMonitor';
export type {
    AdvancedCacheAnalytics,
    AdvancedCacheConfig,
    CacheOperationResult
} from './hooks/useAdvancedCache';
export { useAdvancedCache } from './hooks/useAdvancedCache';
export type {
    WarmingContext,
    WarmingQuery,
    WarmingResult,
    WarmingStrategy,
    WarmingTrigger
} from './strategies/cacheWarming';
// Cache warming
export {
    CacheWarmingManager,
    getWarmingManager,
    warmCache
} from './strategies/cacheWarming';
export type {
    CacheStats,
    CleanupResult,
    MemoryOptimizationConfig
} from './strategies/memoryOptimization';
// Memory optimization
export {
    cleanupCache,
    getMemoryManager,
    MemoryOptimizationManager
} from './strategies/memoryOptimization';
export type {
    InvalidationContext,
    InvalidationResult,
    InvalidationStrategy
} from './strategies/smartInvalidation';
// Smart invalidation
export {
    getInvalidationManager,
    invalidateSmartly,
    SmartInvalidationManager
} from './strategies/smartInvalidation';
