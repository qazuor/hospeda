/**
 * @fileoverview
 * Integration tests for `0195-hos-2658-ai-translate-venue-experience-grant` (HOS-2658 AC-28).
 *
 * Runs against the REAL integration database (catalog loaded by the versioned
 * migrations, plan-catalog immutability triggers from extras 041) with the
 * rollback-isolation idiom: every version of the six venue and experience plans
 * gets `ai_translate` + `max_ai_translate_per_month` with the accommodation values,
 * a version that already holds the key keeps it, no accommodation row changes, and
 * a second run inserts nothing.
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
import { PRODUCTION_PLAN_AI_TRANSLATE_GRANTS } from '../../src/catalog/next-version-entitlements.js';
import * as migration from '../../src/data-migrations/0195-hos-2658-ai-translate-venue-experience-grant.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    const actor: Actor = {
        id: '00000000-0000-4000-8000-000000000000',
        roles: [RoleEnum.SUPER_ADMIN],
        permissions: []
    };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

type Row = Record<string, unknown>;

async function rows(tx: DrizzleClient, query: ReturnType<typeof sql>): Promise<Row[]> {
    return ((await tx.execute(query)) as unknown as { rows: Row[] }).rows;
}

/** Every version of a plan, by vertical + slug. */
async function versionsOf(tx: DrizzleClient, vertical: string, slug: string): Promise<string[]> {
    const result = await rows(
        tx,
        sql`select pv.id from plan_version pv
            join plan p on p.id = pv.plan_id and p.vertical = pv.vertical
            where pv.vertical = ${vertical} and p.slug = ${slug} order by pv.id`
    );
    return result.map((row) => String(row.id));
}

/** Publishes an extra, non-current version of a plan inside the test transaction. */
async function addVersion(tx: DrizzleClient, vertical: string, slug: string): Promise<string> {
    const [row] = await rows(
        tx,
        sql`insert into plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
            select p.id, p.vertical, 99, false, false, 0, false from plan p
            where p.vertical = ${vertical} and p.slug = ${slug}
            returning id`
    );
    if (!row) throw new Error(`plan ${vertical}/${slug} is not in the catalog`);
    return String(row.id);
}

async function entitlementOf(tx: DrizzleClient, versionId: string): Promise<Row[]> {
    return rows(
        tx,
        sql`select plan_quota, trial_quota from plan_version_entitlement
            where plan_version_id = ${versionId} and key = 'ai_translate'`
    );
}

async function limitOf(tx: DrizzleClient, versionId: string): Promise<Row[]> {
    return rows(
        tx,
        sql`select value from plan_version_limit
            where plan_version_id = ${versionId} and key = 'max_ai_translate_per_month'`
    );
}

/** Fingerprint of every accommodation catalog grant row. */
async function accommodationFingerprint(tx: DrizzleClient): Promise<Row[]> {
    return rows(
        tx,
        sql`select 'e' as kind, e.plan_version_id, e.key, e.plan_quota::text as v1, e.trial_quota::text as v2
            from plan_version_entitlement e join plan_version pv on pv.id = e.plan_version_id
            where pv.vertical = 'accommodation'
            union all
            select 'l', l.plan_version_id, l.key, l.value::text, null
            from plan_version_limit l join plan_version pv on pv.id = l.plan_version_id
            where pv.vertical = 'accommodation'
            order by 1, 2, 3`
    );
}

describe('HOS-2658: 0195-hos-2658-ai-translate-venue-experience-grant (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error('HOSPEDA_DATABASE_URL is not set in this worktree');
        }
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('is content-only and lists exactly the six venue and experience plans', () => {
        expect(migration.meta).toEqual({
            name: '0195-hos-2658-ai-translate-venue-experience-grant',
            group: 'required',
            destructive: false,
            contentOnly: true
        });
        expect(
            PRODUCTION_PLAN_AI_TRANSLATE_GRANTS.map(({ vertical, slug, entitlement, limit }) => [
                vertical,
                slug,
                entitlement.planQuota,
                entitlement.trialQuota,
                limit.value
            ])
        ).toEqual([
            ['venue', 'venue-basico', 200, 200, 200],
            ['venue', 'venue-pro', 1000, 200, 1000],
            ['venue', 'venue-premium', 5000, 200, 5000],
            ['experience', 'experience-basico', 200, 200, 200],
            ['experience', 'experience-pro', 1000, 200, 1000],
            ['experience', 'experience-premium', 5000, 200, 5000]
        ]);
    });

    it('grants both keys to every version, keeps a pre-held key and leaves accommodation alone (AC-28)', async () => {
        await withRollback(async (tx) => {
            // Arrange: an extra version of experience-basico, and a venue-pro
            // version that already holds ai_translate with another value.
            const extraExperienceVersion = await addVersion(tx, 'experience', 'experience-basico');
            const preHeldVenueVersion = await addVersion(tx, 'venue', 'venue-pro');
            await tx.execute(
                sql`insert into plan_version_entitlement (id, plan_version_id, key, plan_quota, trial_quota)
                    values (gen_random_uuid(), ${preHeldVenueVersion}, 'ai_translate', 7, 7)`
            );
            const accommodationBefore = await accommodationFingerprint(tx);
            const allVersions = new Map<
                string,
                (typeof PRODUCTION_PLAN_AI_TRANSLATE_GRANTS)[number]
            >();
            for (const grant of PRODUCTION_PLAN_AI_TRANSLATE_GRANTS) {
                for (const id of await versionsOf(tx, grant.vertical, grant.slug)) {
                    allVersions.set(id, grant);
                }
            }

            // Act
            const result = await migration.up(buildCtx(tx));

            // Assert
            expect(allVersions.size).toBeGreaterThanOrEqual(8);
            expect(allVersions.has(extraExperienceVersion)).toBe(true);
            expect(result.counts).toEqual({
                entitlementsInserted: allVersions.size - 1,
                limitsInserted: allVersions.size
            });
            for (const [versionId, grant] of allVersions) {
                const expectedEntitlement =
                    versionId === preHeldVenueVersion
                        ? { plan_quota: 7, trial_quota: 7 }
                        : {
                              plan_quota: grant.entitlement.planQuota,
                              trial_quota: grant.entitlement.trialQuota
                          };
                expect(await entitlementOf(tx, versionId)).toEqual([expectedEntitlement]);
                expect(await limitOf(tx, versionId)).toEqual([{ value: grant.limit.value }]);
            }
            expect(await accommodationFingerprint(tx)).toEqual(accommodationBefore);
            const [setting] = await rows(
                tx,
                sql`select current_setting('hospeda.catalog_additive_grant', true) as value`
            );
            expect(setting).toEqual({ value: '' });
        });
    });

    it('is idempotent: a second run inserts nothing', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await migration.up(buildCtx(tx));

            // Act
            const second = await migration.up(buildCtx(tx));

            // Assert
            expect(second.counts).toEqual({ entitlementsInserted: 0, limitsInserted: 0 });
        });
    });
});
