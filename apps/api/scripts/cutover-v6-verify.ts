/**
 * V6 cutover read-only verifiers (HOS-1957): the journal check of step 3
 * (AC:CORTE:7, gap G5) and the catalog verification of step 3a (AC:CORTE:8, gap G8).
 *
 * Run after `hops db-migrate`, with the new image's checkout:
 *   pnpm --dir apps/api exec tsx scripts/cutover-v6-verify.ts --journal [--catalog]
 * Normally through `hops cutover-verify`, which supplies the api container's
 * environment and a host-reachable database URL.
 *
 * Writes nothing: every connection is opened with `default_transaction_read_only=on`
 * and the only statements are SELECTs. Prints one JSON result per check.
 * Exit codes: 0 every requested check passed, 1 a check failed or an error, 2 refused arguments.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { resolveStep3DatabaseUrl } from '../src/services/cutover-v6/step-3.env.js';
import { parseVerifyArgs } from '../src/services/cutover-v6/verify.args.js';
import type { Gr3Result } from '../src/services/cutover-v6/verify-catalog.js';
import { buildGr3Candidates, verifyCatalog } from '../src/services/cutover-v6/verify-catalog.js';
import { loadCatalogSnapshot } from '../src/services/cutover-v6/verify-catalog.load.js';
import { buildJournalEntries, compareJournal } from '../src/services/cutover-v6/verify-journal.js';

const MIGRATIONS_DIR = resolve(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'packages',
    'db',
    'src',
    'migrations'
);

/** Runs the requested read-only checks and sets the exit code. */
async function main(): Promise<void> {
    const parsed = parseVerifyArgs({ argv: process.argv.slice(2) });
    if (!parsed.ok) {
        console.error(parsed.reason);
        process.exitCode = 2;
        return;
    }
    loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });
    const { databaseUrl } = await resolveStep3DatabaseUrl({
        loadEnvModule: () => import('../src/utils/env.js')
    });
    const [{ Pool }, { initializeDb }] = await Promise.all([import('pg'), import('@repo/db')]);
    const pool = new Pool({
        connectionString: databaseUrl,
        options: '-c default_transaction_read_only=on'
    });
    let failed = false;
    try {
        if (parsed.checks.includes('journal')) {
            const entries = buildJournalEntries({
                journalJson: readFileSync(resolve(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
                readSql: (tag) => readFileSync(resolve(MIGRATIONS_DIR, `${tag}.sql`), 'utf8')
            });
            const { rows } = await pool.query<{ hash: string; created_at: string | null }>(
                'SELECT hash, created_at FROM drizzle.__drizzle_migrations'
            );
            const comparison = compareJournal({
                entries,
                applied: rows.map((row) => ({ hash: row.hash, createdAt: row.created_at }))
            });
            console.info(
                JSON.stringify({
                    check: 'journal',
                    ...comparison,
                    missing: comparison.missing.map((m) => ({
                        idx: m.idx,
                        tag: m.tag,
                        hash: m.hash
                    })),
                    whenMismatch: comparison.whenMismatch.map((m) => m.tag)
                })
            );
            if (!comparison.ok) failed = true;
        }
        if (parsed.checks.includes('catalog')) {
            const [{ previewPlanVersion }, { PermissionEnum, RoleEnum }] = await Promise.all([
                import('@repo/service-core'),
                import('@repo/schemas')
            ]);
            initializeDb(pool);
            const snapshot = await loadCatalogSnapshot({
                query: async (sql) => pool.query(sql),
                now: new Date()
            });
            // Not a system actor: previewPlanVersion asks for the super-admin
            // permission, which a system actor may never hold (G19).
            const actor = {
                id: '00000000-0000-4000-8000-000000000000',
                roles: [RoleEnum.SUPER_ADMIN],
                permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE]
            };
            const gr3Results: Gr3Result[] = [];
            for (const candidate of buildGr3Candidates({ snapshot })) {
                let message: string | null = null;
                try {
                    await previewPlanVersion({
                        actor,
                        planId: candidate.planId,
                        content: {
                            ...candidate.content,
                            entitlements: [...candidate.content.entitlements],
                            limits: [...candidate.content.limits]
                        }
                    });
                } catch (error) {
                    message = error instanceof Error ? error.message : String(error);
                }
                gr3Results.push({
                    planId: candidate.planId,
                    versionId: candidate.versionId,
                    vertical: candidate.vertical,
                    slug: candidate.slug,
                    message
                });
            }
            const verification = verifyCatalog({ snapshot, gr3Results });
            console.info(JSON.stringify({ check: 'catalog', ...verification }));
            if (!verification.ok) failed = true;
        }
    } finally {
        await pool.end();
    }
    process.exitCode = failed ? 1 : 0;
}

main().catch((error: unknown) => {
    console.error(
        JSON.stringify({
            errorClass: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : 'Unknown error'
        })
    );
    process.exitCode = 1;
});
