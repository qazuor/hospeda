/**
 * Addon Catalog CRUD Module
 *
 * Handles database write operations for billing addons:
 * - Create, update, soft-delete, restore, hard-delete
 *
 * All mutations run inside transactions and emit audit log entries.
 * Access control is enforced at the API layer, not here.
 *
 * Column layout of `billing_addons`:
 * - `name`            varchar — human-readable display name
 * - `description`     text
 * - `active`          boolean
 * - `unitAmount`      integer — price in ARS cents
 * - `currency`        varchar — always 'ARS'
 * - `billingInterval` varchar — 'one_time' | 'month'
 * - `entitlements`    text[] — first element is the granted entitlement key
 * - `limits`          JSONB — `{ [limitKey]: limitIncrease }`
 * - `metadata`        JSONB — contains: slug, durationDays, targetCategories, sortOrder
 *
 * @module services/billing/addon/addon.crud
 */

import {
    type DrizzleClient,
    type QZPayBillingAddon,
    type QueryContext,
    billingAddons,
    billingSubscriptionAddons,
    count,
    eq,
    sql,
    withTransaction
} from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import type { AdminAddonResponse } from '@repo/schemas';
import { mapRowToAddonDefinition } from './addon-catalog.mapper.js';
import { diffAddonFields, insertAddonAuditLog } from './addon.audit.js';
import type { CreateAddonInput, UpdateAddonInput } from './addon.write-types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Gets an addon by ID without soft-delete filtering (for internal use only).
 * Used by update/toggle/delete operations to fetch the current state.
 */
async function getAddonByIdInternal(
    id: string,
    db: DrizzleClient
): Promise<QZPayBillingAddon | undefined> {
    const [row] = await db.select().from(billingAddons).where(eq(billingAddons.id, id)).limit(1);
    return row;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Maps a raw `billing_addons` row to the admin-facing {@link AdminAddonResponse} DTO.
 *
 * Extends the public `AddonDefinition` mapping with DB metadata fields:
 * - `id` — UUID primary key
 * - `createdAt` / `updatedAt` — ISO 8601 timestamps
 * - `deletedAt` — ISO 8601 soft-delete timestamp (null when not deleted)
 *
 * @param row - Raw DB row from `billing_addons`
 * @returns Mapped `AdminAddonResponse` DTO
 */
export function mapRowToAdminAddonResponse(row: QZPayBillingAddon): AdminAddonResponse {
    const def = mapRowToAddonDefinition(row);
    return {
        ...def,
        // Filter to only the valid AdminAddonResponse target categories
        targetCategories: def.targetCategories.filter(
            (c): c is 'owner' | 'complex' => c === 'owner' || c === 'complex'
        ),
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt?.toISOString() ?? row.createdAt.toISOString(),
        deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
    };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Creates a new billing addon.
 *
 * - Slug is stored in `metadata.slug` and must be unique.
 * - `name` column stores the display name (not the slug).
 * - Rejects duplicate slugs with ALREADY_EXISTS.
 * - Wraps insert + audit in a single transaction.
 *
 * @param input - Addon creation data
 * @param options - Optional settings
 * @param options.livemode - Whether to create in live mode (default: false)
 * @param options.actorId - Optional actor performing the mutation (for audit)
 * @param ctx - Optional query context carrying a transaction client
 * @returns Created admin addon response or error
 *
 * @example
 * ```ts
 * const result = await createAddon({
 *   slug: 'extra-photos-20',
 *   name: 'Extra Photos Pack (+20 photos)',
 *   description: 'Adds 20 extra photo slots.',
 *   billingType: 'recurring',
 *   priceArs: 200000,
 *   durationDays: null,
 *   affectsLimitKey: 'max_photos_per_accommodation',
 *   limitIncrease: 20,
 *   grantsEntitlement: null,
 *   targetCategories: ['owner', 'complex'],
 *   isActive: true,
 *   sortOrder: 3,
 * });
 * ```
 */
export async function createAddon(
    input: CreateAddonInput,
    options: { readonly livemode?: boolean; readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const livemode = options.livemode ?? false;
        const actorId = options.actorId ?? null;

        const doCreate = async (db: DrizzleClient) => {
            // Check for duplicate slug in metadata
            const [existing] = await db
                .select({ id: billingAddons.id })
                .from(billingAddons)
                .where(sql`${billingAddons.metadata}->>'slug' = ${input.slug}`)
                .limit(1);

            if (existing) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.ALREADY_EXISTS,
                        message: `Addon with slug "${input.slug}" already exists`
                    }
                };
            }

            const billingInterval = input.billingType === 'one_time' ? 'one_time' : 'month';

            const metadata: Record<string, unknown> = {
                slug: input.slug,
                durationDays: input.durationDays,
                targetCategories: input.targetCategories,
                sortOrder: input.sortOrder
            };

            const limits: Record<string, number> =
                input.affectsLimitKey !== null && input.limitIncrease !== null
                    ? { [input.affectsLimitKey]: input.limitIncrease }
                    : {};

            const entitlements: string[] =
                input.grantsEntitlement !== null ? [input.grantsEntitlement] : [];

            const [inserted] = await db
                .insert(billingAddons)
                .values({
                    name: input.name,
                    description: input.description,
                    active: input.isActive,
                    unitAmount: input.priceArs,
                    currency: 'ARS',
                    billingInterval,
                    billingIntervalCount: 1,
                    entitlements,
                    limits,
                    livemode,
                    metadata
                })
                .returning();

            if (!inserted) {
                throw new Error('Addon insert returned no row');
            }

            await insertAddonAuditLog(db, {
                action: 'addon_created',
                addonId: inserted.id,
                actorId,
                changes: { ...metadata, name: input.name, active: input.isActive },
                previousValues: null,
                livemode
            });

            return { success: true as const, data: mapRowToAdminAddonResponse(inserted) };
        };

        return ctx?.tx ? await doCreate(ctx.tx) : await withTransaction(doCreate);
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to create addon' }
        };
    }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Updates a billing addon's mutable fields.
 *
 * Slug is immutable and cannot be changed via this method.
 * Emits a field-level diff audit log.
 * Wraps everything in a single transaction.
 *
 * @param id - UUID of the addon to update
 * @param input - Fields to update (partial)
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Updated admin addon response or error
 */
