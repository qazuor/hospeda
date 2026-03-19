/**
 * Entitlement Checking Middleware
 *
 * Loads user entitlements and limits from QZPay on every request.
 * Caches results with 5-minute TTL for optimal performance.
 *
 * This middleware:
 * - Runs AFTER actor and billing customer middleware
 * - Loads entitlements and limits from QZPay
 * - Caches per-user with 5-minute TTL (in-memory FIFO cache)
 * - Sets entitlements and limits in context for route handlers
 * - Provides helper functions for route-level entitlement checks
 * - Silently skips if billing is not enabled or user is not authenticated
 *
 * @module middlewares/entitlement
 */

import type { EntitlementKey, LimitKey } from '@repo/billing';
import * as Sentry from '@sentry/node';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppBindings } from '../types';
import { apiLogger } from '../utils/logger';
import { getQZPayBilling } from './billing';

/**
 * Cache entry for user entitlements and limits
 */
interface EntitlementCacheEntry {
    /** User's entitled features */
    entitlements: Set<EntitlementKey>;
    /** User's usage limits */
    limits: Map<LimitKey, number>;
    /** Cache timestamp */
    timestamp: number;
}

/**
 * In-memory FIFO cache for user entitlements
 * Key: billingCustomerId
 * Value: EntitlementCacheEntry
 */
class EntitlementCache {
    private cache: Map<string, EntitlementCacheEntry> = new Map();
    private readonly ttlMs: number;
    private readonly maxSize: number;

    constructor(options: { ttlMs: number; maxSize?: number }) {
        this.ttlMs = options.ttlMs;
        this.maxSize = options.maxSize || 1000; // Default max 1000 users cached
    }

    /**
     * Get cached entitlements if still valid
     */
    get(customerId: string): EntitlementCacheEntry | null {
        const entry = this.cache.get(customerId);

        if (!entry) {
            return null;
        }

        // Check if expired
        const age = Date.now() - entry.timestamp;
        if (age > this.ttlMs) {
            this.cache.delete(customerId);
            return null;
        }

        return entry;
    }

    /**
     * Set cached entitlements
     */
    set(customerId: string, entry: EntitlementCacheEntry): void {
        // If cache is full, remove oldest entry
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(customerId, entry);
    }

    /**
     * Clear cache for a specific customer (useful for subscription changes)
     */
    invalidate(customerId: string): void {
        this.cache.delete(customerId);
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; maxSize: number; ttlMs: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttlMs: this.ttlMs
        };
    }
}

// Singleton cache instance
const entitlementCache = new EntitlementCache({
    ttlMs: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000
});

/**
 * Result of loading entitlements for a billing customer.
 */
interface LoadEntitlementsResult {
    /** User's entitled features (plan-level + customer-level overrides) */
    entitlements: Set<EntitlementKey>;
    /** User's usage limits (plan-level + customer-level overrides) */
    limits: Map<LimitKey, number>;
    /**
     * Whether this result is safe to cache.
     * False when customer-level calls failed and values are plan-only.
     * Degraded results must NOT be cached so the next request retries.
     */
    shouldCache: boolean;
}

/**
 * Load entitlements and limits for a billing customer.
 *
 * Fetches plan-level entitlements first, then attempts to merge customer-level
 * overrides. If the customer-level calls fail, returns plan-only data with
 * `shouldCache: false` so degraded results are never stored in cache.
 *
 * @param customerId - The QZPay customer ID
 * @returns Entitlements, limits, and cache flag, or null if billing unavailable
 */
