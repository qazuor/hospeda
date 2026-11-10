/**
 * listing.junction-sync.ts
 *
 * Generic many-to-many junction synchronisers for listing entities
 * (SPEC-239 T-031).  Parametrised by (junction model, catalog model, FK column
 * name) so venue and future experience entities can share the same logic.
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
 * HOS-2067: a RETIRED (soft-deleted) catalog id is treated like an unknown one
 * unless the entity already has it linked. It is rejected, never dropped: the
 * sync is exact-set, so a stale form carrying a retired id also lacks the
 * replacement relation a data migration created, and the diff would delete it.
 * An already-linked retired id is kept as is.
 *
 * @module listing.junction-sync
 */

import type { DrizzleClient } from '@repo/db';
import { type AmenityRelationAttributes, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types';
import {
    amenityAttributesMatch,
    buildAmenityAttributeUpdate,
    resolveDesiredAmenityAttributes
} from '../../utils/amenity-relation-attributes';
import { readAllJunctionRows, validateCatalogIds } from '../../utils/junction-sync';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Minimal interface for a catalog model (amenity / feature) used by the
 * validator. HOS-321: batch lookup, not one `findById` per id.
 */
interface CatalogModel {
    findByIds: (
        ids: readonly string[],
        tx?: DrizzleClient
    ) => Promise<readonly { id: string; deletedAt?: Date | string | null }[]>;
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
    /**
     * Updates rows matching `where` (HOS-2061: relation attributes). Optional
     * because the feature junction never needs it.
     */
    update?: (
        where: Record<string, unknown>,
        data: Record<string, unknown>,
        tx?: DrizzleClient
    ) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Inputs for {@link syncListingAmenityJunction}.
 *
 * @template TRow - The DB row type of the junction table.
 */
export interface SyncListingAmenityJunctionInput<TRow extends Record<string, unknown>> {
    /** The listing entity whose amenity relations are being synced. */
    readonly entityId: string;
    /**
     * Name of the FK column on the junction row that points at the entity.
     * For venue: `'venueId'`.  For experience: `'experienceId'`.
     */
    readonly entityFkColumn: string;
    /**
     * Target amenity UUIDs.
     * `undefined` → no-op | `[]` → clear all | `[ids]` → sync to set.
     */
    readonly amenityIds: readonly string[] | undefined;
    /**
     * Per-amenity relation attributes (HOS-2061), same contract as the
     * accommodation sync:
     * `undefined` → attributes of existing rows untouched;
     * `[…]` → every linked amenity gets exactly the listed `scope` /
     * `availability`, an unlisted linked amenity is reset to NULL, and an entry
     * for an amenity that is not linked throws `VALIDATION_ERROR`.
     */
    readonly amenityAttributes?: readonly AmenityRelationAttributes[] | undefined;
    /** Junction table model (injectable for testing). */
    readonly junctionModel: JunctionModel<TRow>;
    /** Amenity catalog model (injectable for testing). */
    readonly amenityModel: CatalogModel;
    /** Active Drizzle transaction client. */
    readonly tx: DrizzleClient;
}

/**
 * Inputs for {@link syncListingFeatureJunction}.
 *
 * @template TRow - The DB row type of the junction table.
 */
export interface SyncListingFeatureJunctionInput<TRow extends Record<string, unknown>> {
    /** The listing entity whose feature relations are being synced. */
    readonly entityId: string;
    /**
     * Name of the FK column on the junction row that points at the entity.
     * For venue: `'venueId'`.  For experience: `'experienceId'`.
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
 * Syncs a listing entity's amenity junction table inside an existing
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
 * @param input - {@link SyncListingAmenityJunctionInput}
 * @throws {ServiceError} code `VALIDATION_ERROR` when any amenity ID is unknown or newly retired.
 *
 * @example
 * ```ts
 * // In VenueService._afterCreate:
 * await syncListingAmenityJunction({
 *   entityId: venue.id,
 *   entityFkColumn: 'venueId',
 *   amenityIds: ctx.hookState.pendingAmenityIds,
 *   junctionModel: this.rvenueAmenityModel,
 *   amenityModel: this.amenityModel,
 *   tx: ctx.tx!,
 * });
 * ```
 */
export async function syncListingAmenityJunction<TRow extends Record<string, unknown>>(
    input: SyncListingAmenityJunctionInput<TRow>
): Promise<void> {
    const {
        entityId,
        entityFkColumn,
        amenityIds,
        amenityAttributes,
        junctionModel,
        amenityModel,
        tx
    } = input;

    // undefined → no-op (three-way contract)
    if (amenityIds === undefined && amenityAttributes === undefined) return;

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

    // Validate all supplied IDs before touching any rows. Runs AFTER the read
    // so a retired catalog id the entity already has linked is tolerated
    // (HOS-2067); a retired id it does not have is rejected.
    if (amenityIds !== undefined && amenityIds.length > 0) {
        await validateCatalogIds({
            ids: amenityIds,
            findByIds: (ids, txClient) => amenityModel.findByIds(ids, txClient),
            entityLabel: 'amenity',
            alreadyLinkedIds: new Set(existing.map((row) => row.amenityId as string)),
            tx
        });
    }
    const existingById = new Map(existing.map((row) => [row.amenityId as string, row]));
    const existingIds = new Set(existingById.keys());
    const targetIds = amenityIds === undefined ? existingIds : new Set(amenityIds);

    // HOS-2061: resolve attributes BEFORE any write, so a bad entry rolls back nothing.
    const desired =
        amenityAttributes === undefined
            ? undefined
            : resolveDesiredAmenityAttributes({ amenityAttributes, finalIds: targetIds });

    // Delete rows NOT in the target set, in ONE batched statement.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    if (toDelete.length > 0) {
        await junctionModel.hardDelete({ [entityFkColumn]: entityId, amenityId: toDelete }, tx);
    }

    // Insert rows that are in the target set but missing from the junction table.
    const toInsert = [...targetIds].filter((id) => !existingIds.has(id));
    for (const amenityId of toInsert) {
        const attributes = desired?.get(amenityId);
        await junctionModel.create(
            {
                [entityFkColumn]: entityId,
                amenityId,
                // HOS-2061: scope/availability stay NULL ("not declared") unless sent.
                ...(attributes
                    ? {
                          scope: attributes.scope,
                          availability: attributes.availability,
                          // HOS-2084: `extraCharge` -> is_optional (column default false).
                          ...(attributes.isOptional === undefined
                              ? {}
                              : { isOptional: attributes.isOptional })
                      }
                    : {})
            },
            tx
        );
    }

    // HOS-2061: update kept rows whose attributes differ from the desired values.
    if (desired === undefined) return;
    for (const amenityId of targetIds) {
        const row = existingById.get(amenityId);
        if (!row) continue; // just inserted with the desired values
        const want = desired.get(amenityId);
        if (!want || amenityAttributesMatch({ row, want })) continue;
        if (!junctionModel.update) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Amenity junction model must implement update() to write relation attributes'
            );
        }
        await junctionModel.update(
            { [entityFkColumn]: entityId, amenityId },
            buildAmenityAttributeUpdate({ want }),
            tx
        );
    }
}

