import { adminLogger } from '@/utils/logger';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Cache warming strategy configuration
 */
export type WarmingStrategy = {
    /** Strategy identifier */
    readonly id: string;
    /** Strategy name for debugging */
    readonly name: string;
    /** Queries to prefetch */
    readonly queries: readonly WarmingQuery[];
    /** Trigger conditions */
    readonly triggers: readonly WarmingTrigger[];
    /** Priority level (higher = executed first) */
    readonly priority?: number;
    /** Whether to run in background */
    readonly background?: boolean;
    /** Maximum concurrent prefetches */
    readonly maxConcurrent?: number;
};

/**
 * Query to prefetch for cache warming
 */
export type WarmingQuery = {
    /** Query key factory function */
    readonly queryKey: () => unknown[];
    /** Query function */
    readonly queryFn: () => Promise<unknown>;
    /** Stale time for the prefetched data */
    readonly staleTime?: number;
    /** Cache time for the prefetched data */
    readonly cacheTime?: number;
    /** Whether this query is critical (should not fail silently) */
    readonly critical?: boolean;
};

/**
 * Trigger condition for cache warming
 */
export type WarmingTrigger = {
    /** Trigger type */
    readonly type: 'route-change' | 'user-action' | 'time-based' | 'data-change' | 'manual';
    /** Condition function */
    readonly condition: (context: WarmingContext) => boolean;
    /** Delay before warming (ms) */
    readonly delay?: number;
};

/**
 * Context for cache warming triggers
 */
export type WarmingContext = {
    /** Current route/page */
    readonly route?: string;
    /** User action that triggered warming */
    readonly action?: string;
    /** Additional context data */
    readonly data?: unknown;
    /** Timestamp */
    readonly timestamp: number;
};

/**
 * Cache warming result
 */
export type WarmingResult = {
    readonly strategy: string;
    readonly queriesWarmed: number;
    readonly queriesFailed: number;
    readonly executionTime: number;
    readonly success: boolean;
    readonly errors: readonly string[];
};

/**
 * Cache warming and prefetching manager
 *
 * Intelligently prefetches data based on user behavior patterns,
 * route changes, and predictive algorithms to improve perceived performance.
 *
 * @example
 * ```tsx
 * const warmingManager = new CacheWarmingManager(queryClient);
 *
 * // Register warming strategy
 * warmingManager.registerStrategy({
 *   id: 'dashboard-data',
 *   name: 'Dashboard Data Warming',
 *   queries: [
 *     {
 *       queryKey: () => ['dashboard', 'stats'],
 *       queryFn: () => fetchDashboardStats(),
 *       staleTime: 5 * 60 * 1000 // 5 minutes
 *     }
 *   ],
 *   triggers: [
 *     {
 *       type: 'route-change',
 *       condition: (ctx) => ctx.route === '/dashboard'
 *     }
 *   ]
 * });
 *
 * // Trigger warming
 * await warmingManager.warmCache({
 *   route: '/dashboard',
 *   timestamp: Date.now()
 * });
 * ```
 */
export class CacheWarmingManager {
    private readonly queryClient: QueryClient;
    private readonly strategies = new Map<string, WarmingStrategy>();
    private readonly results: WarmingResult[] = [];
    private readonly maxResultHistory = 50;
    private readonly activeWarmings = new Set<string>();

    constructor(queryClient: QueryClient) {
        this.queryClient = queryClient;
        this.registerDefaultStrategies();
    }

    /**
     * Register a cache warming strategy
     */
    registerStrategy(strategy: WarmingStrategy): void {
        this.strategies.set(strategy.id, strategy);
        adminLogger.debug(`Registered cache warming strategy: ${strategy.name}`);
    }

    /**
     * Unregister a cache warming strategy
     */
    unregisterStrategy(strategyId: string): void {
        if (this.strategies.delete(strategyId)) {
            adminLogger.debug(`Unregistered cache warming strategy: ${strategyId}`);
        }
    }

    /**
     * Get all registered strategies
     */
    getStrategies(): readonly WarmingStrategy[] {
        return Array.from(this.strategies.values());
    }

