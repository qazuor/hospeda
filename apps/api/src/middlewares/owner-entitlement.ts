/**
 * Owner Entitlement Middleware (SPEC-187 P2-T4)
 *
 * Resolves the OWNING HOST of an accommodation and attaches their
 * `EntitlementKey[]` to the Hono context as `c.get('ownerEntitlements')`.
 *
 * **Distinct from `entitlementMiddleware`:**
 * - `entitlementMiddleware` resolves the REQUESTING user (the actor on
 *   the current request) and exposes `userEntitlements` for gates the
 *   viewer needs (e.g., "can this tourist contact via WhatsApp?").
 * - `ownerEntitlementMiddleware` resolves the OWNER of the resource the
 *   request targets (the accommodation) and exposes `ownerEntitlements`
 *   for gates that depend on what the owner is entitled to publish (e.g.,
 *   "should the public detail page surface `richDescription`?" — FR-3b).
 *
 * The two never overlap: a logged-in tourist viewing an accommodation
 * carries `userEntitlements` for themselves and `ownerEntitlements` for
 * the accommodation's host. SPEC-187 P2-T5 consumes
 * `ownerEntitlements`; SPEC-171 and the existing viewer-gated branches
 * continue to consume `userEntitlements`.
 *
 * **Staff bypass (INV-6):** platform staff roles (SUPER_ADMIN, ADMIN,
 * EDITOR, CLIENT_MANAGER) get the full unlimited set, mirroring the
 * existing `entitlementMiddleware` bypass. This matters in dev (seeded
 * staff owners) and in admin preview contexts.
 *
 * **Fail-open:** billing not initialized → tourist-free defaults (no
 * premium features). No billing customer for the owner → empty set (the
 * public route applies the "owner-not-entitled" omission deterministically).
 * Throws 400 if the configured param is missing (no implicit host
 * resolution — the public route MUST resolve the host explicitly) and 404
 * if the accommodation row does not exist.
 *
 * @module middlewares/owner-entitlement
 */
import {
    type EntitlementKey,
    getDefaultEntitlements,
    getUnlimitedEntitlements,
    isEntitlementGrantingStatus,
    isEntitlementKey,
    isLimitKey,
    type LimitKey
} from '@repo/billing';
import { accommodations, getDb, userRole as userRoleTable } from '@repo/db';
import {
    getUserRoles,
    hydrateSubscriptionProductDomains,
    isAccommodationSubscription,
    type RoleEnum
} from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { eq, inArray, type SQL } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { CachedOwnerSubscription } from '../services/entity-subscription-cache.service';
import { readAccommodationSubscriptionCacheByOwnerIds } from '../services/entity-subscription-cache.service';
import { PlanService } from '../services/plan.service';
import type { AppBindings } from '../types';
import { apiLogger } from '../utils/logger';
import { isStaffBypassRole } from '../utils/staff-roles';
import { getQZPayBilling } from './billing';

/**
 * Options for the owner entitlement middleware factory.
 */
export interface OwnerEntitlementMiddlewareOptions {
    /**
     * Name of the Hono path parameter carrying the accommodation ID.
     * Defaults to `'accommodationId'`. Set this when the route uses a
     * different identifier — for example, when the middleware is mounted
     * under a sub-router that already extracted the param under another
     * name.
     */
    readonly paramName?: string;
}

/**
 * Default name of the Hono path parameter carrying the accommodation ID.
 * Matches the SPEC-187 P2-T4 spec text and the convention used by the
 * other accommodation routes in this service.
 */
const DEFAULT_PARAM_NAME = 'accommodationId';

/**
 * Load the owning host's billing customer ID by looking up
 * `accommodation.ownerId` (a `users.id` FK) via QZPay's
 * `customers.getByExternalId(userId)` API.
 *
 * The QZPay billing customer carries the plan + addons that determine
 * what the owner can publish. Customer rows are created by the Better
 * Auth signup databaseHook (non-blocking), so a missing customer row
 * is a normal transient state — the middleware treats it as
 * fail-open (return `null`, public route omits premium fields).
 *
 * @param ownerId - The `users.id` of the accommodation's owner.
 * @returns QZPay customer ID, or `null` if billing is disabled, the
 *   customer row does not exist yet, or the lookup failed.
 */
async function loadOwnerCustomerId(ownerId: string): Promise<string | null> {
    const billing = getQZPayBilling();
    if (!billing) {
        return null;
    }
    try {
        const customer = await billing.customers.getByExternalId(ownerId);
        return customer?.id ?? null;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { ownerId, error: message },
            'ownerEntitlementMiddleware: failed to look up QZPay customer for owner; failing open with empty entitlements'
        );
        Sentry.captureException(error, {
            tags: { subsystem: 'owner-entitlements', action: 'customer-lookup' },
            extra: { ownerId }
        });
        return null;
    }
}

