// TEST:V2:2 (HOS-1434, piece V2, AC:V2:1): nothing is added to a version
// published by another transaction, even when this transaction has written the
// version's row since (an UPDATE of `current`). Regression for the xmin bypass:
// extras 041 used to decide "created by this transaction" from the parent's
// `xmin`, which names the transaction that wrote the CURRENT tuple, so any
// UPDATE of the published version made it look freshly created.
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

/** The transaction-local setting extras 041 records created versions in. */
const CREATED_VERSIONS_SETTING = 'hospeda.catalog_versions_created_in_xact';

/** The database error a statement raised, or `null` when it succeeded. */
interface DbError {
    readonly code?: string;
    readonly message?: string;
}

type Attempt = (sqlText: string, params?: unknown[]) => Promise<DbError | null>;

/** Runs one statement under a savepoint and returns its error, or `null`. */
const attemptOn =
    (client: PoolClient): Attempt =>
    async (sqlText, params = []) => {
        await client.query('SAVEPOINT attempt');
        try {
            await client.query(sqlText, params);
            await client.query('RELEASE SAVEPOINT attempt');
            return null;
        } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT attempt');
            return error as DbError;
        }
    };

/** Runs `body` inside a transaction that is always rolled back. */
async function inRolledBackTx(
    body: (args: { readonly client: PoolClient; readonly attempt: Attempt }) => Promise<void>
): Promise<void> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await body({ client, attempt: attemptOn(client) });
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

