/**
 * @fileoverview
 * PostgreSQL integration coverage for data-migration 0180 (HOS-919): catalog
 * upsert (step A), legacy backfill (step B) and permission grants (step C).
 *
 * Every case runs inside a transaction that is always rolled back, so the
 * ephemeral integration database stays empty between cases.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { getDb, initializeDb, resetDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0180-hos919-host-trade-category-catalog.js';
import { assertRequiredColumns } from '../../src/data-migrations/columnDependencyGuard.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { hostTradeCategoryIdFor } from '../../src/required/hostTradeCategories.seed.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(HERE, '../../../../apps/api/.env.local') });

class RollbackSignal extends Error {}
let pool: Pool;

/** Runs a callback in a transaction that always rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            // Lets the fixtures below insert host_trades without building a whole
            // destination/user graph. Rolled back with the transaction.
            await tx.execute(sql`SET LOCAL session_replication_role = replica`);
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    const actor: Actor = { id: crypto.randomUUID(), role: RoleEnum.SUPER_ADMIN, permissions: [] };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

const count = async (tx: DrizzleClient, table: string): Promise<number> => {
    const result = await tx.execute(sql`SELECT count(*)::int AS n FROM ${sql.raw(table)}`);
    return Number((result.rows[0] as { n: number }).n);
};

/** Inserts one host_trades row carrying a legacy category. */
async function insertTrade(
    tx: DrizzleClient,
    input: { readonly slug: string; readonly category: string }
): Promise<string> {
    const result = await tx.execute(
        sql`INSERT INTO host_trades (slug, name, category, contact, benefit, destination_id)
            VALUES (${input.slug}, ${input.slug}, ${input.category}::host_trade_category_enum,
                    'contact', 'benefit', ${crypto.randomUUID()}::uuid)
            RETURNING id`
    );
    return (result.rows[0] as { id: string }).id;
}

/** Inserts one alliance lead carrying a legacy category (free-text varchar). */
async function insertLead(
    tx: DrizzleClient,
    input: { readonly category: string; readonly slugs?: readonly string[] }
): Promise<string> {
    const result = await tx.execute(
        sql`INSERT INTO alliance_leads (kind, contact_name, email, message, category, category_slugs)
            VALUES ('provider', 'n', 'x@example.test', 'm', ${input.category},
                    ${
                        input.slugs
                            ? sql`ARRAY[${sql.join(
                                  input.slugs.map((s) => sql`${s}`),
                                  sql`, `
                              )}]::text[]`
                            : sql`NULL`
                    })
            RETURNING id`
    );
    return (result.rows[0] as { id: string }).id;
}

const linkedSlugs = async (tx: DrizzleClient, tradeId: string): Promise<string[]> => {
    const result = await tx.execute(
        sql`SELECT c.slug FROM r_host_trade_category r
            JOIN host_trade_categories c ON c.id = r.category_id
            WHERE r.host_trade_id = ${tradeId}::uuid ORDER BY c.slug`
    );
    return (result.rows as Array<{ slug: string }>).map((row) => row.slug);
};

const leadSlugs = async (tx: DrizzleClient, leadId: string): Promise<string[] | null> => {
    const result = await tx.execute(
        sql`SELECT category_slugs FROM alliance_leads WHERE id = ${leadId}::uuid`
    );
    return (result.rows[0] as { category_slugs: string[] | null }).category_slugs;
};

