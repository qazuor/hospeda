import { adminLogger } from '@/utils/logger';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Cache invalidation strategy configuration
 */
export type InvalidationStrategy = {
    /** Strategy identifier */
    readonly id: string;
    /** Strategy name for debugging */
    readonly name: string;
    /** Patterns to match for invalidation */
    readonly patterns: readonly string[];
    /** Whether to invalidate exact matches only */
    readonly exactMatch?: boolean;
    /** Whether to refetch immediately after invalidation */
    readonly refetchActive?: boolean;
    /** Delay before invalidation (ms) */
    readonly delay?: number;
    /** Priority level (higher = executed first) */
    readonly priority?: number;
    /** Condition function to determine if invalidation should occur */
    readonly condition?: (context: InvalidationContext) => boolean;
};

/**
 * Context provided to invalidation strategies
 */
export type InvalidationContext = {
    /** The entity that triggered the invalidation */
    readonly entity: string;
    /** The operation that occurred (create, update, delete) */
    readonly operation: 'create' | 'update' | 'delete' | 'bulk';
    /** Additional data about the operation */
    readonly data?: unknown;
    /** Timestamp of the operation */
    readonly timestamp: number;
    /** User/actor who performed the operation */
    readonly actor?: string;
};

/**
 * Invalidation result tracking
 */
export type InvalidationResult = {
    readonly strategy: string;
    readonly patterns: readonly string[];
    readonly queriesInvalidated: number;
    readonly executionTime: number;
    readonly success: boolean;
    readonly error?: string;
};

/**
 * Smart cache invalidation manager
 *
 * Provides intelligent cache invalidation based on entity relationships,
 * operation types, and configurable strategies. Optimizes performance by
 * only invalidating relevant queries and provides detailed analytics.
 *
 * @example
 * ```tsx
 * const invalidationManager = new SmartInvalidationManager(queryClient);
 *
 * // Register strategies
 * invalidationManager.registerStrategy({
 *   id: 'user-related',
 *   name: 'User Related Data',
 *   patterns: ['users', 'user-profile', 'user-settings'],
 *   refetchActive: true,
 *   condition: (ctx) => ctx.entity === 'user'
 * });
 *
 * // Trigger invalidation
 * await invalidationManager.invalidate({
 *   entity: 'user',
 *   operation: 'update',
 *   data: { id: '123', email: 'new@email.com' }
 * });
 * ```
 */
export class SmartInvalidationManager {
    private readonly queryClient: QueryClient;
    private readonly strategies = new Map<string, InvalidationStrategy>();
    private readonly results: InvalidationResult[] = [];
    private readonly maxResultHistory = 100;

    constructor(queryClient: QueryClient) {
        this.queryClient = queryClient;
        this.registerDefaultStrategies();
    }

    /**
     * Register a new invalidation strategy
     */
    registerStrategy(strategy: InvalidationStrategy): void {
        this.strategies.set(strategy.id, strategy);
        adminLogger.debug(`Registered invalidation strategy: ${strategy.name}`);
    }

    /**
     * Unregister an invalidation strategy
     */
    unregisterStrategy(strategyId: string): void {
        if (this.strategies.delete(strategyId)) {
            adminLogger.debug(`Unregistered invalidation strategy: ${strategyId}`);
        }
    }

    /**
     * Get all registered strategies
     */
    getStrategies(): readonly InvalidationStrategy[] {
        return Array.from(this.strategies.values());
    }

    /**
     * Trigger smart invalidation based on context
     */
    async invalidate(context: InvalidationContext): Promise<InvalidationResult[]> {
        const startTime = Date.now();
        const results: InvalidationResult[] = [];

        adminLogger.info(`Starting smart invalidation for ${context.entity}:${context.operation}`);

        // Get applicable strategies sorted by priority
        const applicableStrategies = this.getApplicableStrategies(context);

        // Execute strategies in parallel for better performance
        const strategyPromises = applicableStrategies.map((strategy) =>
            this.executeStrategy(strategy, context)
        );

        const strategyResults = await Promise.allSettled(strategyPromises);

        // Process results
        for (let i = 0; i < strategyResults.length; i++) {
            const result = strategyResults[i];
            const strategy = applicableStrategies[i];

            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                const errorResult: InvalidationResult = {
                    strategy: strategy.id,
                    patterns: strategy.patterns,
                    queriesInvalidated: 0,
                    executionTime: 0,
                    success: false,
                    error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
                };
                results.push(errorResult);
                adminLogger.error(`Strategy ${strategy.id} failed:`, result.reason);
            }
        }

        // Store results for analytics
        this.storeResults(results);

        const totalTime = Date.now() - startTime;
        const totalInvalidated = results.reduce((sum, r) => sum + r.queriesInvalidated, 0);

        adminLogger.info(
            `Smart invalidation completed: ${totalInvalidated} queries invalidated in ${totalTime}ms`
        );