/**
 * Syncs a listing entity's feature junction table inside an existing
 * database transaction.
 *
 * Same three-way contract and implementation pattern as
 * {@link syncListingAmenityJunction}, adapted for feature IDs.
 *
 * @param input - {@link SyncListingFeatureJunctionInput}
 * @throws {ServiceError} code `VALIDATION_ERROR` when any feature ID is unknown or newly retired.
 */
export async function syncListingFeatureJunction<TRow extends Record<string, unknown>>(
    input: SyncListingFeatureJunctionInput<TRow>
): Promise<void> {
    const { entityId, entityFkColumn, featureIds, junctionModel, featureModel, tx } = input;

    // undefined → no-op (three-way contract)
    if (featureIds === undefined) return;

    // Fetch ALL current junction rows for this entity — see the amenity
    // counterpart for why an unpaginated read corrupts the diff.
    const existing = await readAllJunctionRows<TRow>({
        where: { [entityFkColumn]: entityId },
        junctionModel,
        sortBy: 'featureId' as keyof TRow & string,
        tx
    });

    // Validate all supplied IDs before touching any rows. Runs AFTER the read
    // so a retired catalog id the entity already has linked is tolerated
    // (HOS-2067); a retired id it does not have is rejected.
    if (featureIds.length > 0) {
        await validateCatalogIds({
            ids: featureIds,
            findByIds: (ids, txClient) => featureModel.findByIds(ids, txClient),
            entityLabel: 'feature',
            alreadyLinkedIds: new Set(existing.map((row) => row.featureId as string)),
            tx
        });
    }
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
