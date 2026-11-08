import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

const columns: Readonly<Record<string, readonly string[]>> = {
    promo_code: [
        'id',
        'code',
        'effect_kind',
        'extension_days',
        'discount_kind',
        'value',
        'all_verticals',
        'verticals',
        'total_quota',
        'valid_from',
        'valid_until',
        'stackable',
        'usable_with_another_active',
        'duration_kind',
        'duration_charges',
        'closed_at',
        'closed_by',
        'created_at',
        'updated_at'
    ],
    promo_redemption: [
        'id',
        'promo_code_id',
        'user_id',
        'redeemed_at',
        'subscription_id',
        'remaining_charges'
    ],
    courtesy_grant: [
        'id',
        'beneficiary_user_id',
        'months',
        'starts_at',
        'ends_at',
        'granted_by',
        'reason',
        'subscription_id',
        'balance_months',
        'balance_closed_at',
        'close_reason',
        'created_at'
    ],
    subscription_pause: [
        'id',
        'subscription_id',
        'reason',
        'requested_months',
        'starts_at',
        'expected_end_at',
        'actual_end_at',
        'created_at'
    ]
};

const checks = [
    'ck_promo_code_effect_kind',
    'ck_promo_code_discount_kind',
    'ck_promo_code_value',
    'ck_promo_code_verticals',
    'ck_promo_code_total_quota',
    'ck_promo_code_window',
    'ck_promo_code_duration_kind',
    'ck_promo_code_duration_charges',
    'ck_promo_code_close_together',
    'ck_promo_code_effect_shape',
    'ck_promo_redemption_remaining_charges',
    'ck_promo_redemption_subscription_or_unlimited',
    'ck_courtesy_grant_months',
    'ck_courtesy_grant_balance_months',
    'ck_courtesy_grant_close_reason',
    'ck_courtesy_grant_balance_close'
] as const;

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

describe('TEST:B9b:11 — the promo and courtesy schema from empty (AC:B9b:11)', () => {
    it('creates all four tables with their declared columns', async () => {
        const result = await getTestPool().query<{ table_name: string; column_name: string }>(
            "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1)",
            [Object.keys(columns)]
        );
        for (const [table, names] of Object.entries(columns)) {
            expect(
                result.rows
                    .filter((row) => row.table_name === table)
                    .map((row) => row.column_name)
                    .sort()
            ).toEqual([...names].sort());
        }
    });

    it('creates the promo and courtesy CHECK constraints by name', async () => {
        const result = await getTestPool().query<{ conname: string; contype: string }>(
            'SELECT conname, contype FROM pg_constraint WHERE conname = ANY($1)',
            [checks]
        );
        for (const name of checks)
            expect(result.rows.find((row) => row.conname === name)?.contype).toBe('c');
    });

    it('rejects a redemption with negative remaining charges', async () => {
        await withRollback(async (client) => {
            // The promo and user are local fixture rows, removed by the outer rollback.
            const id = crypto.randomUUID();
            await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
                id,
                `b9b-${id}`,
                `b9b-${id}@example.test`
            ]);
            const code = await client.query<{ id: string }>(
                `INSERT INTO promo_code (code, effect_kind, discount_kind, value, all_verticals,
                    stackable, usable_with_another_active, duration_kind)
                 VALUES ($1, 'DISCOUNT', 'FIXED', 100, true, false, false, 'FOREVER') RETURNING id`,
                [`B9B-${id}`]
            );
            await client.query('SAVEPOINT negative_redemption');
            try {
                await client.query(
                    `INSERT INTO promo_redemption
                        (promo_code_id, user_id, redeemed_at, remaining_charges)
                     VALUES ($1, $2, now(), -1)`,
                    [code.rows[0]!.id, id]
                );
                throw new Error('negative remaining charges unexpectedly accepted');
            } catch (error) {
                expect(error).toMatchObject({
                    code: '23514',
                    constraint: 'ck_promo_redemption_remaining_charges'
                });
            } finally {
                await client.query('ROLLBACK TO SAVEPOINT negative_redemption');
            }
        });
    });
});
