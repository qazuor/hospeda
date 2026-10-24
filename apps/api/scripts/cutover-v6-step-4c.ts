import { resolve } from 'node:path';
import { getDb, initializeDb } from '@repo/db';
import { getRevalidationService, initializeRevalidationService } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import {
    createRevalidationPagePurger,
    Step4cNoOpAdapterError
} from '../src/services/cutover-v6/step-4c.adapters.js';
import { runStep4c } from '../src/services/cutover-v6/step-4c.service.js';
import { env, validateApiEnv } from '../src/utils/env.js';

/**
 * Runs the protected one-time step 4c command.
 * Run from the repository root with: `pnpm --filter hospeda-api exec tsx scripts/cutover-v6-step-4c.ts --dry-run`.
 */
async function main(): Promise<void> {
    loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });
    validateApiEnv();
    const flags = new Set(process.argv.slice(2));
    const allowed = new Set(['--dry-run', '--confirm-purge']);
    const unknown = [...flags].filter((flag) => !allowed.has(flag));
    if (unknown.length > 0) throw new Error(`Unknown flag: ${unknown.join(', ')}`);
    const dryRun = flags.has('--dry-run');
    if (!dryRun && !flags.has('--confirm-purge')) {
        console.error('Refusing to run: pass --confirm-purge, or use --dry-run.');
        process.exitCode = 2;
        return;
    }

    const pool = new Pool({ connectionString: env.HOSPEDA_DATABASE_URL });
    try {
        initializeDb(pool);
        initializeRevalidationService({
            nodeEnv: env.NODE_ENV,
            revalidationSecret: env.HOSPEDA_REVALIDATION_SECRET,
            siteUrl: env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar',
            deployEnv: env.HOSPEDA_DEPLOY_ENV
        });
        const service = getRevalidationService();
        if (!service) throw new Error('RevalidationServiceNotInitialized');
        const result = await runStep4c({
            db: getDb(),
            pagePurger: createRevalidationPagePurger({ service }),
            dryRun
        });
        console.info(JSON.stringify(result));
        process.exitCode = result.status === 'failed' ? 1 : 0;
    } catch (error) {
        const errorClass = error instanceof Error ? error.name : 'UnknownError';
        console.error(JSON.stringify({ errorClass }));
        process.exitCode = error instanceof Step4cNoOpAdapterError ? 2 : 1;
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    const errorClass = error instanceof Error ? error.name : 'UnknownError';
    console.error(JSON.stringify({ errorClass }));
    process.exitCode = 1;
});
