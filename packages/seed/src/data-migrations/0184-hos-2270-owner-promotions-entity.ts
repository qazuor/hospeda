/**
 * @fileoverview
 * Data migration: 0184-hos-2270-owner-promotions-entity
 *
 * Release N (expand) of the owner-promotions target change (HOS-2270): copies
 * `owner_promotions.accommodation_id` into the new `entity_id` column.
 *
 * ## Why this migration exists
 *
 * Structural migration 0236 added `entity_type` (default `'accommodation'`) and
 * `entity_id`. The default types every existing row correctly, but `entity_id`
 * is born NULL, and NULL with `entity_type = 'accommodation'` means "all of the
 * owner's accommodations". Until this runs, an already-seeded environment holds
 * promotions that point at one accommodation in the legacy column and nowhere
 * in the new pair. The code of release N reads both (dual read), so nothing
 * breaks in the window; this copy is what lets release N+1 drop the legacy
 * column without losing a single target.
 *
 * ## What it does
 *
 * `entity_id = accommodation_id` where `accommodation_id IS NOT NULL` and
 * `entity_id IS NULL`. Rows with a NULL `accommodation_id` are the genuine
 * "all of the owner's accommodations" promotions (D-4 of SPEC-285): they stay
 * type `accommodation` with a NULL `entity_id`, and there is nothing to copy.
 *
 * ## Idempotency
 *
 * It only touches rows where `entity_id IS NULL AND accommodation_id IS NOT
 * NULL`, so a second run finds nothing and changes nothing.
 *
 * ## Why `requiresColumns` (HOS-433)
 *
 * The release N+1 migration drops `accommodation_id`. If it were merged into the
 * same release as this copy, `db:migrate` would drop the source before this ran,
 * the UPDATE would read nothing and the ledger would record it as applied
 * forever. Declaring the three columns makes the runner refuse to execute
 * instead of "succeeding" over zero rows.
 *
 * Dual-write rule: the baseline fixture that writes promotions
 * (`src/test-users/hostPromotion.ts`) is demo-only and exempt, but was updated to
 * write the new pair anyway.
 */

import type { DrizzleClient } from '@repo/db';
import { sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0184-hos-2270-owner-promotions-entity',
    group: 'required',
    destructive: false,
    requiresColumns: [
        { table: 'owner_promotions', column: 'accommodation_id' },
        { table: 'owner_promotions', column: 'entity_type' },
        { table: 'owner_promotions', column: 'entity_id' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * Copies `accommodation_id` into `entity_id` for every promotion that still lacks it.
 *
 * Raw SQL on purpose: `accommodation_id` leaves the Drizzle schema in the release
 * N+1, and this file must keep compiling after that.
 *
 * @param args.db - Transaction-scoped client.
 * @returns How many rows were copied and how many owner-wide rows were left alone.
 */
export async function copyAccommodationIdToEntityId({
    db
}: {
    readonly db: DrizzleClient;
}): Promise<{ readonly copied: number; readonly ownerWide: number }> {
    const updated = await db.execute(
        sql`UPDATE owner_promotions
            SET entity_id = accommodation_id
            WHERE entity_id IS NULL AND accommodation_id IS NOT NULL
            RETURNING id`
    );
    const ownerWide = await db.execute(
        sql`SELECT count(*)::int AS total FROM owner_promotions
            WHERE entity_type = 'accommodation' AND entity_id IS NULL AND accommodation_id IS NULL`
    );
    return {
        copied: updated.rows?.length ?? 0,
        ownerWide: Number((ownerWide.rows?.[0] as { total?: number } | undefined)?.total ?? 0)
    };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const { copied, ownerWide } = await copyAccommodationIdToEntityId({ db: ctx.db });
    return {
        summary: `Copied accommodation_id into entity_id on ${copied} owner promotion(s); ${ownerWide} owner-wide promotion(s) keep a NULL entity_id.`,
        counts: { copied, ownerWide }
    };
}
