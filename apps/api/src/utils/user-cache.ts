import type { User } from '@repo/schemas';
import { UserService } from '@repo/service-core';
import { LRUCache } from 'lru-cache';
import { createSystemActor } from './actor.js';
import { env } from './env.js';
import { apiLogger } from './logger.js';

/** Whether running in Vercel serverless environment */
const isServerless = !!env.VERCEL;

/**
 * Cached user data with metadata
 */
interface CachedUser {
    user: User;
    timestamp: number;
    hitCount: number;
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
    size: number;
    maxSize: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    pendingQueries: number;
}

/**
 * High-performance user cache with LRU eviction and query deduplication.
 *
 * In serverless environments (Vercel), the LRU cache and stats interval are
 * disabled since each invocation is ephemeral. Users are queried directly
 * from the database. Query deduplication is still active within a single
 * request lifecycle.
 *
 * Features:
 * - LRU cache with configurable size and TTL (long-running only)
 * - Query deduplication to prevent duplicate DB calls
 * - Manual invalidation for data consistency
 * - Comprehensive stats and logging
 */
export class UserCache {
    private cache: LRUCache<string, CachedUser> | null = isServerless
        ? null
        : new LRUCache<string, CachedUser>({
              max: 1000, // Maximum 1000 users cached
              ttl: 5 * 60 * 1000 // 5 minutes TTL
          });

    private pendingQueries = new Map<string, Promise<User | null>>();
    private stats = {
        hitCount: 0,
        missCount: 0
    };

    private userService: UserService;
    private statsIntervalId: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.userService = new UserService({ logger: apiLogger });

        // Log cache stats every 5 minutes (long-running only)
        if (!isServerless) {
            this.statsIntervalId = setInterval(
                () => {
                    const stats = this.getStats();
                    if (stats.hitCount > 0 || stats.missCount > 0) {
                        apiLogger.info(
                            `UserCache Stats: hitRate=${(stats.hitRate * 100).toFixed(1)}% size=${stats.size}/${stats.maxSize} hits=${stats.hitCount} misses=${stats.missCount} pending=${stats.pendingQueries}`
                        );
                    }
                },
                5 * 60 * 1000
            );
        }
    }

    /**
     * Cleanup resources when cache is no longer needed
     * Call this method before destroying the cache instance to prevent memory leaks
     */
    destroy(): void {
        if (this.statsIntervalId) {
            clearInterval(this.statsIntervalId);
            this.statsIntervalId = null;
            apiLogger.debug('UserCache stats interval cleared');
        }
        this.cache?.clear();
        this.pendingQueries.clear();
    }

    /**
     * Get user by database user ID (UUID), using cache when possible.
     * In serverless mode, always queries the database directly.
     *
     * @param userId - Database user UUID
     * @returns User object or null if not found
     */
    async getUser(userId: string): Promise<User | null> {
        // In serverless mode, query DB directly (with deduplication)
        if (isServerless) {
            return this.queryWithDeduplication(userId);
        }

        // Check cache first
        const cached = this.cache?.get(userId);
        if (cached) {
            this.stats.hitCount++;
            cached.hitCount++;
            apiLogger.debug(`Cache HIT for user ${userId} (hit #${cached.hitCount})`);
            return cached.user;
        }

        // Check if query is already in progress (deduplication)
        if (this.pendingQueries.has(userId)) {
            apiLogger.debug(`Cache WAIT for user ${userId} (query in progress)`);
            const pendingQuery = this.pendingQueries.get(userId);
            if (pendingQuery) {
                return pendingQuery;
            }
        }

        // Start new DB query
        this.stats.missCount++;
        apiLogger.debug(
            `Cache MISS for user ${userId}, querying DB (miss #${this.stats.missCount})`
        );

        const queryPromise = this.queryDatabase(userId);
        this.pendingQueries.set(userId, queryPromise);

        try {
            const user = await queryPromise;

            if (user) {
                // Cache the result
                this.cache?.set(userId, {
                    user,
                    timestamp: Date.now(),
                    hitCount: 0
                });
                apiLogger.debug(`User ${userId} cached successfully`);
            } else {
                apiLogger.debug(`User ${userId} not found in DB`);
            }

            return user;
        } catch (error) {
            apiLogger.error(
                `Cache query error for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        } finally {
            // Always clean up pending query
            this.pendingQueries.delete(userId);
        }
    }

    /**
     * Manually invalidate a user from cache.
     * Call this when user data is updated.
     * No-op in serverless mode.
     *
     * @param userId - Database user UUID to invalidate
     */
    invalidate(userId: string): void {
        if (!this.cache) return;

        const wasInCache = this.cache.has(userId);
        this.cache.delete(userId);

        if (wasInCache) {
            apiLogger.debug(`Cache invalidated for user ${userId}`);
        }
    }

    /**
     * Invalidate all cached users
     * Use sparingly, only for major system changes
     * No-op in serverless mode.
     */
    invalidateAll(): void {
        if (!this.cache) return;

        const size = this.cache.size;
        this.cache.clear();
        apiLogger.info(`Cache cleared, removed ${size} users`);
    }

    /**
     * Get comprehensive cache statistics
     */
    getStats(): CacheStats {
        const totalRequests = this.stats.hitCount + this.stats.missCount;

        return {
            size: this.cache?.size ?? 0,
            maxSize: this.cache?.max ?? 0,
            hitCount: this.stats.hitCount,
            missCount: this.stats.missCount,
            hitRate: totalRequests > 0 ? this.stats.hitCount / totalRequests : 0,
            pendingQueries: this.pendingQueries.size
        };
    }

    /**
     * Reset statistics (useful for testing)
     */
    resetStats(): void {
        this.stats.hitCount = 0;
        this.stats.missCount = 0;
    }

    /**
     * Query user with deduplication (for serverless mode).
     * Prevents concurrent duplicate DB queries within a single invocation.
     */
    private async queryWithDeduplication(userId: string): Promise<User | null> {
        const pending = this.pendingQueries.get(userId);
        if (pending) return pending;

        const queryPromise = this.queryDatabase(userId);
        this.pendingQueries.set(userId, queryPromise);

        try {
            return await queryPromise;
        } catch (error) {
            apiLogger.error(
                `DB query error for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        } finally {
            this.pendingQueries.delete(userId);
        }
    }

    /**
     * Query user from database by ID.
     * Private method that handles the actual DB interaction.
     *
     * @note Uses SYSTEM actor for internal cache operations.
     * This is safe because the cache only returns user data to the actor middleware,
     * which then creates the appropriate actor context for the request.
     */
    private async queryDatabase(userId: string): Promise<User | null> {
        // Use SYSTEM actor for internal cache operations
        // This ensures the cache can access user data regardless of permission restrictions
        const systemActor = createSystemActor();

        const result = await this.userService.getById(systemActor, userId);

        return result.data || null;
    }
}

// Export singleton instance
export const userCache = new UserCache();
