/**
 * junction-sync.ts
 *
 * Primitives shared by every "sync a many-to-many junction table to an EXACT
 * target set" implementation (accommodation amenities/features, commerce
 * amenities/features, ...).
 *
 * They live in `utils/` rather than under one domain's `services/` folder
 * because the two bugs they exist to prevent (HOS-321) are properties of the
 * exact-set contract itself, not of any one entity:
 *
 *  1. **Truncated current-set read.** `BaseModelImpl.findAll` ALWAYS paginates
 *     and defaults to `pageSize: 20`. Diffing a full target set against a
 *     truncated "existing" set re-INSERTS the rows past the first page
 *     (composite-PK violation → the whole transaction rolls back) and never
 *     deletes the ones the user actually de-selected.
 *  2. **Per-id catalog validation.** One `findById` per id inside the open
 *     write transaction is fine for a handful of ids and pathological for a
 *     full set (~92 amenities on a seeded accommodation).
 *
 * Duplicating either fix per domain is how the two copies drift, so both live
 * in one place with one set of tests.
 *
 * Deliberately NOT re-exported from `utils/index.ts`: "shared" here means
 * shared between sync modules INSIDE this package, not part of
 * `@repo/service-core`'s public surface. Nothing outside should be hand-rolling
 * a junction sync.
 *
 * @module utils/junction-sync
 */

import type { DrizzleClient } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../types';

/**
 * Page size requested when reading the CURRENT junction rows. MUST stay equal
 * to `BaseModelImpl`'s private `MAX_PAGE_SIZE` — see the termination note on
 * {@link readAllJunctionRows}.
 */
const JUNCTION_READ_PAGE_SIZE = 200;

/**
 * Hard ceiling on pages read per sync. A junction row set is bounded by the
 * size of the catalog it links to (~110 amenities / ~96 features today), so
 * this is only ever reached if a model implementation ignores `page`.
 */
const JUNCTION_READ_MAX_PAGES = 50;

/** Structural view of the junction models' paginated `findAll`. */
export interface PaginatedJunctionReader<TRow> {
    readonly findAll: (
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: undefined,
        tx?: DrizzleClient
    ) => Promise<{ items: TRow[]; total: number }>;
}

/** Inputs for {@link readAllJunctionRows}. */
export interface ReadAllJunctionRowsInput<TRow> {
    /** Filter identifying the parent entity's rows (e.g. `{ accommodationId }`). */
    readonly where: Record<string, unknown>;
    /** The junction model to page through. */
    readonly junctionModel: PaginatedJunctionReader<TRow>;
    /** Column giving a stable total order across pages. */
    readonly sortBy: keyof TRow & string;
    /** Active transaction client. */
    readonly tx: DrizzleClient;
}

/**
 * Reads EVERY junction row matching `where`, paging until a short page proves
 * the set is exhausted.
 *
 * Termination is a SHORT page, deliberately not the reported `total`:
 * `findAll` issues the count and the rows as two separate statements, so under
 * READ COMMITTED a `total` that under-reports (the count ran before a
 * concurrent commit the row query then saw) would break the loop early and
 * silently truncate the read — bug 1 above, with no error.
 *
 * That makes {@link JUNCTION_READ_PAGE_SIZE} coupled to `BaseModelImpl`'s
 * private `MAX_PAGE_SIZE`, which is 200 and clamps any larger request: if that
 * ceiling were ever lowered below this constant, EVERY page would look short
 * and the read would stop after page 1. Keep the two equal. The constant is
 * deliberately NOT imported from `@repo/db` — several suites mock that barrel
 * with a factory spread, which does not materialize its star re-exports, so a
 * value import here breaks every one of them at load time.
 *
 * `sortBy` is REQUIRED, not cosmetic: `LIMIT/OFFSET` without a total order lets
 * Postgres return the same row on two pages (and skip another) *within* a
 * single statement. Note this makes each page internally consistent, NOT the
 * accumulation across pages — the pages are separate statements, so a
 * concurrent INSERT that sorts before the current offset can still shift the
 * window. That is acceptable here because the sync already runs inside the
 * caller's write transaction against a single parent entity.
 *
 * The loop is forward-looking defence today: a junction row set is bounded by
 * its catalog (~110 rows) and the page size is 200, so page 1 covers everything
 * until a catalog outgrows that. The load-bearing part of the fix is simply
 * asking for a page size above the model's default of 20.
 *
 * @param input - {@link ReadAllJunctionRowsInput}
 * @returns Every junction row matching `where`.
 * @throws {ServiceError} code `INTERNAL_ERROR` if `where` is empty, or if the
 *   model ignores `page` and keeps returning full pages.
 */
export async function readAllJunctionRows<TRow>({
    where,
    junctionModel,
    sortBy,
    tx
}: ReadAllJunctionRowsInput<TRow>): Promise<TRow[]> {
    // Mirrors `BaseModelImpl.hardDelete`'s guard: an empty filter here would
    // page through the ENTIRE junction table rather than one entity's rows.
    if (Object.keys(where).length === 0) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'readAllJunctionRows requires a non-empty where filter'
        );
    }

    const rows: TRow[] = [];
    let page = 1;

    for (;;) {
        const { items } = await junctionModel.findAll(
            where,
            { page, pageSize: JUNCTION_READ_PAGE_SIZE, sortBy, sortOrder: 'asc' },
            undefined,
            tx
        );
        rows.push(...items);

        // A short (or empty) page means there is nothing after it.
        if (items.length < JUNCTION_READ_PAGE_SIZE) break;

        page += 1;
        // Termination otherwise rests on the model honouring `page`, which the
        // structural reader type cannot enforce. Fail loudly instead of hanging
        // the request if some implementation ever returns the same page twice.
        if (page > JUNCTION_READ_MAX_PAGES) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                `junction read exceeded ${JUNCTION_READ_MAX_PAGES} pages for ${JSON.stringify(where)}`
            );
        }
    }

    return rows;
}

/** Inputs for {@link validateCatalogIds}. */
export interface ValidateCatalogIdsInput {
    /** UUIDs to validate against the catalog. */
    readonly ids: readonly string[];
    /** Catalog batch lookup (e.g. `amenityModel.findByIds`). */
    readonly findByIds: (
        ids: readonly string[],
        tx?: DrizzleClient
    ) => Promise<readonly { id: string }[]>;
    /** Human-readable name for error messages ("amenity" / "feature"). */
    readonly entityLabel: string;
    /** Transaction client passed through to the catalog lookup. */
    readonly tx: DrizzleClient;
}

/**
 * Validates that every ID in `ids` exists in the catalog, in ONE query.
 * Throws `ServiceError(VALIDATION_ERROR)` naming the first unknown ID so the
 * surrounding transaction rolls back with no partial writes.
 *
 * @param input - {@link ValidateCatalogIdsInput}
 * @throws {ServiceError} code `VALIDATION_ERROR` when any ID is unknown.
 */
export async function validateCatalogIds({
    ids,
    findByIds,
    entityLabel,
    tx
}: ValidateCatalogIdsInput): Promise<void> {
    if (ids.length === 0) return;

    const found = new Set((await findByIds(ids, tx)).map((row) => row.id));
    // Report the first unknown ID in the caller's order so the message is
    // reproducible regardless of how the DB ordered the result set.
    const missing = ids.find((id) => !found.has(id));
    if (missing !== undefined) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            `${entityLabel} not found: ${missing}`
        );
    }
}
