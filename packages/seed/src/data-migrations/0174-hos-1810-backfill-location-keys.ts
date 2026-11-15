/**
 * @fileoverview
 * Data migration: 0174-hos-1810-backfill-location-keys
 *
 * Dual-write counterpart (HOS-25) for HOS-1810. `accommodations` and `venues`
 * gained `location_key`, the normalized place key the one-address rule compares.
 * The services derive it on create and update, and the seeds derive it on insert,
 * so a row written after this release has one. Rows that already existed have
 * NULL; this migration computes it from `location` and `destination_id` with the
 * same `buildLocationKey` the services use, so every live listing with a
 * comparable address takes part in the rule.
 *
 * Run order: `db:migrate` (adds the columns and the unique indexes) then
 * `db:seed:migrate`. It must run after `0172-hos-2189-venue-locations`, which
 * gives the curated venues their address, so those end with a key too.
 *
 * ## Idempotency
 *
 * Only rows whose `location_key` is NULL are written, so a second run changes
 * nothing, and a key an owner's edit already produced is never touched.
 *
 * ## The unique index is respected, not fought
 *
 * `*_ownerId_locationKey_published_uniq` allows one PUBLISHED, live listing per
 * owner and key. If existing data already broke the rule (the owner says it does
 * not), writing every key would abort the migration on the second row. Instead a
 * PUBLISHED listing whose key an owner's earlier published listing already holds
 * is left without a key and counted in the summary: it keeps working, it just
 * does not participate, and nothing is lost.
 *
 * ## `destructive` flag decision
 *
 * `false`: it only fills an empty, derived column.
 */
import { sql } from '@repo/db';
import { buildLocationKey } from '@repo/utils';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0174-hos-1810-backfill-location-keys',
    group: 'required',
    destructive: false,
    requiresColumns: [
        { table: 'accommodations', column: 'location_key' },
        { table: 'accommodations', column: 'location_exception_at' },
        { table: 'venues', column: 'location_key' },
        { table: 'venues', column: 'location_exception_at' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/** The two tables the one-address rule covers. */
const TABLES = ['accommodations', 'venues'] as const;

/** A listing row as the planner reads it. */
export interface BackfillRow {
    readonly id: string;
    readonly ownerId: string;
    readonly destinationId: string;
    readonly location: Record<string, string | undefined> | null;
    readonly publicationStatus: string;
    readonly hasException: boolean;
}

/** The planner's verdict for a set of rows. */
export interface BackfillPlan {
    /** `id` to key, for every row that gets one. */
    readonly keys: ReadonlyMap<string, string>;
    /** Rows with no comparable address (no number, `s/n`, no street). */
    readonly withoutKey: number;
    /** PUBLISHED rows left unkeyed because their owner already holds the key. */
    readonly skippedDuplicates: readonly string[];
}

/**
 * Plans the keys for rows that have none.
 *
 * @param params.rows - Rows with `location_key IS NULL`, oldest first.
 * @param params.occupied - `ownerId|key` of PUBLISHED, non-excepted rows that
 *   already hold a key, so the plan never proposes a second one.
 * @returns The plan.
 */
export function planLocationKeys({
    rows,
    occupied
}: {
    readonly rows: readonly BackfillRow[];
    readonly occupied: ReadonlySet<string>;
}): BackfillPlan {
    const taken = new Set(occupied);
    const keys = new Map<string, string>();
    const skippedDuplicates: string[] = [];
    let withoutKey = 0;

    for (const row of rows) {
        const key = buildLocationKey({
            street: row.location?.street,
            number: row.location?.number,
            floor: row.location?.floor,
            apartment: row.location?.apartment,
            destinationId: row.destinationId
        });
        if (!key) {
            withoutKey += 1;
            continue;
        }
        const counts = row.publicationStatus === 'PUBLISHED' && !row.hasException;
        const slot = `${row.ownerId}|${key}`;
        if (counts && taken.has(slot)) {
            skippedDuplicates.push(row.id);
            continue;
        }
        if (counts) taken.add(slot);
        keys.set(row.id, key);
    }
    return { keys, withoutKey, skippedDuplicates };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const counts: Record<string, number> = {};
    let written = 0;
    const skipped: string[] = [];

    for (const table of TABLES) {
        const identifier = sql.identifier(table);
        const occupiedRows = await ctx.db.execute(
            sql`SELECT owner_id, location_key FROM ${identifier}
                WHERE location_key IS NOT NULL AND deleted_at IS NULL
                  AND publication_status = 'PUBLISHED' AND location_exception_at IS NULL`
        );
        const occupied = new Set(
            (occupiedRows.rows ?? []).map(
                (row) => `${String(row.owner_id)}|${String(row.location_key)}`
            )
        );

        const pending = await ctx.db.execute(
            sql`SELECT id, owner_id, destination_id, location, publication_status,
                       location_exception_at
                FROM ${identifier}
                WHERE location_key IS NULL AND location IS NOT NULL AND deleted_at IS NULL
                ORDER BY created_at ASC, id ASC`
        );
        const rows: BackfillRow[] = (pending.rows ?? []).map((row) => ({
            id: String(row.id),
            ownerId: String(row.owner_id),
            destinationId: String(row.destination_id),
            location: row.location as BackfillRow['location'],
            publicationStatus: String(row.publication_status),
            hasException: row.location_exception_at !== null
        }));

        const plan = planLocationKeys({ rows, occupied });
        for (const [id, key] of plan.keys) {
            const result = await ctx.db.execute(
                sql`UPDATE ${identifier} SET location_key = ${key}
                    WHERE id = ${id} AND location_key IS NULL RETURNING id`
            );
            written += (result.rows ?? []).length;
        }
        counts[`${table}Keyed`] = plan.keys.size;
        counts[`${table}WithoutKey`] = plan.withoutKey;
        skipped.push(...plan.skippedDuplicates);
    }

    return {
        summary:
            `Set the place key of ${written} listing(s)` +
            (skipped.length > 0
                ? `; left ${skipped.length} published duplicate(s) without one: ${skipped.join(', ')}.`
                : '.'),
        counts: { ...counts, written, skippedDuplicates: skipped.length }
    };
}
