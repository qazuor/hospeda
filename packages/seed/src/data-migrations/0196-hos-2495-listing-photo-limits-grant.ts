import { sql } from '@repo/db';
import { PRODUCTION_PLAN_LISTING_PHOTO_LIMIT_GRANTS } from '../catalog/next-version-entitlements.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** No baseline writes these rows, so a fresh database must run the grant. */
export const meta = {
    name: '0196-hos-2495-listing-photo-limits-grant',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/** Add missing gallery limits even to historical plan versions that still anchor live coverage. */
export async function up({ db }: Pick<SeedMigrationCtx, 'db'>): Promise<SeedMigrationResult> {
    const grants = sql.join(
        PRODUCTION_PLAN_LISTING_PHOTO_LIMIT_GRANTS.map(
            ({ vertical, slug, limit }) =>
                sql`(${vertical}::text, ${slug}::text, ${limit.key}::text, ${limit.value}::int)`
        ),
        sql`, `
    );

    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2495', true)`);
    const result = await db.execute<{ inserted: number }>(sql`
        with grants (vertical, slug, key, value) as (values ${grants}), inserted_limits as (
            insert into plan_version_limit (id, plan_version_id, key, value)
            select gen_random_uuid(), pv.id, g.key, g.value
            from grants g
            join plan p on p.vertical::text = g.vertical and p.slug = g.slug and p.role is null
            join plan_version pv on pv.plan_id = p.id and pv.vertical = p.vertical
            where not exists (
                select 1 from plan_version_limit existing
                where existing.plan_version_id = pv.id and existing.key = g.key
            )
            returning plan_version_id
        )
        select count(*)::int as inserted from inserted_limits
    `);
    // On failure the runner rolls back the transaction and its local setting.
    await db.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);

    const photoLimitsInserted = result.rows[0]?.inserted ?? 0;
    return {
        summary: `HOS-2495: granted gallery photo limits to ${photoLimitsInserted} plan versions.`,
        counts: { photoLimitsInserted }
    };
}
