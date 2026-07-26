/**
 * commerce.junction-sync.ts
 *
 * Generic many-to-many junction synchronisers for commerce listing entities
 * (SPEC-239 T-031).  Parametrised by (junction model, catalog model, FK column
 * name) so gastronomy and future experience entities can share the same logic.
 *
 * Three-way contract (same as accommodation.junction-sync.ts):
 *  - ids === undefined  →  no-op (leave existing rows untouched)
 *  - ids === []         →  delete ALL rows for this entity
 *  - ids === [a, b, c]  →  diff-sync to EXACTLY that set (delete missing, insert new)
 *
 * All mutations happen inside the caller-supplied Drizzle transaction so they
 * participate in the same atomic boundary as the entity write.  An unknown
 * catalog ID throws `ServiceError(VALIDATION_ERROR)` which rolls back the
 * entire transaction — no partial writes occur.
 *
 * @module commerce.junction-sync
 */

import type { DrizzleClient } from '@repo/db';
import { readAllJunctionRows, validateCatalogIds } from '../../utils/junction-sync';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Minimal interface for a catalog model (amenity / feature) used by the
 * validator. HOS-321: batch lookup, not one `findById` per id.
 */
interface CatalogModel {
    findByIds: (ids: readonly string[], tx?: DrizzleClient) => Promise<readonly { id: string }[]>;
}

/**
 * Minimal interface for a junction model.  Requires `findAll` (to read current
 * rows), `hardDelete` (to remove by composite key), and `create` (to insert).
 */
interface JunctionModel<TRow extends Record<string, unknown>> {
    findAll: (
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: undefined,
        tx?: DrizzleClient
    ) => Promise<{ items: TRow[]; total: number }>;
    hardDelete: (where: Record<string, unknown>, tx?: DrizzleClient) => Promise<unknown>;
    create: (data: Record<string, unknown>, tx?: DrizzleClient) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Inputs for {@link syncCommerceAmenityJunction}.
 *
 * @template TRow - The DB row type of the junction table.
 */
export interface SyncCommerceAmenityJunctionInput<TRow extends Record<string, unknown>> {
    /** The commerce entity whose amenity relations are being synced. */
    readonly entityId: string;
    /**
     * Name of the FK column on the junction row that points at the entity.
     * For gastronomy: `'gastronomyId'`.  For experience: `'experienceId'`.
     */
    readonly entityFkColumn: string;
    /**
     * Target amenity UUIDs.
     * `undefined` → no-op | `[]` → clear all | `[ids]` → sync to set.
     */
    readonly amenityIds: readonly string[] | undefined;
    /** Junction table model (injectable for testing). */
    readonly junctionModel: JunctionModel<TRow>;
    /** Amenity catalog model (injectable for testing). */
    readonly amenityModel: CatalogModel;
    /** Active Drizzle transaction client. */
    readonly tx: DrizzleClient;
}

/**
 * Inputs for {@link syncCommerceFeatureJunction}.
 *
 * @template TRow - The DB row type of the junction table.
 */
export interface SyncCommerceFeatureJunctionInput<TRow extends Record<string, unknown>> {
    /** The commerce entity whose feature relations are being synced. */
    readonly entityId: string;
    /**
     * Name of the FK column on the junction row that points at the entity.
     * For gastronomy: `'gastronomyId'`.  For experience: `'experienceId'`.
     */
    readonly entityFkColumn: string;
    /**
     * Target feature UUIDs.
     * `undefined` → no-op | `[]` → clear all | `[ids]` → sync to set.
     */
    readonly featureIds: readonly string[] | undefined;
    /** Junction table model (injectable for testing). */
    readonly junctionModel: JunctionModel<TRow>;
    /** Feature catalog model (injectable for testing). */
    readonly featureModel: CatalogModel;
    /** Active Drizzle transaction client. */
    readonly tx: DrizzleClient;
}

// ---------------------------------------------------------------------------
// Public sync functions
// ---------------------------------------------------------------------------

/**
 * Syncs a commerce entity's amenity junction table inside an existing
 * database transaction.
 *
 * Three-way contract:
 * - `amenityIds === undefined` → **no-op** (existing rows untouched)
 * - `amenityIds === []`        → delete all existing rows
 * - `amenityIds = [id, …]`    → diff against current state:
 *     - Rows whose `amenityId` is NOT in the target set are deleted.
 *     - Missing rows are inserted.
 *   Operation is idempotent.
 *
 * @param input - {@link SyncCommerceAmenityJunctionInput}
 * @throws {ServiceError} code `VALIDATION_ERROR` when any amenity ID is unknown.
 *
 * @example
 * ```ts
 * // In GastronomyService._afterCreate:
 * await syncCommerceAmenityJunction({
 *   entityId: gastronomy.id,
 *   entityFkColumn: 'gastronomyId',
 *   amenityIds: ctx.hookState.pendingAmenityIds,
 *   junctionModel: this.rGastronomyAmenityModel,
 *   amenityModel: this.amenityModel,
 *   tx: ctx.tx!,
 * });
 * ```
 */
export async function syncCommerceAmenityJunction<TRow extends Record<string, unknown>>(
    input: SyncCommerceAmenityJunctionInput<TRow>
): Promise<void> {
    const { entityId, entityFkColumn, amenityIds, junctionModel, amenityModel, tx } = input;

    // undefined → no-op (three-way contract)
    if (amenityIds === undefined) return;

    // Validate all supplied IDs before touching any rows.
    if (amenityIds.length > 0) {
        await validateCatalogIds({
            ids: amenityIds,
            findByIds: (ids, txClient) => amenityModel.findByIds(ids, txClient),
            entityLabel: 'amenity',
            tx
        });
    }

    // Fetch ALL current junction rows for this entity (HOS-321: an unpaginated
    // `findAll` silently truncates at the model's 20-row default page, which
    // makes the exact-set diff re-insert rows past page 1 — a composite-PK
    // violation that rolls the whole save back).
    const existing = await readAllJunctionRows<TRow>({
        where: { [entityFkColumn]: entityId },
        junctionModel,
        sortBy: 'amenityId' as keyof TRow & string,
        tx
    });
    const existingIds = new Set(existing.map((row) => row.amenityId as string));
    const targetIds = new Set(amenityIds);

    // Delete rows NOT in the target set, in ONE batched statement.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    if (toDelete.length > 0) {
        await junctionModel.hardDelete({ [entityFkColumn]: entityId, amenityId: toDelete }, tx);
    }