/**
 * Resolve the plan entitlements for a given billing customer ID.
 *
 * Shares the SUBSCRIPTION SELECTION contract with `loadEntitlements`
 * (entitlement.ts): entitlement-granting status (`active | trialing | comp`,
 * HOS-291) AND accommodation product domain (SPEC-239 T-034). It is a
 * deliberately reduced re-implementation of the rest: it does NOT carry the
 * viewer-only concerns (caller-keyed cache, staff bypass, actor-role defaults),
 * NOR the HOS-217 HOST tourist-plan discard, NOR the customer-level entitlement
 * merge (`billing.entitlements.getByCustomerId`) that the consumer-side loader
 * applies — so an admin-granted customer-level entitlement is NOT visible on
 * owner-gated surfaces. Returns a fresh `Set<EntitlementKey>` for every call.
 *
 * @param customerId - The QZPay customer ID.
 * @returns A set of entitlement keys. Empty if no entitlement-granting
 *   accommodation subscription exists, or the plan carries no entitlements.
 */
/**
 * Resolve the entitlement set a PLAN grants, by plan id.
 *
 * Split out of {@link loadCustomerEntitlements} by HOS-1084 so the cached read
 * path — which already knows the plan id, because `entity_subscriptions` stores
 * it — can reach the plan without first walking customer → subscriptions.
 *
 * @param planId - `billing_plans.id`.
 * @param memo - Optional per-batch memo. A listing page routinely resolves the
 *   same handful of plans for a dozen different owners; the memo collapses that
 *   to one lookup per DISTINCT plan. Deliberately NOT a module-level cache:
 *   this is request-scoped dedup, not a staleness window.
 * @returns The plan's known entitlement keys. Empty on any failure, matching
 *   the fail-closed contract of the caller.
 */
async function loadPlanEntitlements(
    planId: string,
    memo?: Map<string, Promise<Set<EntitlementKey>>>
): Promise<Set<EntitlementKey>> {
    const memoized = memo?.get(planId);
    if (memoized) {
        return await memoized;
    }

    const load = (async (): Promise<Set<EntitlementKey>> => {
        const entitlements = new Set<EntitlementKey>();
        const billing = getQZPayBilling();
        if (!billing) {
            return entitlements;
        }
        try {
            const plan = await billing.plans.get(planId);
            if (!plan?.entitlements) {
                return entitlements;
            }
            // Filter to known keys — unknown strings from a mis-configured plan
            // are silently dropped (same approach as the existing loader).
            for (const key of plan.entitlements) {
                if (isEntitlementKey(key)) {
                    entitlements.add(key);
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            apiLogger.warn(
                { planId, error: message },
                'ownerEntitlementMiddleware: failed to load plan entitlements; returning empty set'
            );
            Sentry.captureException(error, {
                tags: { subsystem: 'owner-entitlements', action: 'plan-lookup' },
                extra: { planId }
            });
        }
        return entitlements;
    })();

    memo?.set(planId, load);
    return await load;
}

async function loadCustomerEntitlements(customerId: string): Promise<Set<EntitlementKey>> {
    const billing = getQZPayBilling();
    if (!billing) {
        return new Set<EntitlementKey>();
    }
    const entitlements = new Set<EntitlementKey>();
    try {
        const rawSubscriptions = await billing.subscriptions.getByCustomerId(customerId);
        // HOS-291: route through the shared predicate (active | trialing | comp)
        // instead of re-deriving the status set inline. The inline check omitted
        // `comp` (SPEC-262), so an admin-comped owner resolved to an EMPTY
        // entitlement set and every owner-gated feature was silently off for
        // them — while the consumer-side loader (`loadEntitlements` in
        // entitlement.ts, HOS-238) already resolved the same subscription
        // correctly.
        //
        // The domain filter closes a PRE-EXISTING hole in the same selection
        // (SPEC-239 T-034: a commerce sub could already be picked here while
        // `active`), and it must land together with the status widening because
        // `comp` is USER-reachable on a commerce subscription — the promo-code
        // apply path flips whatever subscription the caller owns, with no domain
        // guard — and the commerce plan carries `entitlements: []` / `limits: []`.
        // Selecting it would shadow the owner's live accommodation subscription
        // and reproduce the very symptom this fix removes. The predicate treats
        // null/undefined productDomain as 'accommodation' (legacy rows + column
        // default), so it can never drop a real accommodation sub.
        //
        // HOS-847: `getByCustomerId()` returns qzpay-core-mapped objects that never
        // carry `productDomain` (HOS-934 gap) — without hydration the domain
        // filter above was a silent no-op, which would have let a recurring
        // add-on's own preapproval row (product_domain = 'addon') shadow the
        // owner's real accommodation subscription. Hydrate before filtering.
        //
        // There should only ever be ONE live accommodation subscription per
        // customer (`start-paid.ts` rejects a second one with this same predicate
        // pair), so `find` order is not load-bearing.
        const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions ?? []);
        const active = subscriptions.find(
            (sub) => isEntitlementGrantingStatus(sub.status) && isAccommodationSubscription(sub)
        );
        if (!active) {
            return entitlements;
        }
        return await loadPlanEntitlements(active.planId);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { customerId, error: message },
            'ownerEntitlementMiddleware: failed to load plan entitlements; returning empty set'
        );
        Sentry.captureException(error, {
            tags: { subsystem: 'owner-entitlements', action: 'plan-lookup' },
            extra: { customerId }
        });
        return entitlements;
    }
}