async function loadEntitlements(customerId: string): Promise<LoadEntitlementsResult | null> {
    try {
        const billing = getQZPayBilling();

        if (!billing) {
            return null;
        }

        // Get customer's active subscription
        const subscriptions = await billing.subscriptions.getByCustomerId(customerId);

        if (!subscriptions || subscriptions.length === 0) {
            // No subscription - return empty entitlements
            return {
                entitlements: new Set<EntitlementKey>(),
                limits: new Map<LimitKey, number>(),
                shouldCache: true
            };
        }

        // Find active subscription (there should only be one)
        const activeSubscription = subscriptions.find(
            (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!activeSubscription) {
            // No active subscription - return empty entitlements
            return {
                entitlements: new Set<EntitlementKey>(),
                limits: new Map<LimitKey, number>(),
                shouldCache: true
            };
        }

        // Get the plan for this subscription
        const plan = await billing.plans.get(activeSubscription.planId);

        if (!plan) {
            apiLogger.warn(
                `Plan not found for active subscription. SubscriptionId: ${activeSubscription.id}, PlanId: ${activeSubscription.planId}`
            );
            return {
                entitlements: new Set<EntitlementKey>(),
                limits: new Map<LimitKey, number>(),
                shouldCache: true
            };
        }

        // Extract entitlements from plan (entitlements is string[])
        const entitlements = new Set<EntitlementKey>((plan.entitlements || []) as EntitlementKey[]);

        // Extract limits from plan (limits is Record<string, number>)
        const limits = new Map<LimitKey, number>();
        if (plan.limits) {
            for (const [key, value] of Object.entries(plan.limits)) {
                limits.set(key as LimitKey, value);
            }
        }

        // Attempt to merge customer-level entitlements and limits.
        // These calls are wrapped in try-catch for graceful degradation:
        // if they fail, plan-only values are returned with shouldCache=false
        // so the next request retries instead of serving stale plan-only data.
        let shouldCache = true;

        try {
            // Fetch customer-level entitlements and merge with plan entitlements (union)
            const customerEntitlements = await billing.entitlements.getByCustomerId(customerId);
            for (const ce of customerEntitlements) {
                entitlements.add(ce.entitlementKey as EntitlementKey);
            }

            // Fetch customer-level limits and override plan-level values (customer takes precedence)
            const customerLimits = await billing.limits.getByCustomerId(customerId);
            for (const cl of customerLimits) {
                limits.set(cl.limitKey as LimitKey, cl.maxValue);
            }
        } catch (customerError) {
            const errorMessage =
                customerError instanceof Error ? customerError.message : String(customerError);

            apiLogger.warn(
                `Failed to load customer-level entitlements for customer ${customerId}. Falling back to plan-only values. Error: ${errorMessage}`
            );
            Sentry.captureException(customerError, {
                tags: {
                    subsystem: 'billing-entitlements',
                    action: 'load-customer-overrides'
                },
                extra: { customerId }
            });

            // Do not cache degraded results - next request must retry customer-level calls
            shouldCache = false;
        }

        return { entitlements, limits, shouldCache };
    } catch (error) {
        apiLogger.error(
            `Error loading entitlements for customer ${customerId}: ${error instanceof Error ? error.message : String(error)}`
        );
        Sentry.captureException(error, {
            tags: { subsystem: 'billing-entitlements', action: 'load' },
            extra: { customerId }
        });
        return null;
    }
}

/**
 * Entitlement middleware
 *
 * Loads user entitlements and limits from QZPay and caches them.
 * Must run AFTER actor and billing customer middleware.
 *
 * Sets the following context variables:
 * - userEntitlements: Set<EntitlementKey> - User's entitled features
 * - userLimits: Map<LimitKey, number> - User's usage limits
 *
 * @example
 * ```typescript
 * import { entitlementMiddleware } from './middlewares/entitlement';
 *
 * // In app setup (after billing customer middleware)
 * app.use(actorMiddleware());
 * app.use(billingMiddleware);
 * app.use(billingCustomerMiddleware());
 * app.use(entitlementMiddleware());
 *
 * // In route handler
 * const entitlements = c.get('userEntitlements');
 * if (entitlements.has(EntitlementKey.PUBLISH_ACCOMMODATIONS)) {
 *   // User can publish accommodations
 * }
 * ```
 */
export const entitlementMiddleware = (): MiddlewareHandler<AppBindings> => {
    return async (c, next) => {
        // Check if billing is enabled
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            // Billing not enabled - set empty entitlements
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', false);
            await next();
            return;
        }

        // Get billing customer ID (set by billing customer middleware)
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            // No billing customer - set empty entitlements
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', false);
            await next();
            return;
        }

        try {
            // Check cache first
            let cached = entitlementCache.get(billingCustomerId);

            if (cached) {
                // Cache hit - billing was previously healthy
                c.set('billingLoadFailed', false);
            } else {
                // Cache miss - load from QZPay
                const result = await loadEntitlements(billingCustomerId);

                if (result) {
                    cached = {
                        entitlements: result.entitlements,
                        limits: result.limits,
                        timestamp: Date.now()
                    };

                    if (result.shouldCache) {
                        // Full result (plan + customer overrides) - safe to cache
                        entitlementCache.set(billingCustomerId, cached);
                        apiLogger.debug(
                            `Loaded and cached entitlements for customer ${billingCustomerId}. Entitlements: ${result.entitlements.size}, Limits: ${result.limits.size}`
                        );
                    } else {
                        // Degraded result (plan-only, customer calls failed) - do NOT cache
                        // so the next request retries the customer-level calls
                        apiLogger.debug(
                            `Loaded degraded entitlements (plan-only) for customer ${billingCustomerId}. Skipping cache. Entitlements: ${result.entitlements.size}, Limits: ${result.limits.size}`
                        );
                    }

                    // Billing succeeded - mark as healthy
                    c.set('billingLoadFailed', false);
                } else {
                    // Failed to load entirely - use empty entitlements, do not cache
                    // Mark as failed so middleware guards return 503 instead of granting unlimited access
                    cached = {
                        entitlements: new Set<EntitlementKey>(),
                        limits: new Map<LimitKey, number>(),
                        timestamp: Date.now()
                    };
                    c.set('billingLoadFailed', true);
                }
            }

            // Set in context
            c.set('userEntitlements', cached.entitlements);
            c.set('userLimits', cached.limits);
        } catch (error) {
            // Log error but don't break the request (fail-open strategy, see ADR-016)
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.warn(
                `Error in entitlement middleware for customer ${billingCustomerId}: ${errorMessage}`
            );
            Sentry.captureException(error, {
                tags: { subsystem: 'billing-entitlements', action: 'middleware' },
                extra: { billingCustomerId }
            });

            // Set empty entitlements and mark billing as failed
            // requireLimit / requireEntitlement will return 503 instead of silently granting unlimited access
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', true);
        }

        await next();
    };
};

