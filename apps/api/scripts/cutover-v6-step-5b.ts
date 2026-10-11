import { resolve } from 'node:path';
import { getDb, initializeDb } from '@repo/db';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import {
    createGoogleGrantRevoker,
    createPhotoStorage
} from '../src/services/cutover-v6/step-5b.adapters.js';
import { runStep5b } from '../src/services/cutover-v6/step-5b.service.js';
import { getMediaProvider, initializeMediaProvider } from '../src/services/media.js';
import { env, validateApiEnv } from '../src/utils/env.js';
import { decryptSecret } from '../src/utils/oauth-vault.js';

/** Runs the protected one-time step 5b command. */
async function main(): Promise<void> {
    loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });
    validateApiEnv();
    const flags = new Set(process.argv.slice(2));
    const allowed = new Set(['--dry-run', '--confirm-delete-remote']);
    const unknown = [...flags].filter((flag) => !allowed.has(flag));
    if (unknown.length > 0) throw new Error(`Unknown flag: ${unknown.join(', ')}`);
    const dryRun = flags.has('--dry-run');
    if (!dryRun && !flags.has('--confirm-delete-remote')) {
        console.error('Refusing to run: pass --confirm-delete-remote, or use --dry-run.');
        process.exitCode = 2;
        return;
    }

    const pool = new Pool({ connectionString: env.HOSPEDA_DATABASE_URL });
    try {
        initializeDb(pool);
        initializeMediaProvider();
        const result = await runStep5b({
            db: getDb(),
            photoStorage: createPhotoStorage({ provider: getMediaProvider() }),
            grantRevoker: createGoogleGrantRevoker(),
            decryptSecret,
            dryRun
        });
        console.info(JSON.stringify(result));
        process.exitCode =
            result.status === 'completed' || result.status === 'already_done' ? 0 : 1;
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    const errorClass = error instanceof Error ? error.name : 'UnknownError';
    console.error(JSON.stringify({ errorClass }));
    process.exitCode = 1;
});
