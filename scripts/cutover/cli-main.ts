import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runAbortInverse } from './abort-inverse.ts';
import { readProbeManifest } from './probe-manifest.ts';
import type { InverseManifest } from './read-manifest.ts';
import { readInverseManifest } from './read-manifest.ts';
import { runCutover } from './run-cutover.ts';
import type { KnownIdsReader, ProviderApi } from './types.ts';
import { createManifestWriter, writeJsonRecord } from './write-manifest.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_PROBES = path.join(repoRoot, 'packages/payments/src/probes/probes.json');

/** Variables of the operator's shell session. Their values are never printed or written. */
const VAR_TOKEN = 'CUTOVER_MP_ACCESS_TOKEN';
const VAR_OLD_DB = 'CUTOVER_OLD_DATABASE_URL';

/**
 * Everything the CLI touches outside itself, injected so the wiring can be tested against a
 * simulated provider (HOS-1427). `cli.ts` passes the real ones.
 */
export interface CliDeps {
    /** Command-line arguments, without the node and script entries. */
    readonly args: readonly string[];
    /** The operator's shell session variables. Values are never printed or written. */
    readonly session: Readonly<Record<string, string | undefined>>;
    readonly createApi: (input: { readonly accessToken: string }) => ProviderApi;
    readonly createKnownIdsReader: (input: { readonly connectionString: string }) => KnownIdsReader;
    readonly sleep: (ms: number) => Promise<void>;
    readonly out: (line: string) => void;
    readonly err: (line: string) => void;
}

const dumpTo =
    ({ what, err }: { readonly what: string; readonly err: (line: string) => void }) =>
    (text: string): void => {
        err(`${what} WRITE FAILED. Full record follows; save it now:`);
        err(text);
    };

/**
 * `--abort-inverse <manifest>`: runs inverses (b) and (c) of the abort branch on the ids of
 * that manifest only, and writes its own report next to it (never over it).
 */
async function abortInverse({
    manifestPath,
    confirmed,
    accessToken,
    deps
}: {
    readonly manifestPath: string;
    readonly confirmed: boolean;
    readonly accessToken: string | undefined;
    readonly deps: CliDeps;
}): Promise<number> {
    const { err, out } = deps;
    if (!confirmed) {
        err('refusing to run the abort inverses without --confirm-abort-inverse');
        return 2;
    }
    if (!accessToken) {
        err(`set ${VAR_TOKEN} in this shell session`);
        return 2;
    }
    let manifest: InverseManifest;
    try {
        manifest = readInverseManifest({ path: manifestPath });
    } catch (error) {
        err(error instanceof Error ? error.message : 'manifest could not be read');
        return 2;
    }
    const { ok, report } = await runAbortInverse({
        api: deps.createApi({ accessToken }),
        manifest,
        sleep: deps.sleep
    });
    const { dir, name } = path.parse(manifestPath);
    const { writtenTo } = writeJsonRecord({
        value: report,
        wantedPath: path.join(dir, `${name}-abort-inverse.json`),
        fallback: dumpTo({ what: 'INVERSE REPORT', err })
    });
    out(
        `outcome=${report.outcome} probe=${report.probe.action} payment=${report.payment.action} report=${writtenTo ?? 'NOT WRITTEN (see stderr)'}`
    );
    for (const failure of report.failures) {
        err(`FAIL ${failure.code}${failure.id ? ` ${failure.id}` : ''}: ${failure.detail}`);
    }
    return ok && writtenTo !== null ? 0 : 1;
}

/**
 * Runs the CLI: the cutover (steps 1a, 1b, 2) or, with `--abort-inverse`, the abort inverses.
 *
 * @param deps - arguments, session variables, provider factory and output sinks
 * @returns the process exit code (0 ok, 1 failed run, 2 usage error)
 */
export async function runCli(deps: CliDeps): Promise<number> {
    const { err, out } = deps;
    const { values } = parseArgs({
        args: [...deps.args],
        options: {
            probes: { type: 'string', default: DEFAULT_PROBES },
            'manifest-out': { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
            'confirm-cancel-all': { type: 'boolean', default: false },
            'abort-inverse': { type: 'string' },
            'confirm-abort-inverse': { type: 'boolean', default: false }
        }
    });
    const { session } = deps;
    const inversePath = values['abort-inverse'];
    if (inversePath !== undefined) {
        if (values['dry-run'] === true || values['confirm-cancel-all'] === true) {
            err('--abort-inverse cannot be combined with a cutover run flag');
            return 2;
        }
        return abortInverse({
            manifestPath: inversePath,
            confirmed: values['confirm-abort-inverse'] === true,
            accessToken: session[VAR_TOKEN],
            deps
        });
    }
    const dryRun = values['dry-run'] === true;
    if (!dryRun && values['confirm-cancel-all'] !== true) {
        err('refusing to cancel without --confirm-cancel-all (use --dry-run for census only)');
        return 2;
    }
    const accessToken = session[VAR_TOKEN];
    const oldDb = session[VAR_OLD_DB];
    if (!accessToken || !oldDb) {
        err(`set ${VAR_TOKEN} and ${VAR_OLD_DB} in this shell session`);
        return 2;
    }
    let probeIds: readonly string[];
    try {
        probeIds = readProbeManifest({ path: values.probes ?? DEFAULT_PROBES });
    } catch (error) {
        err(error instanceof Error ? error.message : 'probe manifest could not be read');
        return 2;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const writer = createManifestWriter({
        wantedPath:
            values['manifest-out'] ??
            path.join(repoRoot, 'scripts/cutover/out', `cutover-manifest-${stamp}.json`),
        fallback: dumpTo({ what: 'MANIFEST', err })
    });
    const result = await runCutover({
        api: deps.createApi({ accessToken }),
        readKnownIds: deps.createKnownIdsReader({ connectionString: oldDb }),
        probeIds,
        dryRun,
        sleep: deps.sleep,
        onCheckpoint: (manifest) => writer.write(manifest).writtenTo !== null
    });
    const { writtenTo } = writer.write(result.manifest);
    out(`outcome=${result.manifest.outcome} manifest=${writtenTo ?? 'NOT WRITTEN (see stderr)'}`);
    for (const failure of result.manifest.failures) {
        err(`FAIL ${failure.code}${failure.id ? ` ${failure.id}` : ''}: ${failure.detail}`);
    }
    return result.ok && writtenTo !== null ? 0 : 1;
}