export async function updateAddon(
    id: string,
    input: UpdateAddonInput & { readonly slug?: never },
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doUpdate = async (db: DrizzleClient) => {
            const existing = await getAddonByIdInternal(id, db);
            if (!existing) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Addon not found' }
                };
            }

            const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;

            // Build updated metadata (merge, preserving slug and other immutable fields)
            const updatedMeta: Record<string, unknown> = { ...existingMeta };
            if (input.durationDays !== undefined) updatedMeta.durationDays = input.durationDays;
            if (input.targetCategories !== undefined)
                updatedMeta.targetCategories = input.targetCategories;
            if (input.sortOrder !== undefined) updatedMeta.sortOrder = input.sortOrder;

            const addonUpdateData: Partial<QZPayBillingAddon> = {
                metadata: updatedMeta
            };

            if (input.name !== undefined) addonUpdateData.name = input.name;
            if (input.description !== undefined) addonUpdateData.description = input.description;
            if (input.priceArs !== undefined) addonUpdateData.unitAmount = input.priceArs;
            if (input.billingType !== undefined) {
                addonUpdateData.billingInterval =
                    input.billingType === 'one_time' ? 'one_time' : 'month';
            }
            if (input.isActive !== undefined) addonUpdateData.active = input.isActive;

            // Reconcile limits — if either affectsLimitKey or limitIncrease changes, rebuild
            if (input.affectsLimitKey !== undefined || input.limitIncrease !== undefined) {
                const existingLimits = (existing.limits ?? {}) as Record<string, number>;
                const newLimitKey = input.affectsLimitKey ?? Object.keys(existingLimits)[0] ?? null;
                const newLimitIncrease =
                    input.limitIncrease ??
                    (newLimitKey !== null ? (existingLimits[newLimitKey] ?? null) : null);

                addonUpdateData.limits =
                    newLimitKey !== null && newLimitIncrease !== null
                        ? { [newLimitKey]: newLimitIncrease }
                        : {};
            }

            // Reconcile entitlements
            if (input.grantsEntitlement !== undefined) {
                addonUpdateData.entitlements =
                    input.grantsEntitlement !== null ? [input.grantsEntitlement] : [];
            }

            const [updated] = await db
                .update(billingAddons)
                .set(addonUpdateData)
                .where(eq(billingAddons.id, id))
                .returning();

            if (!updated) {
                throw new Error('Addon update returned no row');
            }

            // Compute before/after diff for audit
            const beforeSnapshot: Record<string, unknown> = {
                name: existing.name,
                description: existing.description,
                active: existing.active,
                unitAmount: existing.unitAmount,
                billingInterval: existing.billingInterval,
                entitlements: existing.entitlements,
                limits: existing.limits,
                metadata: existingMeta
            };
            const afterSnapshot: Record<string, unknown> = {
                name: updated.name,
                description: updated.description,
                active: updated.active,
                unitAmount: updated.unitAmount,
                billingInterval: updated.billingInterval,
                entitlements: updated.entitlements,
                limits: updated.limits,
                metadata: updatedMeta
            };
            const diff = diffAddonFields(beforeSnapshot, afterSnapshot);

            await insertAddonAuditLog(db, {
                action: 'addon_updated',
                addonId: id,
                actorId,
                // TYPE-WORKAROUND: diff.changed is Record<string, AddonDiffChangedField> but
                // insertAddonAuditLog accepts Record<string, unknown>; safe widening.
                changes: diff.changed as unknown as Record<string, unknown>,
                previousValues: beforeSnapshot,
                livemode: existing.livemode ?? false
            });

            return { success: true as const, data: mapRowToAdminAddonResponse(updated) };
        };

        return ctx?.tx ? await doUpdate(ctx.tx) : await withTransaction(doUpdate);
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to update addon' }
        };
    }
}

