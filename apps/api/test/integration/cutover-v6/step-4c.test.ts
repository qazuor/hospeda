import type { DrizzleClient } from '@repo/db';
import { getDb, sql } from '@repo/db';
import type { RevalidateTargetResult, RevalidationAdapter } from '@repo/service-core';
import { NoOpRevalidationAdapter, RevalidationService } from '@repo/service-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    createRevalidationPagePurger,
    Step4cNoOpAdapterError
} from '../../../src/services/cutover-v6/step-4c.adapters.js';
import type { PagePurger } from '../../../src/services/cutover-v6/step-4c.service.js';
import {
    runStep4c,
    Step4cPassageTableMissingError
} from '../../../src/services/cutover-v6/step-4c.service.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';

const table = 'cutover_v6_deleted_listing';
const deleted = [
    { entityType: 'accommodation', entityId: '14820000-0000-4000-8000-000000000001' },
    { entityType: 'venue', entityId: '14820000-0000-4000-8000-000000000002' },
    { entityType: 'experience', entityId: '14820000-0000-4000-8000-000000000003' }
] as const;
type Call = { readonly group: string; readonly tags: readonly string[] };

function fakePurger(failGroup?: string, calls: Call[] = []): PagePurger {
    return {
        async purge({ group, tags }) {
            calls.push({ group, tags: [...tags] });
            return group === failGroup
                ? { ok: false, failed: tags.slice(0, 1) }
                : { ok: true, failed: [] };
        }
    };
}

async function withRollback(run: (tx: DrizzleClient) => Promise<void>) {
    const rollback = new Error('rollback');
    try {
        await getDb().transaction(async (tx) => {
            await tx.execute(sql`DROP TABLE IF EXISTS ${sql.raw(table)}`);
            await tx.execute(sql`CREATE TABLE ${sql.raw(table)} (
                entity_type varchar(32) NOT NULL, entity_id uuid NOT NULL,
                PRIMARY KEY (entity_type, entity_id))`);
            await run(tx);
            throw rollback;
        });
    } catch (error) {
        if (error !== rollback) throw error;
    }
}

async function seedRows(tx: DrizzleClient) {
    for (const row of deleted) {
        await tx.execute(sql`INSERT INTO ${sql.raw(table)} (entity_type, entity_id)
            VALUES (${row.entityType}, ${row.entityId}::uuid)`);
    }
}

async function seedDestinations(tx: DrizzleClient) {
    const ids: string[] = [];
    for (let index = 1; index <= 22; index += 1) {
        const id = `14820000-0000-4000-8000-${String(index).padStart(12, '0')}`;
        ids.push(id);
        await tx.execute(sql`INSERT INTO destinations
            (id, destination_type, path, slug, name, summary, description, location)
            VALUES (${id}::uuid, 'CITY', ${`/hos-1482-dest-${index}`}, ${`hos-1482-dest-${index}`},
                'Cutover destination', 'Summary', 'Description', '{"coordinates":{"lat":"-32","long":"-58"}}'::jsonb)`);
    }
    return ids;
}

function recordingAdapter(results?: readonly RevalidateTargetResult[]) {
    const received: string[][] = [];
    const adapter: RevalidationAdapter = {
        name: 'RecordingAdapter',
        async revalidate({ tag }) {
            return { target: tag, success: true, durationMs: 0 };
        },
        async revalidateMany({ tags }) {
            received.push([...tags]);
            return results ?? tags.map((target) => ({ target, success: true, durationMs: 0 }));
        },
        async purgeEverything() {
            return { target: '*', success: true, durationMs: 0 };
        }
    };
    return { adapter, received };
}

