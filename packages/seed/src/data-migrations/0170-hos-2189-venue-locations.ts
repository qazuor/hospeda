/**
 * @fileoverview
 * Data migration: 0170-hos-2189-venue-locations
 *
 * Dual-write counterpart (HOS-25) for HOS-2189. `venues` gained a structured
 * postal address (`location` JSONB, the same shape as an accommodation's). The
 * six curated venue fixtures under `src/data/venue/` now carry one, so a fresh
 * database is built correct; this migration gives the same address to the rows
 * an already-seeded environment holds.
 *
 * ## Which rows
 *
 * The fixtures' deterministic ids (`deterministicFixtureId` over the key
 * `venue:<fixture id>`, the very key `venues.seed.ts` inserts with), so a row
 * an operator created by hand is never matched.
 *
 * ## Idempotency and operator edits
 *
 * Only a row whose `location` is still NULL is written, so re-running is a
 * no-op and an address an owner or an admin already entered is never
 * overwritten. A fixture whose row does not exist in the environment (the
 * example data was purged) simply matches nothing.
 *
 * ## `destructive` flag decision
 *
 * `false`: the migration only fills an empty column.
 */
import { sql } from '@repo/db';
import { deterministicFixtureId } from '../utils/deterministicFixtureId.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0170-hos-2189-venue-locations',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The fixture files this migration covers. A FIXED list, not the manifest: a
 * later venue fixture ships its own migration instead of being swept in here.
 */
const VENUE_FIXTURE_FILES = [
    '001-venue-uruguay-la-parrilla-del-puerto.json',
    '002-venue-colon-cafe-del-palacio.json',
    '003-venue-gualeguaychu-la-cerveceria-del-rio.json',
    '004-venue-concordia-heladeria-artesanal-luna.json',
    '005-venue-federacion-restaurant-termas.json',
    '006-venue-uruguay-bar-el-rinconcito.json'
] as const;

/** The part of a venue fixture this migration reads. */
interface VenueFixture {
    readonly id: string;
    readonly location?: Record<string, unknown> | null;
}

/** One planned write: the real row id and the address to give it. */
export interface VenueLocationUpdate {
    readonly venueId: string;
    readonly location: Record<string, unknown>;
}

/**
 * Plans the writes from the fixtures, skipping any without an address.
 *
 * Exported so the test can assert the plan without a database.
 *
 * @param params.fixtures - The venue fixtures, as read off disk.
 * @returns One update per fixture that carries a `location`.
 */
export function planVenueLocationUpdates({
    fixtures
}: {
    readonly fixtures: readonly VenueFixture[];
}): readonly VenueLocationUpdate[] {
    return fixtures.flatMap((fixture) =>
        fixture.location
            ? [
                  {
                      venueId: deterministicFixtureId({ seedKey: `venue:${fixture.id}` }),
                      location: fixture.location
                  }
              ]
            : []
    );
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const fixtures = await loadJsonFiles<VenueFixture>('src/data/venue', [...VENUE_FIXTURE_FILES]);
    const updates = planVenueLocationUpdates({ fixtures });

    let updated = 0;
    for (const { venueId, location } of updates) {
        const result = await ctx.db.execute(
            sql`UPDATE venues
                SET location = ${JSON.stringify(location)}::jsonb,
                    updated_at = now()
                WHERE id = ${venueId}
                  AND location IS NULL
                  AND deleted_at IS NULL
                RETURNING id`
        );
        updated += (result.rows ?? []).length;
    }

    return {
        summary:
            updated === 0
                ? 'No curated venue needed an address.'
                : `Set the postal address of ${updated} curated venue(s).`,
        counts: { planned: updates.length, updated }
    };
}