// ---------------------------------------------------------------------------
// Toggle active / Soft-delete
// ---------------------------------------------------------------------------

/**
 * Toggles the `active` flag of a billing addon.
 *
 * @param id - UUID of the addon
 * @param active - The desired active state
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Updated admin addon response or NOT_FOUND error
 */
export async function toggleAddonActive(
    id: string,
    active: boolean,
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doToggle = async (db: DrizzleClient) => {
            const existing = await getAddonByIdInternal(id, db);
            if (!existing) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Addon not found' }
                };
            }

            const [updated] = await db
                .update(billingAddons)
                .set({ active })
                .where(eq(billingAddons.id, id))
                .returning();

            if (!updated) {
                throw new Error('Addon toggle returned no row');
            }

            await insertAddonAuditLog(db, {
                action: active ? 'addon_activated' : 'addon_deactivated',
                addonId: id,
                actorId,
                changes: { active },
                previousValues: { active: existing.active },
                livemode: existing.livemode ?? false
            });

            return { success: true as const, data: mapRowToAdminAddonResponse(updated) };
        };

        return ctx?.tx ? await doToggle(ctx.tx) : await withTransaction(doToggle);
    } catch (_error) {
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to toggle addon active state'
            }
        };
    }
}

/**
 * Soft-deletes a billing addon by setting `deletedAt = now()` and `active = false`.
 *
 * The row is retained for referential integrity. `getBySlug` will return
 * NOT_FOUND for soft-deleted addons.
 *
 * @param id - UUID of the addon to soft-delete
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Success or NOT_FOUND error
 */
export async function softDeleteAddon(
    id: string,
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doDelete = async (db: DrizzleClient) => {
            const existing = await getAddonByIdInternal(id, db);
            if (!existing) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Addon not found' }
                };
            }

            await db
                .update(billingAddons)
                .set({ active: false, deletedAt: new Date() })
                .where(eq(billingAddons.id, id));

            await insertAddonAuditLog(db, {
                action: 'addon_soft_deleted',
                addonId: id,
                actorId,
                changes: { active: false, deletedAt: new Date().toISOString() },
                previousValues: { active: existing.active, deletedAt: null },
                livemode: existing.livemode ?? false
            });

            return { success: true as const, data: undefined };
        };

        return ctx?.tx ? await doDelete(ctx.tx) : await withTransaction(doDelete);
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to soft-delete addon' }
        };
    }
}

// ---------------------------------------------------------------------------
// Restore (undo soft-delete)
// ---------------------------------------------------------------------------

/**
 * Restores a soft-deleted billing addon by clearing `deletedAt` and setting `active = true`.
 *
 * Semantics:
 * - If the addon does not exist at all → NOT_FOUND error.
 * - If the addon is NOT soft-deleted (`deletedAt == null`) → VALIDATION_ERROR.
 * - If soft-deleted → sets `deletedAt = null` and `active = true`, emits audit log.
 *
 * @param id - UUID of the addon to restore
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Restored admin addon response or error (NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR)
 *
 * @example
 * ```ts
 * const result = await restoreAddon('550e8400-e29b-41d4-a716-446655440000', { actorId: 'admin-uuid' });
 * if (result.success) {
 *   console.log(result.data.isActive); // true
 * }
 * ```
 */
