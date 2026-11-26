import { getDb, initializeDb, resetDb, sql } from '@repo/db';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { meta, up } from '../../src/data-migrations/0196-hos-2495-listing-photo-limits-grant.js';

let pool: Pool;

beforeAll(() => {
    const connectionString = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!connectionString) throw new Error('The seed integration config must provide the test DB');
    pool = new Pool({ connectionString });
    initializeDb(pool);
});

afterAll(async () => {
    resetDb();
    await pool?.end();
});

it('grants all six plans including historical versions, preserves existing limits, and reruns without writes', async () => {
    const rollback = new Error('Rollback fixture');

    await expect(
        getDb().transaction(async (db) => {
            await db.execute(sql`
            insert into plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
            select pv.plan_id, pv.vertical, pv.rank, false, false, pv.trial_days, pv.allows_pause
            from plan_version pv join plan p on p.id = pv.plan_id
            where p.slug = 'venue-pro' and pv.current
        `);
            await db.execute(
                sql`select set_config('hospeda.catalog_additive_grant', 'HOS-2495', true)`
            );
            await db.execute(sql`
            insert into plan_version_limit (plan_version_id, key, value)
            select pv.id, 'max_photos_per_experience', 42
            from plan_version pv join plan p on p.id = pv.plan_id
            where p.slug = 'experience-pro' and pv.current
        `);
            await db.execute(sql`select set_config('hospeda.catalog_additive_grant', '', true)`);

            const first = await up({ db });
            const second = await up({ db });
            const { rows } = await db.execute(sql`
            select p.slug, pv.current, l.key, l.value
            from plan_version_limit l join plan_version pv on pv.id = l.plan_version_id
            join plan p on p.id = pv.plan_id
            where l.key in ('max_photos_per_venue', 'max_photos_per_experience')
            order by p.slug, pv.current
        `);
            const setting = await db.execute(
                sql`select current_setting('hospeda.catalog_additive_grant') as value`
            );

            expect(meta).toEqual({
                name: '0196-hos-2495-listing-photo-limits-grant',
                group: 'required',
                destructive: false,
                contentOnly: true
            });
            expect(first.counts).toEqual({ photoLimitsInserted: 6 });
            expect(second.counts).toEqual({ photoLimitsInserted: 0 });
            expect(rows).toEqual([
                {
                    slug: 'experience-basico',
                    current: true,
                    key: 'max_photos_per_experience',
                    value: 15
                },
                {
                    slug: 'experience-premium',
                    current: true,
                    key: 'max_photos_per_experience',
                    value: 50
                },
                {
                    slug: 'experience-pro',
                    current: true,
                    key: 'max_photos_per_experience',
                    value: 42
                },
                { slug: 'venue-basico', current: true, key: 'max_photos_per_venue', value: 15 },
                { slug: 'venue-premium', current: true, key: 'max_photos_per_venue', value: 50 },
                { slug: 'venue-pro', current: false, key: 'max_photos_per_venue', value: 30 },
                { slug: 'venue-pro', current: true, key: 'max_photos_per_venue', value: 30 }
            ]);
            expect(setting.rows).toEqual([{ value: '' }]);
            throw rollback;
        })
    ).rejects.toBe(rollback);
});
