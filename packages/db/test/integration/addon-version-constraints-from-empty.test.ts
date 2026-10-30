import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

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
): Promise<{ code?: string; constraint?: string } | null> {
    await client.query('SAVEPOINT expected_rejection');
    try {
        await client.query(statement, params);
        return null;
    } catch (error) {
        return error as { code?: string; constraint?: string };
    } finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    }
}

async function addon(client: PoolClient): Promise<string> {
    const result = await client.query<{ id: string }>(
        "INSERT INTO addon (slug, name) VALUES ($1, 'HOS-1651 addon') RETURNING id",
        [`hos1651-${crypto.randomUUID()}`]
    );
    return result.rows[0]!.id;
}

async function version(
    client: PoolClient,
    addonId: string,
    validity: 'FIXED_DAYS' | 'WHILE_SUBSCRIPTION_ALIVE'
): Promise<string> {
    const result = await client.query<{ id: string }>(
        "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, $2, $3, 'USER') RETURNING id",
        [addonId, validity, validity === 'FIXED_DAYS' ? 30 : null]
    );
    return result.rows[0]!.id;
}

const insertProduct = `INSERT INTO addon_product
    (version_id, addon_id, price, currency, charge_kind, cycle, compatible_verticals)
    VALUES ($1, $2, 100, 'ARS', $3, $4, ARRAY['accommodation']) RETURNING id`;

describe('HOS-1651 constraints after migration from empty', () => {
    it('TEST:HOS-1651:a:1 — rejects a version belonging to another addon on INSERT and repoint', async () => {
        await withRollback(async (client) => {
            const addonId = await addon(client);
            const otherAddonId = await addon(client);
            const ownVersionId = await version(client, addonId, 'FIXED_DAYS');
            const otherVersionId = await version(client, otherAddonId, 'FIXED_DAYS');

            const mismatch = await rejected(client, insertProduct, [
                otherVersionId,
                addonId,
                'UNA_VEZ',
                null
            ]);
            expect(mismatch?.code).toBe('23503');
            expect(mismatch?.constraint).toBe('fk_addon_product_version_addon');

            const product = await client.query<{ id: string }>(insertProduct, [
                ownVersionId,
                addonId,
                'UNA_VEZ',
                null
            ]);
            const repoint = await rejected(
                client,
                'UPDATE addon_product SET version_id = $1 WHERE id = $2',
                [otherVersionId, product.rows[0]!.id]
            );
            expect(repoint?.code).toBe('23503');
            expect(repoint?.constraint).toBe('fk_addon_product_version_addon');
        });
    });

    it('TEST:HOS-1651:b:1 — rejects PERIODICO + FIXED_DAYS on INSERT and both UPDATE paths', async () => {
        const trigger = await getTestPool().query<{ tgname: string }>(
            "SELECT tgname FROM pg_trigger WHERE tgrelid = 'addon_product'::regclass AND tgname = 'addon_product_periodic_fixed_days' AND NOT tgisinternal"
        );
        expect(trigger.rows).toHaveLength(1);

        await withRollback(async (client) => {
            const addonId = await addon(client);
            const fixedVersionId = await version(client, addonId, 'FIXED_DAYS');
            const aliveVersionId = await version(client, addonId, 'WHILE_SUBSCRIPTION_ALIVE');

            const invalidInsert = await rejected(client, insertProduct, [
                fixedVersionId,
                addonId,
                'PERIODICO',
                'monthly'
            ]);
            expect(invalidInsert?.code).toBe('23514');
            expect(invalidInsert?.constraint).toBe('ck_addon_product_periodic_not_fixed_days');

            const periodic = await client.query<{ id: string }>(insertProduct, [
                aliveVersionId,
                addonId,
                'PERIODICO',
                'monthly'
            ]);
            const invalidVersionUpdate = await rejected(
                client,
                'UPDATE addon_product SET version_id = $1 WHERE id = $2',
                [fixedVersionId, periodic.rows[0]!.id]
            );
            expect(invalidVersionUpdate?.code).toBe('23514');
            expect(invalidVersionUpdate?.constraint).toBe(
                'ck_addon_product_periodic_not_fixed_days'
            );

            const oneTime = await client.query<{ id: string }>(insertProduct, [
                fixedVersionId,
                addonId,
                'UNA_VEZ',
                null
            ]);
            const invalidChargeUpdate = await rejected(
                client,
                "UPDATE addon_product SET charge_kind = 'PERIODICO', cycle = 'monthly' WHERE id = $1",
                [oneTime.rows[0]!.id]
            );
            expect(invalidChargeUpdate?.code).toBe('23514');
            expect(invalidChargeUpdate?.constraint).toBe(
                'ck_addon_product_periodic_not_fixed_days'
            );
        });
    });
});