    /**
     * Trigger cache warming based on context
     */
    async warmCache(context: WarmingContext): Promise<WarmingResult[]> {
        const startTime = Date.now();
        const results: WarmingResult[] = [];

        adminLogger.debug('Starting cache warming for context:', JSON.stringify(context));

        // Get applicable strategies
        const applicableStrategies = this.getApplicableStrategies(context);

        if (applicableStrategies.length === 0) {
            adminLogger.debug('No applicable warming strategies found');
            return results;
        }

        // Execute strategies
        for (const strategy of applicableStrategies) {
            // Skip if already warming this strategy
            if (this.activeWarmings.has(strategy.id)) {
                adminLogger.debug(`Strategy ${strategy.id} already warming, skipping`);
                continue;
            }

            try {
                const result = await this.executeStrategy(strategy, context);
                results.push(result);
            } catch (error) {
                const errorResult: WarmingResult = {
                    strategy: strategy.id,
                    queriesWarmed: 0,
                    queriesFailed: 0,
                    executionTime: 0,
                    success: false,
                    errors: [error instanceof Error ? error.message : 'Unknown error']
                };
                results.push(errorResult);
                adminLogger.error(
                    `Cache warming strategy ${strategy.id} failed:`,
                    error instanceof Error ? error.message : String(error)
                );
            }
        }

        // Store results
        this.storeResults(results);

        const totalTime = Date.now() - startTime;
        const totalWarmed = results.reduce((sum, r) => sum + r.queriesWarmed, 0);

        adminLogger.info(
            `Cache warming completed: ${totalWarmed} queries warmed in ${totalTime}ms`
        );

        return results;
    }

    /**
     * Prefetch specific queries
     */
    async prefetchQueries(queries: readonly WarmingQuery[]): Promise<WarmingResult> {
        const startTime = Date.now();
        let queriesWarmed = 0;
        let queriesFailed = 0;
        const errors: string[] = [];

        const maxConcurrent = 5;
        const chunks = this.chunkArray(queries, maxConcurrent);

        for (const chunk of chunks) {
            const promises = chunk.map(async (query) => {
                try {
                    await this.queryClient.prefetchQuery({
                        queryKey: query.queryKey(),
                        queryFn: query.queryFn,
                        staleTime: query.staleTime,
                        gcTime: query.cacheTime
                    });
                    queriesWarmed++;
                } catch (error) {
                    queriesFailed++;
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(errorMsg);

                    if (query.critical) {
                        adminLogger.error(
                            'Critical query prefetch failed:',
                            error instanceof Error ? error.message : String(error)
                        );
                    } else {
                        adminLogger.warn(
                            'Query prefetch failed:',
                            error instanceof Error ? error.message : String(error)
                        );
                    }
                }
            });

            await Promise.allSettled(promises);
        }

        return {
            strategy: 'manual-prefetch',
            queriesWarmed,
            queriesFailed,
            executionTime: Date.now() - startTime,
            success: queriesFailed === 0,
            errors
        };
    }

    /**
     * Warm cache for a specific route
     */
    async warmRouteCache(route: string): Promise<WarmingResult[]> {
        return this.warmCache({
            route,
            timestamp: Date.now()
        });
    }

