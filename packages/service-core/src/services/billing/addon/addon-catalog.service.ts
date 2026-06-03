/**
 * Addon Catalog Service
 *
 * Provides DB-backed listing and retrieval of add-on catalog entries from the
 * `billing_addons` table. This replaces the static in-memory catalog reads from
 * `@repo/billing` for all catalog queries.
 *
 * The `billing_addons` table is seeded from `ALL_ADDONS` via
 * `packages/seed/src/required/billingAddons.seed.ts`. Catalog data (slug,
 * durationDays, targetCategories, sortOrder) is stored in the `metadata` JSONB
 * column. Limit/entitlement effects are stored in `limits` and `entitlements`
 * columns respectively (and mirrored back by the mapper).
 *
 * @module services/billing/addon/addon-catalog.service
 */

import type { AddonDefinition } from '@repo/billing';
import type { QueryContext } from '@repo/db';
import { and, asc, billingAddons, eq, getDb, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { mapRowToAddonDefinition } from './addon-catalog.mapper.js';
import type { ListAvailableAddonsInput, ServiceResult } from './addon.types.js';

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
}
