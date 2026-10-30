/**
 * V6 cutover step 3: writes the five cutover trials with `writeCutoverTrials` and the real campaign adapter.
 * Run during cutover step 3, after `hops db-migrate` and after the new image is up with crons off.
 * First run `pnpm --dir apps/api exec tsx scripts/cutover-v6-step-3.ts --dry-run`, check the five rows by hand, then run the same command with `--confirm-write-trials`. A rerun writes nothing and reports `already_done`.
 * Exit codes: 0 dry_run/completed/already_done, 1 nothing_planned or error, 2 refused arguments.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { parseStep3Args } from '../src/services/cutover-v6/step-3.args.js';
import { resolveStep3DatabaseUrl } from '../src/services/cutover-v6/step-3.env.js';

/** Executes the explicitly confirmed V6 step 3 cutover operation. */
async function main(): Promise<void> {
    const parsed = parseStep3Args({ argv: process.argv.slice(2) });
    if (!parsed.ok) {
        console.error(parsed.reason);
        process.exitCode = 2;
        return;
    }
    loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });
    const { databaseUrl } = await resolveStep3DatabaseUrl({
        loadEnvModule: () => import('../src/utils/env.js')
    });
    const [{ Pool }, { getDb, initializeDb }] = await Promise.all([
        import('pg'),
        import('@repo/db')
    ]);
    const pool = new Pool({ connectionString: databaseUrl });
    let serviceErrorClass: typeof import('@repo/service-core').ServiceError | undefined;
    try {
        const serviceCore = await import('@repo/service-core');
        serviceErrorClass = serviceCore.ServiceError;
        const [{ runStep3, STEP3_EXIT_CODE }, { injectClock, systemClock }] = await Promise.all([
            import('../src/services/cutover-v6/step-3.service.js'),
            import('../src/utils/clock.js')
        ]);
        initializeDb(pool);
        injectClock({ clock: systemClock });
        const result = await runStep3({
            db: getDb(),
            clock: systemClock,
            dryRun: parsed.value.dryRun,
            ...(parsed.value.ownerIds === undefined ? {} : { ownerIds: parsed.value.ownerIds })
        });
        console.info(JSON.stringify(result));
        process.exitCode = STEP3_EXIT_CODE[result.status];
    } catch (error) {
        console.error(
            JSON.stringify({
                errorClass: error instanceof Error ? error.name : 'UnknownError',
                ...(serviceErrorClass && error instanceof serviceErrorClass
                    ? { code: error.code }
                    : {}),
                message: error instanceof Error ? error.message : 'Unknown error'
            })
        );
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
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
