import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('TEST:V6:12 listing moderation permission schema', () => {
    it('contains listing.moderate in permission_enum', async () => {
        await withTestTransaction(async (tx) => {
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum'`
            );
            expect(result.rows.map((row) => row.enumlabel)).toContain('listing.moderate');
        });
    });
});

describe('TEST:V6:13 moderation purge schema', () => {
    it('has four nullable remote deletion marks', async () => {
        await withTestTransaction(async (tx) => {
            const columns = await tx.execute(sql`
                SELECT table_name, column_name, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND column_name = 'remote_deletion_pending_at'
                  AND table_name IN ('accommodation_media', 'gastronomy_media', 'experience_media', 'accommodation_calendar_sync')
            `);
            expect(columns.rows).toHaveLength(4);
            expect(columns.rows.every((row) => row.is_nullable === 'YES')).toBe(true);
        });
    });
});
