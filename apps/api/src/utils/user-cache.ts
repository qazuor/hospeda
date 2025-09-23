import type { User } from '@repo/schemas';
import { AuthProviderEnum } from '@repo/schemas';
import { UserService } from '@repo/service-core';
import { LRUCache } from 'lru-cache';
import { createGuestActor } from './actor.js';
import { apiLogger } from './logger.js';

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
 * High-performance user cache with LRU eviction and query deduplication
 *
 * Features:
 * - LRU cache with configurable size and TTL
 * - Query deduplication to prevent duplicate DB calls
 * - Manual invalidation for data consistency
 * - Comprehensive stats and logging
 */
export class UserCache {
    private cache = new LRUCache<string, CachedUser>({
        max: 1000, // Maximum 1000 users cached
        ttl: 5 * 60 * 1000 // 5 minutes TTL
    });

    private pendingQueries = new Map<string, Promise<User | null>>();
    private stats = {
        hitCount: 0,
        missCount: 0
    };

    private userService: UserService;

    constructor() {
        this.userService = new UserService({ logger: apiLogger });

        // Log cache stats every 5 minutes
        setInterval(
            () => {
                const stats = this.getStats();
                if (stats.hitCount > 0 || stats.missCount > 0) {
                    apiLogger.info(
                        `📊 UserCache Stats: hitRate=${(stats.hitRate * 100).toFixed(1)}% size=${stats.size}/${stats.maxSize} hits=${stats.hitCount} misses=${stats.missCount} pending=${stats.pendingQueries}`
                    );
                }
            },
            5 * 60 * 1000
        );
    }

    /**
     * Get user by Clerk user ID, using cache when possible
     *
     * @param clerkUserId - Clerk user ID (e.g., "user_31HTUXqo9ZFzgAfNCFhPlBVXbA1")
     * @returns User object or null if not found
     */
    async getUser(clerkUserId: string): Promise<User | null> {
        // Check cache first
        const cached = this.cache.get(clerkUserId);
        if (cached) {
            this.stats.hitCount++;
            cached.hitCount++;
            apiLogger.debug(`🎯 Cache HIT for user ${clerkUserId} (hit #${cached.hitCount})`);
            return cached.user;
        }

        // Check if query is already in progress (deduplication)
        if (this.pendingQueries.has(clerkUserId)) {
            apiLogger.debug(`⏳ Cache WAIT for user ${clerkUserId} (query in progress)`);
            const pendingQuery = this.pendingQueries.get(clerkUserId);
            if (pendingQuery) {
                return pendingQuery;
            }
        }

        // Start new DB query
        this.stats.missCount++;
        apiLogger.debug(
            `💾 Cache MISS for user ${clerkUserId}, querying DB (miss #${this.stats.missCount})`
        );

        const queryPromise = this.queryDatabase(clerkUserId);
        this.pendingQueries.set(clerkUserId, queryPromise);

        try {
            const user = await queryPromise;

            if (user) {
                // Cache the result
                this.cache.set(clerkUserId, {
                    user,
                    timestamp: Date.now(),
                    hitCount: 0
                });
                apiLogger.debug(`✅ User ${clerkUserId} cached successfully`);
            } else {
                apiLogger.debug(`❌ User ${clerkUserId} not found in DB`);
            }

            return user;
        } catch (error) {
            apiLogger.error(
                `🚨 Cache query error for user ${clerkUserId}: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        } finally {
            // Always clean up pending query
            this.pendingQueries.delete(clerkUserId);
        }
    }

    /**
     * Manually invalidate a user from cache
     * Call this when user data is updated
     *
     * @param clerkUserId - Clerk user ID to invalidate
     */
    invalidate(clerkUserId: string): void {
        const wasInCache = this.cache.has(clerkUserId);
        this.cache.delete(clerkUserId);

        if (wasInCache) {
            apiLogger.debug(`🗑️ Cache invalidated for user ${clerkUserId}`);
        }
    }

    /**
     * Invalidate all cached users
     * Use sparingly, only for major system changes
     */
    invalidateAll(): void {
        const size = this.cache.size;
        this.cache.clear();
        apiLogger.info(`🧹 Cache cleared, removed ${size} users`);
    }

    /**
     * Get comprehensive cache statistics
     */
    getStats(): CacheStats {
        const totalRequests = this.stats.hitCount + this.stats.missCount;

        return {
            size: this.cache.size,
            maxSize: this.cache.max || 0,
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
     * Query user from database
     * Private method that handles the actual DB interaction
     */
    private async queryDatabase(clerkUserId: string): Promise<User | null> {
        const guestActor = createGuestActor();

        const result = await this.userService.getByAuthProviderId(guestActor, {
            provider: AuthProviderEnum.CLERK,
            providerUserId: clerkUserId
        });

        return result.data?.user || null;
    }
}

// Export singleton instance
export const userCache = new UserCache();
