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
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Minimal interface for a catalog model (amenity / feature) used by the
 * validator.  Only `findById` is required.
 */
interface CatalogModel {
    findById: (id: string, tx?: DrizzleClient) => Promise<unknown>;
}

/**
 * Minimal interface for a junction model.  Requires `findAll` (to read current
 * rows), `hardDelete` (to remove by composite key), and `create` (to insert).
 */
interface JunctionModel<TRow extends Record<string, unknown>> {
    findAll: (
        where: Record<string, unknown>,
        options?: unknown,
        additionalConditions?: unknown,
        tx?: DrizzleClient
    ) => Promise<{ items: TRow[] }>;
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
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Validates that every ID in `ids` exists in the catalog.
 * Throws `ServiceError(VALIDATION_ERROR)` on the first unknown ID, which
 * causes the surrounding transaction to roll back with no partial writes.
 *
 * @param ids - UUIDs to validate.
 * @param findById - Catalog lookup function.
 * @param entityLabel - Human-readable label for error messages.
 * @param tx - Transaction client threaded through to the catalog lookup.
 */
async function validateCatalogIds(
    ids: readonly string[],
    findById: (id: string, tx?: DrizzleClient) => Promise<unknown>,
    entityLabel: string,
    tx: DrizzleClient
): Promise<void> {
    for (const id of ids) {
        const row = await findById(id, tx);
        if (!row) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `${entityLabel} not found: ${id}`
            );
        }
    }
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
        await validateCatalogIds(
            amenityIds,
            (id, txClient) => amenityModel.findById(id, txClient),
            'amenity',
            tx
        );
    }

    // Fetch current junction rows for this entity.
    const { items: existing } = await junctionModel.findAll(
        { [entityFkColumn]: entityId },
        undefined,
        undefined,
        tx
    );
    const existingIds = new Set(existing.map((row) => row.amenityId as string));
    const targetIds = new Set(amenityIds);

    // Delete rows NOT in the target set.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    for (const amenityId of toDelete) {
        await junctionModel.hardDelete({ [entityFkColumn]: entityId, amenityId }, tx);
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
        await validateCatalogIds(
            featureIds,
            (id, txClient) => featureModel.findById(id, txClient),
            'feature',
            tx
        );
    }

    // Fetch current junction rows for this entity.
    const { items: existing } = await junctionModel.findAll(
        { [entityFkColumn]: entityId },
        undefined,
        undefined,
        tx
    );
    const existingIds = new Set(existing.map((row) => row.featureId as string));
    const targetIds = new Set(featureIds);

    // Delete rows NOT in the target set.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    for (const featureId of toDelete) {
        await junctionModel.hardDelete({ [entityFkColumn]: entityId, featureId }, tx);
    }

    // Insert rows that are in the target set but missing from the junction table.
    const toInsert = [...targetIds].filter((id) => !existingIds.has(id));
    for (const featureId of toInsert) {
        await junctionModel.create({ [entityFkColumn]: entityId, featureId }, tx);
    }
}
