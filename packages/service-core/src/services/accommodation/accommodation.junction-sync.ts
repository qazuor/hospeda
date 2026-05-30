/**
 * accommodation.junction-sync.ts
 *
 * Transactional helpers that sync the many-to-many junction tables
 * `r_accommodation_amenity` and `r_accommodation_feature` as part of
 * an accommodation create or update operation (SPEC-172).
 *
 * Contract (owner-locked):
 *  - ids === undefined  →  leave existing rows untouched (no-op)
 *  - ids === []         →  delete ALL rows for this accommodation
 *  - ids === [a, b, c]  →  sync to EXACTLY that set:
 *                           delete rows not in the set,
 *                           insert rows that are missing
 *
 * All mutations happen on the caller-supplied `tx` so they run inside the
 * same transaction as the accommodation write. An unknown catalog ID causes
 * a `ServiceError(VALIDATION_ERROR)` which rolls back the whole transaction.
 *
 * @module accommodation.junction-sync
 */

import type {
    AmenityModel,
    DrizzleClient,
    FeatureModel,
    RAccommodationAmenityModel,
    RAccommodationFeatureModel
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Inputs required by {@link syncAmenityJunction}. */
interface SyncAmenityJunctionInput {
    /** The accommodation whose amenity relations are being synced. */
    readonly accommodationId: string;
    /**
     * Target set of amenity UUIDs.
     * `undefined` → leave existing rows untouched.
     * `[]` → delete all.
     * `[…]` → sync to exact set.
     */
    readonly amenityIds: readonly string[] | undefined;
    /** Junction table model (injectable for testing). */
    readonly junctionModel: RAccommodationAmenityModel;
    /** Catalog model used to validate that IDs exist (injectable for testing). */
    readonly amenityModel: AmenityModel;
    /** Active Drizzle transaction client. */
    readonly tx: DrizzleClient;
}

/** Inputs required by {@link syncFeatureJunction}. */
interface SyncFeatureJunctionInput {
    /** The accommodation whose feature relations are being synced. */
    readonly accommodationId: string;
    /**
     * Target set of feature UUIDs.
     * `undefined` → leave existing rows untouched.
     * `[]` → delete all.
     * `[…]` → sync to exact set.
     */
    readonly featureIds: readonly string[] | undefined;
    /** Junction table model (injectable for testing). */
    readonly junctionModel: RAccommodationFeatureModel;
    /** Catalog model used to validate that IDs exist (injectable for testing). */
    readonly featureModel: FeatureModel;
    /** Active Drizzle transaction client. */
    readonly tx: DrizzleClient;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Validates that every ID in `ids` exists in the catalog via `findById`.
 * Throws `ServiceError(VALIDATION_ERROR)` on the first unknown ID so the
 * surrounding transaction rolls back with no partial writes.
 *
 * @param ids - UUIDs to validate against the catalog.
 * @param findById - Catalog lookup (e.g. `amenityModel.findById`).
 * @param entityLabel - Human-readable name for error messages ("amenity" / "feature").
 * @param tx - Transaction client passed through to the catalog lookup.
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
 * Syncs `r_accommodation_amenity` for a single accommodation inside an
 * existing database transaction.
 *
 * Three-way contract:
 * - `amenityIds === undefined` → **no-op** (existing rows untouched)
 * - `amenityIds === []`        → delete all existing rows
 * - `amenityIds = [id, …]`    → diff against current state:
 *     - Rows whose `amenityId` is NOT in the target set are deleted.
 *     - Missing rows are inserted with `isOptional = false`.
 *   Operation is idempotent.
 *
 * Validation: every ID in `amenityIds` must exist in the `amenities` catalog.
 * An unknown ID throws `ServiceError(VALIDATION_ERROR)` which rolls back the
 * surrounding transaction — no partial writes occur.
 *
 * @param input - {@link SyncAmenityJunctionInput}
 * @throws {ServiceError} code `VALIDATION_ERROR` when any amenity ID is unknown.
 */
export async function syncAmenityJunction({
    accommodationId,
    amenityIds,
    junctionModel,
    amenityModel,
    tx
}: SyncAmenityJunctionInput): Promise<void> {
    // undefined → leave untouched (R-1 regression contract)
    if (amenityIds === undefined) return;

    // Validate all supplied IDs exist before touching any rows.
    if (amenityIds.length > 0) {
        await validateCatalogIds(
            amenityIds,
            (id, txClient) => amenityModel.findById(id, txClient),
            'amenity',
            tx
        );
    }

    // Fetch current junction rows for this accommodation.
    // findAll(where, options?, additionalConditions?, tx?)
    const { items: existing } = await junctionModel.findAll(
        { accommodationId },
        undefined,
        undefined,
        tx
    );
    const existingIds = new Set(existing.map((row) => row.amenityId as string));
    const targetIds = new Set(amenityIds);

    // Delete rows NOT in the target set.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    for (const amenityId of toDelete) {
        await junctionModel.hardDelete({ accommodationId, amenityId }, tx);
    }

    // Insert rows that are in the target set but not yet in the junction table.
    const toInsert = [...targetIds].filter((id) => !existingIds.has(id));
    for (const amenityId of toInsert) {
        // TYPE-WORKAROUND: The junction model's generic type (AccommodationAmenityRelation)
        // covers all columns; cast is safe because Drizzle maps fields by column name at insert time.
        await junctionModel.create(
            {
                accommodationId,
                amenityId,
                isOptional: false
                // additionalCost and additionalCostPercent default to null in DB schema.
            } as Parameters<typeof junctionModel.create>[0],
            tx
        );
    }
}

/**
 * Syncs `r_accommodation_feature` for a single accommodation inside an
 * existing database transaction.
 *
 * Three-way contract:
 * - `featureIds === undefined` → **no-op** (existing rows untouched)
 * - `featureIds === []`        → delete all existing rows
 * - `featureIds = [id, …]`    → diff against current state:
 *     - Rows whose `featureId` is NOT in the target set are deleted.
 *     - Missing rows are inserted with `hostReWriteName = null`, `comments = null`.
 *   Operation is idempotent.
 *
 * Validation: every ID in `featureIds` must exist in the `features` catalog.
 * An unknown ID throws `ServiceError(VALIDATION_ERROR)` which rolls back the
 * surrounding transaction — no partial writes occur.
 *
 * @param input - {@link SyncFeatureJunctionInput}
 * @throws {ServiceError} code `VALIDATION_ERROR` when any feature ID is unknown.
 */
export async function syncFeatureJunction({
    accommodationId,
    featureIds,
    junctionModel,
    featureModel,
    tx
}: SyncFeatureJunctionInput): Promise<void> {
    // undefined → leave untouched (R-1 regression contract)
    if (featureIds === undefined) return;

    // Validate all supplied IDs exist before touching any rows.
    if (featureIds.length > 0) {
        await validateCatalogIds(
            featureIds,
            (id, txClient) => featureModel.findById(id, txClient),
            'feature',
            tx
        );
    }

    // Fetch current junction rows for this accommodation.
    // findAll(where, options?, additionalConditions?, tx?)
    const { items: existing } = await junctionModel.findAll(
        { accommodationId },
        undefined,
        undefined,
        tx
    );
    const existingIds = new Set(existing.map((row) => row.featureId as string));
    const targetIds = new Set(featureIds);

    // Delete rows NOT in the target set.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    for (const featureId of toDelete) {
        await junctionModel.hardDelete({ accommodationId, featureId }, tx);
    }

    // Insert rows that are in the target set but not yet in the junction table.
    const toInsert = [...targetIds].filter((id) => !existingIds.has(id));
    for (const featureId of toInsert) {
        // TYPE-WORKAROUND: The DB schema columns (hostReWriteName, comments) do not match
        // the generic type parameter (AccommodationFeature which has notes/isHighlighted).
        // This is a pre-existing type mismatch in the codebase. We cast to the parameter
        // type; Drizzle resolves fields by column name at query generation time and only
        // writes columns that exist in the table schema — extra fields are silently ignored.
        await junctionModel.create(
            { accommodationId, featureId } as Parameters<typeof junctionModel.create>[0],
            tx
        );
    }
}
