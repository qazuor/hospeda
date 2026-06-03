/**
 * Addon Catalog Service
 *
 * Provides DB-backed listing, retrieval, and mutation of add-on catalog entries
 * from the `billing_addons` table. This replaces the static in-memory catalog
 * reads from `@repo/billing` for all catalog queries.
 *
 * The `billing_addons` table is seeded from `ALL_ADDONS` via
 * `packages/seed/src/required/billingAddons.seed.ts`. Catalog data (slug,
 * durationDays, targetCategories, sortOrder) is stored in the `metadata` JSONB
 * column. Limit/entitlement effects are stored in `limits` and `entitlements`
 * columns respectively (and mirrored back by the mapper).
 *
 * Write methods (create, update, toggleActive, softDelete, restore, hardDelete)
 * are backed by {@link module:services/billing/addon/addon.crud} and emit audit
 * log entries via {@link module:services/billing/addon/addon.audit}.
 *
 * @module services/billing/addon/addon-catalog.service
 */

import type { AddonDefinition } from '@repo/billing';
import type { QueryContext } from '@repo/db';
import { and, asc, billingAddons, count, eq, getDb, isNull, sql } from '@repo/db';
import type { AdminAddonResponse } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { mapRowToAddonDefinition } from './addon-catalog.mapper.js';
import {
    createAddon,
    hardDeleteAddon,
    mapRowToAdminAddonResponse,
    restoreAddon,
    softDeleteAddon,
    toggleAddonActive,
    updateAddon
} from './addon.crud.js';
import type { ListAvailableAddonsInput, ServiceResult } from './addon.types.js';
import type { CreateAddonInput, UpdateAddonInput } from './addon.write-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the Drizzle client to use: the transaction from `ctx` when provided,
 * otherwise the global pool client.
 */
function resolveDb(ctx?: QueryContext) {
    return ctx?.tx ?? getDb();
}

// Re-export for consumers that import from the service module directly
export type { CreateAddonInput, UpdateAddonInput };

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

/**
 * DB-backed catalog service for add-on definitions.
 *
 * All reads go to `billing_addons` via Drizzle. Rows are mapped to
 * `AddonDefinition` by {@link mapRowToAddonDefinition}.
 *
 * @example
 * ```ts
 * const svc = new AddonCatalogService();
 * const result = await svc.list({ billingType: 'one_time', active: true });
 * if (result.success) {
 *   console.log(result.data); // AddonDefinition[]
 * }
 * ```
 */
