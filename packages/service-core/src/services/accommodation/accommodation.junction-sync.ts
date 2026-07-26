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
 * The "sync to exact set" diff is only correct if the CURRENT set is read in
 * full — see `readAllJunctionRows` and HOS-321 for what a truncated read does.
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
import { readAllJunctionRows, validateCatalogIds } from '../../utils/junction-sync';

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
        await validateCatalogIds({
            ids: amenityIds,
            findByIds: (ids, txClient) => amenityModel.findByIds(ids, txClient),
            entityLabel: 'amenity',
            tx
        });
    }

    // Fetch ALL current junction rows for this accommodation (HOS-321: this
    // must not be truncated by the model's default page size — see
    // `readAllJunctionRows`).
    const existing = await readAllJunctionRows<{ amenityId: string }>({
        where: { accommodationId },
        junctionModel,
        sortBy: 'amenityId',
        tx
    });
    const existingIds = new Set(existing.map((row) => row.amenityId));
    const targetIds = new Set(amenityIds);

    // Delete rows NOT in the target set, in ONE statement. `buildWhereClause`
    // turns an array value on a scalar column into `IN (...)`, so clearing a
    // fully-populated accommodation costs one round trip instead of ~92 inside
    // the open write transaction.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    if (toDelete.length > 0) {
        await junctionModel.hardDelete({ accommodationId, amenityId: toDelete }, tx);
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
        await validateCatalogIds({
            ids: featureIds,
            findByIds: (ids, txClient) => featureModel.findByIds(ids, txClient),
            entityLabel: 'feature',
            tx
        });
    }

    // Fetch ALL current junction rows for this accommodation (HOS-321: this
    // must not be truncated by the model's default page size — see
    // `readAllJunctionRows`).
    const existing = await readAllJunctionRows<{ featureId: string }>({
        where: { accommodationId },
        junctionModel,
        sortBy: 'featureId',
        tx
    });
    const existingIds = new Set(existing.map((row) => row.featureId));
    const targetIds = new Set(featureIds);

    // Delete rows NOT in the target set, in ONE statement — see the amenity
    // counterpart for why.
    const toDelete = [...existingIds].filter((id) => !targetIds.has(id));
    if (toDelete.length > 0) {
        await junctionModel.hardDelete({ accommodationId, featureId: toDelete }, tx);
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
