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

import {
    type EntitlementKey,
    type LimitKey,
    getDefaultEntitlements,
    getUnlimitedEntitlements
} from '@repo/billing';
import { RoleEnum } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { PlanService } from '../services/plan.service';
import type { AppBindings } from '../types';
import { isGuestActor } from '../utils/actor';
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
 * Module-level PlanService singleton used for the host-draft default plan lookup.
 *
 * Shared across all requests to avoid recreating the service on every call.
 * Safe: PlanService has no mutable state.
 */
const planService = new PlanService();

/**
 * Memoized promise carrying the resolved owner-basico defaults.
 *
 * Populated on first call to {@link buildHostDraftDefaultsResult} and
 * invalidated after {@link HOST_DRAFT_CACHE_TTL_MS} (5 minutes — matching
 * the entitlement cache TTL philosophy). A single promise is shared across
 * all concurrent requests on the HOST fallback path, so the DB is only
 * queried once per TTL window even under burst load (SPEC-192 T-024).
 *
 * Set to `null` on module initialisation and after TTL expiry.
 */
let hostDraftDefaultsCache: Promise<LoadEntitlementsResult> | null = null;

/** Timestamp of the last successful hostDraftDefaultsCache population */
let hostDraftDefaultsCachedAt = 0;

/** TTL for the owner-basico defaults memo — matches the entitlement cache TTL */
const HOST_DRAFT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
 * Build the default free-tier entitlement result (SPEC-143 T-143-58).
 *
 * Used when an authenticated customer has no active paid subscription —
 * tourist-free is the documented default and every authenticated user is
 * entitled to it. The result is `shouldCache: true` because it derives
 * exclusively from static in-memory plan config; no customer-level data is
 * read, so there is nothing to invalidate per-customer.
 *
 * @returns A LoadEntitlementsResult populated from {@link getDefaultEntitlements}.
 */
function buildDefaultEntitlementsResult(): LoadEntitlementsResult {
    const fallback = getDefaultEntitlements();
    return {
        entitlements: new Set<EntitlementKey>(fallback.entitlements),
        limits: new Map<LimitKey, number>(fallback.limits.map((l) => [l.key, l.value])),
        shouldCache: true
    };
}

/**
 * Build the host-draft default entitlement result (SPEC-143 Block 1).
 *
 * When a user is promoted to the HOST role via the onboarding flow, they may
 * not yet have an active paid subscription (the real `billing_subscription` row
 * + 14-day trial countdown starts at first-publish, not at role promotion). To
 * avoid locking the host out of core features between promotion and first
 * publish, we fall back to the `owner-basico` plan entitlements/limits instead
 * of the tourist-free defaults used for regular users.
 *
 * **Performance (SPEC-192 T-024):** this function is called on every protected
 * request for HOST actors without an active subscription — a hot path. The
 * previous implementation was an in-memory map lookup (O(n) on ALL_PLANS); the
 * new implementation queries the `billing_plans` DB table. To preserve the
 * near-zero latency of the hot path, the resolved result is memoized with a
 * module-level promise and a 5-minute TTL matching the entitlement cache
 * philosophy (see {@link HOST_DRAFT_CACHE_TTL_MS}). The promise is shared, so
 * concurrent requests on first load coalesce into a single DB query.
 *
 * If `owner-basico` is NOT_FOUND (mis-configuration or plan not yet seeded),
 * this function falls back to {@link buildDefaultEntitlementsResult} and does
 * NOT memoize the miss — the next request will retry so the plan is picked up
 * after seeding without requiring a restart.
 *
 * @returns A LoadEntitlementsResult populated from the `owner-basico` DB plan.
 */
async function buildHostDraftDefaultsResult(): Promise<LoadEntitlementsResult> {
    const now = Date.now();

    // Return the memoized promise if still within TTL
    if (
        hostDraftDefaultsCache !== null &&
        now - hostDraftDefaultsCachedAt < HOST_DRAFT_CACHE_TTL_MS
    ) {
        return hostDraftDefaultsCache;
    }

    // Build a new promise and memoize it immediately so concurrent callers
    // share the same inflight query (promise deduplication).
    const fetchPromise = planService.getBySlug('owner-basico').then((result) => {
        if (!result.success) {
            // NOT_FOUND or INTERNAL_ERROR — do NOT memoize; next request retries.
            hostDraftDefaultsCache = null;
            hostDraftDefaultsCachedAt = 0;
            apiLogger.warn(
                { errorCode: result.error.code },
                'owner-basico plan not found in DB — falling back to tourist-free defaults for HOST actor'
            );
            return buildDefaultEntitlementsResult();
        }

        // BillingPlanResponse.limits is Record<string, number>; convert to Map<LimitKey, number>
        const limits = new Map<LimitKey, number>(
            Object.entries(result.data.limits) as [LimitKey, number][]
        );

        return {
            entitlements: new Set<EntitlementKey>(result.data.entitlements as EntitlementKey[]),
            limits,
            shouldCache: true
        };
    });

    // Memoize the promise; set the timestamp now so concurrent callers use it.
    hostDraftDefaultsCache = fetchPromise;
    hostDraftDefaultsCachedAt = now;

    return fetchPromise;
}