/** A slug no other case uses, so committed rows never collide. */
const uniqueSlug = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random()}`;

/**
 * Inserts a plan and one version of it; returns the version id. The version is
 * not sellable, so the committed ones never hold a rank another case needs.
 */
async function insertPlanVersion(
    client: PoolClient,
    args: { readonly current: boolean }
): Promise<string> {
    const plan = await client.query<{ id: string }>(
        `INSERT INTO plan (vertical, slug, name) VALUES ('accommodation', $1, 'Plan') RETURNING id`,
        [uniqueSlug('plan')]
    );
    const version = await client.query<{ id: string }>(
        `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
         VALUES ($1, 'accommodation', 10, false, $2, 14, true) RETURNING id`,
        [(plan.rows[0] as { id: string }).id, args.current]
    );
    return (version.rows[0] as { id: string }).id;
}

/** Inserts an addon and one version of it; returns the version id. */
async function insertAddonVersion(client: PoolClient): Promise<string> {
    const addon = await client.query<{ id: string }>(
        `INSERT INTO addon (slug, name) VALUES ($1, 'Fotos') RETURNING id`,
        [uniqueSlug('addon')]
    );
    const version = await client.query<{ id: string }>(
        `INSERT INTO addon_version (addon_id, validity, scope_type)
         VALUES ($1, 'WHILE_SUBSCRIPTION_ALIVE', 'USER') RETURNING id`,
        [(addon.rows[0] as { id: string }).id]
    );
    return (version.rows[0] as { id: string }).id;
}

/** Commits a plan version (current) and an addon version in their own transaction. */
async function commitPublishedVersions(): Promise<{
    readonly planVersionId: string;
    readonly addonVersionId: string;
}> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        const planVersionId = await insertPlanVersion(client, { current: true });
        const addonVersionId = await insertAddonVersion(client);
        await client.query('COMMIT');
        return { planVersionId, addonVersionId };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

const INSERT_PLAN_ENTITLEMENT = `INSERT INTO plan_version_entitlement (plan_version_id, key)
    VALUES ($1, 'respond_reviews')`;
const INSERT_PLAN_LIMIT = `INSERT INTO plan_version_limit (plan_version_id, key, value)
    VALUES ($1, 'max_photos_per_accommodation', 99)`;
const INSERT_ADDON_ENTITLEMENT = `INSERT INTO addon_version_entitlement (addon_version_id, key)
    VALUES ($1, 'featured_listing')`;
const INSERT_ADDON_LIMIT = `INSERT INTO addon_version_limit (addon_version_id, key, value)
    VALUES ($1, 'max_photos_per_accommodation', 99)`;

/** The ids the current transaction has recorded as created by it. */
async function createdVersions(client: PoolClient): Promise<readonly string[]> {
    const { rows } = await client.query<{ value: string | null }>(
        'SELECT current_setting($1, true) AS value',
        [CREATED_VERSIONS_SETTING]
    );
    const value = rows[0]?.value ?? '';
    return value === '' ? [] : value.split(',');
}

describe('TEST:V2:2 — writing a published version does not reopen it to new grants', () => {
    it.each([
        ['flipping current', 'UPDATE plan_version SET current = NOT current WHERE id = $1'],
        ['a no-op SET current = current', 'UPDATE plan_version SET current = current WHERE id = $1']
    ])('after %s, a child row under the published plan version is rejected', async (_label, update) => {
        const { planVersionId } = await commitPublishedVersions();

        await inRolledBackTx(async ({ client, attempt }) => {
            await client.query(update, [planVersionId]);

            const errors = [
                await attempt(INSERT_PLAN_ENTITLEMENT, [planVersionId]),
                await attempt(INSERT_PLAN_LIMIT, [planVersionId])
            ];

            expect(errors.map((e) => e?.code)).toEqual(['P0001', 'P0001']);
            expect(errors[0]?.message).toContain('published by another transaction');
        });
    });

    it('after the published addon version is rewritten, a child row under it is rejected', async () => {
        const { addonVersionId } = await commitPublishedVersions();

        await inRolledBackTx(async ({ client, attempt }) => {
            // addon_version rejects every UPDATE today; lift that (rolled back with
            // the transaction) to prove the child guard does not lean on it.
            await client.query(
                'ALTER TABLE addon_version DISABLE TRIGGER trg_addon_version_immutable'
            );
            await client.query('UPDATE addon_version SET validity = validity WHERE id = $1', [
                addonVersionId
            ]);

            const errors = [
                await attempt(INSERT_ADDON_ENTITLEMENT, [addonVersionId]),
                await attempt(INSERT_ADDON_LIMIT, [addonVersionId])
            ];

            expect(errors.map((e) => e?.code)).toEqual(['P0001', 'P0001']);
        });
    });

    it('a version created in an earlier transaction on the same connection is published', async () => {
        const client = await getTestPool().connect();
        try {
            await client.query('BEGIN');
            const planVersionId = await insertPlanVersion(client, { current: false });
            await client.query('COMMIT');

            await client.query('BEGIN');
            const error = await attemptOn(client)(INSERT_PLAN_LIMIT, [planVersionId]);
            await client.query('ROLLBACK');

            expect(error?.code).toBe('P0001');
        } finally {
            client.release();
        }
    });
});

describe('TEST:V2:2 — a version and its grants written in one transaction, under savepoints', () => {
    it('a version created inside a savepoint takes its rows inside it and after its release', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            await client.query('SAVEPOINT outer_sp');
            const planVersionId = await insertPlanVersion(client, { current: true });
            const addonVersionId = await insertAddonVersion(client);
            const inside = [
                await attempt(INSERT_PLAN_ENTITLEMENT, [planVersionId]),
                await attempt(INSERT_ADDON_ENTITLEMENT, [addonVersionId])
            ];
            await client.query('RELEASE SAVEPOINT outer_sp');
            const after = [
                await attempt(INSERT_PLAN_LIMIT, [planVersionId]),
                await attempt(INSERT_ADDON_LIMIT, [addonVersionId])
            ];

            expect(inside).toEqual([null, null]);
            expect(after).toEqual([null, null]);
        });
    });

    it('a savepoint rolled back forgets the versions it created, and only those', async () => {
        await inRolledBackTx(async ({ client }) => {
            const kept = await insertPlanVersion(client, { current: true });
            await client.query('SAVEPOINT doomed');
            const discardedPlan = await insertPlanVersion(client, { current: true });
            const discardedAddon = await insertAddonVersion(client);
            const whileOpen = await createdVersions(client);
            await client.query('ROLLBACK TO SAVEPOINT doomed');
            const afterRollback = await createdVersions(client);

            expect(whileOpen).toEqual([kept, discardedPlan, discardedAddon]);
            expect(afterRollback).toEqual([kept]);
        });
    });

    it('the record of created versions does not survive the transaction', async () => {
        const client = await getTestPool().connect();
        try {
            await client.query('BEGIN');
            await insertPlanVersion(client, { current: true });
            await client.query('ROLLBACK');
            await client.query('BEGIN');
            const next = await createdVersions(client);
            await client.query('ROLLBACK');

            expect(next).toEqual([]);
        } finally {
            client.release();
        }
    });
});