describe('TEST:V6:24 step 4c', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });
    afterAll(async () => testDb.teardown());

    it('purges all groups in stable order and produces the same calls on a second run', async () => {
        await withRollback(async (tx) => {
            await seedRows(tx);
            await seedDestinations(tx);
            await tx.execute(sql`INSERT INTO destinations
                (id, destination_type, path, slug, name, summary, description, location)
                VALUES ('14820000-0000-4000-8000-000000009999'::uuid, 'CITY', '/ci-extra-destination',
                    'ci-extra-destination', 'CI extra destination', 'Summary', 'Description',
                    '{"coordinates":{"lat":"-32","long":"-58"}}'::jsonb)`);
            const liveDestinations = await tx.execute(sql`SELECT id::text AS id, slug
                FROM destinations WHERE deleted_at IS NULL ORDER BY slug, id`);
            const independentCount =
                await tx.execute(sql`SELECT count(*)::int AS count FROM destinations
                WHERE deleted_at IS NULL AND slug LIKE 'hos-1482-dest-%'`);
            expect(Number(independentCount.rows[0]?.count)).toBe(22);
            const first: Call[] = [];
            const second: Call[] = [];
            const firstResult = await runStep4c({
                db: tx,
                pagePurger: fakePurger(undefined, first),
                dryRun: false
            });
            const secondResult = await runStep4c({
                db: tx,
                pagePurger: fakePurger(undefined, second),
                dryRun: false
            });
            expect(first.map(({ group }) => group)).toEqual([
                'listings',
                'collections',
                'destinations'
            ]);
            expect(second).toEqual(first);
            expect(first[0]?.tags).toEqual([
                'accom-14820000-0000-4000-8000-000000000001',
                'exp-14820000-0000-4000-8000-000000000003',
                'gastro-14820000-0000-4000-8000-000000000002'
            ]);
            expect(first[1]?.tags).toEqual(['home', 'list-accom', 'list-exp', 'list-gastro']);
            expect(first[2]?.tags).toEqual(
                liveDestinations.rows
                    .flatMap(({ id, slug }) => [`dest-${slug}`, `dest-${id}`])
                    .sort()
            );
            expect(firstResult).toMatchObject({
                status: 'completed',
                listingCount: 3,
                destinationCount: liveDestinations.rows.length
            });
            expect(secondResult).toEqual(firstResult);
        });
    });

    it('still purges collections and destinations when the passage table is empty', async () => {
        await withRollback(async (tx) => {
            await seedDestinations(tx);
            const calls: Call[] = [];
            const result = await runStep4c({
                db: tx,
                pagePurger: fakePurger(undefined, calls),
                dryRun: false
            });
            expect(calls.map(({ group }) => group)).toEqual(['collections', 'destinations']);
            expect(result.groups[0]).toMatchObject({ name: 'listings', tagCount: 0, ok: true });
        });
    });

    it('omits logically deleted destinations', async () => {
        await withRollback(async (tx) => {
            const ids = await seedDestinations(tx);
            const [id] = ids;
            await tx.execute(
                sql`UPDATE destinations SET deleted_at = now() WHERE id = ${id}::uuid`
            );
            const liveDestinations = await tx.execute(sql`SELECT id::text AS id, slug
                FROM destinations WHERE deleted_at IS NULL ORDER BY slug, id`);
            const calls: Call[] = [];
            const result = await runStep4c({
                db: tx,
                pagePurger: fakePurger(undefined, calls),
                dryRun: false
            });
            expect(result.destinationCount).toBe(liveDestinations.rows.length);
            expect(calls.at(-1)?.tags).toEqual(
                liveDestinations.rows
                    .flatMap(({ id: liveId, slug }) => [`dest-${slug}`, `dest-${liveId}`])
                    .sort()
            );
            expect(calls.at(-1)?.tags).not.toContain(`dest-${id}`);
        });
    });

    it('reports one failed group and still attempts the remaining groups', async () => {
        await withRollback(async (tx) => {
            await seedRows(tx);
            await seedDestinations(tx);
            const calls: Call[] = [];
            const result = await runStep4c({
                db: tx,
                pagePurger: fakePurger('collections', calls),
                dryRun: false
            });
            expect(calls.map(({ group }) => group)).toEqual([
                'listings',
                'collections',
                'destinations'
            ]);
            expect(result.status).toBe('failed');
            expect(result.groups[1]).toMatchObject({
                name: 'collections',
                ok: false,
                failed: ['home']
            });
        });
    });

    it('rejects a missing passage table before calling the purger', async () => {
        const calls: Call[] = [];
        await withRollback(async (tx) => {
            await tx.execute(sql`DROP TABLE ${sql.raw(table)}`);
            await expect(
                runStep4c({ db: tx, pagePurger: fakePurger(undefined, calls), dryRun: false })
            ).rejects.toBeInstanceOf(Step4cPassageTableMissingError);
            expect(calls).toEqual([]);
        });
    });

    it('returns the complete groups without purging in dry-run mode', async () => {
        await withRollback(async (tx) => {
            await seedRows(tx);
            await seedDestinations(tx);
            const liveDestinations = await tx.execute(sql`SELECT id::text AS id, slug
                FROM destinations WHERE deleted_at IS NULL ORDER BY slug, id`);
            const calls: Call[] = [];
            const result = await runStep4c({
                db: tx,
                pagePurger: fakePurger(undefined, calls),
                dryRun: true
            });
            expect(calls).toEqual([]);
            expect(result).toMatchObject({
                status: 'dry_run',
                listingCount: 3,
                destinationCount: liveDestinations.rows.length
            });
        });
    });

    it('prefixes tags for prod and treats unresolved environments and no-op adapters as failures', async () => {
        await withRollback(async () => {
            const { adapter, received } = recordingAdapter();
            const prod = new RevalidationService({ adapter, cacheTagEnvironment: 'prod' });
            const purger = createRevalidationPagePurger({ service: prod });
            expect(
                await purger.purge({ group: 'collections', tags: ['home', 'list-accom'] })
            ).toMatchObject({ ok: true });
            expect(received[0]).toEqual(['prod:home', 'prod:list-accom']);

            const failedRecorder = recordingAdapter([
                { target: 'prod:home', success: false, error: 'failure', durationMs: 1 }
            ]);
            const failed = new RevalidationService({
                adapter: failedRecorder.adapter,
                cacheTagEnvironment: 'prod'
            });
            expect(
                await createRevalidationPagePurger({ service: failed }).purge({
                    group: 'collections',
                    tags: ['home']
                })
            ).toEqual({ ok: false, failed: ['home'] });

            const unresolvedRecorder = recordingAdapter();
            const unresolved = new RevalidationService({ adapter: unresolvedRecorder.adapter });
            expect(
                await createRevalidationPagePurger({ service: unresolved }).purge({
                    group: 'collections',
                    tags: ['home']
                })
            ).toEqual({ ok: false, failed: ['home'] });
            expect(unresolvedRecorder.received).toEqual([]);

            const noOp = new RevalidationService({
                adapter: new NoOpRevalidationAdapter(),
                cacheTagEnvironment: 'prod'
            });
            expect(() => createRevalidationPagePurger({ service: noOp })).toThrow(
                Step4cNoOpAdapterError
            );
        });
    });
});
