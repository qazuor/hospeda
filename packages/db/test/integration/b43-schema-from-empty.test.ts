// DEC-ARCH-017📌12 «Tests mínimos: migración desde cero» (HOS-1534, B4.3): the 0162 migration
// creates provider_link.cancelled_seen_at, subscription_pause and coverage_loss with their
// constraints on an empty database. Every row is written inside a transaction that rolls back.
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

interface DbError {
    code?: string;
    constraint?: string;
}

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

async function seedUser(client: PoolClient): Promise<string> {
    const userId = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        userId,
        `b43-${userId}`,
        `b43-${userId}@example.test`
    ]);
    return userId;
}

async function seedTombstone(client: PoolClient): Promise<string> {
    const result = await client.query<{ id: string }>(
        "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id"
    );
    return result.rows[0]?.id as string;
}

const insertPause = `INSERT INTO subscription_pause (subscription_id, reason, starts_at, actual_end_at)
VALUES ($1, $2, $3, $4)`;
const insertLoss = `INSERT INTO coverage_loss (user_id, vertical, lost_at) VALUES ($1, $2, now())`;

describe('B4.3 schema migration from empty (DEC-ARCH-017📌12)', () => {
    it('adds a nullable provider_link.cancelled_seen_at timestamptz', async () => {
        const result = await getTestPool().query<{
            data_type: string;
            is_nullable: string;
        }>(
            "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'provider_link' AND column_name = 'cancelled_seen_at'"
        );
        expect(result.rows).toEqual([
            { data_type: 'timestamp with time zone', is_nullable: 'YES' }
        ]);
        await withRollback(async (client) => {
            const subscriptionId = await seedTombstone(client);
            const link = await client.query<{ cancelled_seen_at: Date | null }>(
                "INSERT INTO provider_link (subscription_id, provider, provider_id) VALUES ($1, 'MERCADO_PAGO', $2) RETURNING cancelled_seen_at",
                [subscriptionId, `b43-${crypto.randomUUID()}`]
            );
            expect(link.rows).toEqual([{ cancelled_seen_at: null }]);
        });
    });

    it('subscription_pause rejects a reason outside CUSTOMER_REQUEST and COURTESY', async () => {
        await withRollback(async (client) => {
            const subscriptionId = await seedTombstone(client);
            const error = await rejected(client, insertPause, [
                subscriptionId,
                'OWNER_WHIM',
                '2026-10-01T00:00:00Z',
                null
            ]);
            expect(error).toMatchObject({
                code: '23514',
                constraint: 'ck_subscription_pause_reason'
            });
        });
    });

    it('subscription_pause rejects an end before its start', async () => {
        await withRollback(async (client) => {
            const subscriptionId = await seedTombstone(client);
            const error = await rejected(client, insertPause, [
                subscriptionId,
                'COURTESY',
                '2026-10-01T00:00:00Z',
                '2026-09-01T00:00:00Z'
            ]);
            expect(error).toMatchObject({
                code: '23514',
                constraint: 'ck_subscription_pause_actual_end'
            });
        });
    });

    it('subscription_pause accepts two closed pauses and one open, and rejects a second open one', async () => {
        await withRollback(async (client) => {
            const subscriptionId = await seedTombstone(client);
            await client.query(insertPause, [
                subscriptionId,
                'CUSTOMER_REQUEST',
                '2026-01-01T00:00:00Z',
                '2026-02-01T00:00:00Z'
            ]);
            await client.query(insertPause, [
                subscriptionId,
                'COURTESY',
                '2026-03-01T00:00:00Z',
                '2026-04-01T00:00:00Z'
            ]);
            await client.query(insertPause, [
                subscriptionId,
                'CUSTOMER_REQUEST',
                '2026-05-01T00:00:00Z',
                null
            ]);
            const error = await rejected(client, insertPause, [
                subscriptionId,
                'COURTESY',
                '2026-06-01T00:00:00Z',
                null
            ]);
            expect(error).toMatchObject({
                code: '23505',
                constraint: 'uq_subscription_pause_open'
            });
            const rows = await client.query<{ open: boolean; count: number }>(
                'SELECT actual_end_at IS NULL AS open, count(*)::int AS count FROM subscription_pause WHERE subscription_id = $1 GROUP BY 1 ORDER BY 1',
                [subscriptionId]
            );
            expect(rows.rows).toEqual([
                { open: false, count: 2 },
                { open: true, count: 1 }
            ]);
        });
    });

    it('coverage_loss rejects a duplicate (user_id, vertical) and an unknown vertical', async () => {
        await withRollback(async (client) => {
            const userId = await seedUser(client);
            await client.query(insertLoss, [userId, 'accommodation']);
            const duplicate = await rejected(client, insertLoss, [userId, 'accommodation']);
            expect(duplicate).toMatchObject({ code: '23505', constraint: 'pk_coverage_loss' });
            const unknownVertical = await rejected(client, insertLoss, [
                userId,
                'no-such-vertical'
            ]);
            expect(unknownVertical).toMatchObject({
                code: '23503',
                constraint: 'coverage_loss_vertical_vertical_id_fk'
            });
            const rows = await client.query<{ vertical: string }>(
                'SELECT vertical FROM coverage_loss WHERE user_id = $1',
                [userId]
            );
            expect(rows.rows).toEqual([{ vertical: 'accommodation' }]);
        });
    });
});