export class AddonCatalogService {
    /**
     * Lists add-on catalog entries with optional filtering.
     *
     * Applies filters for `billingType`, `targetCategory`, and `active` status.
     * Results are sorted by `metadata->>'sortOrder'` ascending (numeric cast),
     * then by `name` ascending for stable ordering when sortOrder values are
     * equal.
     *
     * `billingType` maps to the DB `billingInterval` column:
     * - `'one_time'` → `billingInterval = 'one_time'`
     * - `'recurring'` → `billingInterval = 'month'`
     *
     * `targetCategory` is stored in `metadata->>'targetCategories'` as a JSON
     * array string. The filter uses a JSON-contains check via ILIKE (safe for
     * the fixed set of values in this catalog).
     *
     * @param filter - Optional filter criteria
     * @param ctx - Optional query context carrying a transaction client
     * @returns Filtered and sorted list of add-on definitions
     *
     * @example
     * ```ts
     * const result = await svc.list({ billingType: 'recurring', active: true });
     * if (result.success) {
     *   console.log(result.data.length);
     * }
     * ```
     */
    async list(
        filter: ListAvailableAddonsInput = {},
        ctx?: QueryContext
    ): Promise<ServiceResult<AddonDefinition[]>> {
        try {
            const db = resolveDb(ctx);

            const conditions = [];

            if (filter.active !== undefined) {
                conditions.push(eq(billingAddons.active, filter.active));
            }

            if (filter.billingType !== undefined) {
                const interval = filter.billingType === 'one_time' ? 'one_time' : 'month';
                conditions.push(eq(billingAddons.billingInterval, interval));
            }

            if (filter.targetCategory !== undefined) {
                // targetCategories is stored in metadata JSONB as a JSON array string.
                // We use a JSON array containment check: metadata->'targetCategories'
                // is compared with a JSON string literal using the @> operator.
                conditions.push(
                    sql`${billingAddons.metadata}->'targetCategories' @> ${JSON.stringify([filter.targetCategory])}::jsonb`
                );
            }

            const whereClause = and(...conditions);

            const rows = await db
                .select()
                .from(billingAddons)
                .where(whereClause)
                .orderBy(
                    asc(sql`(${billingAddons.metadata}->>'sortOrder')::int`),
                    asc(billingAddons.name)
                );

            return { success: true, data: rows.map(mapRowToAddonDefinition) };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Failed to list add-on catalog: ${message}`
                }
            };
        }
    }

    /**
     * Gets a single add-on catalog entry by its slug.
     *
     * The slug is stored in `metadata->>'slug'`. Returns NOT_FOUND when no
     * row with the given slug exists.
     *
     * @param slug - The add-on slug identifier (e.g. `'visibility-boost-7d'`)
     * @param ctx - Optional query context carrying a transaction client
     * @returns The matching add-on definition or a NOT_FOUND error
     *
     * @example
     * ```ts
     * const result = await svc.getBySlug('extra-photos-20');
     * if (result.success) {
     *   console.log(result.data.priceArs);
     * }
     * ```
     */
    async getBySlug(slug: string, ctx?: QueryContext): Promise<ServiceResult<AddonDefinition>> {
        try {
            const db = resolveDb(ctx);

            const [row] = await db
                .select()
                .from(billingAddons)
                .where(sql`${billingAddons.metadata}->>'slug' = ${slug}`)
                .limit(1);

            if (!row) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: `Add-on '${slug}' not found`
                    }
                };
            }

            return { success: true, data: mapRowToAddonDefinition(row) };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Failed to get add-on '${slug}': ${message}`
                }
            };
        }
    }

    /**
     * Gets a single add-on catalog entry by its UUID.
     *
     * Returns NOT_FOUND for soft-deleted rows (deletedAt IS NOT NULL).
     *
     * @param id - UUID of the billing addon
     * @param ctx - Optional query context carrying a transaction client
     * @returns The matching admin addon response or a NOT_FOUND error
     *
     * @example
     * ```ts
     * const result = await svc.getById('550e8400-e29b-41d4-a716-446655440000');
     * if (result.success) {
     *   console.log(result.data.slug);
     * }
     * ```
     */
    async getById(id: string, ctx?: QueryContext): Promise<ServiceResult<AdminAddonResponse>> {
        try {
            const db = resolveDb(ctx);

            const [row] = await db
                .select()
                .from(billingAddons)
                .where(and(eq(billingAddons.id, id), isNull(billingAddons.deletedAt)))
                .limit(1);

            if (!row) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: `Add-on '${id}' not found`
                    }
                };
            }

            return { success: true, data: mapRowToAdminAddonResponse(row) };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Failed to get add-on '${id}': ${message}`
                }
            };
        }
    }

    /**
     * Lists add-on catalog entries with optional filtering and pagination.
     *
     * Returns an {@link AdminAddonResponse} shape including `id`, `createdAt`,
     * `updatedAt`, and `deletedAt`. By default excludes soft-deleted addons;
     * pass `includeDeleted: true` to include them.
     *
     * @param filter - Optional filter criteria including pagination
     * @param ctx - Optional query context carrying a transaction client
     * @returns Paginated admin addon list or error
     *
     * @example
     * ```ts
     * const result = await svc.listAdmin({ isActive: true, page: 1, pageSize: 20 });
     * if (result.success) {
     *   console.log(result.data.items, result.data.pagination);
     * }
     * ```
     */
    async listAdmin(
        filter: {
            readonly billingType?: 'one_time' | 'recurring';
            readonly targetCategory?: 'owner' | 'complex';
            readonly isActive?: boolean;
            readonly includeDeleted?: boolean;
            readonly search?: string;
            readonly page?: number;
            readonly pageSize?: number;
        } = {},
        ctx?: QueryContext
    ): Promise<
        ServiceResult<{
            items: AdminAddonResponse[];
            pagination: {
                page: number;
                pageSize: number;
                total: number;
                totalPages: number;
            };
        }>
    > {
        try {
            const db = resolveDb(ctx);
            const {
                page = 1,
                pageSize = 20,
                billingType,
                targetCategory,
                isActive,
                includeDeleted,
                search
            } = filter;

            const conditions = [];

            if (!includeDeleted) {
                conditions.push(isNull(billingAddons.deletedAt));
            }

            if (isActive !== undefined) {
                conditions.push(eq(billingAddons.active, isActive));
            }

            if (billingType !== undefined) {
                const interval = billingType === 'one_time' ? 'one_time' : 'month';
                conditions.push(eq(billingAddons.billingInterval, interval));
            }

            if (targetCategory !== undefined) {
                conditions.push(
                    sql`${billingAddons.metadata}->'targetCategories' @> ${JSON.stringify([targetCategory])}::jsonb`
                );
            }

            if (search) {
                const safeSearch = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
                conditions.push(
                    sql`(
                        ${billingAddons.name} ILIKE ${safeSearch}
                        OR
                        ${billingAddons.metadata}->>'slug' ILIKE ${safeSearch}
                    )`
                );
            }

            const whereClause = and(...conditions);

            const countResult = await db
                .select({ value: count() })
                .from(billingAddons)
                .where(whereClause);

            const total = countResult[0]?.value ?? 0;

            const rows = await db
                .select()
                .from(billingAddons)
                .where(whereClause)
                .orderBy(
                    asc(sql`(${billingAddons.metadata}->>'sortOrder')::int`),
                    asc(billingAddons.name)
                )
                .limit(pageSize)
                .offset((page - 1) * pageSize);

            return {
                success: true,
                data: {
                    items: rows.map(mapRowToAdminAddonResponse),
                    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Failed to list add-on catalog: ${message}`
                }
            };
        }
    }

    // -------------------------------------------------------------------------
    // Write methods — delegate to addon.crud.ts
    // -------------------------------------------------------------------------

    /**
     * Creates a new billing addon.
     *
     * Rejects duplicate slugs with ALREADY_EXISTS.
     *
     * @param input - Addon creation data
     * @param options - Optional settings
     * @param options.livemode - Whether to create in live mode (default: false)
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Created admin addon response or error
     */
    async create(
        input: CreateAddonInput,
        options: { readonly livemode?: boolean; readonly actorId?: string } = {},
        ctx?: QueryContext
    ) {
        return createAddon(input, options, ctx);
    }

    /**
     * Updates mutable fields of a billing addon.
     *
     * Slug is immutable and cannot be changed.
     *
     * @param id - UUID of the addon to update
     * @param input - Fields to update (all optional)
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Updated admin addon response or error
     */
    async update(
        id: string,
        input: UpdateAddonInput & { readonly slug?: never },
        options: { readonly actorId?: string } = {},
        ctx?: QueryContext
    ) {
        return updateAddon(id, input, options, ctx);
    }

    /**
     * Toggles the `active` flag of a billing addon.
     *
     * @param id - UUID of the addon
     * @param active - Desired active state
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Updated admin addon response or error
     */
    async toggleActive(
        id: string,
        active: boolean,
        options: { readonly actorId?: string } = {},
        ctx?: QueryContext
    ) {
        return toggleAddonActive(id, active, options, ctx);
    }

    /**
     * Soft-deletes a billing addon (sets `deletedAt = now()`, `active = false`).
     *
     * The row is retained; `getBySlug` will return NOT_FOUND for it.
     *
     * @param id - UUID of the addon to soft-delete
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Success or error
     */
    async softDelete(id: string, options: { readonly actorId?: string } = {}, ctx?: QueryContext) {
        return softDeleteAddon(id, options, ctx);
    }

    /**
     * Restores a soft-deleted billing addon by clearing `deletedAt` and setting `active = true`.
     *
     * Returns VALIDATION_ERROR if the addon is not currently soft-deleted.
     *
     * @param id - UUID of the addon to restore
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Restored admin addon response or error (NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR)
     */
    async restore(id: string, options: { readonly actorId?: string } = {}, ctx?: QueryContext) {
        return restoreAddon(id, options, ctx);
    }

    /**
     * Permanently deletes a billing addon.
     *
     * Blocked if any `billing_subscription_addons` or `billing_addon_purchases`
     * row references this addon (ALREADY_EXISTS conflict error).
     *
     * @param id - UUID of the addon to hard-delete
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Success or error (ALREADY_EXISTS if referenced by purchases)
     */
    async hardDelete(id: string, options: { readonly actorId?: string } = {}, ctx?: QueryContext) {
        return hardDeleteAddon(id, options, ctx);
    }
}
