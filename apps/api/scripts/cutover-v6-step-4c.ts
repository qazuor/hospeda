import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, initializeDb } from '@repo/db';
import { getRevalidationService, initializeRevalidationService } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import {
    createPrefixPurgeTransport,
    createRevalidationPagePurger,
    Step4cNoOpAdapterError
} from '../src/services/cutover-v6/step-4c.adapters.js';
import {
    mergeUnique,
    parseListFile,
    parseStep4cArgs
} from '../src/services/cutover-v6/step-4c.args.js';
import { runStep4c } from '../src/services/cutover-v6/step-4c.service.js';
import { env, validateApiEnv } from '../src/utils/env.js';

/**
 * Runs the protected one-time step 4c command.
 * Run from the repository root with: `pnpm --filter hospeda-api exec tsx scripts/cutover-v6-step-4c.ts --dry-run`.
 *
 * Purges, in this order, attempting every group even if one fails:
 * `listings`, `collections`, `destinations`, `legacy-tags` (the retired
 * collection and per-entity tags of the old vertical) and `legacy-prefixes` (the 54 URL prefixes of
 * the old and new restaurant-vertical routes on `hospeda.com.ar` and `www.hospeda.com.ar`).
 * Tags go through `revalidateMany` (100 per request) and the prefixes in one
 * request, so the whole run costs about 5 Cloudflare requests (Free plan: 5 per
 * minute, shared with the live API). Every response is checked: a 429 is a purge
 * that did not happen, so the run exits 1 and the result names the failed group and tags.
 *
 * Flags:
 *   --dry-run                      Count only, call nothing.
 *   --confirm-purge                Required for a real run.
 *   --extra-tags-file <path>       Optional. Text file, one bare tag per line (no `<env>:`
 *                                  namespace); blank lines and lines starting with `#` are
 *                                  ignored. Added to the legacy tags generated in code.
 *   --extra-prefixes-file <path>   Optional. Same format, one `host/path` prefix per line
 *                                  (no scheme). Added to the generated legacy prefixes.
 * Both lists are de-duplicated before grouping.
 *
 * Exit codes: 0 done (or dry run), 1 a purge failed or an error, 2 refused (no
 * `--confirm-purge`, unknown flag, or the no-op adapter).
 */
async function main(): Promise<void> {
    loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });
    validateApiEnv();
    const parsed = parseStep4cArgs({ argv: process.argv.slice(2) });
    if (!parsed.ok) {
        console.error(parsed.error);
        process.exitCode = 2;
        return;
    }
    const { dryRun, confirmPurge, extraTagsFile, extraPrefixesFile } = parsed.value;
    const extraTags = extraTagsFile
        ? mergeUnique({ lists: [parseListFile({ content: readFileSync(extraTagsFile, 'utf8') })] })
        : [];
    const extraPrefixes = extraPrefixesFile
        ? mergeUnique({
              lists: [parseListFile({ content: readFileSync(extraPrefixesFile, 'utf8') })]
          })
        : [];
    if (!dryRun && !confirmPurge) {
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
        const siteUrl = env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar';
        const service = getRevalidationService();
        if (!service) throw new Error('RevalidationServiceNotInitialized');
        const result = await runStep4c({
            db: getDb(),
            pagePurger: createRevalidationPagePurger({
                service,
                prefixTransport: createPrefixPurgeTransport({
                    siteUrl,
                    secret: env.HOSPEDA_REVALIDATION_SECRET
                })
            }),
            dryRun,
            extraTags,
            extraPrefixes
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
