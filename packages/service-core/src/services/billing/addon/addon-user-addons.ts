/**
 * Add-on User Query Functions
 *
 * Pure query functions for retrieving user add-ons from the database.
 * No infra deps (no apiLogger, Sentry, sendNotification, or env imports).
 *
 * @module services/billing/addon/addon-user-addons
 */

import { getAddonBySlug } from '@repo/billing';
import { getDb } from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { ServiceResult, UserAddon } from './addon.types.js';
import { addonAdjustmentsArraySchema } from './addon.types.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * Zod schema for a single JSONB limit adjustment entry
 */
const LimitAdjustmentEntrySchema = z.object({
    limitKey: z.string(),
    increase: z.number()
});

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result of a bulk addon revocation for a customer.
 */
export interface RevokeAllAddonsResult {
    /** Number of purchases successfully revoked. */
    revokedCount: number;
    /** Purchase IDs that failed to be revoked. */
    failedIds: string[];
}

/**
 * Input parameters for {@link revokeAllAddonsForCustomer}.
 */
export interface RevokeAllAddonsInput {
    /** Billing customer UUID whose ALL active addon purchases should be revoked. */
    readonly customerId: string;
}

/**
 * Billing customer abstraction used by query functions.
 * This avoids importing QZPayBilling directly.
 */
interface BillingCustomer {
    readonly id: string;
    readonly email: string;
    readonly metadata?: Record<string, unknown> | null;
}

/**
 * Subscription abstraction used by query functions.
 */
interface BillingSubscription {
    readonly id: string;
    readonly status: string;
    readonly metadata?: Record<string, unknown>;
}

/**
 * Minimal billing interface required by user-addon query functions.
 * Avoids coupling to the full QZPayBilling type.
 */
export interface UserAddonBillingClient {
    readonly customers: {
        getByExternalId(externalId: string): Promise<BillingCustomer | null>;
    };
    readonly subscriptions: {
        getByCustomerId(customerId: string): Promise<BillingSubscription[]>;
    };
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Map a single addon purchase row to a UserAddon object.
 *
 * @param purchase - Raw purchase row from the database.
 * @returns Mapped UserAddon object.
 */
function mapPurchaseToUserAddon(purchase: {
    id: string;
    addonSlug: string;
    status: string;
    purchasedAt: Date;
    expiresAt: Date | null;
    canceledAt: Date | null;
    limitAdjustments: unknown;
    entitlementAdjustments: unknown;
}): UserAddon {
    const addonDef = getAddonBySlug(purchase.addonSlug);

    let affectsLimitKey: string | null = null;
    let limitIncrease: number | null = null;

    if (
        purchase.limitAdjustments &&
        Array.isArray(purchase.limitAdjustments) &&
        purchase.limitAdjustments.length > 0
    ) {
        const firstLimit = purchase.limitAdjustments[0];
        const parsed = LimitAdjustmentEntrySchema.safeParse(firstLimit);
        if (parsed.success) {
            affectsLimitKey = parsed.data.limitKey;
            limitIncrease = parsed.data.increase;
        }
    }

    let grantsEntitlement: string | null = null;
    if (
        purchase.entitlementAdjustments &&
        Array.isArray(purchase.entitlementAdjustments) &&
        purchase.entitlementAdjustments.length > 0
    ) {
        const firstEntitlement = purchase.entitlementAdjustments[0] as {
            entitlementKey?: string;
        } | null;
        grantsEntitlement = firstEntitlement?.entitlementKey ?? null;
    }

    return {
        id: purchase.id,
        addonSlug: purchase.addonSlug,
        addonName: addonDef?.name || purchase.addonSlug,
        billingType: addonDef?.billingType || 'one_time',
        status: purchase.status as 'active' | 'expired' | 'canceled',
        purchasedAt: purchase.purchasedAt.toISOString(),
        expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
        canceledAt: purchase.canceledAt ? purchase.canceledAt.toISOString() : null,
        priceArs: addonDef?.priceArs || 0,
        affectsLimitKey,
        limitIncrease,
        grantsEntitlement
    };
}

/**
 * Parse addon adjustments from subscription JSON metadata for backward
 * compatibility. Returns UserAddon entries for addons not already in the table.
 *
 * @param subscriptions - Active subscriptions for the customer.
 * @param existingTableSlugs - Set of addon slugs already found in the table.
 * @returns UserAddon entries parsed from metadata.
 */
function parseMetadataAddons({
    subscriptions,
    existingTableSlugs
}: {
    readonly subscriptions: readonly BillingSubscription[];
    readonly existingTableSlugs: ReadonlySet<string>;
}): readonly UserAddon[] {
    const result: UserAddon[] = [];

    const activeSubscription = subscriptions.find(
        (sub) => sub.status === 'active' || sub.status === 'trialing'
    );

    if (!activeSubscription) {
        return result;
    }

    const metadata = activeSubscription.metadata as Record<string, unknown> | undefined;
    const adjustmentsJson = metadata?.addonAdjustments as string | undefined;

    if (!adjustmentsJson) {
        return result;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(adjustmentsJson);
    } catch {
        return result;
    }

    const validationResult = addonAdjustmentsArraySchema.safeParse(parsed);
    if (!validationResult.success) {
        return result;
    }

    for (const adj of validationResult.data) {
        if (existingTableSlugs.has(adj.addonSlug)) {
            continue;
        }

        const addonDef = getAddonBySlug(adj.addonSlug);
        result.push({
            id: `${activeSubscription.id}_${adj.addonSlug}`,
            addonSlug: adj.addonSlug,
            addonName: addonDef?.name || adj.addonSlug,
            billingType: addonDef?.billingType || 'one_time',
            status: 'active' as const,
            purchasedAt: adj.appliedAt,
            expiresAt: null,
            canceledAt: null,
            priceArs: addonDef?.priceArs || 0,
            affectsLimitKey: adj.limitKey || null,
            limitIncrease: adj.limitIncrease || null,
            grantsEntitlement: adj.entitlement || null
        });
    }

    return result;
}

/**
 * Get a user's active add-ons.
 *
 * Queries `billing_addon_purchases` as primary source, then merges results
 * from JSON metadata in subscription records for backward compatibility.
 * Table entries take priority over metadata entries for the same slug.
 *
 * @param billing - Billing client for customer/subscription lookups.
 * @param userId - The user's external ID.
 * @returns List of active user add-ons.
 *
 * @example
 * ```ts
 * const result = await queryUserAddons({ billing, userId: 'user_123' });
 * if (result.success) {
 *   for (const addon of result.data) {
 *     console.log(addon.addonSlug, addon.status);
 *   }
 * }
 * ```
 */
export async function queryUserAddons({
    billing,
    userId
}: {
    readonly billing: UserAddonBillingClient;
    readonly userId: string;
}): Promise<ServiceResult<UserAddon[]>> {
    const customer = await billing.customers.getByExternalId(userId);

    if (!customer) {
        return { success: true, data: [] };
    }

    const db = getDb();

    const addonPurchases = await db
        .select()
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.customerId, customer.id),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    const userAddonsFromTable: UserAddon[] = addonPurchases.map((purchase) =>
        mapPurchaseToUserAddon(purchase)
    );