describe('HOS-919: 0180 catalog upsert, backfill and grants (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL)
            throw new Error('HOSPEDA_DATABASE_URL is not set in this worktree');
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    describe('step A: catalog upsert', () => {
        it('inserts 5 groups and 29 categories on an empty database', async () => {
            await withRollback(async (tx) => {
                const result = await migration.up(buildCtx(tx));

                expect(await count(tx, 'host_trade_category_groups')).toBe(5);
                expect(await count(tx, 'host_trade_categories')).toBe(29);
                expect(result.counts).toMatchObject({ groupsCreated: 5, categoriesCreated: 29 });
            });
        });

        it('assigns the deterministic id and the right group to each category', async () => {
            await withRollback(async (tx) => {
                await migration.up(buildCtx(tx));

                const rows = await tx.execute(
                    sql`SELECT c.id, g.slug AS group_slug
                        FROM host_trade_categories c
                        JOIN host_trade_category_groups g ON g.id = c.group_id
                        WHERE c.slug = 'destapaciones-desagotes'`
                );
                expect(rows.rows).toEqual([
                    {
                        id: hostTradeCategoryIdFor({ slug: 'destapaciones-desagotes' }),
                        group_slug: 'instalaciones'
                    }
                ]);
            });
        });

        it('inserts nothing on a second run', async () => {
            await withRollback(async (tx) => {
                await migration.up(buildCtx(tx));
                const second = await migration.up(buildCtx(tx));

                expect(second.counts).toMatchObject({ groupsCreated: 0, categoriesCreated: 0 });
                expect(await count(tx, 'host_trade_category_groups')).toBe(5);
                expect(await count(tx, 'host_trade_categories')).toBe(29);
            });
        });

        it('keeps an admin-edited name on re-run', async () => {
            await withRollback(async (tx) => {
                await migration.up(buildCtx(tx));
                await tx.execute(
                    sql`UPDATE host_trade_categories
                        SET name_i18n = '{"es":"Plomeros","en":"Plumbers","pt":"Encanadores"}'::jsonb
                        WHERE slug = 'plomeria'`
                );

                await migration.up(buildCtx(tx));

                const row = await tx.execute(
                    sql`SELECT name_i18n->>'es' AS es FROM host_trade_categories WHERE slug = 'plomeria'`
                );
                expect((row.rows[0] as { es: string }).es).toBe('Plomeros');
            });
        });
    });

    describe('step B: backfill from the legacy columns', () => {
        it('links every legacy value to its mapped slugs, PILETA_JARDIN to two', async () => {
            await withRollback(async (tx) => {
                const ids = new Map<string, string>();
                for (const legacy of Object.keys(migration.LEGACY_CATEGORY_TO_SLUGS)) {
                    ids.set(
                        legacy,
                        await insertTrade(tx, {
                            slug: `t-${legacy.toLowerCase()}`,
                            category: legacy
                        })
                    );
                }

                const result = await migration.up(buildCtx(tx));

                for (const [legacy, slugs] of Object.entries(migration.LEGACY_CATEGORY_TO_SLUGS)) {
                    const tradeId = ids.get(legacy) as string;
                    expect(await linkedSlugs(tx, tradeId), legacy).toEqual([...slugs].sort());
                }
                expect(await count(tx, 'r_host_trade_category')).toBe(14);
                expect(result.counts).toMatchObject({ tradeLinksCreated: 14 });
            });
        });

        it('converts leads to categorySlugs and leaves already-converted leads alone', async () => {
            await withRollback(async (tx) => {
                const pool = await insertLead(tx, { category: 'PILETA_JARDIN' });
                const gas = await insertLead(tx, { category: 'GAS' });
                const done = await insertLead(tx, { category: 'GAS', slugs: ['gas-venta'] });

                await migration.up(buildCtx(tx));

                expect(await leadSlugs(tx, pool)).toEqual(['piletas', 'parque-jardineria']);
                expect(await leadSlugs(tx, gas)).toEqual(['gas-instalacion']);
                expect(await leadSlugs(tx, done)).toEqual(['gas-venta']);
            });
        });

        it('skips an unknown legacy value without throwing', async () => {
            await withRollback(async (tx) => {
                const unknown = await insertLead(tx, { category: 'FOO' });
                const known = await insertLead(tx, { category: 'PLOMERIA' });

                const result = await migration.up(buildCtx(tx));

                expect(await leadSlugs(tx, unknown)).toBeNull();
                expect(await leadSlugs(tx, known)).toEqual(['plomeria']);
                expect(result.counts).toMatchObject({ unknownLegacyValues: 1 });
            });
        });

        it('skips a legacy value that is an Object.prototype member', async () => {
            await withRollback(async (tx) => {
                const proto = await insertLead(tx, { category: 'constructor' });

                const result = await migration.up(buildCtx(tx));

                expect(await leadSlugs(tx, proto)).toBeNull();
                expect(result.counts).toMatchObject({ unknownLegacyValues: 1 });
            });
        });

        it('creates no duplicate link on a second run', async () => {
            await withRollback(async (tx) => {
                await insertTrade(tx, { slug: 't-pool', category: 'PILETA_JARDIN' });
                await migration.up(buildCtx(tx));

                const second = await migration.up(buildCtx(tx));

                expect(await count(tx, 'r_host_trade_category')).toBe(2);
                expect(second.counts).toMatchObject({ tradeLinksCreated: 0, leadsConverted: 0 });
            });
        });
    });

    describe('step C: permission grants', () => {
        it('grants the five permissions to SUPER_ADMIN and ADMIN and is idempotent', async () => {
            await withRollback(async (tx) => {
                const first = await migration.up(buildCtx(tx));
                const second = await migration.up(buildCtx(tx));

                const rows = await tx.execute(
                    sql`SELECT role, count(*)::int AS n FROM role_permission
                        WHERE permission::text LIKE 'hostTradeCategory.%' GROUP BY role ORDER BY role::text`
                );
                expect(rows.rows).toEqual([
                    { role: 'ADMIN', n: 5 },
                    { role: 'SUPER_ADMIN', n: 5 }
                ]);
                expect(first.counts).toMatchObject({ permissionsGranted: 10 });
                expect(second.counts).toMatchObject({ permissionsGranted: 0 });
            });
        });
    });

    describe('column dependency guard (HOS-433)', () => {
        it('refuses to run when a legacy column is gone and the table still has rows', async () => {
            await withRollback(async (tx) => {
                await insertTrade(tx, { slug: 't-guard', category: 'PLOMERIA' });
                await tx.execute(sql`ALTER TABLE host_trades DROP COLUMN category`);

                await expect(
                    assertRequiredColumns({ db: tx, meta: migration.meta })
                ).rejects.toThrow(/host_trades\.category/);
            });
        });
    });
});
