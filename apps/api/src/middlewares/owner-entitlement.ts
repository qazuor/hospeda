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
    isEntitlementKey
} from '@repo/billing';
import { accommodations, getDb, users } from '@repo/db';
import { RoleEnum } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { type SQL, eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
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

// Re-export the SQL helper for tests / type augmentation downstream.
export type { SQL };