    const existingTableSlugs = new Set(userAddonsFromTable.map((a) => a.addonSlug));

    // Backward compatibility: merge from JSON metadata
    const subscriptions = await billing.subscriptions.getByCustomerId(customer.id);
    const userAddonsFromMetadata = parseMetadataAddons({
        subscriptions,
        existingTableSlugs
    });

    return { success: true, data: [...userAddonsFromTable, ...userAddonsFromMetadata] };
}

/**
 * Check whether a specific add-on is currently active for a user.
 *
 * @param billing - Billing client for customer/subscription lookups.
 * @param userId - User ID to check.
 * @param addonSlug - Add-on slug to look for.
 * @returns True if the add-on is found with status 'active'.
 *
 * @example
 * ```ts
 * const result = await queryAddonActive({ billing, userId: 'user_123', addonSlug: 'extra-photos' });
 * if (result.success && result.data) {
 *   // user has the add-on active
 * }
 * ```
 */
export async function queryAddonActive({
    billing,
    userId,
    addonSlug
}: {
    readonly billing: UserAddonBillingClient;
    readonly userId: string;
    readonly addonSlug: string;
}): Promise<ServiceResult<boolean>> {
    const result = await queryUserAddons({ billing, userId });

    if (!result.success) {
        return { success: false, error: result.error };
    }

    const hasAddon = result.data.some(
        (addon) => addon.addonSlug === addonSlug && addon.status === 'active'
    );

    return { success: true, data: hasAddon };
}

/**
 * Query all active addon purchases for a customer.
 *
 * Returns raw purchase IDs and slugs for bulk operations.
 * Does not include metadata-based addons.
 *
 * @param customerId - Billing customer UUID.
 * @returns Array of active purchase records (id + addonSlug).
 */
export async function queryActiveAddonPurchases({
    customerId
}: {
    readonly customerId: string;
}): Promise<ReadonlyArray<{ readonly id: string; readonly addonSlug: string }>> {
    const db = getDb();

    return db
        .select({
            id: billingAddonPurchases.id,
            addonSlug: billingAddonPurchases.addonSlug
        })
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.customerId, customerId),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );
}

/**
 * Cancel a single addon purchase by setting status to 'canceled'.
 *
 * This is the raw DB operation without any Sentry, logging, or notification
 * side effects. Use from the API layer which wraps with infra concerns.
 *
 * @param purchaseId - The purchase record UUID.
 * @returns Number of rows updated (0 or 1).
 */
export async function cancelAddonPurchaseRecord({
    purchaseId
}: {
    readonly purchaseId: string;
}): Promise<number> {
    const db = getDb();

    const updateResult = await db
        .update(billingAddonPurchases)
        .set({
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingAddonPurchases.id, purchaseId),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    return (updateResult as { rowCount?: number }).rowCount || 0;
}