    /**
     * Get cache warming analytics
     */
    getAnalytics(): {
        readonly totalWarmings: number;
        readonly averageExecutionTime: number;
        readonly successRate: number;
        readonly topStrategies: readonly { strategy: string; count: number }[];
        readonly recentResults: readonly WarmingResult[];
    } {
        const totalWarmings = this.results.length;
        const successfulResults = this.results.filter((r) => r.success);
        const averageExecutionTime =
            totalWarmings > 0
                ? this.results.reduce((sum, r) => sum + r.executionTime, 0) / totalWarmings
                : 0;
        const successRate =
            totalWarmings > 0 ? (successfulResults.length / totalWarmings) * 100 : 100;

        // Count strategy usage
        const strategyCounts = new Map<string, number>();
        for (const result of this.results) {
            strategyCounts.set(result.strategy, (strategyCounts.get(result.strategy) || 0) + 1);
        }

        const topStrategies = Array.from(strategyCounts.entries())
            .map(([strategy, count]) => ({ strategy, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            totalWarmings,
            averageExecutionTime,
            successRate,
            topStrategies,
            recentResults: this.results.slice(-10)
        };
    }

    /**
     * Clear analytics history
     */
    clearAnalytics(): void {
        this.results.length = 0;
        adminLogger.debug('Cache warming analytics cleared');
    }

    /**
     * Get applicable strategies for the given context
     */
    private getApplicableStrategies(context: WarmingContext): WarmingStrategy[] {
        const applicable = Array.from(this.strategies.values())
            .filter((strategy) => {
                return strategy.triggers.some((trigger) => {
                    // Apply delay if specified
                    if (trigger.delay && trigger.delay > 0) {
                        setTimeout(() => trigger.condition(context), trigger.delay);
                        return false; // Don't execute immediately
                    }
                    return trigger.condition(context);
                });
            })
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        return applicable;
    }

    /**
     * Execute a warming strategy
     */
    private async executeStrategy(
        strategy: WarmingStrategy,
        _context: WarmingContext
    ): Promise<WarmingResult> {
        const startTime = Date.now();
        this.activeWarmings.add(strategy.id);

        try {
            const result = await this.prefetchQueries(strategy.queries);

            return {
                ...result,
                strategy: strategy.id,
                executionTime: Date.now() - startTime
            };
        } finally {
            this.activeWarmings.delete(strategy.id);
        }
    }

    /**
     * Store results for analytics
     */
    private storeResults(results: WarmingResult[]): void {
        this.results.push(...results);

        // Keep only recent results
        if (this.results.length > this.maxResultHistory) {
            this.results.splice(0, this.results.length - this.maxResultHistory);
        }
    }

    /**
     * Chunk array into smaller arrays
     */
    private chunkArray<T>(array: readonly T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size) as T[]);
        }
        return chunks;
    }

    /**
     * Register default warming strategies
     */
    private registerDefaultStrategies(): void {
        // Dashboard warming
        this.registerStrategy({
            id: 'dashboard-warming',
            name: 'Dashboard Data Warming',
            queries: [
                {
                    queryKey: () => ['dashboard', 'stats'],
                    queryFn: async () => {
                        // Mock dashboard stats - replace with actual API call
                        return { users: 100, accommodations: 50, bookings: 200 };
                    },
                    staleTime: 5 * 60 * 1000,
                    critical: true
                },
                {
                    queryKey: () => ['dashboard', 'recent-activity'],
                    queryFn: async () => {
                        // Mock recent activity - replace with actual API call
                        return [];
                    },
                    staleTime: 2 * 60 * 1000
                }
            ],
            triggers: [
                {
                    type: 'route-change',
                    condition: (ctx) => ctx.route === '/dashboard' || ctx.route === '/'
                }
            ],
            priority: 10
        });

        // List page warming
        this.registerStrategy({
            id: 'list-warming',
            name: 'List Page Data Warming',
            queries: [
                {
                    queryKey: () => ['entities', 'counts'],
                    queryFn: async () => {
                        // Mock entity counts - replace with actual API call
                        return { total: 0 };
                    },
                    staleTime: 10 * 60 * 1000
                }
            ],
            triggers: [
                {
                    type: 'route-change',
                    condition: (ctx) => ctx.route?.includes('/list') || false
                }
            ],
            priority: 5
        });

        // User action warming
        this.registerStrategy({
            id: 'user-action-warming',
            name: 'User Action Predictive Warming',
            queries: [
                {
                    queryKey: () => ['user', 'profile'],
                    queryFn: async () => {
                        // Mock user profile - replace with actual API call
                        return { id: 'user-1', name: 'User' };
                    },
                    staleTime: 15 * 60 * 1000
                }
            ],
            triggers: [
                {
                    type: 'user-action',
                    condition: (ctx) => ctx.action === 'login' || ctx.action === 'profile-view'
                }
            ],
            priority: 3
        });
    }
}

/**
 * Default cache warming manager instance
 */
let defaultWarmingManager: CacheWarmingManager | null = null;

/**
 * Get or create the default warming manager
 */
export const getWarmingManager = (queryClient: QueryClient): CacheWarmingManager => {
    if (!defaultWarmingManager) {
        defaultWarmingManager = new CacheWarmingManager(queryClient);
    }
    return defaultWarmingManager;
};

/**
 * Convenience function for cache warming
 */
export const warmCache = async (
    queryClient: QueryClient,
    context: WarmingContext
): Promise<WarmingResult[]> => {
    const manager = getWarmingManager(queryClient);
    return manager.warmCache(context);
};
