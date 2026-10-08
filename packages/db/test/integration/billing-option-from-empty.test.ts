import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

interface DbError {
    readonly code?: string;
    readonly constraint?: string;
}

/** Exercise a migrated database and roll back every fixture. */
async function withRollback(body: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await body(client);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

/** Capture one expected SQL rejection without aborting the enclosing transaction. */
async function rejected(
    client: PoolClient,
    statement: string,
    params: unknown[]
): Promise<DbError | null> {
    await client.query('SAVEPOINT expected_rejection');
    try {
        await client.query(statement, params);
        return null;
    } catch (error) {
        return error as DbError;
    } finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    }
}

/** Create two versions of one plan for the billing option checks. */
async function versions(client: PoolClient): Promise<[string, string]> {
    const slug = `billing-option-${crypto.randomUUID()}`;
    const plan = await client.query<{ id: string }>(
        `INSERT INTO plan (vertical, slug, name) VALUES ('accommodation', $1, 'Billing test') RETURNING id`,
        [slug]
    );
    const planId = (plan.rows[0] as { id: string }).id;
    const ids: string[] = [];
    for (const current of [false, true]) {
        const result = await client.query<{ id: string }>(
            `INSERT INTO plan_version
             (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
             VALUES ($1, 'accommodation', 1, true, $2, 0, true) RETURNING id`,
            [planId, current]
        );
        ids.push((result.rows[0] as { id: string }).id);
    }
    return ids as [string, string];
}

const INSERT_OPTION = `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
    VALUES ($1, $2, $3, $4) RETURNING id`;

describe('TEST:B2:1 — billing_option after db:migrate from empty', () => {
    it('has integer amount, currency and the two composite unique constraints', async () => {
        const columns = await getTestPool().query<{
            column_name: string;
            data_type: string;
            is_nullable: string;
        }>(
            `SELECT column_name, data_type, is_nullable FROM information_schema.columns
             WHERE table_name = 'billing_option'`
        );
        const byName = Object.fromEntries(columns.rows.map((row) => [row.column_name, row]));
        expect(byName.amount).toMatchObject({ data_type: 'integer', is_nullable: 'NO' });
        expect(byName.currency).toMatchObject({
            data_type: 'character varying',
            is_nullable: 'NO'
        });
        expect(byName.plan_version_id?.is_nullable).toBe('NO');

        const constraints = await getTestPool().query<{ conname: string; definition: string }>(
            `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
             WHERE conrelid = 'billing_option'::regclass`
        );
        const byConstraint = Object.fromEntries(
            constraints.rows.map((row) => [row.conname, row.definition])
        );
        expect(byConstraint.uq_billing_option_version_cycle).toBe(
            'UNIQUE (plan_version_id, cycle)'
        );
        expect(byConstraint.uq_billing_option_id_version).toBe('UNIQUE (id, plan_version_id)');
        expect(byConstraint.billing_option_plan_version_id_plan_version_id_fk).toBe(
            'FOREIGN KEY (plan_version_id) REFERENCES plan_version(id)'
        );
        expect(byConstraint.ck_billing_option_currency).toContain("currency)::text = 'ARS'");
    });
});

describe('TEST:B2:2 — database rejects invalid billing options', () => {
    it('rejects decimals, duplicate cycle within one version, and non-ARS currency', async () => {
        await withRollback(async (client) => {
            const [oldVersion, currentVersion] = await versions(client);
            await client.query(INSERT_OPTION, [oldVersion, 'monthly', 3000, 'ARS']);
            expect(
                (await rejected(client, INSERT_OPTION, [oldVersion, 'monthly', 3500, 'ARS']))
                    ?.constraint
            ).toBe('uq_billing_option_version_cycle');
            expect(
                (await rejected(client, INSERT_OPTION, [oldVersion, 'annual', 3000.5, 'ARS']))?.code
            ).toBe('22P02');
            expect(
                (await rejected(client, INSERT_OPTION, [oldVersion, 'annual', 3000, 'USD']))
                    ?.constraint
            ).toBe('ck_billing_option_currency');
            const otherVersion = await client.query(INSERT_OPTION, [
                currentVersion,
                'monthly',
                4500,
                'ARS'
            ]);
            expect(otherVersion.rows).toHaveLength(1);
        });
    });
});