    // Insert rows that are in the target set but missing from the junction table.
    const toInsert = [...targetIds].filter((id) => !existingIds.has(id));
    for (const amenityId of toInsert) {
        await junctionModel.create({ [entityFkColumn]: entityId, amenityId }, tx);
    }
}

/**
 * Syncs a commerce entity's feature junction table inside an existing
 * database transaction.
 *
 * Same three-way contract and implementation pattern as
 * {@link syncCommerceAmenityJunction}, adapted for feature IDs.
 *
 * @param input - {@link SyncCommerceFeatureJunctionInput}
 * @throws {ServiceError} code `VALIDATION_ERROR` when any feature ID is unknown.
 */
export async function syncCommerceFeatureJunction<TRow extends Record<string, unknown>>(
    input: SyncCommerceFeatureJunctionInput<TRow>
): Promise<void> {
    const { entityId, entityFkColumn, featureIds, junctionModel, featureModel, tx } = input;

    // undefined → no-op (three-way contract)
    if (featureIds === undefined) return;

    // Validate all supplied IDs before touching any rows.
    if (featureIds.length > 0) {
        await validateCatalogIds({
            ids: featureIds,
            findByIds: (ids, txClient) => featureModel.findByIds(ids, txClient),
            entityLabel: 'feature',
            tx
        });
    }

    // Fetch ALL current junction rows for this entity — see the amenity
    // counterpart for why an unpaginated read corrupts the diff.
    const existing = await readAllJunctionRows<TRow>({
        where: { [entityFkColumn]: entityId },
        junctionModel,
        sortBy: 'featureId' as keyof TRow & string,
        tx
    });
    const existingIds = new Set(existing.map((row) => row.featureId as string));
    const targetIds = new Set(featureIds);

    // Delete rows NOT in the target set, in ONE batched statement.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    if (toDelete.length > 0) {
        await junctionModel.hardDelete({ [entityFkColumn]: entityId, featureId: toDelete }, tx);
    }

    // Insert rows that are in the target set but missing from the junction table.
    const toInsert = [...targetIds].filter((id) => !existingIds.has(id));
    for (const featureId of toInsert) {
        await junctionModel.create({ [entityFkColumn]: entityId, featureId }, tx);
    }
}
