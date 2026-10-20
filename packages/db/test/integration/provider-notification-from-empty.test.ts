import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PROVIDER_NOTIFICATION_CHANNELS } from '../../src/schemas/vertical/provider-notification.dbschema.ts';
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

describe('TEST:B3:21 and TEST:B3:38 — provider notification schema from empty', () => {
    it('TEST:B3:21 a: creates the delivery columns with the required nullability', async () => {
        const columns = await getTestPool().query<{ column_name: string; is_nullable: string }>(
            "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'provider_notification' ORDER BY ordinal_position"
        );
        expect(
            Object.fromEntries(columns.rows.map((row) => [row.column_name, row.is_nullable]))
        ).toEqual({
            id: 'NO',
            channel: 'NO',
            url: 'NO',
            body: 'NO',
            received_at: 'NO'
        });
        expect(columns.rows.map((row) => row.column_name)).not.toContain('deleted_at');
        expect(columns.rows.map((row) => row.column_name)).not.toContain('updated_at');
    });

    it('TEST:B3:21 b: has no unique constraint or unique index beyond the primary key', async () => {
        const constraints = await getTestPool().query(
            "SELECT 1 FROM pg_constraint WHERE conrelid = 'provider_notification'::regclass AND contype = 'u'"
        );
        expect(constraints.rows).toHaveLength(0);
        const indexes = await getTestPool().query<{ indisprimary: boolean }>(
            `SELECT i.indisprimary FROM pg_index i
             WHERE i.indrelid = 'provider_notification'::regclass AND i.indisunique`
        );
        expect(indexes.rows.filter((row) => !row.indisprimary)).toHaveLength(0);
        expect(indexes.rows.filter((row) => row.indisprimary)).toHaveLength(1);
    });

    it('TEST:B3:21 c: stores duplicate deliveries as separate rows', async () => {
        await withRollback(async (client) => {
            const url = `https://example.test/notice?duplicate=${crypto.randomUUID()}`;
            const statement =
                "INSERT INTO provider_notification (channel, url, body, received_at) VALUES ('WEBHOOKS', $1, '', now())";
            await client.query(statement, [url]);
            await client.query(statement, [url]);
            const rows = await client.query('SELECT id FROM provider_notification WHERE url = $1', [
                url
            ]);
            expect(rows.rows).toHaveLength(2);
        });
    });

    it('TEST:B3:21 d: enforces the closed channel list and accepts an empty body', async () => {
        await withRollback(async (client) => {
            const rejectedChannel = await rejected(
                client,
                "INSERT INTO provider_notification (channel, url, body) VALUES ('OTHER', $1, '')",
                [`https://example.test/notice?invalid=${crypto.randomUUID()}`]
            );
            expect(rejectedChannel?.code).toBe('23514');
            expect(rejectedChannel?.constraint).toBe('ck_provider_notification_channel');
            for (const channel of PROVIDER_NOTIFICATION_CHANNELS) {
                await client.query(
                    'INSERT INTO provider_notification (channel, url, body) VALUES ($1, $2, $3)',
                    [channel, `https://example.test/notice?valid=${crypto.randomUUID()}`, '']
                );
            }
        });
    });

    it('TEST:B3:21 e: has no foreign keys', async () => {
        const constraints = await getTestPool().query(
            "SELECT 1 FROM pg_constraint WHERE conrelid = 'provider_notification'::regclass AND contype = 'f'"
        );
        expect(constraints.rows).toHaveLength(0);
    });

    it('TEST:B3:38: creates no ipn_delivery table', async () => {
        const result = await getTestPool().query<{ table_name: string | null }>(
            'SELECT to_regclass($1)::text AS table_name',
            ['ipn_delivery']
        );
        expect(result.rows[0]?.table_name).toBeNull();
    });
});