        return results;
    }

    /**
     * Invalidate specific query patterns immediately
     */
    async invalidatePatterns(
        patterns: readonly string[],
        options: {
            readonly exactMatch?: boolean;
            readonly refetchActive?: boolean;
        } = {}
    ): Promise<InvalidationResult> {
        const startTime = Date.now();
        let queriesInvalidated = 0;

        try {
            for (const pattern of patterns) {
                if (options.exactMatch) {
                    await this.queryClient.invalidateQueries({
                        queryKey: [pattern],
                        refetchType: options.refetchActive ? 'active' : 'none'
                    });
                } else {
                    await this.queryClient.invalidateQueries({
                        predicate: (query) => {
                            const queryKey = query.queryKey.join('.');
                            return queryKey.includes(pattern);
                        },
                        refetchType: options.refetchActive ? 'active' : 'none'
                    });
                }

                // Count affected queries
                const matchingQueries = this.queryClient.getQueryCache().findAll({
                    predicate: (query) => {
                        const queryKey = query.queryKey.join('.');
                        return options.exactMatch
                            ? queryKey === pattern
                            : queryKey.includes(pattern);
                    }
                });

                queriesInvalidated += matchingQueries.length;
            }

            return {
                strategy: 'manual',
                patterns,
                queriesInvalidated,
                executionTime: Date.now() - startTime,
                success: true
            };
        } catch (error) {
            return {
                strategy: 'manual',
                patterns,
                queriesInvalidated: 0,
                executionTime: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get invalidation analytics
     */
    getAnalytics(): {
        readonly totalInvalidations: number;
        readonly averageExecutionTime: number;
        readonly successRate: number;
        readonly topStrategies: readonly { strategy: string; count: number }[];
        readonly recentResults: readonly InvalidationResult[];
    } {
        const totalInvalidations = this.results.length;
        const successfulResults = this.results.filter((r) => r.success);
        const averageExecutionTime =
            totalInvalidations > 0
                ? this.results.reduce((sum, r) => sum + r.executionTime, 0) / totalInvalidations
                : 0;
        const successRate =
            totalInvalidations > 0 ? (successfulResults.length / totalInvalidations) * 100 : 100;

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
            totalInvalidations,
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
        adminLogger.debug('Cache invalidation analytics cleared');
    }

    /**
     * Get applicable strategies for the given context
     */
    private getApplicableStrategies(context: InvalidationContext): InvalidationStrategy[] {
        const applicable = Array.from(this.strategies.values())
            .filter((strategy) => {
                // Check condition if provided
                if (strategy.condition && !strategy.condition(context)) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        return applicable;
    }

    /**
     * Execute a single invalidation strategy
     */
    private async executeStrategy(
        strategy: InvalidationStrategy,
        _context: InvalidationContext
    ): Promise<InvalidationResult> {
        const startTime = Date.now();

        // Apply delay if specified
        if (strategy.delay && strategy.delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, strategy.delay));
        }

        try {
            const result = await this.invalidatePatterns(strategy.patterns, {
                exactMatch: strategy.exactMatch,
                refetchActive: strategy.refetchActive
            });

            return {
                ...result,
                strategy: strategy.id,
                executionTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                strategy: strategy.id,
                patterns: strategy.patterns,
                queriesInvalidated: 0,
                executionTime: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Store results for analytics
     */
    private storeResults(results: InvalidationResult[]): void {
        this.results.push(...results);

        // Keep only recent results to prevent memory leaks
        if (this.results.length > this.maxResultHistory) {
            this.results.splice(0, this.results.length - this.maxResultHistory);
        }
    }

    /**
     * Register default invalidation strategies
     */
    private registerDefaultStrategies(): void {
        // Entity-specific strategies
        this.registerStrategy({
            id: 'user-data',
            name: 'User Data Invalidation',
            patterns: ['users', 'user-profile', 'user-settings', 'user-permissions'],
            refetchActive: true,
            priority: 10,
            condition: (ctx) => ctx.entity === 'user'
        });

        this.registerStrategy({
            id: 'accommodation-data',
            name: 'Accommodation Data Invalidation',
            patterns: ['accommodations', 'accommodation-reviews', 'accommodation-amenities'],
            refetchActive: true,
            priority: 10,
            condition: (ctx) => ctx.entity === 'accommodation'
        });

        this.registerStrategy({
            id: 'destination-data',
            name: 'Destination Data Invalidation',
            patterns: ['destinations', 'destination-attractions', 'destination-reviews'],
            refetchActive: true,
            priority: 10,
            condition: (ctx) => ctx.entity === 'destination'
        });

        // Operation-specific strategies
        this.registerStrategy({
            id: 'bulk-operations',
            name: 'Bulk Operations Invalidation',
            patterns: ['lists', 'counts', 'statistics'],
            refetchActive: false,
            priority: 5,
            condition: (ctx) => ctx.operation === 'bulk'
        });

        // Global strategies
        this.registerStrategy({
            id: 'cache-warming',
            name: 'Cache Warming After Updates',
            patterns: ['dashboard', 'recent-activity'],
            refetchActive: true,
            priority: 1,
            delay: 1000 // Warm cache after other invalidations
        });
    }
}

/**
 * Default smart invalidation manager instance
 */
let defaultInvalidationManager: SmartInvalidationManager | null = null;

/**
 * Get or create the default invalidation manager
 */
export const getInvalidationManager = (queryClient: QueryClient): SmartInvalidationManager => {
    if (!defaultInvalidationManager) {
        defaultInvalidationManager = new SmartInvalidationManager(queryClient);
    }
    return defaultInvalidationManager;
};

/**
 * Convenience function for triggering invalidation
 */
export const invalidateSmartly = async (
    queryClient: QueryClient,
    context: InvalidationContext
): Promise<InvalidationResult[]> => {
    const manager = getInvalidationManager(queryClient);
    return manager.invalidate(context);
};
