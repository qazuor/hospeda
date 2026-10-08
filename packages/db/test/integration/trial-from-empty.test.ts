// TEST:V4:1, TEST:V4:2 and TEST:V4:4 (HOS-1443, piece V4.1): the `trial` and
// `canje_de_trial` tables after db:migrate and apply-extras on an empty
// disposable database.
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

/** The database error a statement raised, or `null` when it succeeded. */
interface DbError {
    readonly code?: string;
    readonly constraint?: string;
    readonly message?: string;
}

/**
 * Runs `body` inside a transaction that is always rolled back. `attempt` runs
 * one statement under a savepoint and returns its error (or `null`), so a
 * rejected statement does not abort the rest of the case.
 */
async function inRolledBackTx(
    body: (args: {
        readonly client: PoolClient;
        readonly attempt: (sqlText: string, params?: unknown[]) => Promise<DbError | null>;
    }) => Promise<void>
): Promise<void> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        const attempt = async (sqlText: string, params: unknown[] = []) => {
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
        await body({ client, attempt });
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

/** A stand-in pseudonym: 64 lowercase hex characters, like the real one. */
const pseudonymOf = (seed: string): string => createHash('sha256').update(seed).digest('hex');

let userCounter = 0;

/** Inserts a user and returns its id. */
async function insertUser(client: PoolClient): Promise<string> {
    userCounter += 1;
    const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (slug, display_name, email)
         VALUES ($1, 'Trial test', $2) RETURNING id`,
        [`trial-test-${userCounter}`, `trial-test-${userCounter}@local.test`]
    );
    return (rows[0] as { id: string }).id;
}

/** SQL of a trial row born consumed (`T6`/`T8`): no clock, no plan, no floor. */
const INSERT_CONSUMED = `INSERT INTO trial (user_id, vertical, status, email_pseudonym)
    VALUES ($1, $2, 'TRIAL_CONVERTED', $3) RETURNING id`;

/** The constraints of a table, by name, from the catalog. */
async function constraintsOf(table: string): Promise<Record<string, string>> {
    const { rows } = await getTestPool().query<{ conname: string; def: string }>(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conrelid = $1::regclass ORDER BY conname`,
        [table]
    );
    return Object.fromEntries(rows.map((r) => [r.conname, r.def]));
}

/** The column names of a table, sorted. */
async function columnsOf(table: string): Promise<string[]> {
    const { rows } = await getTestPool().query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 ORDER BY column_name`,
        [table]
    );
    return rows.map((r) => r.column_name);
}

describe('TEST:V4:1 - the trial tables after db:migrate and apply-extras from empty', () => {
    it('creates trial and canje_de_trial', async () => {
        const { rows } = await getTestPool().query<{ tablename: string }>(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public'
             AND tablename = ANY($1) ORDER BY tablename`,
            [['trial', 'canje_de_trial']]
        );

        expect(rows.map((r) => r.tablename)).toEqual(['canje_de_trial', 'trial']);
    });

    it('trial has UNIQUE(user_id, vertical) and UNIQUE(email_pseudonym, vertical)', async () => {
        const constraints = await constraintsOf('trial');

        expect(constraints.uq_trial_user_vertical).toBe('UNIQUE (user_id, vertical)');
        expect(constraints.uq_trial_email_pseudonym_vertical).toBe(
            'UNIQUE (email_pseudonym, vertical)'
        );
    });

    it('neither uniqueness carries a state condition: no partial index on trial', async () => {
        const { rows } = await getTestPool().query<{ indexname: string; indexdef: string }>(
            `SELECT indexname, indexdef FROM pg_indexes
             WHERE schemaname = 'public' AND tablename = 'trial'`
        );

        expect(rows.length).toBeGreaterThanOrEqual(3);
        for (const row of rows) {
            expect(row.indexdef, row.indexname).not.toContain(' WHERE ');
        }
    });

    it('trial.user_id references users ON DELETE RESTRICT', async () => {
        const constraints = await constraintsOf('trial');

        expect(constraints.trial_user_id_users_id_fk).toBe(
            'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT'
        );
    });

    it('trial has no deleted_at column', async () => {
        expect(await columnsOf('trial')).not.toContain('deleted_at');
    });

    it('trial has an enabled BEFORE DELETE row trigger', async () => {
        const { rows } = await getTestPool().query<{
            tgname: string;
            def: string;
            tgenabled: string;
        }>(
            `SELECT tgname, pg_get_triggerdef(oid) AS def, tgenabled FROM pg_trigger
             WHERE tgrelid = 'trial'::regclass AND NOT tgisinternal AND tgname = 'trg_trial_no_delete'`
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]?.tgenabled).toBe('O');
        expect(rows[0]?.def).toContain('BEFORE DELETE ON public.trial FOR EACH ROW');
    });

    it('canje_de_trial has UNIQUE(redemption_key)', async () => {
        const constraints = await constraintsOf('canje_de_trial');

        expect(constraints.uq_canje_de_trial_redemption_key).toBe('UNIQUE (redemption_key)');
    });
});