/**
 * Middleware that requires a specific entitlement
 *
 * Returns 403 Forbidden if user lacks the required entitlement.
 * Use this on routes that need specific features.
 *
 * @param key - The entitlement key to check
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { requireEntitlement } from './middlewares/entitlement';
 * import { EntitlementKey } from '@repo/billing';
 *
 * app.post(
 *   '/accommodations',
 *   requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS),
 *   async (c) => {
 *     // User has entitlement - proceed with accommodation creation
 *   }
 * );
 * ```
 */
export function requireEntitlement(key: EntitlementKey): MiddlewareHandler<AppBindings> {
    return async (c, next) => {
        // If billing failed to load, return 503 instead of silently granting access
        if (c.get('billingLoadFailed')) {
            return c.json(
                {
                    error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message: 'Billing service temporarily unavailable'
                    }
                },
                503
            );
        }

        const entitlements = c.get('userEntitlements');

        if (!entitlements || !entitlements.has(key)) {
            throw new HTTPException(403, {
                message: `Access denied. This feature requires the '${key}' entitlement.`
            });
        }

        await next();
    };
}

/**
 * Middleware that checks if user has remaining capacity for a limit
 *
 * Returns 403 Forbidden if user has reached the limit.
 * Note: This only checks the plan limit, not the current usage.
 * Route handlers must check actual usage against the limit.
 *
 * @param key - The limit key to check
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { requireLimit } from './middlewares/entitlement';
 * import { LimitKey } from '@repo/billing';
 *
 * app.post(
 *   '/accommodations',
 *   requireLimit(LimitKey.MAX_ACCOMMODATIONS),
 *   async (c) => {
 *     // User has limit defined - check actual usage in handler
 *     const limit = getRemainingLimit(c, LimitKey.MAX_ACCOMMODATIONS);
 *     // Compare with current count...
 *   }
 * );
 * ```
 */
export function requireLimit(key: LimitKey): MiddlewareHandler<AppBindings> {
    return async (c, next) => {
        // If billing failed to load, return 503 instead of silently granting unlimited access.
        // Without this guard, an empty limits Map causes getRemainingLimit() to return -1
        // (unlimited) for every key, which would be a privilege escalation during outages.
        if (c.get('billingLoadFailed')) {
            return c.json(
                {
                    error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message: 'Billing service temporarily unavailable'
                    }
                },
                503
            );
        }

        const limits = c.get('userLimits');

        if (!limits || !limits.has(key)) {
            throw new HTTPException(403, {
                message: `Access denied. This feature requires the '${key}' limit to be defined.`
            });
        }

        const limitValue = limits.get(key);

        // Check if limit is 0 (effectively disabled)
        if (limitValue === 0) {
            throw new HTTPException(403, {
                message: `Access denied. The '${key}' limit is set to 0 in your plan.`
            });
        }

        await next();
    };
}

