import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { run as runCatalogSql } from '../../check-catalog-sql.ts';
import { generateBaselineMigration } from '../../cutover-v6/step-6/generate-baseline.ts';
import { buildReferenceRowsSql } from '../../cutover-v6/step-6/reference-rows.ts';
import { diffFingerprints, fingerprintSchema } from '../../cutover-v6/step-6/schema-fingerprint.ts';
import {
    applyMigrations,
    connect,
    createScratch,
    dropScratch,
    requireAdminUrl,
    withDatabase
} from './scratch-db.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const tempDirs: string[] = [];
afterAll(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function executeSql({
    client,
    sql
}: {
    readonly client: { query(sql: string): Promise<unknown> };
    readonly sql: string;
}): Promise<void> {
    for (const statement of sql.split('--> statement-breakpoint'))
        if (statement.trim()) await client.query(statement);
}

describe('TEST:V6:26 step 6 baseline rehearsal', () => {
    it('matches the cut schema, retains only reference rows, and catches schema mutations', async () => {
        const adminUrl = requireAdminUrl();
        const admin = await connect({ url: adminUrl });
        const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
        const aName = `hospeda_v6_step6_a_${suffix}`;
        const bName = `hospeda_v6_step6_b_${suffix}`;
        const created: string[] = [];
        try {
            for (const name of [aName, bName]) {
                await createScratch({ admin, name });
                created.push(name);
            }
            const aUrl = withDatabase({ url: adminUrl, database: aName });
            const bUrl = withDatabase({ url: adminUrl, database: bName });
            const a = await connect({ url: aUrl });
            const b = await connect({ url: bUrl });
            try {
                await applyMigrations({ client: a, source: { kind: 'working-tree' } });
                execFileSync('node', ['packages/db/scripts/apply-postgres-extras.mjs', aUrl], {
                    cwd: ROOT,
                    stdio: 'pipe'
                });
                await a.query(
                    'ALTER TABLE public.billing_deadline_version DISABLE TRIGGER billing_deadline_version_immutable'
                );
                await a.query(
                    `UPDATE public.billing_deadline_version
                     SET changed_key = 20,
                         previous_value = '{"daysBefore":[5,1]}'::jsonb,
                         new_value = '{"daysBefore":[3,1]}'::jsonb,
                         changed_by = $1
                     WHERE version = 2`,
                    [randomUUID()]
                );
                await a.query(
                    'ALTER TABLE public.billing_deadline_version ENABLE TRIGGER billing_deadline_version_immutable'
                );
                const publishedDeadline = await a.query(
                    `SELECT changed_key, previous_value, new_value, changed_by, created_at
                     FROM public.billing_deadline_version WHERE version = 2`
                );
                expect(publishedDeadline.rows[0]).toMatchObject({
                    changed_key: 20,
                    previous_value: { daysBefore: [5, 1] },
                    new_value: { daysBefore: [3, 1] }
                });
                expect(publishedDeadline.rows[0]?.changed_by).toBeTruthy();
                expect(publishedDeadline.rows[0]?.created_at).toBeTruthy();
                await a.query('DROP TABLE cutover_v6_deleted_listing');

                const outDir = mkdtempSync(path.join(tmpdir(), 'step6-baseline-db-'));
                tempDirs.push(outDir);
                const baseline = generateBaselineMigration({ outDir });
                const referenceSql = await buildReferenceRowsSql({ source: a });
                const generatedSql = readFileSync(baseline.sqlPath, 'utf8');
                const combinedSql = `${generatedSql.trim()}\n--> statement-breakpoint\n${referenceSql}\n`;
                writeFileSync(baseline.sqlPath, combinedSql);
                await executeSql({ client: b, sql: combinedSql });
                execFileSync('node', ['packages/db/scripts/apply-postgres-extras.mjs', bUrl], {
                    cwd: ROOT,
                    stdio: 'pipe'
                });

                const trigger = await b.query(
                    `SELECT 1 FROM pg_trigger
                     WHERE tgrelid = 'public.domain_event'::regclass
                       AND tgname = 'domain_event_append_only' AND NOT tgisinternal`
                );
                expect(trigger.rows).toHaveLength(1);
                const inserted = await b.query(
                    `INSERT INTO public.domain_event
                       (event_type, entity_type, entity_id, actor_type, correlation_id)
                     VALUES ('email.undeliverable', 'step6', $1, 'job', $2) RETURNING id`,
                    [randomUUID(), randomUUID()]
                );
                await expect(
                    b.query(`UPDATE public.domain_event SET reason = 'edited' WHERE id = $1`, [
                        inserted.rows[0]?.id
                    ])
                ).rejects.toMatchObject({ code: 'P0001' });

                const aFingerprint = await fingerprintSchema({ client: a });
                const bFingerprint = await fingerprintSchema({ client: b });
                const differences = diffFingerprints({ a: aFingerprint, b: bFingerprint });
                console.info(`A vs B schema differences: ${JSON.stringify(differences)}`);
                console.info(
                    `A vs B differing definitions: ${JSON.stringify(
                        differences.map((difference) => {
                            const object = aFingerprint.objects.find((entry) =>
                                difference.includes(`${entry.kind} ${entry.name}`)
                            );
                            return {
                                difference,
                                A: object?.definition,
                                B: bFingerprint.objects.find(
                                    (entry) =>
                                        entry.kind === object?.kind && entry.name === object.name
                                )?.definition
                            };
                        })
                    )}`
                );

                const required = [
                    'catalog_key',
                    'vertical',
                    'billing_deadline_version',
                    'vertical_deadline_version'
                ];
                for (const table of required) {
                    const orderBy = table.endsWith('_deadline_version') ? 'version' : '1';
                    const rowsA = await a.query(
                        `SELECT * FROM public."${table}" ORDER BY ${orderBy}`
                    );
                    const rowsB = await b.query(
                        `SELECT * FROM public."${table}" ORDER BY ${orderBy}`
                    );
                    expect(rowsB.rows).toEqual(rowsA.rows);
                }
                for (const table of [
                    'plan',
                    'plan_version',
                    'plan_version_entitlement',
                    'plan_version_limit'
                ]) {
                    const count = await b.query(`SELECT count(*)::int AS n FROM public."${table}"`);
                    expect(Number(count.rows[0]?.n)).toBe(0);
                }
                const tables = await a.query(
                    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
                );
                const referenceSet = new Set([
                    ...required,
                    'plan',
                    'plan_version',
                    'plan_version_entitlement',
                    'plan_version_limit'
                ]);
                const unexpectedRows: string[] = [];
                for (const row of tables.rows) {
                    const table = String(row.tablename);
                    if (referenceSet.has(table)) continue;
                    const [countA, countB] = await Promise.all([
                        a.query(`SELECT count(*)::int AS n FROM public."${table}"`),
                        b.query(`SELECT count(*)::int AS n FROM public."${table}"`)
                    ]);
                    if (Number(countA.rows[0]?.n) > 0 && Number(countB.rows[0]?.n) === 0)
                        unexpectedRows.push(table);
                }
                console.info(
                    `Non-reference tables with rows in A but none in B: ${JSON.stringify(unexpectedRows)}`
                );

                const g18Dir = path.join(outDir, 'g18');
                mkdirSync(g18Dir);
                writeFileSync(path.join(g18Dir, `${baseline.tag}.sql`), combinedSql);
                const g18 = runCatalogSql({ migrationsDir: g18Dir });
                expect(g18.exitCode).toBe(0);
                expect(g18.output).toContain('baseline history: catalog_key and vertical only');

                await b.query(
                    `CREATE FUNCTION public.step6_extra_function() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$`
                );
                expect(
                    diffFingerprints({ a: aFingerprint, b: await fingerprintSchema({ client: b }) })
                ).toEqual(['function step6_extra_function() only in B']);
                await b.query('DROP FUNCTION public.step6_extra_function()');

                await b.query(
                    `CREATE TRIGGER step6_extra_trigger BEFORE INSERT ON public.domain_event FOR EACH ROW EXECUTE FUNCTION public.domain_event_reject_mutation()`
                );
                expect(
                    diffFingerprints({ a: aFingerprint, b: await fingerprintSchema({ client: b }) })
                ).toEqual(['trigger domain_event.step6_extra_trigger only in B']);
                await b.query('DROP TRIGGER step6_extra_trigger ON public.domain_event');

                await b.query(
                    'ALTER TABLE public.domain_event DISABLE TRIGGER domain_event_append_only'
                );
                expect(
                    diffFingerprints({ a: aFingerprint, b: await fingerprintSchema({ client: b }) })
                ).toEqual([
                    expect.stringMatching(
                        /^trigger domain_event\.domain_event_append_only differs:.*enabled=O; B=.*enabled=D$/
                    )
                ]);
                await b.query(
                    'ALTER TABLE public.domain_event ENABLE TRIGGER domain_event_append_only'
                );

                await b.query('CREATE VIEW public.step6_extra_view AS SELECT 1 AS value');
                expect(
                    diffFingerprints({ a: aFingerprint, b: await fingerprintSchema({ client: b }) })
                ).toEqual(['view step6_extra_view only in B']);
                await b.query('DROP VIEW public.step6_extra_view');

                const index = await b.query(
                    "SELECT i.indexname FROM pg_indexes i WHERE i.schemaname='public' AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname=i.indexname) ORDER BY i.indexname LIMIT 1"
                );
                const indexName = String(index.rows[0]?.indexname);
                await b.query(`DROP INDEX public."${indexName}"`);
                expect(
                    diffFingerprints({
                        a: aFingerprint,
                        b: await fingerprintSchema({ client: b })
                    }).some((d) => d.includes(`index ${indexName} only in A`))
                ).toBe(true);
                const aAfterIndexMutation = await fingerprintSchema({ client: a });
                const bAfterIndexMutation = await fingerprintSchema({ client: b });
                await b.query(`CREATE TYPE public.step6_mutation_enum AS ENUM ('first', 'second')`);
                await a.query(`CREATE TYPE public.step6_mutation_enum AS ENUM ('first', 'second')`);
                const enumA = await fingerprintSchema({ client: a });
                const enumB = await fingerprintSchema({ client: b });
                expect(
                    diffFingerprints({ a: enumA, b: enumB }).filter(
                        (difference) =>
                            !diffFingerprints({
                                a: aAfterIndexMutation,
                                b: bAfterIndexMutation
                            }).includes(difference)
                    )
                ).toEqual([]);
                await b.query('DROP TYPE public.step6_mutation_enum');
                await b.query(`CREATE TYPE public.step6_mutation_enum AS ENUM ('second', 'first')`);
                expect(
                    diffFingerprints({ a: enumA, b: await fingerprintSchema({ client: b }) }).some(
                        (d) => d.includes('enum step6_mutation_enum differs')
                    )
                ).toBe(true);
                expect(differences).toEqual([]);
            } finally {
                await Promise.all([a.end(), b.end()]);
            }
        } finally {
            for (const name of created) await dropScratch({ admin, name });
            await admin.end();
        }
    });
    it('does not change the real migration tree while generating a baseline', () => {
        const before = execFileSync(
            'git',
            ['status', '--porcelain', '--', 'packages/db/src/migrations'],
            { cwd: ROOT, encoding: 'utf8' }
        );
        const outDir = mkdtempSync(path.join(tmpdir(), 'step6-baseline-dry-'));
        tempDirs.push(outDir);
        const baseline = generateBaselineMigration({ outDir });
        expect(baseline.tag).toBe('0000_baseline');
        expect(
            execFileSync('git', ['status', '--porcelain', '--', 'packages/db/src/migrations'], {
                cwd: ROOT,
                encoding: 'utf8'
            })
        ).toBe(before);
    });
});