describe('TEST:V4:2 - the trial is single for life', () => {
    it('rejects a second trial for the same user and vertical', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            await client.query(INSERT_CONSUMED, [userId, 'accommodation', pseudonymOf('a')]);

            const error = await attempt(INSERT_CONSUMED, [
                userId,
                'accommodation',
                pseudonymOf('b')
            ]);

            expect(error?.code).toBe('23505');
            expect(error?.constraint).toBe('uq_trial_user_vertical');
        });
    });

    it('rejects a new account with the same pseudonym in the same vertical', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const first = await insertUser(client);
            const second = await insertUser(client);
            await client.query(INSERT_CONSUMED, [first, 'gastronomy', pseudonymOf('same')]);

            const error = await attempt(INSERT_CONSUMED, [
                second,
                'gastronomy',
                pseudonymOf('same')
            ]);

            expect(error?.code).toBe('23505');
            expect(error?.constraint).toBe('uq_trial_email_pseudonym_vertical');
        });
    });

    it('rejects the repeat whatever the state of the first row', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const first = await insertUser(client);
            const second = await insertUser(client);
            await client.query(
                `INSERT INTO trial (user_id, vertical, status, email_pseudonym)
                 VALUES ($1, 'experience', 'TRIAL_EXPIRED', $2)`,
                [first, pseudonymOf('expired')]
            );

            const error = await attempt(INSERT_CONSUMED, [
                second,
                'experience',
                pseudonymOf('expired')
            ]);

            expect(error?.constraint).toBe('uq_trial_email_pseudonym_vertical');
        });
    });

    it('admits the same person in another vertical', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            await client.query(INSERT_CONSUMED, [userId, 'accommodation', pseudonymOf('multi')]);

            const error = await attempt(INSERT_CONSUMED, [
                userId,
                'gastronomy',
                pseudonymOf('multi')
            ]);

            expect(error).toBeNull();
        });
    });

    it('rejects a DELETE of the row, and the row stays', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            await client.query(INSERT_CONSUMED, [userId, 'accommodation', pseudonymOf('keep')]);

            const error = await attempt('DELETE FROM trial WHERE user_id = $1', [userId]);
            const { rows } = await client.query('SELECT 1 FROM trial WHERE user_id = $1', [userId]);

            expect(error?.code).toBe('P0001');
            expect(error?.message).toContain('trial');
            expect(rows).toHaveLength(1);
        });
    });

    it('offers no soft delete: the table has no deleted_at to stamp', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            await client.query(INSERT_CONSUMED, [userId, 'accommodation', pseudonymOf('hide')]);

            const error = await attempt('UPDATE trial SET deleted_at = now() WHERE user_id = $1', [
                userId
            ]);

            expect(error?.code).toBe('42703');
        });
    });

    it('survives the account being pseudonymised, with its pseudonym untouched', async () => {
        await inRolledBackTx(async ({ client }) => {
            const userId = await insertUser(client);
            const pseudonym = pseudonymOf('survivor');
            await client.query(INSERT_CONSUMED, [userId, 'accommodation', pseudonym]);

            // The account drop pseudonymises the user row: it never deletes it.
            await client.query(
                `UPDATE users SET display_name = 'Removed', email = $2, deleted_at = now()
                 WHERE id = $1`,
                [userId, `removed-${userId}@removed.invalid`]
            );
            const { rows } = await client.query<{ user_id: string; email_pseudonym: string }>(
                'SELECT user_id, email_pseudonym FROM trial WHERE user_id = $1',
                [userId]
            );

            expect(rows).toEqual([{ user_id: userId, email_pseudonym: pseudonym }]);
        });
    });

    it('refuses to physically delete an account that has a trial row', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            await client.query(INSERT_CONSUMED, [userId, 'accommodation', pseudonymOf('restrict')]);

            const error = await attempt('DELETE FROM users WHERE id = $1', [userId]);

            expect(error?.code).toBe('23503');
            expect(error?.constraint).toBe('trial_user_id_users_id_fk');
        });
    });

    it('requires a 64-character lowercase hex pseudonym, so a mailbox cannot be stored', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);

            const mailbox = await attempt(INSERT_CONSUMED, [
                userId,
                'accommodation',
                'ana@hotel.com'
            ]);
            const upper = await attempt(INSERT_CONSUMED, [
                userId,
                'accommodation',
                pseudonymOf('x').toUpperCase()
            ]);

            expect(mailbox?.constraint).toBe('ck_trial_email_pseudonym_format');
            expect(upper?.constraint).toBe('ck_trial_email_pseudonym_format');
        });
    });
});

