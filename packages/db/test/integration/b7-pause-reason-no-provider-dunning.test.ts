import { SUBSCRIPTION_PAUSE_REASONS } from '@repo/db';
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

interface DbError {
    readonly code?: string;
    readonly constraint?: string;
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

describe('HOS-1559 TEST:B7:15 (mitad) AC:B7:9 — pause reason is closed', () => {
    it('rejects PROVIDER_DUNNING on a migrated-from-empty schema', async () => {
        expect(SUBSCRIPTION_PAUSE_REASONS).toEqual(['CUSTOMER_REQUEST', 'COURTESY']);
        await withRollback(async (client) => {
            const subscription = await client.query<{ id: string }>(
                "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id"
            );
            const subscriptionId = subscription.rows[0]?.id;
            if (!subscriptionId) throw new Error('Could not seed pause-reason subject');
            await expect(
                client.query(
                    'INSERT INTO subscription_pause (subscription_id, reason, starts_at, actual_end_at) VALUES ($1, $2, $3, $4)',
                    [subscriptionId, 'PROVIDER_DUNNING', '2026-10-01T00:00:00Z', null]
                )
            ).rejects.toMatchObject({
                code: '23514',
                constraint: 'ck_subscription_pause_reason'
            } satisfies Partial<DbError>);
        });
    });
});
