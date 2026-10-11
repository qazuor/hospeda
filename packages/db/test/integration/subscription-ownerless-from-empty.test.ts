import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

interface DbError {
    readonly code?: string;
    readonly constraint?: string;
}

/** Runs checks against the migrated schema and rolls every fixture back. */
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

/** Captures a rejected statement in a savepoint so the outer fixture stays usable. */
async function rejected(
    client: PoolClient,
    statement: string,
    params: unknown[] = []
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

/** Inserts a uniquely named test user and real principal anchors. */
async function fixtures(client: PoolClient) {
    const token = crypto.randomUUID();
    const user = await client.query<{ id: string }>(
        'INSERT INTO users (slug, email) VALUES ($1, $2) RETURNING id',
        [`ownerless-${token}`, `ownerless-${token}@example.test`]
    );
    const plan = await client.query<{ id: string }>(
        "INSERT INTO plan (vertical, slug, name) VALUES ('accommodation', $1, 'Ownerless test') RETURNING id",
        [`ownerless-${token}`]
    );
    const version = await client.query<{ id: string }>(
        `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
         VALUES ($1, 'accommodation', 1, true, true, 0, true) RETURNING id`,
        [plan.rows[0]?.id]
    );
    const option = await client.query<{ id: string }>(
        "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 1000, 'ARS') RETURNING id",
        [version.rows[0]?.id]
    );
    return {
        userId: user.rows[0]?.id as string,
        versionId: version.rows[0]?.id as string,
        optionId: option.rows[0]?.id as string
    };
}

const insert = `INSERT INTO subscription (user_id, vertical, payment_method, plan_version_id, billing_option_id, status, class)
    VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6) RETURNING id`;

describe('TEST:B11:19 — ownerless subscription from empty migrated schema', () => {
    it('rejects incomplete owners by constraint and accepts valid principal/complement rows', async () => {
        await withRollback(async (client) => {
            const f = await fixtures(client);
            const principal = [
                f.userId,
                'accommodation',
                'CARD',
                f.versionId,
                f.optionId,
                'PRINCIPAL'
            ];
            for (const values of [
                [null, 'accommodation', 'CARD', f.versionId, f.optionId, 'PRINCIPAL'],
                [f.userId, null, 'CARD', f.versionId, f.optionId, 'PRINCIPAL'],
                [f.userId, 'accommodation', null, f.versionId, f.optionId, 'PRINCIPAL'],
                [f.userId, 'accommodation', 'CARD', null, f.optionId, 'PRINCIPAL'],
                [f.userId, 'accommodation', 'CARD', f.versionId, null, 'PRINCIPAL'],
                [null, 'accommodation', 'CARD', null, null, 'COMPLEMENTO'],
                [f.userId, null, 'CARD', null, null, 'COMPLEMENTO'],
                [f.userId, 'accommodation', null, null, null, 'COMPLEMENTO']
            ]) {
                const error = await rejected(client, insert, values);
                expect(error?.constraint).toBe(
                    values[5] === 'PRINCIPAL' && (values[3] === null || values[4] === null)
                        ? 'ck_subscription_principal_anchor'
                        : 'ck_subscription_identity_not_null'
                );
            }
            const [acceptedPrincipal] = (await client.query(insert, principal)).rows;
            expect(acceptedPrincipal?.id).toBeTruthy();
            // DJ (owner 2026-10-08): COMPLEMENTO is exempt from plan version and billing option.
            const complement = await client.query(insert, [
                f.userId,
                'accommodation',
                'CARD',
                null,
                null,
                'COMPLEMENTO'
            ]);
            expect(complement.rows[0]?.id).toBeTruthy();
        });
    });

    it('accepts and identifies a receipt tombstone, and enforces its cancelled state', async () => {
        await withRollback(async (client) => {
            const tombstone = await client.query<{ id: string; class: string }>(
                "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id, class"
            );
            const found = await client.query<{ class: string }>(
                'SELECT class FROM subscription WHERE id = $1',
                [tombstone.rows[0]?.id]
            );
            expect(found.rows[0]?.class).toBe('LAPIDA');
            expect(
                (
                    await rejected(
                        client,
                        "INSERT INTO subscription (status, class) VALUES ('ACTIVE', 'LAPIDA')"
                    )
                )?.constraint
            ).toBe('ck_subscription_tombstone_cancelled');
        });
    });

    it('has no tombstone-origin column or similarly named subscription constraint', async () => {
        const names = [
            'origen_de_lapida',
            'origen_de_lápida',
            'tombstone_origin',
            'origin_of_tombstone'
        ];
        const columns = await getTestPool().query<{ column_name: string }>(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscription' AND column_name = ANY($1)",
            [names]
        );
        const constraints = await getTestPool().query<{ conname: string }>(
            "SELECT conname FROM pg_constraint WHERE conrelid = 'subscription'::regclass AND conname = ANY($1)",
            [names]
        );
        expect(columns.rows.map((row) => row.column_name)).toEqual([]);
        expect(constraints.rows.map((row) => row.conname)).toEqual([]);
    });
});