/**
 * Platform staff roles that bypass billing entitlements entirely (SPEC-171).
 *
 * These roles operate the admin panel on behalf of the platform and have no
 * billing customer/subscription. They are not "billing actors", so the
 * resolver grants them the unlimited entitlement set instead of treating
 * "no plan" as "no entitlements" (which would surface upsell gates at them).
 *
 * HOST is deliberately excluded: it is the only paying role and must keep
 * seeing the real plan entitlements (and upsell gates when on a free tier).
 * Non-staff, non-HOST roles (USER, GUEST, SPONSOR, SYSTEM) keep the
 * tourist-free defaults.
 */
const STAFF_BILLING_BYPASS_ROLES: ReadonlySet<RoleEnum> = new Set([
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN,
    RoleEnum.EDITOR,
    RoleEnum.CLIENT_MANAGER
]);

/**
 * Whether the given role is platform staff that bypasses billing entitlements.
 *
 * @param role - The actor role to check (undefined → not staff).
 * @returns `true` when the role is in {@link STAFF_BILLING_BYPASS_ROLES}.
 */
function isStaffBypassRole(role: RoleEnum | undefined): boolean {
    return role !== undefined && STAFF_BILLING_BYPASS_ROLES.has(role);
}

/**
 * Build the unlimited entitlement result for platform staff (SPEC-171).
 *
 * Every entitlement granted and every limit set to the unlimited sentinel
 * (`-1`), sourced from {@link getUnlimitedEntitlements}. `shouldCache` is
 * irrelevant here because the staff bypass short-circuits the middleware
 * before the customer-keyed cache is ever touched, but it is set to `true`
 * for shape consistency with the other builders.
 *
 * @returns A LoadEntitlementsResult granting everything.
 */
function buildStaffUnlimitedResult(): LoadEntitlementsResult {
    const unlimited = getUnlimitedEntitlements();
    return {
        entitlements: new Set<EntitlementKey>(unlimited.entitlements),
        limits: new Map<LimitKey, number>(
            unlimited.limits.map((l) => [l.key as LimitKey, l.value])
        ),
        shouldCache: true
    };
}

/**
 * Load entitlements and limits for a billing customer.
 *
 * Three paths:
 * 1. Active paid (or trialing) subscription → plan entitlements + customer
 *    overrides merged on top.
 * 2. No subscriptions or no active subscription → default free-tier
 *    entitlements via {@link buildDefaultEntitlementsResult} (SPEC-143 T-143-58).
 * 3. Active subscription pointing at a deleted plan → empty result; this is a
 *    data-integrity error, NOT a missing-subscription case, so we deliberately
 *    do NOT fall back to free-tier — empty trips the downstream `billingLoadFailed`
 *    guard and surfaces the corruption instead of masking it.
 *
 * When merging customer-level overrides on path 1, if the customer-level calls
 * fail the function returns plan-only data with `shouldCache: false` so degraded
 * results are never stored in cache.
 *
 * @param customerId - The QZPay customer ID
 * @param actorRole - The role of the authenticated actor. Used to select the
 *   correct fallback when no active subscription is found. HOST actors fall back
 *   to `owner-basico` defaults (SPEC-143 Block 1); all other roles fall back to
 *   tourist-free defaults.
 * @returns Entitlements, limits, and cache flag, or null if billing unavailable
 */
