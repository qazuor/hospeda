import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createKnownIdsReader } from './known-ids.ts';
import { readProbeManifest } from './probe-manifest.ts';
import { createProviderApi } from './provider-api.ts';
import { runCutover } from './run-cutover.ts';
import { writeManifest } from './write-manifest.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_PROBES = path.join(repoRoot, 'packages/payments/src/probes/probes.json');

/** Variables of the operator's shell session. Their values are never printed or written. */
const VAR_TOKEN = 'CUTOVER_MP_ACCESS_TOKEN';
const VAR_OLD_DB = 'CUTOVER_OLD_DATABASE_URL';

async function main(): Promise<number> {
    const { values } = parseArgs({
        options: {
            probes: { type: 'string', default: DEFAULT_PROBES },
            'manifest-out': { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
            'confirm-cancel-all': { type: 'boolean', default: false }
        }
    });
    const dryRun = values['dry-run'] === true;
    if (!dryRun && values['confirm-cancel-all'] !== true) {
        console.error(
            'refusing to cancel without --confirm-cancel-all (use --dry-run for census only)'
        );
        return 2;
    }
    const session = process.env;
    const accessToken = session[VAR_TOKEN];
    const oldDb = session[VAR_OLD_DB];
    if (!accessToken || !oldDb) {
        console.error(`set ${VAR_TOKEN} and ${VAR_OLD_DB} in this shell session`);
        return 2;
    }
    let probeIds: readonly string[];
    try {
        probeIds = readProbeManifest({ path: values.probes ?? DEFAULT_PROBES });
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'probe manifest could not be read');
        return 2;
    }
    const result = await runCutover({
        api: createProviderApi({ accessToken }),
        readKnownIds: createKnownIdsReader({ connectionString: oldDb }),
        probeIds,
        dryRun,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    });
    const stamp = result.manifest.startedAt.replace(/[:.]/g, '-');
    const out =
        values['manifest-out'] ??
        path.join(repoRoot, 'scripts/cutover/out', `cutover-manifest-${stamp}.json`);
    const { writtenTo } = writeManifest({
        manifest: result.manifest,
        wantedPath: out,
        fallback: (text) => {
            console.error('MANIFEST WRITE FAILED. Full manifest follows; save it now:');
            console.error(text);
        }
    });
    console.info(
        `outcome=${result.manifest.outcome} manifest=${writtenTo ?? 'NOT WRITTEN (see stderr)'}`
    );
    for (const failure of result.manifest.failures) {
        console.error(
            `FAIL ${failure.code}${failure.id ? ` ${failure.id}` : ''}: ${failure.detail}`
        );
    }
    return result.ok && writtenTo !== null ? 0 : 1;
}

async function entry(): Promise<void> {
    try {
        process.exit(await main());
    } catch {
        console.error('cutover crashed before producing a manifest');
        process.exit(1);
    }
}

void entry();
