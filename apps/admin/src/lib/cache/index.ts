// Advanced cache management hook
export { useAdvancedCache } from './hooks/useAdvancedCache';
export type {
    AdvancedCacheAnalytics,
    AdvancedCacheConfig,
    CacheOperationResult
} from './hooks/useAdvancedCache';

// Smart invalidation
export {
    getInvalidationManager,
    invalidateSmartly,
    SmartInvalidationManager
} from './strategies/smartInvalidation';
export type {
    InvalidationContext,
    InvalidationResult,
    InvalidationStrategy
} from './strategies/smartInvalidation';

// Cache warming
export {
    CacheWarmingManager,
    getWarmingManager,
    warmCache
} from './strategies/cacheWarming';
export type {
    WarmingContext,
    WarmingQuery,
    WarmingResult,
    WarmingStrategy,
    WarmingTrigger
} from './strategies/cacheWarming';

// Memory optimization
export {
    cleanupCache,
    getMemoryManager,
    MemoryOptimizationManager
} from './strategies/memoryOptimization';
export type {
    CacheStats,
    CleanupResult,
    MemoryOptimizationConfig
} from './strategies/memoryOptimization';

// Cache monitoring component
export { CacheMonitor } from '../../components/cache/CacheMonitor';
export type { CacheMonitorProps } from '../../components/cache/CacheMonitor';