export async function restoreAddon(
    id: string,
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doRestore = async (db: DrizzleClient) => {
            // getAddonByIdInternal has no soft-delete filter — finds deleted rows too.
            const existing = await getAddonByIdInternal(id, db);
            if (!existing) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Addon not found' }
                };
            }

            if (existing.deletedAt == null) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'Addon is not soft-deleted and cannot be restored'
                    }
                };
            }

            const [updated] = await db
                .update(billingAddons)
                .set({ active: true, deletedAt: null })
                .where(eq(billingAddons.id, id))
                .returning();

            if (!updated) {
                throw new Error('Addon restore returned no row');
            }

            await insertAddonAuditLog(db, {
                action: 'addon_restored',
                addonId: id,
                actorId,
                changes: { active: true, deletedAt: null },
                previousValues: {
                    active: existing.active,
                    deletedAt: existing.deletedAt?.toISOString() ?? null
                },
                livemode: existing.livemode ?? false
            });

            return { success: true as const, data: mapRowToAdminAddonResponse(updated) };
        };

        return ctx?.tx ? await doRestore(ctx.tx) : await withTransaction(doRestore);
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to restore addon' }
        };
    }
}

// ---------------------------------------------------------------------------
// Hard-delete (with referential guard)
// ---------------------------------------------------------------------------

/**
 * Permanently deletes a billing addon.
 *
 * **Referential guard**: before deleting, counts:
 * 1. `billing_subscription_addons` rows where `addon_id = uuid` (FK is
 *    `ON DELETE RESTRICT`, so skipping this check would surface as a raw
 *    FK violation instead of a clean conflict error)
 * 2. `billing_addon_purchases` rows where `addon_id = uuid`
 *
 * If any references exist, rejects with ALREADY_EXISTS (treated as a conflict).
 *
 * Emits an audit log entry before deletion so the history is preserved.
 *
 * @param id - UUID of the addon to hard-delete
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Success or error (NOT_FOUND | ALREADY_EXISTS | INTERNAL_ERROR)
 */
export async function hardDeleteAddon(
    id: string,
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doHardDelete = async (db: DrizzleClient) => {
            const existing = await getAddonByIdInternal(id, db);
            if (!existing) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Addon not found' }
                };
            }

            const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
            const addonSlug = typeof existingMeta.slug === 'string' ? existingMeta.slug : null;

            // Referential guard: billing_subscription_addons (by addon UUID via
            // FK with ON DELETE RESTRICT — without this check the delete would
            // fail at the DB level with a raw FK violation instead of a 409)
            const [subscriptionAddonCount] = await db
                .select({ value: count() })
                .from(billingSubscriptionAddons)
                // NOTE: the qzpay-drizzle column is `addOnId` (capital O),
                // unlike billingAddonPurchases.addonId
                .where(eq(billingSubscriptionAddons.addOnId, id));

            const activeSubscriptionAddonCount = subscriptionAddonCount?.value ?? 0;
            if (activeSubscriptionAddonCount > 0) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.ALREADY_EXISTS,
                        message: `Addon is referenced by ${activeSubscriptionAddonCount} subscription addon record(s) and cannot be hard-deleted`
                    }
                };
            }

            // Referential guard: billing_addon_purchases (by addon UUID via FK)
            const [purchaseCount] = await db
                .select({ value: count() })
                .from(billingAddonPurchases)
                .where(eq(billingAddonPurchases.addonId, id));

            const activePurchaseCount = purchaseCount?.value ?? 0;
            if (activePurchaseCount > 0) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.ALREADY_EXISTS,
                        message: `Addon is referenced by ${activePurchaseCount} purchase record(s) and cannot be hard-deleted`
                    }
                };
            }

            // Emit audit BEFORE deletion so the log survives
            await insertAddonAuditLog(db, {
                action: 'addon_hard_deleted',
                addonId: id,
                actorId,
                changes: null,
                previousValues: {
                    name: existing.name,
                    active: existing.active,
                    deletedAt: existing.deletedAt?.toISOString() ?? null,
                    slug: addonSlug
                },
                livemode: existing.livemode ?? false
            });

            // Delete the addon row
            await db.delete(billingAddons).where(eq(billingAddons.id, id));

            return { success: true as const, data: undefined };
        };

        return ctx?.tx ? await doHardDelete(ctx.tx) : await withTransaction(doHardDelete);
    } catch (_error) {
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to hard-delete addon'
            }
        };
    }
}