/**
 * Check if user has a specific entitlement
 *
 * Helper function for use inside route handlers.
 *
 * @param c - Hono context
 * @param key - The entitlement key to check
 * @returns True if user has the entitlement
 *
 * @example
 * ```typescript
 * import { hasEntitlement } from '../middlewares/entitlement';
 * import { EntitlementKey } from '@repo/billing';
 *
 * app.get('/accommodations/:id', async (c) => {
 *   const accommodation = await getAccommodation(c.req.param('id'));
 *
 *   // Conditional logic based on entitlement
 *   if (hasEntitlement(c, EntitlementKey.VIEW_ADVANCED_STATS)) {
 *     accommodation.advancedStats = await getAdvancedStats(accommodation.id);
 *   }
 *
 *   return c.json(accommodation);
 * });
 * ```
 */
export function hasEntitlement(c: Context<AppBindings>, key: EntitlementKey): boolean {
    const entitlements = c.get('userEntitlements');
    return entitlements ? entitlements.has(key) : false;
}

/**
 * Get the limit value for a specific limit key
 *
 * Helper function for use inside route handlers.
 * Returns -1 if limit is not defined (unlimited) or 0 if disabled.
 *
 * @param c - Hono context
 * @param key - The limit key to check
 * @returns The limit value (-1 for unlimited, 0 for disabled)
 *
 * @example
 * ```typescript
 * import { getRemainingLimit } from '../middlewares/entitlement';
 * import { LimitKey } from '@repo/billing';
 *
 * app.post('/accommodations', async (c) => {
 *   const limit = getRemainingLimit(c, LimitKey.MAX_ACCOMMODATIONS);
 *
 *   if (limit === -1) {
 *     // Unlimited - proceed
 *   } else if (limit === 0) {
 *     // Disabled - return error
 *     return c.json({ error: 'Feature not available in your plan' }, 403);
 *   } else {
 *     // Check current usage vs limit
 *     const currentCount = await getAccommodationCount(userId);
 *     if (currentCount >= limit) {
 *       return c.json({ error: `Maximum limit of ${limit} reached` }, 403);
 *     }
 *   }
 *
 *   // Proceed with creation
 * });
 * ```
 */
export function getRemainingLimit(c: Context<AppBindings>, key: LimitKey): number {
    const limits = c.get('userLimits');

    if (!limits || !limits.has(key)) {
        // Limit not defined - treat as unlimited
        return -1;
    }

    return limits.get(key) || 0;
}

/**
 * Get all user entitlements
 *
 * Helper function to retrieve all entitlements at once.
 * Useful for displaying plan features or debugging.
 *
 * @param c - Hono context
 * @returns Set of entitlement keys (empty if none)
 *
 * @example
 * ```typescript
 * import { getAllEntitlements } from '../middlewares/entitlement';
 *
 * app.get('/me/entitlements', async (c) => {
 *   const entitlements = getAllEntitlements(c);
 *   return c.json({
 *     entitlements: Array.from(entitlements)
 *   });
 * });
 * ```
 */
export function getAllEntitlements(c: Context<AppBindings>): Set<EntitlementKey> {
    return c.get('userEntitlements') || new Set<EntitlementKey>();
}

/**
 * Get all user limits
 *
 * Helper function to retrieve all limits at once.
 * Useful for displaying plan limits or debugging.
 *
 * @param c - Hono context
 * @returns Map of limit keys to values (empty if none)
 *
 * @example
 * ```typescript
 * import { getAllLimits } from '../middlewares/entitlement';
 *
 * app.get('/me/limits', async (c) => {
 *   const limits = getAllLimits(c);
 *   return c.json({
 *     limits: Object.fromEntries(limits)
 *   });
 * });
 * ```
 */
export function getAllLimits(c: Context<AppBindings>): Map<LimitKey, number> {
    return c.get('userLimits') || new Map<LimitKey, number>();
}

/**
 * Clear entitlement cache for a customer
 *
 * Useful when subscription changes and entitlements need to be refreshed.
 * This is typically called from webhook handlers.
 *
 * @param customerId - The billing customer ID to clear cache for
 *
 * @example
 * ```typescript
 * import { clearEntitlementCache } from './middlewares/entitlement';
 *
 * // In subscription webhook handler
 * app.post('/webhooks/subscription-updated', async (c) => {
 *   const { customerId } = await c.req.json();
 *   clearEntitlementCache(customerId);
 *   return c.json({ received: true });
 * });
 * ```
 */
export function clearEntitlementCache(customerId: string): void {
    apiLogger.debug({ customerId }, 'Entitlement cache cleared');
    entitlementCache.invalidate(customerId);
}

/**
 * Get entitlement cache statistics
 *
 * Useful for monitoring cache performance.
 *
 * @returns Cache statistics
 */
export function getEntitlementCacheStats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
} {
    return entitlementCache.getStats();
}
