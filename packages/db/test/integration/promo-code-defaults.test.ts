import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('TEST:B9b:3 AC:B9b:3 a promo code without quota or window has no cap', () => {
    it('defaults valid_from to database now and leaves quota and end date unlimited', async () => {
        const client = await getTestPool().connect();
        const code = `defaults-${randomUUID()}`;
        try {
            const result = await client.query<{
                total_quota: number | null;
                valid_from: Date;
                valid_until: Date | null;
                database_now: Date;
            }>(
                `INSERT INTO promo_code
                    (code, discount_kind, value, all_verticals, stackable,
                     usable_with_another_active, duration_kind)
                 VALUES ($1, 'FIXED', 100, true, false, false, 'FOREVER')
                 RETURNING total_quota, valid_from, valid_until, now() AS database_now`,
                [code]
            );
            const row = result.rows[0];
            expect(row?.total_quota).toBeNull();
            expect(row?.valid_until).toBeNull();
            expect(Math.abs(row!.valid_from.getTime() - row!.database_now.getTime())).toBeLessThan(
                2_000
            );
        } finally {
            await client.query('DELETE FROM promo_code WHERE code = $1', [code]);
            client.release();
        }
    });
});