async function loadEntitlements(
    customerId: string,
    actorRole?: RoleEnum
): Promise<LoadEntitlementsResult | null> {
    try {
        const billing = getQZPayBilling();

        if (!billing) {
            return null;
        }

        // Get customer's active subscription
        const subscriptions = await billing.subscriptions.getByCustomerId(customerId);

        if (!subscriptions || subscriptions.length === 0) {
            // No subscription at all — fall back to role-appropriate defaults.
            // HOST actors who were just promoted (before first publish) receive
            // owner-basico defaults so they can access host features during the
            // draft phase (SPEC-143 Block 1). All other roles receive tourist-free
            // defaults (SPEC-143 T-143-58).
            if (actorRole === RoleEnum.HOST) {
                return await buildHostDraftDefaultsResult();
            }
            return buildDefaultEntitlementsResult();
        }

        // Find active subscription (there should only be one)
        const activeSubscription = subscriptions.find(
            (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!activeSubscription) {
            // Only cancelled / past_due / paused subscriptions — fall back to
            // role-appropriate defaults. Same rationale as the no-subscriptions
            // branch above (SPEC-143 Block 1 / T-143-58).
            if (actorRole === RoleEnum.HOST) {
                return await buildHostDraftDefaultsResult();
            }
            return buildDefaultEntitlementsResult();
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
        // Platform staff bypass (SPEC-171). Staff roles (SUPER_ADMIN, ADMIN,
        // EDITOR, CLIENT_MANAGER) operate the admin panel without a billing
        // customer/subscription. Grant them the unlimited entitlement set FIRST —
        // before the billingEnabled check, the customer lookup, and the
        // customer-keyed cache. It runs before billingEnabled because the spec
        // requires staff to "see everything enabled, no gating" unconditionally:
        // now that the frontend trusts the resolver (the role-aware shim is
        // gone), returning empty for staff when billing is disabled would gate
        // their premium fields. Running before the cache keeps role-dependent
        // payloads out of the customer-keyed cache (no cross-role leak).
        const staffActor = c.get('actor');
        if (isStaffBypassRole(staffActor?.role as RoleEnum | undefined)) {
            const unlimited = buildStaffUnlimitedResult();
            c.set('userEntitlements', unlimited.entitlements);
            c.set('userLimits', unlimited.limits);
            c.set('billingLoadFailed', false);
            await next();
            return;
        }

        // Check if billing is enabled
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            // Billing not enabled (e.g. the payment provider is unconfigured in
            // this environment). This must NOT strip entitlements from
            // authenticated users: a free feature like saving favorites cannot
            // depend on whether the payment integration is wired up. Grant the
            // same role-appropriate defaults as the no-customer branch below
            // (HOST → owner-basico draft defaults, other authenticated users →
            // tourist-free). Guests get nothing. Staff are already handled by the
            // bypass above. Paid-plan upgrades cannot be resolved while billing is
            // off, so those users fall back to the free baseline until it is
            // configured. (BETA-42: billing-off locked every user out of favorites.)
            const actor = c.get('actor');

            if (!actor || isGuestActor(actor) || !actor.id) {
                c.set('userEntitlements', new Set<EntitlementKey>());
                c.set('userLimits', new Map<LimitKey, number>());
                c.set('billingLoadFailed', false);
                await next();
                return;
            }

            const fallback =
                (actor.role as RoleEnum | undefined) === RoleEnum.HOST
                    ? await buildHostDraftDefaultsResult()
                    : buildDefaultEntitlementsResult();
            c.set('userEntitlements', fallback.entitlements);
            c.set('userLimits', fallback.limits);
            c.set('billingLoadFailed', false);
            await next();
            return;
        }

        // Get billing customer ID (set by billing customer middleware)
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            // No billing customer row yet. This is NOT "no entitlements": every
            // authenticated user is entitled to at least the tourist-free
            // baseline (HOST actors → owner-basico draft defaults), exactly like
            // the no-active-subscription branch inside loadEntitlements. The
            // customer row is created by the Better Auth signup databaseHook,
            // which is non-blocking — if it has not run yet or failed, we must
            // still grant the role-appropriate defaults instead of locking the
            // user out of features every authenticated user should have (e.g.
            // saving favorites). Guests get nothing. (SPEC-143 smoke F-B1)
            const actor = c.get('actor');

            if (!actor || isGuestActor(actor) || !actor.id) {
                c.set('userEntitlements', new Set<EntitlementKey>());
                c.set('userLimits', new Map<LimitKey, number>());
                c.set('billingLoadFailed', false);
                await next();
                return;
            }

            const fallback =
                (actor.role as RoleEnum | undefined) === RoleEnum.HOST
                    ? await buildHostDraftDefaultsResult()
                    : buildDefaultEntitlementsResult();
            c.set('userEntitlements', fallback.entitlements);
            c.set('userLimits', fallback.limits);
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
                // Cache miss - load from QZPay. Pass the actor role so the
                // fallback path can select the correct default plan when the
                // customer has no active subscription (SPEC-143 Block 1).
                const actor = c.get('actor');
                const actorRole = actor?.role as RoleEnum | undefined;
                const result = await loadEntitlements(billingCustomerId, actorRole);

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
 * Invalidates the module-level memo for the `owner-basico` host-draft defaults
 * (SPEC-192 T-024).
 *
 * Forces the next call to {@link buildHostDraftDefaultsResult} to re-query the
 * DB. Useful in test harnesses and after plan updates that should be reflected
 * immediately without waiting for the TTL to expire.
 */
export function clearHostDraftDefaultsCache(): void {
    hostDraftDefaultsCache = null;
    hostDraftDefaultsCachedAt = 0;
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
