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
    type LimitKey,
    getDefaultEntitlements,
    getUnlimitedEntitlements,
    isEntitlementKey,
    isLimitKey
} from '@repo/billing';
import { accommodations, getDb, users } from '@repo/db';
import { RoleEnum } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { type SQL, eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { PlanService } from '../services/plan.service';
import type { AppBindings } from '../types';
import { apiLogger } from '../utils/logger';
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
 * Mirrors the path inside `loadEntitlements` (entitlement.ts) but is
 * intentionally extracted so the owner middleware does not pay for the
 * viewer-only concerns (caller-keyed cache, staff bypass, actor-role
 * defaults). Returns a fresh `Set<EntitlementKey>` for every call.
 *
 * @param customerId - The QZPay customer ID.
 * @returns A set of entitlement keys. Empty if no active subscription
 *   or the plan carries no entitlements.
 */
async function loadCustomerEntitlements(customerId: string): Promise<Set<EntitlementKey>> {
    const billing = getQZPayBilling();
    if (!billing) {
        return new Set<EntitlementKey>();
    }
    const entitlements = new Set<EntitlementKey>();
    try {
        const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
        const active = subscriptions?.find(
            (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
        );
        if (!active) {
            return entitlements;
        }
        const plan = await billing.plans.get(active.planId);
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
        return entitlements;
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

const STAFF_BILLING_BYPASS_ROLES: ReadonlySet<RoleEnum> = new Set([
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN,
    RoleEnum.EDITOR,
    RoleEnum.CLIENT_MANAGER
]);

function isStaffBypassRole(role: RoleEnum | null | undefined): boolean {
    return role !== undefined && role !== null && STAFF_BILLING_BYPASS_ROLES.has(role);
}

async function resolveOwnerRole(ownerId: string): Promise<RoleEnum | null> {
    try {
        const db = getDb();
        const rows = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, ownerId))
            .limit(1);
        const row = rows[0] as { role: RoleEnum | null } | undefined;
        return row?.role ?? null;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { ownerId, error: message },
            'ownerEntitlementMiddleware: failed to resolve owner role; proceeding without staff bypass'
        );
        Sentry.captureException(error, {
            tags: { subsystem: 'owner-entitlements', action: 'owner-role-lookup' },
            extra: { ownerId }
        });
        return null;
    }
}

async function resolveOwnerEntitlementSet(
    ownerId: string,
    ownerRole: RoleEnum | null
): Promise<Set<EntitlementKey>> {
    if (isStaffBypassRole(ownerRole)) {
        return buildStaffUnlimitedEntitlements();
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

        // 1. Resolve accommodation → ownerId.
        let ownerId: string | null = null;
        let ownerRole: RoleEnum | null = null;
        try {
            const db = getDb();
            const rows = await db
                .select({ ownerId: accommodations.ownerId, ownerRole: users.role })
                .from(accommodations)
                .innerJoin(users, eq(users.id, accommodations.ownerId))
                .where(eq(accommodations.id, accommodationId))
                .limit(1);
            const row = rows[0] as { ownerId: string; ownerRole: RoleEnum | null } | undefined;
            ownerId = row?.ownerId ?? null;
            ownerRole = row?.ownerRole ?? null;
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

        const ownerEntitlements = await resolveOwnerEntitlementSet(ownerId, ownerRole);

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
    const ownerRole = await resolveOwnerRole(ownerId);
    return Array.from(await resolveOwnerEntitlementSet(ownerId, ownerRole));
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
 * owner has no active subscription — they get the `owner-basico` DB-row limits
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
 * Load the active-subscription plan limits + customer-level overrides for a
 * given QZPay customer ID.
 *
 * Mirrors the plan-limits portion of `loadEntitlements` in entitlement.ts.
 * Returns `null` when billing is unavailable. Returns the plan-level-only
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
        const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
        const active = subscriptions?.find(
            (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!active) {
            // No active subscription — caller falls back to owner-basico.
            return { limits: new Map<LimitKey, number>(), shouldCache: false };
        }

        const plan = await billing.plans.get(active.planId);
        if (!plan) {
            apiLogger.warn(
                { customerId, planId: active.planId },
                'resolveOwnerLimitsForOwnerId: plan not found for active subscription; returning empty limits'
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
 * `ownerId` → billing customer (`customers.getByExternalId`) → active
 * subscription (`subscriptions.getByCustomerId`) → plan `limits` JSONB
 * (`plans.get`) → customer-level limit overrides merged on top
 * (`limits.getByCustomerId`). Falls back to the `owner-basico` DB-row limits
 * when the owner has no active subscription (matching the HOST fallback in
 * `loadEntitlements`).
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
    const ownerRole = await resolveOwnerRole(ownerId);
    if (isStaffBypassRole(ownerRole)) {
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

    // When the owner has no active subscription (result.limits is empty and
    // shouldCache is false from loadCustomerLimits), fall back to owner-basico.
    if (result.limits.size === 0 && !result.shouldCache) {
        return await buildOwnerBasicoFallbackLimits();
    }

    if (result.shouldCache) {
        setOwnerLimitsCacheEntry(customerId, result.limits);
    }

    return result.limits;
}

// Re-export the SQL helper for tests / type augmentation downstream.
export type { SQL };
