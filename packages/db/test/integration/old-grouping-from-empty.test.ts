// TEST:U1:6 — the full migration chain on an empty disposable database.
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

describe('TEST:U1:6 — old grouping absent after db:migrate from empty', () => {
    it('has business but no old partner type', async () => {
        const values = await getTestPool().query<{ enumlabel: string }>(`
            SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'partner_type_enum'
        `);
        const labels = values.rows.map((row) => row.enumlabel);
        expect(labels).toContain('business');
        expect(labels).not.toContain('commerce');
    });

    it('has no old role, permissions, or contact table', async () => {
        const values = await getTestPool().query<{ typname: string; enumlabel: string }>(`
            SELECT t.typname, e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname IN ('role_enum', 'permission_enum')
        `);
        expect(values.rows.some((row) => row.enumlabel === 'COMMERCE_OWNER')).toBe(false);
        expect(
            values.rows.filter(
                (row) => row.typname === 'permission_enum' && row.enumlabel.startsWith('commerce.')
            )
        ).toEqual([]);
        const table = await getTestPool().query<{ name: string | null }>(
            `SELECT to_regclass('public.commerce_leads')::text AS name`
        );
        expect(table.rows[0]?.name).toBeNull();
    });
});
