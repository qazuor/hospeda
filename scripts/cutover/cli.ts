import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runAbortInverse } from './abort-inverse.ts';
import { createKnownIdsReader } from './known-ids.ts';
import { readProbeManifest } from './probe-manifest.ts';
import { createProviderApi } from './provider-api.ts';
import type { InverseManifest } from './read-manifest.ts';
import { readInverseManifest } from './read-manifest.ts';
import { runCutover } from './run-cutover.ts';
import { createManifestWriter, writeJsonRecord } from './write-manifest.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_PROBES = path.join(repoRoot, 'packages/payments/src/probes/probes.json');

/** Variables of the operator's shell session. Their values are never printed or written. */
const VAR_TOKEN = 'CUTOVER_MP_ACCESS_TOKEN';
const VAR_OLD_DB = 'CUTOVER_OLD_DATABASE_URL';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const dumpToStderr =
    ({ what }: { readonly what: string }) =>
    (text: string): void => {
        console.error(`${what} WRITE FAILED. Full record follows; save it now:`);
        console.error(text);
    };

/**
 * `--abort-inverse <manifest>`: runs inverses (b) and (c) of the abort branch on the ids of
 * that manifest only, and writes its own report next to it (never over it).
 */
async function abortInverse({
    manifestPath,
    confirmed,
    accessToken
}: {
    readonly manifestPath: string;
    readonly confirmed: boolean;
    readonly accessToken: string | undefined;
}): Promise<number> {
    if (!confirmed) {
        console.error('refusing to run the abort inverses without --confirm-abort-inverse');
        return 2;
    }
    if (!accessToken) {
        console.error(`set ${VAR_TOKEN} in this shell session`);
        return 2;
    }
    let manifest: InverseManifest;
    try {
        manifest = readInverseManifest({ path: manifestPath });
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'manifest could not be read');
        return 2;
    }
    const { ok, report } = await runAbortInverse({
        api: createProviderApi({ accessToken }),
        manifest,
        sleep
    });
    const { dir, name } = path.parse(manifestPath);
    const { writtenTo } = writeJsonRecord({
        value: report,
        wantedPath: path.join(dir, `${name}-abort-inverse.json`),
        fallback: dumpToStderr({ what: 'INVERSE REPORT' })
    });
    console.info(
        `outcome=${report.outcome} probe=${report.probe.action} payment=${report.payment.action} report=${writtenTo ?? 'NOT WRITTEN (see stderr)'}`
    );
    for (const failure of report.failures) {
        console.error(
            `FAIL ${failure.code}${failure.id ? ` ${failure.id}` : ''}: ${failure.detail}`
        );
    }
    return ok && writtenTo !== null ? 0 : 1;
}

async function main(): Promise<number> {
    const { values } = parseArgs({
        options: {
            probes: { type: 'string', default: DEFAULT_PROBES },
            'manifest-out': { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
            'confirm-cancel-all': { type: 'boolean', default: false },
            'abort-inverse': { type: 'string' },
            'confirm-abort-inverse': { type: 'boolean', default: false }
        }
    });
    const session = process.env;
    const inversePath = values['abort-inverse'];
    if (inversePath !== undefined) {
        if (values['dry-run'] === true || values['confirm-cancel-all'] === true) {
            console.error('--abort-inverse cannot be combined with a cutover run flag');
            return 2;
        }
        return abortInverse({
            manifestPath: inversePath,
            confirmed: values['confirm-abort-inverse'] === true,
            accessToken: session[VAR_TOKEN]
        });
    }
    const dryRun = values['dry-run'] === true;
    if (!dryRun && values['confirm-cancel-all'] !== true) {
        console.error(
            'refusing to cancel without --confirm-cancel-all (use --dry-run for census only)'
        );
        return 2;
    }
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
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const writer = createManifestWriter({
        wantedPath:
            values['manifest-out'] ??
            path.join(repoRoot, 'scripts/cutover/out', `cutover-manifest-${stamp}.json`),
        fallback: dumpToStderr({ what: 'MANIFEST' })
    });
    const result = await runCutover({
        api: createProviderApi({ accessToken }),
        readKnownIds: createKnownIdsReader({ connectionString: oldDb }),
        probeIds,
        dryRun,
        sleep,
        onCheckpoint: (manifest) => writer.write(manifest).writtenTo !== null
    });
    const { writtenTo } = writer.write(result.manifest);
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
        console.error(
            'cutover crashed: the last checkpoint written (outcome in-progress), if any, holds the ids'
        );
        process.exit(1);
    }
}

void entry();