/**
 * Build the unlimited entitlement set for staff owners (INV-6 symmetry
 * with `entitlementMiddleware`).
 *
 * Staff roles (SUPER_ADMIN, ADMIN, EDITOR, CLIENT_MANAGER) operating the
 * admin panel on behalf of the platform carry no billing customer / plan.
 * The owner middleware would normally fail-open with tourist-free defaults
 * for them; granting the unlimited set preserves the principle "staff see
 * everything enabled, no gating".
 */
function buildStaffUnlimitedEntitlements(): Set<EntitlementKey> {
    const unlimited = getUnlimitedEntitlements();
    return new Set<EntitlementKey>(unlimited.entitlements);
}

/**
 * Resolve the hats of the accommodation's OWNER (HOS-296).
 *
 * Reads `user_role`, not the dropped `users.role` scalar. Returns an empty
 * array on lookup failure, which the staff predicate treats as "not staff" —
 * the same fail-open behaviour the previous `null` return had.
 *
 * @param ownerId - The `users.id` of the accommodation's owner.
 * @returns Every role the owner holds; empty on error.
 */
async function resolveOwnerRoles(ownerId: string): Promise<readonly RoleEnum[]> {
    try {
        return await getUserRoles({ userId: ownerId });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { ownerId, error: message },
            'ownerEntitlementMiddleware: failed to resolve owner roles; proceeding without staff bypass'
        );
        Sentry.captureException(error, {
            tags: { subsystem: 'owner-entitlements', action: 'owner-role-lookup' },
            extra: { ownerId }
        });
        return [];
    }
}

/**
 * Resolve an owner's entitlement set, preferring the denormalized
 * `entity_subscriptions` cache when the caller already read it (HOS-1084).
 *
 * The cache stores exactly the two things this resolver's live path spends
 * three QZPay round trips to rediscover: the status of the owner's
 * accommodation subscription and the plan it runs on. So a HIT skips straight
 * to the plan, and the selection contract is unchanged — an
 * entitlement-granting status (`active | trialing | comp`) on an
 * accommodation-domain subscription, or nothing.
 *
 * A MISS is not "no subscription": it falls through to the live path, which is
 * exactly what this function did before the cache existed. That is what makes
 * an incomplete cache a performance question rather than a correctness one.
 *
 * @param ownerId - `users.id` of the accommodation owner.
 * @param ownerRoles - Roles the owner holds (staff bypass, INV-6).
 * @param cached - The cached row for this owner, or `null`/`undefined` on a miss.
 * @param planMemo - Optional per-batch plan-lookup memo.
 */
async function resolveOwnerEntitlementSet(
    ownerId: string,
    ownerRoles: readonly RoleEnum[],
    cached?: CachedOwnerSubscription | null,
    planMemo?: Map<string, Promise<Set<EntitlementKey>>>
): Promise<Set<EntitlementKey>> {
    if (isStaffBypassRole(ownerRoles)) {
        return buildStaffUnlimitedEntitlements();
    }

    // The cache mirrors billing, so it can only answer while billing is up. With
    // billing uninitialised the live path below returns the free-tier defaults,
    // and a cache hit must not quietly answer something else.
    if (cached && getQZPayBilling()) {
        if (!isEntitlementGrantingStatus(cached.status)) {
            return new Set<EntitlementKey>();
        }
        if (cached.planId) {
            return await loadPlanEntitlements(cached.planId, planMemo);
        }
        // Granting status with no plan id: the sync never writes that pair, so
        // treat it as an unusable row and resolve live rather than answer with
        // an empty — silently wrong — set.
    }

    const customerId = await loadOwnerCustomerId(ownerId);

    if (customerId) {
        return await loadCustomerEntitlements(customerId);
    }

    const billing = getQZPayBilling();
    if (billing) {
        return new Set<EntitlementKey>();
    }

    const defaults = getDefaultEntitlements();
    return new Set<EntitlementKey>(defaults.entitlements.filter(isEntitlementKey));
}

