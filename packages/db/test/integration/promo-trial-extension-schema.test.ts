import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

interface DbError {
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

async function createUser(client: PoolClient): Promise<string> {
    const id = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        id,
        `promo-extension-${id}`,
        `promo-extension-${id}@example.test`
    ]);
    return id;
}

const insertPromo = `INSERT INTO promo_code
    (code, effect_kind, extension_days, discount_kind, value, all_verticals, total_quota,
     valid_from, valid_until, stackable, usable_with_another_active, duration_kind)
    VALUES ($1, $2, $3, $4, $5, true, 1, now(), now() + interval '1 day', false, false, $6)
    RETURNING id`;

describe('TEST:B9b:6 AC:B9b:6 promo code trial extension schema', () => {
    it('enforces effect-specific code shapes and permits only unlimited unlinked redemptions', async () => {
        await withRollback(async (client) => {
            const userId = await createUser(client);
            const extension = await client.query<{ id: string }>(insertPromo, [
                `trial-${crypto.randomUUID()}`,
                'TRIAL_EXTENSION',
                7,
                null,
                null,
                null
            ]);
            expect(extension.rows[0]?.id).toBeDefined();

            const invalidShapes: ReadonlyArray<readonly [string, unknown[], string]> = [
                [
                    'trial extension with discount kind',
                    [`bad-kind-${crypto.randomUUID()}`, 'TRIAL_EXTENSION', 7, 'FIXED', null, null],
                    'ck_promo_code_effect_shape'
                ],
                [
                    'trial extension with zero days',
                    [`bad-zero-${crypto.randomUUID()}`, 'TRIAL_EXTENSION', 0, null, null, null],
                    'ck_promo_code_effect_shape'
                ],
                [
                    'trial extension with null days',
                    [`bad-days-${crypto.randomUUID()}`, 'TRIAL_EXTENSION', null, null, null, null],
                    'ck_promo_code_effect_shape'
                ],
                [
                    'discount with extension days',
                    [`bad-discount-${crypto.randomUUID()}`, 'DISCOUNT', 7, 'FIXED', 10, 'FOREVER'],
                    'ck_promo_code_effect_shape'
                ]
            ];
            for (const [label, params, constraint] of invalidShapes) {
                const error = await rejected(client, insertPromo, [...params]);
                expect(error, label).not.toBeNull();
                expect(error?.constraint, label).toBe(constraint);
            }

            const legacy = await client.query<{ effect_kind: string }>(
                `INSERT INTO promo_code
                    (code, discount_kind, value, all_verticals, total_quota, valid_from,
                     valid_until, stackable, usable_with_another_active, duration_kind)
                 VALUES ($1, 'FIXED', 10, true, 1, now(), now() + interval '1 day', false, false, 'FOREVER')
                 RETURNING effect_kind`,
                [`legacy-${crypto.randomUUID()}`]
            );
            expect(legacy.rows[0]?.effect_kind).toBe('DISCOUNT');
            const promoCodeId = extension.rows[0]?.id;
            expect(promoCodeId).toBeDefined();

            await client.query(
                `INSERT INTO promo_redemption (promo_code_id, user_id, redeemed_at, subscription_id, remaining_charges)
                 VALUES ($1, $2, now(), NULL, NULL)`,
                [promoCodeId, userId]
            );
            const otherUserId = await createUser(client);
            expect(
                (
                    await rejected(
                        client,
                        `INSERT INTO promo_redemption (promo_code_id, user_id, redeemed_at, subscription_id, remaining_charges)
                         VALUES ($1, $2, now(), NULL, 2)`,
                        [promoCodeId, otherUserId]
                    )
                )?.constraint
            ).toBe('ck_promo_redemption_subscription_or_unlimited');
        });
    });
});
