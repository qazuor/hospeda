import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

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

/** Inserts a user, an UNA_VEZ product and its version; returns what an instance needs. */
async function oneTimeProduct(
    client: PoolClient
): Promise<{ readonly userId: string; readonly productId: string; readonly versionId: string }> {
    const userId = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        userId,
        `hos2179-${userId}`,
        `hos2179-${userId}@example.test`
    ]);
    const addon = await client.query<{ id: string }>(
        "INSERT INTO addon (slug, name) VALUES ($1, 'HOS-2179 page addon') RETURNING id",
        [`hos2179-${crypto.randomUUID()}`]
    );
    const version = await client.query<{ id: string }>(
        "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, 'FIXED_DAYS', 7, 'USER') RETURNING id",
        [addon.rows[0]!.id]
    );
    const product = await client.query<{ id: string }>(
        "INSERT INTO addon_product (version_id, addon_id, price, currency, charge_kind, compatible_verticals) VALUES ($1, $2, 100, 'ARS', 'UNA_VEZ', ARRAY['accommodation']) RETURNING id",
        [version.rows[0]!.id, addon.rows[0]!.id]
    );
    return { userId, productId: product.rows[0]!.id, versionId: version.rows[0]!.id };
}

const INSERT_INSTANCE =
    "INSERT INTO addon_instance (product_id, addon_version_id, owner_id, status, payment_page_id, payment_page_expires_at) VALUES ($1, $2, $3, 'EXPIRED', $4, $5) RETURNING id";

/** HOS-2179 §7.1: the one-time payment page columns and the key operation, additive. */
describe('HOS-2179 T-2 payment page columns', () => {
    it('stores a page id with its expiry, and an instance with neither', async () => {
        await withRollback(async (client) => {
            // Arrange
            const p = await oneTimeProduct(client);

            // Act
            const withPage = await client.query<{ id: string }>(INSERT_INSTANCE, [
                p.productId,
                p.versionId,
                p.userId,
                'PAGE-1',
                '2026-11-19T13:00:00.000Z'
            ]);
            await client.query(INSERT_INSTANCE, [p.productId, p.versionId, p.userId, null, null]);

            // Assert
            const read = await client.query<{
                payment_page_id: string;
                payment_page_expires_at: Date;
            }>(
                'SELECT payment_page_id, payment_page_expires_at FROM addon_instance WHERE id = $1',
                [withPage.rows[0]!.id]
            );
            expect(read.rows[0]?.payment_page_id).toBe('PAGE-1');
            expect(read.rows[0]?.payment_page_expires_at.toISOString()).toBe(
                '2026-11-19T13:00:00.000Z'
            );
        });
    });

    it.each([
        ['an id without expiry', 'PAGE-2', null],
        ['an expiry without id', null, '2026-11-19T13:00:00.000Z']
    ])('refuses %s', async (_, pageId, expiresAt) => {
        await withRollback(async (client) => {
            const p = await oneTimeProduct(client);
            await expect(
                client.query(INSERT_INSTANCE, [
                    p.productId,
                    p.versionId,
                    p.userId,
                    pageId,
                    expiresAt
                ])
            ).rejects.toThrow('ck_addon_instance_payment_page_pair');
        });
    });

    it('refuses a page id used by a second instance', async () => {
        await withRollback(async (client) => {
            const p = await oneTimeProduct(client);
            const row = [p.productId, p.versionId, p.userId, 'PAGE-3', '2026-11-19T13:00:00Z'];
            await client.query(INSERT_INSTANCE, row);
            await expect(client.query(INSERT_INSTANCE, row)).rejects.toThrow(
                'uq_addon_instance_payment_page'
            );
        });
    });

    it('accepts the PAYMENT_PAGE_CREATE key operation and still refuses an unknown one', async () => {
        await withRollback(async (client) => {
            const insert =
                'INSERT INTO idempotency_key (key, operation, subject_id) VALUES ($1, $2, $3)';
            await client.query(insert, [
                `page:${crypto.randomUUID()}`,
                'PAYMENT_PAGE_CREATE',
                crypto.randomUUID()
            ]);
            await expect(
                client.query(insert, [crypto.randomUUID(), 'CHECKOUT_CREATE', crypto.randomUUID()])
            ).rejects.toThrow('ck_idempotency_key_operation');
        });
    });

    it('lets an admin change PLAZO 21 and still refuses 22', async () => {
        await withRollback(async (client) => {
            const insert =
                'INSERT INTO billing_deadline_version (version, "values", changed_key) SELECT max(version) + 1, (array_agg("values" ORDER BY version DESC))[1], $1 FROM billing_deadline_version';
            await client.query(insert, [21]);
            await expect(client.query(insert, [22])).rejects.toThrow(
                'ck_billing_deadline_changed_key_range'
            );
        });
    });
});
