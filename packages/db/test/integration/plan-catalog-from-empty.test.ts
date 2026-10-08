// TEST:V2:1, TEST:V2:2 and TEST:V2:3 (HOS-1434, piece V2): the plan and addon
// catalog after db:migrate (and apply-extras) on an empty disposable database.
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

/** Inserts a plan and returns its id. */
async function insertPlan(
    client: PoolClient,
    args: { readonly vertical: string; readonly slug: string }
): Promise<string> {
    const { rows } = await client.query<{ id: string }>(
        `INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id`,
        [args.vertical, args.slug, `Plan ${args.slug}`]
    );
    return (rows[0] as { id: string }).id;
}

/** The SQL that inserts one plan version; parameters in {@link versionParams} order. */
const INSERT_VERSION = `INSERT INTO plan_version
    (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;

interface VersionArgs {
    readonly planId: string;
    readonly vertical: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly current: boolean;
}

const versionParams = (v: VersionArgs): unknown[] => [
    v.planId,
    v.vertical,
    v.rank,
    v.sellable,
    v.current,
    14,
    true
];

/** Inserts a plan version and returns its id. */
async function insertVersion(client: PoolClient, v: VersionArgs): Promise<string> {
    const { rows } = await client.query<{ id: string }>(INSERT_VERSION, versionParams(v));
    return (rows[0] as { id: string }).id;
}

/** The constraints of a table, by name, from the catalog. */
async function constraintsOf(table: string): Promise<Record<string, string>> {
    const { rows } = await getTestPool().query<{ conname: string; def: string }>(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conrelid = $1::regclass ORDER BY conname`,
        [table]
    );
    return Object.fromEntries(rows.map((r) => [r.conname, r.def]));
}

/** The index definitions of a table, by name. */
async function indexesOf(table: string): Promise<Record<string, string>> {
    const { rows } = await getTestPool().query<{ indexname: string; indexdef: string }>(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
        [table]
    );
    return Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));
}

