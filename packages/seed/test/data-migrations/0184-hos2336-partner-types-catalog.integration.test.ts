/**
 * @fileoverview
 * PostgreSQL integration coverage for data-migration 0184 (HOS-2336): catalog
 * upsert (step 1), permission grants (step 2) and the `type_id` backfill from
 * the legacy `partners.type` (step 3).
 *
 * Every case runs inside a transaction that is always rolled back, so the
 * ephemeral integration database stays as it was between cases.
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
import * as migration from '../../src/data-migrations/0184-hos2336-partner-types-catalog.js';
import { assertRequiredColumns } from '../../src/data-migrations/columnDependencyGuard.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { partnerTypeIdFor } from '../../src/required/partnerTypes.seed.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(HERE, '../../../../apps/api/.env.local') });

class RollbackSignal extends Error {}
let pool: Pool;

/** Runs a callback in a transaction that always rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            // Wipes any seeded catalog/partners inside the transaction so each
            // case starts from a known state; rolled back afterwards.
            await tx.execute(sql`SET LOCAL session_replication_role = replica`);
            await tx.execute(sql`DELETE FROM partners`);
            await tx.execute(sql`DELETE FROM partner_types`);
            await tx.execute(
                sql`DELETE FROM role_permission WHERE permission::text LIKE 'partnerType.%'`
            );
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

/** Inserts one partner carrying only the legacy enum type. */
async function insertLegacyPartner(
    tx: DrizzleClient,
    input: { readonly slug: string; readonly type: string | null }
): Promise<string> {
    const result = await tx.execute(
        sql`INSERT INTO partners (slug, name, type, lifecycle_state)
            VALUES (${input.slug}, ${input.slug},
                    ${input.type === null ? sql`NULL` : sql`${input.type}::partner_type_enum`},
                    'DRAFT')
            RETURNING id`
    );
    return (result.rows[0] as { id: string }).id;
}

const typeIdOf = async (tx: DrizzleClient, partnerId: string): Promise<string | null> => {
    const result = await tx.execute(
        sql`SELECT type_id FROM partners WHERE id = ${partnerId}::uuid`
    );
    return (result.rows[0] as { type_id: string | null }).type_id;
};

describe('HOS-2336: 0184 catalog upsert, grants and backfill (integration)', () => {
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

    describe('step 1: catalog upsert', () => {
        it('inserts the 5 types with their deterministic ids on an empty catalog', async () => {
            await withRollback(async (tx) => {
                const result = await migration.up(buildCtx(tx));

                expect(await count(tx, 'partner_types')).toBe(5);
                expect(result.counts).toMatchObject({ typesCreated: 5 });
                const rows = await tx.execute(
                    sql`SELECT id FROM partner_types WHERE slug = 'media'`
                );
                expect((rows.rows[0] as { id: string }).id).toBe(
                    partnerTypeIdFor({ slug: 'media' })
                );
            });
        });

        it('inserts nothing on a second run and keeps an admin-edited name', async () => {
            await withRollback(async (tx) => {
                await migration.up(buildCtx(tx));
                await tx.execute(
                    sql`UPDATE partner_types SET name_i18n = '{"es":"Prensa"}'::jsonb WHERE slug = 'media'`
                );

                const second = await migration.up(buildCtx(tx));

                expect(second.counts).toMatchObject({ typesCreated: 0 });
                const rows = await tx.execute(
                    sql`SELECT name_i18n->>'es' AS es FROM partner_types WHERE slug = 'media'`
                );
                expect((rows.rows[0] as { es: string }).es).toBe('Prensa');
            });
        });
    });

    describe('step 2: permission grants', () => {
        it('grants the five permissions to SUPER_ADMIN and ADMIN and is idempotent', async () => {
            await withRollback(async (tx) => {
                const first = await migration.up(buildCtx(tx));
                const second = await migration.up(buildCtx(tx));

                const rows = await tx.execute(
                    sql`SELECT role, count(*)::int AS n FROM role_permission
                        WHERE permission::text LIKE 'partnerType.%' GROUP BY role ORDER BY role::text`
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

    describe('step 3: backfill from partners.type', () => {
        it('sets type_id from each legacy value and leaves a NULL type alone', async () => {
            await withRollback(async (tx) => {
                const business = await insertLegacyPartner(tx, { slug: 'p-b', type: 'business' });
                const ngo = await insertLegacyPartner(tx, { slug: 'p-n', type: 'ngo' });
                const inst = await insertLegacyPartner(tx, { slug: 'p-i', type: 'institution' });
                const none = await insertLegacyPartner(tx, { slug: 'p-x', type: null });

                const result = await migration.up(buildCtx(tx));

                expect(await typeIdOf(tx, business)).toBe(partnerTypeIdFor({ slug: 'business' }));
                expect(await typeIdOf(tx, ngo)).toBe(partnerTypeIdFor({ slug: 'ngo' }));
                expect(await typeIdOf(tx, inst)).toBe(partnerTypeIdFor({ slug: 'institution' }));
                expect(await typeIdOf(tx, none)).toBeNull();
                expect(result.counts).toMatchObject({
                    partnersConverted: 3,
                    unknownLegacyValues: 0
                });
            });
        });

        it('never overwrites a type_id that is already set, and converts nothing on re-run', async () => {
            await withRollback(async (tx) => {
                await migration.up(buildCtx(tx));
                const id = await insertLegacyPartner(tx, { slug: 'p-set', type: 'business' });
                const media = partnerTypeIdFor({ slug: 'media' });
                await tx.execute(
                    sql`UPDATE partners SET type_id = ${media}::uuid WHERE id = ${id}::uuid`
                );

                const second = await migration.up(buildCtx(tx));

                expect(await typeIdOf(tx, id)).toBe(media);
                expect(second.counts).toMatchObject({ partnersConverted: 0 });
            });
        });
    });

    describe('column dependency guard (HOS-433)', () => {
        it('refuses to run when partners.type is gone and the table still has rows', async () => {
            await withRollback(async (tx) => {
                await insertLegacyPartner(tx, { slug: 'p-guard', type: 'ngo' });
                await tx.execute(sql`ALTER TABLE partners DROP COLUMN type`);

                await expect(
                    assertRequiredColumns({ db: tx, meta: migration.meta })
                ).rejects.toThrow(/partners\.type/);
            });
        });
    });
});
