import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findDestructiveStatements } from '../../../../scripts/check-additive-migrations.ts';
import { closeTestPool, getTestPool } from './helpers.ts';

// HOS-1596 kit: 0139 and 0151 were already in origin/staging at the cut.
const cutMigrations = ['0139_serious_vampiro.sql', '0151_b58_payment_schema.sql'] as const;
const pieceMigrations = [
    '0216_hos1593_addon_domain_event.sql',
    '0217_hos1595_addon_version_publication.sql'
] as const;

function migration(name: string): string {
    return readFileSync(path.join(process.cwd(), 'src/migrations', name), 'utf8');
}

afterAll(closeTestPool);

describe('TEST:B10:11 AC:B10:9 the addon branch has no destructive migration', () => {
    it('the addon model, the identity UNIQUE and the payment column come from cut migrations', async () => {
        const pool = getTestPool();
        const tables = await pool.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = ANY($1)`,
            [['addon_product', 'addon_instance']]
        );
        expect(tables.rows.map((row) => row.table_name).sort()).toEqual([
            'addon_instance',
            'addon_product'
        ]);
        const columns = await pool.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'payment'
               AND column_name = 'addon_instance_id'`
        );
        expect(columns.rows.map((row) => row.column_name)).toEqual(['addon_instance_id']);
        const indexes = await pool.query<{ indexname: string }>(
            `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
               AND tablename = 'addon_instance'
               AND indexname = 'uq_addon_instance_purchase_identity'`
        );
        expect(indexes.rows.map((row) => row.indexname)).toEqual([
            'uq_addon_instance_purchase_identity'
        ]);
        const checks = await pool.query<{ conname: string; definition: string }>(
            `SELECT conname, pg_get_constraintdef(oid) AS definition
             FROM pg_constraint WHERE conrelid = 'payment'::regclass
               AND conname = 'ck_payment_one_subject'`
        );
        expect(checks.rows).toEqual([
            {
                conname: 'ck_payment_one_subject',
                definition: expect.stringMatching(/subscription_id.*addon_instance_id/)
            }
        ]);

        const owners = {
            'addon_product table': cutMigrations.filter((name) =>
                /CREATE TABLE "addon_product"/.test(migration(name))
            ),
            'addon_instance table': cutMigrations.filter((name) =>
                /CREATE TABLE "addon_instance"/.test(migration(name))
            ),
            'purchase identity UNIQUE': cutMigrations.filter((name) =>
                /CREATE UNIQUE INDEX "uq_addon_instance_purchase_identity"/.test(migration(name))
            ),
            'payment addon column': cutMigrations.filter((name) =>
                /"addon_instance_id" uuid/.test(migration(name))
            ),
            'payment subject CHECK': cutMigrations.filter((name) =>
                /CONSTRAINT "ck_payment_one_subject" CHECK/.test(migration(name))
            )
        };
        expect(owners).toEqual({
            'addon_product table': ['0139_serious_vampiro.sql'],
            'addon_instance table': ['0139_serious_vampiro.sql'],
            'purchase identity UNIQUE': ['0139_serious_vampiro.sql'],
            'payment addon column': ['0151_b58_payment_schema.sql'],
            'payment subject CHECK': ['0151_b58_payment_schema.sql']
        });
    });

    it("the piece's own migrations are additive", async () => {
        for (const name of pieceMigrations)
            expect(findDestructiveStatements({ file: name, sql: migration(name) })).toEqual([]);
        const pool = getTestPool();
        const indexes = await pool.query<{ indexname: string }>(
            `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
               AND tablename = 'addon_instance'
               AND indexname = 'uq_addon_instance_free_choice'`
        );
        expect(indexes.rows.map((row) => row.indexname)).toEqual(['uq_addon_instance_free_choice']);
        const eventCheck = await pool.query<{ definition: string }>(
            `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
             WHERE conrelid = 'domain_event'::regclass
               AND conname = 'domain_event_event_type_check'`
        );
        expect(eventCheck.rows).toEqual([
            {
                definition: expect.stringMatching(
                    /addon_instance\.status_changed.*addon_product\.version_published/
                )
            }
        ]);
        const permission = await pool.query<{ enumlabel: string }>(
            `SELECT enumlabel FROM pg_enum
             WHERE enumtypid = 'permission_enum'::regtype
               AND enumlabel = 'billing.publishAddonVersion'`
        );
        expect(permission.rows.map((row) => row.enumlabel)).toEqual([
            'billing.publishAddonVersion'
        ]);
        expect(migration(pieceMigrations[0])).toContain('addon_instance.status_changed');
        expect(migration(pieceMigrations[1])).toContain('addon_product.version_published');
        expect(migration(pieceMigrations[1])).toContain('billing.publishAddonVersion');
    });
});