describe('TEST:V4:2 - the shape of a trial row', () => {
    /** Inserts a trial plan and two versions of a vertical; returns their ids. */
    async function insertPlanAndVersion(
        client: PoolClient,
        vertical: string
    ): Promise<{ planId: string; versionId: string }> {
        const plan = await client.query<{ id: string }>(
            `INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, 'Trial plan') RETURNING id`,
            [vertical, `trial-${vertical}`]
        );
        const planId = (plan.rows[0] as { id: string }).id;
        const version = await client.query<{ id: string }>(
            `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
             VALUES ($1, $2, 1, false, true, 14, false) RETURNING id`,
            [planId, vertical]
        );
        return { planId, versionId: (version.rows[0] as { id: string }).id };
    }

    const INSERT_ACTIVE = `INSERT INTO trial
        (user_id, vertical, status, trial_plan_id, floor_entitlements_version_id,
         floor_limits_version_id, floor_trial_plan_version_id, started_at, ends_at,
         email_pseudonym, deadlines_version)
        VALUES ($1, $2, 'TRIAL_ACTIVE', $3, $4, $5, $6, now(), now() + interval '1 day', $7, 1)`;

    it('accepts a complete TRIAL_ACTIVE row and a consumed row without a clock', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            const other = await insertUser(client);
            const { planId, versionId } = await insertPlanAndVersion(client, 'accommodation');

            const active = await attempt(INSERT_ACTIVE, [
                userId,
                'accommodation',
                planId,
                versionId,
                versionId,
                versionId,
                pseudonymOf('active')
            ]);
            const consumed = await attempt(INSERT_CONSUMED, [
                other,
                'accommodation',
                pseudonymOf('consumed')
            ]);

            expect([active, consumed]).toEqual([null, null]);
        });
    });

    it('rejects a TRIAL_ACTIVE row missing its clock, plan, floor or deadlines version', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);

            const error = await attempt(
                `INSERT INTO trial (user_id, vertical, status, email_pseudonym)
                 VALUES ($1, 'accommodation', 'TRIAL_ACTIVE', $2)`,
                [userId, pseudonymOf('incomplete')]
            );

            expect(error?.code).toBe('23514');
            expect(error?.constraint).toBe('ck_trial_active_complete');
        });
    });

    it('rejects a state outside the machine, including PRE_TRIAL (which has no row)', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);

            const error = await attempt(
                `INSERT INTO trial (user_id, vertical, status, email_pseudonym)
                 VALUES ($1, 'accommodation', 'PRE_TRIAL', $2)`,
                [userId, pseudonymOf('pre')]
            );

            expect(error?.constraint).toBe('ck_trial_status');
        });
    });

    it('rejects a trial plan or a floor version that belongs to another vertical', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            const { planId, versionId } = await insertPlanAndVersion(client, 'gastronomy');

            const error = await attempt(INSERT_ACTIVE, [
                userId,
                'accommodation',
                planId,
                versionId,
                versionId,
                versionId,
                pseudonymOf('cross')
            ]);

            expect(error?.code).toBe('23503');
            expect(error?.constraint).toBe('fk_trial_trial_plan_vertical');
        });
    });

    /** A complete TRIAL_ACTIVE insert where ONE column is replaced by NULL. */
    async function activeWithNull(
        client: PoolClient,
        attempt: (sqlText: string, params?: unknown[]) => Promise<DbError | null>,
        column: string
    ): Promise<DbError | null> {
        const userId = await insertUser(client);
        const { planId, versionId } = await insertPlanAndVersion(client, 'accommodation');
        const columns = [
            'user_id',
            'vertical',
            'status',
            'trial_plan_id',
            'floor_entitlements_version_id',
            'floor_limits_version_id',
            'floor_trial_plan_version_id',
            'started_at',
            'ends_at',
            'email_pseudonym',
            'deadlines_version'
        ];
        const values: Record<string, unknown> = {
            user_id: userId,
            vertical: 'accommodation',
            status: 'TRIAL_ACTIVE',
            trial_plan_id: planId,
            floor_entitlements_version_id: versionId,
            floor_limits_version_id: versionId,
            floor_trial_plan_version_id: versionId,
            started_at: '2026-10-01T00:00:00Z',
            ends_at: '2026-10-02T00:00:00Z',
            email_pseudonym: pseudonymOf(`null-${column}`),
            deadlines_version: 1
        };
        values[column] = null;
        // A NULL clock end alone would trip the together-check first, so null both.
        if (column === 'started_at') values.ends_at = null;
        if (column === 'ends_at') values.started_at = null;
        return attempt(
            `INSERT INTO trial (${columns.join(', ')})
             VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
            columns.map((c) => values[c])
        );
    }

    it.each([
        'trial_plan_id',
        'floor_entitlements_version_id',
        'floor_limits_version_id',
        'floor_trial_plan_version_id',
        'started_at',
        'ends_at',
        'deadlines_version'
    ])('ck_trial_active_complete: a TRIAL_ACTIVE row without %s is rejected', async (column) => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const error = await activeWithNull(client, attempt, column);

            expect(error?.code).toBe('23514');
            expect(error?.constraint).toBe('ck_trial_active_complete');
        });
    });

    it('rejects a deadlines version below 1 (ck_trial_deadlines_version)', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);

            const error = await attempt(
                `INSERT INTO trial (user_id, vertical, status, email_pseudonym, deadlines_version)
                 VALUES ($1, 'accommodation', 'TRIAL_CONVERTED', $2, 0)`,
                [userId, pseudonymOf('deadlines-zero')]
            );

            expect(error?.code).toBe('23514');
            expect(error?.constraint).toBe('ck_trial_deadlines_version');
        });
    });

    it('rejects a redemption that applied zero or negative days (ck_canje_de_trial_applied_days)', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            const insert = `INSERT INTO canje_de_trial (user_id, vertical, redemption_key, applied_days)
                VALUES ($1, 'accommodation', $2, $3)`;

            const zero = await attempt(insert, [userId, 'key-zero', 0]);
            const negative = await attempt(insert, [userId, 'key-negative', -3]);
            const valid = await attempt(insert, [userId, 'key-valid', 7]);
            const repeated = await attempt(insert, [userId, 'key-valid', 7]);

            expect(zero?.constraint).toBe('ck_canje_de_trial_applied_days');
            expect(negative?.constraint).toBe('ck_canje_de_trial_applied_days');
            expect(valid).toBeNull();
            expect(repeated?.constraint).toBe('uq_canje_de_trial_redemption_key');
        });
    });

    it('rejects a trial-plan floor version that belongs to another vertical', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            const own = await insertPlanAndVersion(client, 'accommodation');
            const foreign = await insertPlanAndVersion(client, 'gastronomy');

            const error = await attempt(INSERT_ACTIVE, [
                userId,
                'accommodation',
                own.planId,
                own.versionId,
                own.versionId,
                foreign.versionId,
                pseudonymOf('cross-third')
            ]);

            expect(error?.code).toBe('23503');
            expect(error?.constraint).toBe('fk_trial_floor_trial_plan_version_vertical');
        });
    });

    it('rejects a clock that ends before it starts and a half-written clock', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const userId = await insertUser(client);
            const other = await insertUser(client);
            const insert = `INSERT INTO trial (user_id, vertical, status, started_at, ends_at, email_pseudonym)
                VALUES ($1, 'accommodation', 'TRIAL_EXPIRED', $2, $3, $4)`;

            const reversed = await attempt(insert, [
                userId,
                '2026-10-02T00:00:00Z',
                '2026-10-01T00:00:00Z',
                pseudonymOf('reversed')
            ]);
            const half = await attempt(insert, [
                other,
                '2026-10-01T00:00:00Z',
                null,
                pseudonymOf('half')
            ]);

            expect(reversed?.constraint).toBe('ck_trial_clock_order');
            expect(half?.constraint).toBe('ck_trial_clock_together');
        });
    });
});

// Coord-16 (owner decision on HOS-1443): the half of TEST:V4:4 that says "starting
// a trial through T1 writes none of this data" moves to V4.2, the leaf that
// creates T1. It cannot run before T1 exists. This leaf keeps the structural
// half: no such column exists in either table.
describe('TEST:V4:4 - no phone, tax id or device in the trial tables', () => {
    const FORBIDDEN =
        /phone|tel[ei_]|mobile|whats|cell|tax|fiscal|cuit|cuil|dni|device|fingerprint|user_agent|ip_addr|imei/i;

    it('trial stores exactly the columns the model names, none of them personal data', async () => {
        const columns = await columnsOf('trial');

        expect(columns).toEqual([
            'created_at',
            'deadlines_version',
            'email_pseudonym',
            'ends_at',
            'floor_entitlements_version_id',
            'floor_limits_version_id',
            'floor_trial_plan_version_id',
            'id',
            'started_at',
            'status',
            'trial_plan_id',
            'updated_at',
            'user_id',
            'vertical'
        ]);
        expect(columns.filter((c) => FORBIDDEN.test(c))).toEqual([]);
    });

    it('canje_de_trial stores exactly the columns the model names, none of them personal data', async () => {
        const columns = await columnsOf('canje_de_trial');

        expect(columns).toEqual([
            'applied_at',
            'applied_days',
            'id',
            'redemption_key',
            'user_id',
            'vertical'
        ]);
        expect(columns.filter((c) => FORBIDDEN.test(c))).toEqual([]);
    });

    it('the only mailbox-derived column is the pseudonym, a char(64) hex string, never the mailbox', async () => {
        const { rows } = await getTestPool().query<{ column_name: string; data_type: string }>(
            `SELECT column_name, data_type FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name IN ('trial', 'canje_de_trial')
             AND (column_name ILIKE '%mail%' OR column_name ILIKE '%pseudonym%' OR column_name ILIKE '%hash%')`
        );

        expect(rows).toEqual([{ column_name: 'email_pseudonym', data_type: 'character varying' }]);
    });
});