/**
 * Owner entitlement middleware factory.
 *
 * Reads the accommodation ID from the named path param, resolves the
 * owning host's plan entitlements, and attaches them to the Hono
 * context as `c.get('ownerEntitlements')`.
 *
 * @param options - Middleware options. See {@link OwnerEntitlementMiddlewareOptions}.
 * @returns A Hono `MiddlewareHandler<AppBindings>`.
 *
 * @example
 * ```ts
 * import { ownerEntitlementMiddleware } from './middlewares/owner-entitlement';
 *
 * // On a route keyed by accommodation id
 * app.get(
 *     '/api/v1/public/accommodations/:accommodationId',
 *     ownerEntitlementMiddleware(),
 *     (c) => {
 *         const ownerEntitlements = c.get('ownerEntitlements');
 *         if (ownerEntitlements.has(EntitlementKey.CAN_USE_RICH_DESCRIPTION)) {
 *             // Host is entitled — surface richDescription in the payload.
 *         }
 *         return c.json(accommodation);
 *     }
 * );
 * ```
 */
export const ownerEntitlementMiddleware = (
    options: OwnerEntitlementMiddlewareOptions = {}
): MiddlewareHandler<AppBindings> => {
    const paramName = options.paramName ?? DEFAULT_PARAM_NAME;
    return async (c, next) => {
        const accommodationId = c.req.param(paramName);
        if (!accommodationId) {
            return c.json(
                {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Missing required path parameter: ${paramName}. The owner entitlement middleware cannot resolve an implicit host — the route must declare this param.`
                    }
                },
                400
            );
        }

        // 1. Resolve accommodation → ownerId, and the owner's hats in the same
        //    round trip. HOS-296: `users.role` is gone, so this is a LEFT JOIN
        //    onto `user_role`, which yields one row per held hat — hence the
        //    aggregation below rather than `.limit(1)`. LEFT (not INNER) so an
        //    owner with no rows still resolves the accommodation instead of
        //    turning a data bug into a spurious 404.
        let ownerId: string | null = null;
        let ownerRoles: readonly RoleEnum[] = [];
        try {
            const db = getDb();
            const rows = await db
                .select({ ownerId: accommodations.ownerId, ownerRole: userRoleTable.role })
                .from(accommodations)
                .leftJoin(userRoleTable, eq(userRoleTable.userId, accommodations.ownerId))
                .where(eq(accommodations.id, accommodationId));
            const typedRows = rows as ReadonlyArray<{
                ownerId: string;
                ownerRole: RoleEnum | null;
            }>;
            ownerId = typedRows[0]?.ownerId ?? null;
            ownerRoles = typedRows
                .map((row) => row.ownerRole)
                .filter((role): role is RoleEnum => role !== null);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            apiLogger.error(
                { accommodationId, error: message },
                'ownerEntitlementMiddleware: failed to look up accommodation owner'
            );
            Sentry.captureException(error, {
                tags: { subsystem: 'owner-entitlements', action: 'accommodation-lookup' },
                extra: { accommodationId }
            });
            return c.json(
                { error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve owner' } },
                500
            );
        }

        if (!ownerId) {
            return c.json(
                { error: { code: 'NOT_FOUND', message: 'Accommodation not found' } },
                404
            );
        }

        const ownerEntitlements = await resolveOwnerEntitlementSet(ownerId, ownerRoles);

        c.set('ownerEntitlements', ownerEntitlements);
        await next();
    };
};

/**
 * Helper: retrieve the owning host's entitlement set from the Hono
 * context. Returns an empty set if the middleware did not run (the
 * public route uses this as the "owner not entitled" sentinel).
 *
 * @param c - Hono context
 * @returns The owner's entitlement set
 */
export function getOwnerEntitlements(c: {
    get: (key: 'ownerEntitlements') => Set<EntitlementKey>;
}): Set<EntitlementKey> {
    return c.get('ownerEntitlements');
}

/**
 * Resolve owner entitlements directly from a known ownerId.
 *
 * Used by routes that identify the accommodation by slug (not id) and therefore
 * cannot run {@link ownerEntitlementMiddleware} before the entity fetch. This is
 * the minimal reuse seam for SPEC-187 P2-T6: the route fetches the accommodation,
 * then asks this helper for the owner's entitlements, then applies
 * `filterAccommodationByEntitlements`.
 */
export async function resolveOwnerEntitlementsForOwnerId(
    ownerId: string
): Promise<readonly EntitlementKey[]> {
    const [ownerRoles, cacheMap] = await Promise.all([
        resolveOwnerRoles(ownerId),
        readOwnerSubscriptionCache([ownerId])
    ]);
    return Array.from(
        await resolveOwnerEntitlementSet(ownerId, ownerRoles, cacheMap.get(ownerId) ?? null)
    );
}

/**
 * Read the denormalized owner-subscription cache, never throwing.
 *
 * A cache read that fails must degrade to "every owner is a MISS" — which is
 * the pre-HOS-1084 live path — rather than propagate. Losing the cache costs
 * latency; losing the request costs the page.
 */
async function readOwnerSubscriptionCache(
    ownerIds: readonly string[]
): Promise<Map<string, CachedOwnerSubscription>> {
    try {
        return await readAccommodationSubscriptionCacheByOwnerIds(ownerIds);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { count: ownerIds.length, error: message },
            'owner-entitlement: entity_subscriptions cache read failed; resolving every owner live'
        );
        return new Map<string, CachedOwnerSubscription>();
    }
}

// ---------------------------------------------------------------------------
// Owner Limits — SPEC-211 Phase 1
// ---------------------------------------------------------------------------

/**
 * Module-level PlanService singleton for the owner-basico limits fallback.
 *
 * Shared across all owner-limits requests to avoid re-instantiation on every
 * call. Safe: PlanService carries no mutable per-request state.
 */
const ownerLimitsPlanService = new PlanService();

/**
 * In-memory FIFO cache for owner limits.
 *
 * Keyed by QZPay `customerId`. Mirrors the 5-minute TTL philosophy used by
 * the main `EntitlementCache` in entitlement.ts. A separate cache is used so
 * the owner-limits hot path (chat route) does not share eviction pressure with
 * the viewer-entitlement cache.
 */
interface OwnerLimitsCacheEntry {
    /** Resolved limits map — plan values merged with customer-level overrides. */
    readonly limits: Map<LimitKey, number>;
    /** Unix timestamp of population (ms). */
    readonly timestamp: number;
}

const OWNER_LIMITS_TTL_MS = 5 * 60 * 1000; // 5 minutes — matches entitlement TTL
const OWNER_LIMITS_MAX_SIZE = 1000;
const ownerLimitsCache = new Map<string, OwnerLimitsCacheEntry>();

/**
 * Look up an entry in the owner-limits cache.
 * Returns `null` on miss or if the entry has expired (evicting it eagerly).
 */
function getOwnerLimitsCacheEntry(customerId: string): Map<LimitKey, number> | null {
    const entry = ownerLimitsCache.get(customerId);
    if (!entry) {
        return null;
    }
    if (Date.now() - entry.timestamp > OWNER_LIMITS_TTL_MS) {
        ownerLimitsCache.delete(customerId);
        return null;
    }
    return entry.limits;
}

/**
 * Write an entry to the owner-limits cache, evicting the oldest key when the
 * cache is at capacity (FIFO).
 */
function setOwnerLimitsCacheEntry(customerId: string, limits: Map<LimitKey, number>): void {
    if (ownerLimitsCache.size >= OWNER_LIMITS_MAX_SIZE) {
        const firstKey = ownerLimitsCache.keys().next().value;
        if (firstKey) {
            ownerLimitsCache.delete(firstKey);
        }
    }
    ownerLimitsCache.set(customerId, { limits, timestamp: Date.now() });
}

/**
 * Build the owner-basico fallback limits map.
 *
 * Mirrors the `buildHostDraftDefaultsResult` logic in entitlement.ts but
 * returns only the limits half (a `Map<LimitKey, number>`). Called when an
 * owner has no entitlement-granting accommodation subscription — they get the
 * `owner-basico` DB-row limits
 * so the chat quota check has a concrete finite value rather than an empty map.
 *
 * Falls back to an empty map on lookup error or plan-not-found (the chat route
 * treats an empty-map owner as "no quota defined" and will deny the request).
 *
 * @returns A `Map<LimitKey, number>` populated from the `owner-basico` plan.
 */
async function buildOwnerBasicoFallbackLimits(): Promise<Map<LimitKey, number>> {
    const result = await ownerLimitsPlanService.getBySlug('owner-basico');
    if (!result.success) {
        apiLogger.warn(
            { errorCode: result.error.code },
            'resolveOwnerLimitsForOwnerId: owner-basico plan not found — returning empty limits map for HOST fallback'
        );
        return new Map<LimitKey, number>();
    }
    const limits = new Map<LimitKey, number>();
    for (const [key, value] of Object.entries(result.data.limits)) {
        if (isLimitKey(key)) {
            limits.set(key, value);
        }
    }
    return limits;
}

/**
 * Load the plan limits + customer-level overrides of the owner's live
 * accommodation subscription (status `active | trialing | comp`), for a given
 * QZPay customer ID.
 *
 * Mirrors the plan-limits portion of `loadEntitlements` in entitlement.ts, and
 * uses the same subscription-selection contract as `loadCustomerEntitlements`
 * above. Returns `null` when billing is unavailable. Returns the plan-level-only
 * limits (with `shouldCache: false`) when the customer-override call fails.
 *
 * @param customerId - The QZPay customer ID.
 * @returns The resolved limits map, or `null` if billing is unavailable.
 */
async function loadCustomerLimits(
    customerId: string
): Promise<{ limits: Map<LimitKey, number>; shouldCache: boolean } | null> {
    const billing = getQZPayBilling();
    if (!billing) {
        return null;
    }

    try {
        const rawSubscriptions = await billing.subscriptions.getByCustomerId(customerId);
        // HOS-291: same selection contract as `loadCustomerEntitlements` above
        // (entitlement-granting status AND accommodation domain) — a comp owner
        // must resolve the limits of the plan they were comped on, not the
        // owner-basico fallback quota. Keeping the domain filter matters even
        // more here: a commerce plan is FOUND but carries no limits, so the
        // resolver would cache an empty map for 5 minutes (`shouldCache: true`)
        // instead of falling back to owner-basico.
        //
        // HOS-847: hydrate before filtering — see loadCustomerEntitlements's doc
        // for why the un-hydrated domain filter is a silent no-op.
        const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions ?? []);
        const active = subscriptions.find(
            (sub) => isEntitlementGrantingStatus(sub.status) && isAccommodationSubscription(sub)
        );

        if (!active) {
            // No entitlement-granting accommodation subscription — caller falls
            // back to owner-basico.
            return { limits: new Map<LimitKey, number>(), shouldCache: false };
        }

        const plan = await billing.plans.get(active.planId);
        if (!plan) {
            apiLogger.warn(
                { customerId, planId: active.planId },
                'resolveOwnerLimitsForOwnerId: plan not found for the live subscription; returning empty limits'
            );
            return { limits: new Map<LimitKey, number>(), shouldCache: true };
        }

        // Build plan-level limits map. QZPay returns Record<string, number>; filter
        // to known LimitKey values — unknown keys are silently dropped.
        const limits = new Map<LimitKey, number>();
        if (plan.limits) {
            for (const [key, value] of Object.entries(plan.limits)) {
                if (isLimitKey(key)) {
                    limits.set(key, value);
                }
            }
        }

        // Merge customer-level limit overrides (customer value wins over plan value).
        // Gracefully degrade to plan-only + shouldCache=false when the call fails.
        let shouldCache = true;
        try {
            const customerLimits = await billing.limits.getByCustomerId(customerId);
            for (const cl of customerLimits) {
                if (isLimitKey(cl.limitKey)) {
                    limits.set(cl.limitKey, cl.maxValue);
                }
            }
        } catch (overrideError) {
            const message =
                overrideError instanceof Error ? overrideError.message : String(overrideError);
            apiLogger.warn(
                { customerId, error: message },
                'resolveOwnerLimitsForOwnerId: failed to load customer-level limit overrides; returning plan-only limits'
            );
            Sentry.captureException(overrideError, {
                tags: { subsystem: 'owner-limits', action: 'load-customer-overrides' },
                extra: { customerId }
            });
            shouldCache = false;
        }

        return { limits, shouldCache };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { customerId, error: message },
            'resolveOwnerLimitsForOwnerId: failed to load plan limits; returning empty limits'
        );
        Sentry.captureException(error, {
            tags: { subsystem: 'owner-limits', action: 'plan-lookup' },
            extra: { customerId }
        });
        return { limits: new Map<LimitKey, number>(), shouldCache: false };
    }
}

/**
 * Resolves the accommodation owner's usage limits (`Map<LimitKey, number>`) by
 * `ownerId`. Mirrors {@link resolveOwnerEntitlementsForOwnerId} but returns the
 * **limits half** of the plan. Used by the chat route to gate and meter
 * `ai_chat` against the listing owner instead of the requesting tourist
 * (SPEC-211 Phase 1).
 *
 * **Resolution path:**
 * `ownerId` → billing customer (`customers.getByExternalId`) → live
 * accommodation subscription (`subscriptions.getByCustomerId`, status
 * `active | trialing | comp`) → plan `limits` JSONB (`plans.get`) →
 * customer-level limit overrides merged on top (`limits.getByCustomerId`).
 * Falls back to the `owner-basico` DB-row limits when the owner has no such
 * subscription (matching the HOST fallback in `loadEntitlements`).
 *
 * **Staff bypass (INV-6):** staff owners (SUPER_ADMIN, ADMIN, EDITOR,
 * CLIENT_MANAGER) receive the unlimited entitlement set's limits (`-1` for
 * every key) mirroring the behaviour of the entitlement counterpart.
 *
 * **Caching:** results are cached for 5 minutes keyed by QZPay `customerId`
 * (consistent with the entitlement cache TTL). Degraded results (plan-only,
 * customer-override call failed) are not cached so the next request retries.
 *
 * **Fail-open:** when billing is not initialised, returns the default free-tier
 * limits. An owner with no billing customer row returns the `owner-basico`
 * fallback limits (mirrors the HOST branch of `loadEntitlements`).
 *
 * @param ownerId - The `users.id` of the accommodation's owner.
 * @returns A `Map<LimitKey, number>` for the owner's active plan + overrides.
 *
 * @example
 * ```ts
 * const ownerLimits = await resolveOwnerLimitsForOwnerId(accommodation.ownerId);
 * const chatLimit = ownerLimits.get(LimitKey.MAX_AI_CHAT_PER_MONTH) ?? 0;
 * ```
 */
export async function resolveOwnerLimitsForOwnerId(
    ownerId: string
): Promise<Map<LimitKey, number>> {
    // Staff bypass — unlimited limits for platform staff owners (INV-6).
    const ownerRoles = await resolveOwnerRoles(ownerId);
    if (isStaffBypassRole(ownerRoles)) {
        const unlimited = getUnlimitedEntitlements();
        return new Map<LimitKey, number>(unlimited.limits.map((l) => [l.key, l.value]));
    }

    const billing = getQZPayBilling();

    // Billing not initialised — return default free-tier limits.
    if (!billing) {
        const defaults = getDefaultEntitlements();
        return new Map<LimitKey, number>(defaults.limits.map((l) => [l.key, l.value]));
    }

    // Resolve billing customer for this owner.
    const customerId = await loadOwnerCustomerId(ownerId);

    if (!customerId) {
        // No billing customer row yet — fall back to owner-basico limits (HOST
        // hosts always get the owner-basico baseline, not tourist-free).
        return await buildOwnerBasicoFallbackLimits();
    }

    // Cache hit — return cached limits.
    const cached = getOwnerLimitsCacheEntry(customerId);
    if (cached) {
        return cached;
    }

    // Cache miss — load from QZPay.
    const result = await loadCustomerLimits(customerId);

    if (!result) {
        // Billing unavailable at this point (race condition with billing init).
        const defaults = getDefaultEntitlements();
        return new Map<LimitKey, number>(defaults.limits.map((l) => [l.key, l.value]));
    }

    // When the owner has no entitlement-granting accommodation subscription
    // (result.limits is empty and shouldCache is false from loadCustomerLimits),
    // fall back to owner-basico.
    if (result.limits.size === 0 && !result.shouldCache) {
        return await buildOwnerBasicoFallbackLimits();
    }

    if (result.shouldCache) {
        setOwnerLimitsCacheEntry(customerId, result.limits);
    }

    return result.limits;
}

// ---------------------------------------------------------------------------
// Batch entitlement resolver — SPEC-291 Phase 3b
// ---------------------------------------------------------------------------

/**
 * Batch variant of {@link resolveOwnerEntitlementsForOwnerId}.
 *
 * Resolves entitlement arrays for a page's worth of owner IDs in the **minimum
 * number of round trips**:
 *
 * 1. TWO batched `SELECT`s, issued in parallel — one for every owner's roles
 *    (`user_role`, HOS-296) and one for the denormalized `entity_subscriptions`
 *    cache (HOS-1084).
 * 2. Per-owner resolution then runs in parallel. A cache HIT costs one plan
 *    lookup, deduplicated across the whole batch by {@link loadPlanEntitlements}'s
 *    memo — so a page of twenty listings on four distinct plans makes four
 *    lookups, not twenty. A MISS costs the pre-HOS-1084 live walk.
 *
 * **HOS-1084 removed the 5-minute in-process `Map` this function used to keep.**
 * It was invisible to every other API instance and thrown away on each deploy,
 * which meant a host who upgraded their plan could see the new badge on one
 * instance and not the next, for five minutes, with nothing in the system able
 * to explain the difference. `entity_subscriptions` is the shared, webhook-fresh
 * replacement: it is written the moment the status moves, it is the same row
 * every instance reads, and the reconcile cron re-derives it. A cache miss is
 * never a wrong answer — it is the live path, unchanged.
 *
 * Fail-open: a failed role query → empty entitlements for every affected owner
 * (badge hidden). A failed cache read → every owner resolved live. A per-owner
 * billing failure → empty entitlements for that owner. All logged, all captured.
 *
 * **Use case**: listing endpoints that render a page of accommodation cards.
 * Collect the unique `ownerId` values for the page, call this once, then pass
 * the returned map to {@link filterAccommodationListByOwnerEntitlements}
 * (in `apps/api/src/utils/entitlement-filter.ts`).
 *
 * @param ownerIds - Owner IDs to resolve. Duplicates are tolerated (deduped
 *   internally). The empty-array case returns an empty map immediately.
 * @returns `Map<ownerId, readonly EntitlementKey[]>` — one entry per
 *   **unique** input ID. Owners for which resolution failed have an empty
 *   array (treat as "no entitlements").
 *
 * @example
 * ```ts
 * const ownerIds = [...new Set(items.map((i) => i.ownerId).filter(Boolean))];
 * const entMap = await resolveOwnerEntitlementsForOwnerIds(ownerIds);
 * const gated = filterAccommodationListByOwnerEntitlements(items, entMap);
 * ```
 */
export async function resolveOwnerEntitlementsForOwnerIds(
    ownerIds: readonly string[]
): Promise<Map<string, readonly EntitlementKey[]>> {
    const result = new Map<string, readonly EntitlementKey[]>();
    const unique = [...new Set(ownerIds)];
    if (unique.length === 0) return result;

    // ── 1. Roles and the subscription-status cache, in parallel ────────────
    // HOS-296: roles come from `user_role`, one row per (owner, hat) pair, so
    // the result is grouped rather than mapped 1:1 — still a single round trip.
    const ownerRoleMap = new Map<string, RoleEnum[]>();
    let subscriptionCache: Map<string, CachedOwnerSubscription>;
    try {
        const db = getDb();
        const [rows, cacheMap] = await Promise.all([
            db
                .select({ id: userRoleTable.userId, role: userRoleTable.role })
                .from(userRoleTable)
                .where(inArray(userRoleTable.userId, unique)),
            readOwnerSubscriptionCache(unique)
        ]);
        for (const row of rows) {
            const held = ownerRoleMap.get(row.id) ?? [];
            held.push(row.role as RoleEnum);
            ownerRoleMap.set(row.id, held);
        }
        subscriptionCache = cacheMap;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { count: unique.length, error: message },
            'resolveOwnerEntitlementsForOwnerIds: batch role query failed; failing open with empty entitlements for all affected owners'
        );
        Sentry.captureException(error, {
            tags: { subsystem: 'owner-entitlements', action: 'batch-role-lookup' },
            extra: { count: unique.length }
        });
        // Fail-open: no entitlements for owners whose roles we could not load.
        for (const ownerId of unique) {
            result.set(ownerId, []);
        }
        return result;
    }

    // ── 2. Per-owner resolution, in parallel, sharing one plan memo ───────
    const planMemo = new Map<string, Promise<Set<EntitlementKey>>>();
    await Promise.all(
        unique.map(async (ownerId) => {
            try {
                const ownerRoles = ownerRoleMap.get(ownerId) ?? [];
                const entitlementSet = await resolveOwnerEntitlementSet(
                    ownerId,
                    ownerRoles,
                    subscriptionCache.get(ownerId) ?? null,
                    planMemo
                );
                result.set(ownerId, Array.from(entitlementSet));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                apiLogger.warn(
                    { ownerId, error: message },
                    'resolveOwnerEntitlementsForOwnerIds: billing resolution failed for owner; returning empty entitlements'
                );
                Sentry.captureException(error, {
                    tags: { subsystem: 'owner-entitlements', action: 'batch-billing-lookup' },
                    extra: { ownerId }
                });
                result.set(ownerId, []);
            }
        })
    );

    return result;
}

// Re-export the SQL helper for tests / type augmentation downstream.
export type { SQL };