describe('TEST:V2:1 — the catalog tables after db:migrate from empty', () => {
    it('creates the eight catalog tables', async () => {
        const { rows } = await getTestPool().query<{ tablename: string }>(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)
             ORDER BY tablename`,
            [
                [
                    'plan',
                    'plan_version',
                    'plan_version_entitlement',
                    'plan_version_limit',
                    'addon',
                    'addon_version',
                    'addon_version_entitlement',
                    'addon_version_limit'
                ]
            ]
        );

        expect(rows.map((r) => r.tablename)).toEqual([
            'addon',
            'addon_version',
            'addon_version_entitlement',
            'addon_version_limit',
            'plan',
            'plan_version',
            'plan_version_entitlement',
            'plan_version_limit'
        ]);
    });

    it('plan: UNIQUE(vertical, slug), UNIQUE(id, vertical) and the FK to vertical', async () => {
        const constraints = await constraintsOf('plan');

        expect(constraints.uq_plan_vertical_slug).toBe('UNIQUE (vertical, slug)');
        expect(constraints.uq_plan_id_vertical).toBe('UNIQUE (id, vertical)');
        expect(constraints.plan_vertical_vertical_id_fk).toBe(
            'FOREIGN KEY (vertical) REFERENCES vertical(id)'
        );
    });

    it('plan_version: the composite FK to plan, UNIQUE(id, plan_id), UNIQUE(id, vertical) and the two partial uniques', async () => {
        const constraints = await constraintsOf('plan_version');
        const indexes = await indexesOf('plan_version');

        expect(constraints.fk_plan_version_plan_vertical).toBe(
            'FOREIGN KEY (plan_id, vertical) REFERENCES plan(id, vertical)'
        );
        expect(constraints.uq_plan_version_id_plan).toBe('UNIQUE (id, plan_id)');
        expect(constraints.uq_plan_version_id_vertical).toBe('UNIQUE (id, vertical)');
        expect(indexes.uq_plan_version_one_current_per_plan).toMatch(
            /^CREATE UNIQUE INDEX \S+ ON public\.plan_version USING btree \(plan_id\) WHERE current$/
        );
        expect(indexes.uq_plan_version_sellable_current_rank).toMatch(
            /^CREATE UNIQUE INDEX \S+ ON public\.plan_version USING btree \(vertical, rank\) WHERE \(sellable AND current\)$/
        );
    });

    it('plan_version: grace days default to 10; trial days, pause and the VIP inheritance are its own columns', async () => {
        const { rows } = await getTestPool().query<{
            column_name: string;
            column_default: string | null;
            is_nullable: string;
        }>(
            `SELECT column_name, column_default, is_nullable FROM information_schema.columns
             WHERE table_name = 'plan_version' ORDER BY column_name`
        );
        const byName = Object.fromEntries(rows.map((r) => [r.column_name, r]));

        expect(byName.grace_days?.column_default).toBe('10');
        for (const column of [
            'rank',
            'sellable',
            'current',
            'grace_days',
            'trial_days',
            'allows_pause',
            'inherits_tourist_vip',
            'vertical'
        ]) {
            expect(byName[column]?.is_nullable, column).toBe('NO');
        }
    });

    it('the entitlement and limit tables: UNIQUE(version, key) and the FK to catalog_key', async () => {
        for (const [table, versionColumn] of [
            ['plan_version_entitlement', 'plan_version_id'],
            ['plan_version_limit', 'plan_version_id'],
            ['addon_version_entitlement', 'addon_version_id'],
            ['addon_version_limit', 'addon_version_id']
        ] as const) {
            const constraints = await constraintsOf(table);

            expect(constraints[`uq_${table}_version_key`], table).toBe(
                `UNIQUE (${versionColumn}, key)`
            );
            expect(constraints[`${table}_key_catalog_key_key_fk`], table).toBe(
                'FOREIGN KEY (key) REFERENCES catalog_key(key)'
            );
        }
    });

    it('addon: UNIQUE(slug); addon_version: its addon is not nullable', async () => {
        const addon = await constraintsOf('addon');
        const { rows } = await getTestPool().query<{ is_nullable: string }>(
            `SELECT is_nullable FROM information_schema.columns
             WHERE table_name = 'addon_version' AND column_name = 'addon_id'`
        );

        expect(addon.uq_addon_slug).toBe('UNIQUE (slug)');
        expect(rows).toEqual([{ is_nullable: 'NO' }]);
    });

    it('a version whose vertical disagrees with its plan is rejected by the composite FK', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const planId = await insertPlan(client, { vertical: 'accommodation', slug: 'basic' });

            const error = await attempt(
                INSERT_VERSION,
                versionParams({
                    planId,
                    vertical: 'gastronomy',
                    rank: 10,
                    sellable: true,
                    current: true
                })
            );

            expect(error?.code).toBe('23503');
            expect(error?.constraint).toBe('fk_plan_version_plan_vertical');
        });
    });

    it('a metered entitlement carries both quotas or none', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const planId = await insertPlan(client, { vertical: 'accommodation', slug: 'pro' });
            const versionId = await insertVersion(client, {
                planId,
                vertical: 'accommodation',
                rank: 20,
                sellable: true,
                current: true
            });
            const insert = `INSERT INTO plan_version_entitlement (plan_version_id, key, plan_quota, trial_quota)
                VALUES ($1, $2, $3, $4)`;

            const both = await attempt(insert, [versionId, 'ai_chat', 100, 10]);
            const none = await attempt(insert, [versionId, 'respond_reviews', null, null]);
            const half = await attempt(insert, [versionId, 'ai_search', 100, null]);

            expect([both, none]).toEqual([null, null]);
            expect(half?.constraint).toBe('ck_plan_version_entitlement_quotas_together');
        });
    });
});

describe('TEST:V2:2 — cosmetics mutate; what has an effect is only published as a new version', () => {
    it('editing a plan cosmetics changes no version', async () => {
        await inRolledBackTx(async ({ client }) => {
            const planId = await insertPlan(client, { vertical: 'experience', slug: 'basic' });
            await insertVersion(client, {
                planId,
                vertical: 'experience',
                rank: 10,
                sellable: true,
                current: true
            });
            const before = await client.query('SELECT * FROM plan_version WHERE plan_id = $1', [
                planId
            ]);

            await client.query(
                `UPDATE plan SET name = 'Básico', description = 'Nuevo texto', pricing_order = 3,
                 slug = 'basico' WHERE id = $1`,
                [planId]
            );
            const after = await client.query('SELECT * FROM plan_version WHERE plan_id = $1', [
                planId
            ]);

            expect(after.rows).toEqual(before.rows);
            expect(after.rowCount).toBe(1);
        });
    });

    it.each([
        ['rank', '30'],
        ['sellable', 'false'],
        ['grace_days', '3'],
        ['trial_days', '0'],
        ['allows_pause', 'false'],
        ['inherits_tourist_vip', 'true'],
        ['vertical', "'gastronomy'"]
    ])('an UPDATE of plan_version.%s is rejected', async (column, value) => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const planId = await insertPlan(client, { vertical: 'accommodation', slug: 'p' });
            const versionId = await insertVersion(client, {
                planId,
                vertical: 'accommodation',
                rank: 10,
                sellable: true,
                current: true
            });

            const error = await attempt(
                `UPDATE plan_version SET ${column} = ${value} WHERE id = $1`,
                [versionId]
            );

            expect(error?.code).toBe('P0001');
            expect(error?.message).toContain('plan_version is immutable');
        });
    });

    it('current is the only mutable column, and a version is never deleted', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const planId = await insertPlan(client, { vertical: 'accommodation', slug: 'p' });
            const versionId = await insertVersion(client, {
                planId,
                vertical: 'accommodation',
                rank: 10,
                sellable: true,
                current: true
            });

            const flip = await attempt('UPDATE plan_version SET current = false WHERE id = $1', [
                versionId
            ]);
            const remove = await attempt('DELETE FROM plan_version WHERE id = $1', [versionId]);

            expect(flip).toBeNull();
            expect(remove?.code).toBe('P0001');
        });
    });

    it('what a version grants is never edited: its entitlements and limits reject UPDATE and DELETE', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const planId = await insertPlan(client, { vertical: 'accommodation', slug: 'p' });
            const versionId = await insertVersion(client, {
                planId,
                vertical: 'accommodation',
                rank: 10,
                sellable: true,
                current: true
            });
            await client.query(
                `INSERT INTO plan_version_entitlement (plan_version_id, key) VALUES ($1, 'respond_reviews')`,
                [versionId]
            );
            await client.query(
                `INSERT INTO plan_version_limit (plan_version_id, key, value) VALUES ($1, 'max_photos_per_accommodation', 20)`,
                [versionId]
            );

            const errors = [
                await attempt(
                    `UPDATE plan_version_limit SET value = 5 WHERE plan_version_id = $1`,
                    [versionId]
                ),
                await attempt(`DELETE FROM plan_version_limit WHERE plan_version_id = $1`, [
                    versionId
                ]),
                await attempt(
                    `UPDATE plan_version_entitlement SET key = 'view_basic_stats' WHERE plan_version_id = $1`,
                    [versionId]
                ),
                await attempt(`DELETE FROM plan_version_entitlement WHERE plan_version_id = $1`, [
                    versionId
                ])
            ];

            expect(errors.map((e) => e?.code)).toEqual(['P0001', 'P0001', 'P0001', 'P0001']);
        });
    });

    it('publishing a new version leaves the anchored one exactly as it was', async () => {
        await inRolledBackTx(async ({ client }) => {
            const planId = await insertPlan(client, { vertical: 'accommodation', slug: 'p' });
            const anchored = await insertVersion(client, {
                planId,
                vertical: 'accommodation',
                rank: 10,
                sellable: true,
                current: true
            });
            await client.query(
                `INSERT INTO plan_version_limit (plan_version_id, key, value) VALUES ($1, 'max_photos_per_accommodation', 20)`,
                [anchored]
            );
            const read = async (id: string) => ({
                version: (
                    await client.query(
                        'SELECT rank, sellable, grace_days, trial_days, allows_pause, inherits_tourist_vip FROM plan_version WHERE id = $1',
                        [id]
                    )
                ).rows,
                limits: (
                    await client.query(
                        'SELECT key, value FROM plan_version_limit WHERE plan_version_id = $1',
                        [id]
                    )
                ).rows
            });
            const before = await read(anchored);

            await client.query('UPDATE plan_version SET current = false WHERE id = $1', [anchored]);
            const published = await insertVersion(client, {
                planId,
                vertical: 'accommodation',
                rank: 10,
                sellable: true,
                current: true
            });
            await client.query(
                `INSERT INTO plan_version_limit (plan_version_id, key, value) VALUES ($1, 'max_photos_per_accommodation', 30)`,
                [published]
            );

            expect(await read(anchored)).toEqual(before);
            expect((await read(published)).limits).toEqual([
                { key: 'max_photos_per_accommodation', value: 30 }
            ]);
        });
    });

    it('addon_version is immutable, and so is what it grants', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const { rows } = await client.query<{ id: string }>(
                `INSERT INTO addon (slug, name) VALUES ('photos', 'Fotos') RETURNING id`
            );
            const addonId = (rows[0] as { id: string }).id;
            const version = await client.query<{ id: string }>(
                `INSERT INTO addon_version (addon_id, validity, validity_days, scope_type)
                 VALUES ($1, 'FIXED_DAYS', 30, 'LISTING') RETURNING id`,
                [addonId]
            );
            const versionId = (version.rows[0] as { id: string }).id;
            await client.query(
                `INSERT INTO addon_version_limit (addon_version_id, key, value) VALUES ($1, 'max_photos_per_accommodation', 30)`,
                [versionId]
            );

            const cosmetic = await attempt(`UPDATE addon SET name = 'Más fotos' WHERE id = $1`, [
                addonId
            ]);
            const errors = [
                await attempt(`UPDATE addon_version SET validity_days = 40 WHERE id = $1`, [
                    versionId
                ]),
                await attempt(`DELETE FROM addon_version WHERE id = $1`, [versionId]),
                await attempt(
                    `UPDATE addon_version_limit SET value = 40 WHERE addon_version_id = $1`,
                    [versionId]
                )
            ];

            expect(cosmetic).toBeNull();
            expect(errors.map((e) => e?.code)).toEqual(['P0001', 'P0001', 'P0001']);
        });
    });
});

/** Commits a plan version and an addon version in their own transaction; returns their ids. */
async function commitPublishedVersions(): Promise<{
    readonly planVersionId: string;
    readonly addonVersionId: string;
}> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        const planId = await insertPlan(client, {
            vertical: 'accommodation',
            slug: `published-${Date.now()}-${Math.random()}`
        });
        const planVersionId = await insertVersion(client, {
            planId,
            vertical: 'accommodation',
            rank: 10,
            sellable: true,
            current: false
        });
        const addon = await client.query<{ id: string }>(
            `INSERT INTO addon (slug, name) VALUES ($1, 'Fotos') RETURNING id`,
            [`published-${Date.now()}-${Math.random()}`]
        );
        const addonVersion = await client.query<{ id: string }>(
            `INSERT INTO addon_version (addon_id, validity, scope_type)
             VALUES ($1, 'WHILE_SUBSCRIPTION_ALIVE', 'USER') RETURNING id`,
            [(addon.rows[0] as { id: string }).id]
        );
        await client.query('COMMIT');
        return {
            planVersionId,
            addonVersionId: (addonVersion.rows[0] as { id: string }).id
        };
    } finally {
        client.release();
    }
}

describe('TEST:V2:2 — nothing is added to a version published by another transaction', () => {
    it('a child row inserted after the version was committed elsewhere is rejected, in all four tables', async () => {
        const { planVersionId, addonVersionId } = await commitPublishedVersions();

        await inRolledBackTx(async ({ attempt }) => {
            const errors = [
                await attempt(
                    `INSERT INTO plan_version_entitlement (plan_version_id, key) VALUES ($1, 'respond_reviews')`,
                    [planVersionId]
                ),
                await attempt(
                    `INSERT INTO plan_version_limit (plan_version_id, key, value) VALUES ($1, 'max_photos_per_accommodation', 99)`,
                    [planVersionId]
                ),
                await attempt(
                    `INSERT INTO addon_version_entitlement (addon_version_id, key) VALUES ($1, 'featured_listing')`,
                    [addonVersionId]
                ),
                await attempt(
                    `INSERT INTO addon_version_limit (addon_version_id, key, value) VALUES ($1, 'max_photos_per_accommodation', 99)`,
                    [addonVersionId]
                )
            ];

            expect(errors.map((e) => e?.code)).toEqual(['P0001', 'P0001', 'P0001', 'P0001']);
            expect(errors[0]?.message).toContain('published by another transaction');
        });
    });

    it('a version and its rows created in the same transaction pass, also under a savepoint', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const planId = await insertPlan(client, { vertical: 'accommodation', slug: 'same-tx' });
            const versionId = await insertVersion(client, {
                planId,
                vertical: 'accommodation',
                rank: 10,
                sellable: true,
                current: true
            });
            await client.query('SAVEPOINT nested');
            const nestedPlan = await insertPlan(client, {
                vertical: 'accommodation',
                slug: 'same-tx-nested'
            });
            const nestedVersion = await insertVersion(client, {
                planId: nestedPlan,
                vertical: 'accommodation',
                rank: 11,
                sellable: true,
                current: true
            });
            await client.query('RELEASE SAVEPOINT nested');

            const results = [
                await attempt(
                    `INSERT INTO plan_version_entitlement (plan_version_id, key, plan_quota, trial_quota) VALUES ($1, 'ai_chat', 100, 10)`,
                    [versionId]
                ),
                await attempt(
                    `INSERT INTO plan_version_limit (plan_version_id, key, value) VALUES ($1, 'max_photos_per_accommodation', 20)`,
                    [versionId]
                ),
                await attempt(
                    `INSERT INTO plan_version_limit (plan_version_id, key, value) VALUES ($1, 'max_photos_per_accommodation', 20)`,
                    [nestedVersion]
                )
            ];

            expect(results).toEqual([null, null, null]);
        });
    });
});

describe('TEST:V2:3 — sellable and current versions never share a rank; one current per plan', () => {
    it('two sellable, current versions with the same rank in one vertical: rejected', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const basic = await insertPlan(client, { vertical: 'gastronomy', slug: 'basic' });
            const pro = await insertPlan(client, { vertical: 'gastronomy', slug: 'pro' });
            await insertVersion(client, {
                planId: basic,
                vertical: 'gastronomy',
                rank: 20,
                sellable: true,
                current: true
            });

            const error = await attempt(
                INSERT_VERSION,
                versionParams({
                    planId: pro,
                    vertical: 'gastronomy',
                    rank: 20,
                    sellable: true,
                    current: true
                })
            );

            expect(error?.code).toBe('23505');
            expect(error?.constraint).toBe('uq_plan_version_sellable_current_rank');
        });
    });

    it('a version that is not current, or not sellable, does not hold the rank; another vertical neither', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const basic = await insertPlan(client, { vertical: 'gastronomy', slug: 'basic' });
            const pro = await insertPlan(client, { vertical: 'gastronomy', slug: 'pro' });
            const floor = await insertPlan(client, { vertical: 'gastronomy', slug: 'floor' });
            const other = await insertPlan(client, { vertical: 'experience', slug: 'basic' });
            await insertVersion(client, {
                planId: basic,
                vertical: 'gastronomy',
                rank: 20,
                sellable: true,
                current: true
            });

            const results = [
                await attempt(
                    INSERT_VERSION,
                    versionParams({
                        planId: pro,
                        vertical: 'gastronomy',
                        rank: 20,
                        sellable: true,
                        current: false
                    })
                ),
                await attempt(
                    INSERT_VERSION,
                    versionParams({
                        planId: floor,
                        vertical: 'gastronomy',
                        rank: 20,
                        sellable: false,
                        current: true
                    })
                ),
                await attempt(
                    INSERT_VERSION,
                    versionParams({
                        planId: other,
                        vertical: 'experience',
                        rank: 20,
                        sellable: true,
                        current: true
                    })
                )
            ];

            expect(results).toEqual([null, null, null]);
        });
    });

    it('a plan with two current versions: rejected', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const planId = await insertPlan(client, { vertical: 'tourist', slug: 'vip' });
            await insertVersion(client, {
                planId,
                vertical: 'tourist',
                rank: 10,
                sellable: true,
                current: true
            });

            const error = await attempt(
                INSERT_VERSION,
                versionParams({
                    planId,
                    vertical: 'tourist',
                    rank: 11,
                    sellable: false,
                    current: true
                })
            );

            expect(error?.code).toBe('23505');
            expect(error?.constraint).toBe('uq_plan_version_one_current_per_plan');
        });
    });

    it('flipping an old current version back on while another is current: rejected', async () => {
        await inRolledBackTx(async ({ client, attempt }) => {
            const planId = await insertPlan(client, { vertical: 'tourist', slug: 'vip' });
            const old = await insertVersion(client, {
                planId,
                vertical: 'tourist',
                rank: 10,
                sellable: true,
                current: false
            });
            await insertVersion(client, {
                planId,
                vertical: 'tourist',
                rank: 10,
                sellable: true,
                current: true
            });

            const error = await attempt('UPDATE plan_version SET current = true WHERE id = $1', [
                old
            ]);

            expect(error?.code).toBe('23505');
        });
    });
});
