import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateBaselineMigration } from './step-6/generate-baseline.ts';
import { buildReferenceRowsSql } from './step-6/reference-rows.ts';
import { replaceHistories } from './step-6/replace-histories.ts';
import { diffFingerprints, fingerprintSchema } from './step-6/schema-fingerprint.ts';

interface PgClient {
    query(sql: string): Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
    end(): Promise<void>;
}

/** Connects to a URL using the pg dependency owned by @repo/db. */
async function connect({ url }: { readonly url: string }): Promise<PgClient> {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const requireFromDb = createRequire(path.join(root, 'packages/db/package.json'));
    const Client = (
        requireFromDb('pg') as {
            readonly Client: new (config: { connectionString: string }) => PgClient;
        }
    ).Client;
    const client = new Client({ connectionString: url });
    await (client as PgClient & { connect(): Promise<void> }).connect();
    return client;
}

/** Runs the step 6 command line entry point. */
export async function main({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const [command, ...args] = argv;
    const value = (flag: string): string | undefined => {
        const index = args.indexOf(flag);
        return index < 0 ? undefined : args[index + 1];
    };
    const urlA = value('--a-url');
    const urlB = value('--b-url');
    if (command === 'compare') {
        if (!urlA || !urlB) throw new Error('compare requires --a-url and --b-url');
        const aClient = await connect({ url: urlA });
        const bClient = await connect({ url: urlB });
        try {
            const differences = diffFingerprints({
                a: await fingerprintSchema({ client: aClient }),
                b: await fingerprintSchema({ client: bClient })
            });
            if (differences.length === 0) {
                console.log('Schema fingerprints match.');
                return 0;
            }
            for (const difference of differences) console.error(difference);
            return 1;
        } finally {
            await Promise.all([aClient.end(), bClient.end()]);
        }
    }
    if (command === 'prepare-repo') {
        const sourceUrl = value('--source-url');
        if (!sourceUrl) throw new Error('prepare-repo requires --source-url');
        const source = await connect({ url: sourceUrl });
        try {
            const outDir = path.join(repoRoot, '.hoja/tmp', `step-6-baseline-${Date.now()}`);
            const baseline = generateBaselineMigration({ outDir });
            const referenceSql = await buildReferenceRowsSql({ source });
            const plan = replaceHistories({
                repoRoot,
                baseline,
                referenceSql,
                dryRun: args.includes('--dry-run')
            });
            console.log(JSON.stringify({ baseline, plan }, null, 2));
            return 0;
        } finally {
            await source.end();
        }
    }
    throw new Error(
        'Usage: step-6.ts compare --a-url <url> --b-url <url> | prepare-repo --source-url <url> [--dry-run]'
    );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    main({ argv: process.argv.slice(2) })
        .then((code) => process.exit(code))
        .catch((error: unknown) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exit(2);
        });
}
