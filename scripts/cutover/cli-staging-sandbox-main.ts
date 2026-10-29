import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import type { ReadOnlyClient } from './known-ids.ts';
import { readProbeManifest } from './probe-manifest.ts';
import type { StagingSandboxManifest } from './run-staging-sandbox.ts';
import { runStagingSandbox, STAGING_SANDBOX_MANIFEST_KIND } from './run-staging-sandbox.ts';
import type { StagingSandboxApi } from './staging-sandbox-api.ts';
import {
    assertSandboxAccount,
    assertStagingDatabase,
    assertStagingTarget,
    EnvironmentRefusal
} from './staging-sandbox-guards.ts';
import { readStagingSources } from './staging-sandbox-sources.ts';
import type { ProviderApi } from './types.ts';
import { createManifestWriter } from './write-manifest.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_PROBES = path.join(repoRoot, 'packages/payments/src/probes/probes.json');

/** Variables of the operator's shell session. Their values are never printed or written. */
export const VAR_TOKEN = 'CUTOVER_MP_ACCESS_TOKEN';
export const VAR_STAGING_DB = 'CUTOVER_STAGING_DATABASE_URL';

/** Exit codes: 0 clean, 1 a failure (do not go on to V4), 2 usage error or environment refusal. */
const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_REFUSED = 2;

/** Everything the CLI touches outside itself, injected so the wiring is testable without network or DB. */
export interface StagingSandboxCliDeps {
    readonly args: readonly string[];
    readonly session: Readonly<Record<string, string | undefined>>;
    readonly createApi: (input: { readonly accessToken: string }) => ProviderApi;
    readonly createSandboxApi: (input: { readonly accessToken: string }) => StagingSandboxApi;
    /** Opens a READ-ONLY session (`connectReadOnly` in production). */
    readonly connectDb: (input: { readonly connectionString: string }) => Promise<ReadOnlyClient>;
    readonly sleep: (ms: number) => Promise<void>;
    readonly backoffMs?: readonly number[];
    readonly out: (line: string) => void;
    readonly err: (line: string) => void;
}

const previousManifestSchema = z.object({
    kind: z.literal(STAGING_SANDBOX_MANIFEST_KIND),
    schemaVersion: z.literal(1),
    foundIds: z.array(z.string()),
    liveIds: z.array(z.string()),
    failures: z.array(z.object({ id: z.string().optional() }))
});

/**
 * Reads the ids of a previous run's manifest (partial or finished), so a retry covers the
 * same preapprovals even after the reset erased their database anchors.
 *
 * @param input - path of a manifest written by this run
 * @returns the ids it found, deduplicated
 * @throws Error when the file is unreadable or is not a manifest of this run
 */
export function readPreviousManifestIds({ file }: { readonly file: string }): readonly string[] {
    let json: unknown;
    try {
        json = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        throw new Error(`previous manifest at ${file} is unreadable or not JSON`);
    }
    const parsed = previousManifestSchema.safeParse(json);
    if (!parsed.success) {
        throw new Error(`file at ${file} is not a ${STAGING_SANDBOX_MANIFEST_KIND} manifest`);
    }
    const failureIds = parsed.data.failures.flatMap((f) => (f.id === undefined ? [] : [f.id]));
    return [...new Set([...parsed.data.foundIds, ...parsed.data.liveIds, ...failureIds])];
}

/** Opens the database, proves it is staging's, reads the sources and always closes. */
async function readGuardedSources({
    connectionString,
    deps
}: {
    readonly connectionString: string;
    readonly deps: StagingSandboxCliDeps;
}): Promise<Awaited<ReturnType<typeof readStagingSources>>> {
    let client: ReadOnlyClient;
    try {
        client = await deps.connectDb({ connectionString });
    } catch {
        throw new EnvironmentRefusal({
            message: 'could not connect to the database; refusing to run'
        });
    }
    try {
        await assertStagingDatabase({ client });
        return await readStagingSources({ client });
    } finally {
        await client.end().catch(() => undefined);
    }
}

/**
 * Entry logic of `cli-staging-sandbox.ts` (HOS-1951, step V1 of the staging window).
 *
 * Order, fail-closed at every step and before any cancellation: `--target=staging`, the two
 * session variables, the provider account is a TEST account, the database answers
 * `current_database() = hospeda_staging`. Then the sources are read and the run starts, as a
 * dry run unless `--apply` is given.
 *
 * @param deps - arguments, session and injected dependencies
 * @returns the process exit code
 */
export async function runStagingSandboxCli(deps: StagingSandboxCliDeps): Promise<number> {
    const { err, out } = deps;
    let values: {
        readonly target?: string;
        readonly apply?: boolean;
        readonly probes?: string;
        readonly 'from-manifest'?: string;
        readonly 'manifest-out'?: string;
    };
    try {
        values = parseArgs({
            args: [...deps.args],
            options: {
                target: { type: 'string' },
                apply: { type: 'boolean' },
                probes: { type: 'string' },
                'from-manifest': { type: 'string' },
                'manifest-out': { type: 'string' }
            },
            strict: true,
            allowPositionals: false
        }).values;
    } catch {
        err(
            'usage: cli-staging-sandbox.ts --target=staging [--apply] [--from-manifest <path>] [--probes <path>] [--manifest-out <path>]'
        );
        return EXIT_REFUSED;
    }

    const accessToken = deps.session[VAR_TOKEN];
    const connectionString = deps.session[VAR_STAGING_DB];
    try {
        assertStagingTarget({ target: values.target });
        if (!accessToken || !connectionString) {
            throw new EnvironmentRefusal({
                message: `${VAR_TOKEN} and ${VAR_STAGING_DB} must be set in the session; refusing to run`
            });
        }
        const sandboxApi = deps.createSandboxApi({ accessToken });
        await assertSandboxAccount({ api: sandboxApi });
        const sources = await readGuardedSources({ connectionString, deps });

        let probeIds: readonly string[];
        let manifestIds: readonly string[] = [];
        try {
            probeIds = readProbeManifest({ path: values.probes ?? DEFAULT_PROBES });
            if (values['from-manifest'] !== undefined) {
                manifestIds = readPreviousManifestIds({ file: values['from-manifest'] });
            }
        } catch (error) {
            err(error instanceof Error ? error.message : 'could not read an input file');
            return EXIT_REFUSED;
        }

        const mode = values.apply === true ? 'apply' : 'dry-run';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const wantedPath =
            values['manifest-out'] ??
            path.join(repoRoot, `scripts/cutover/out/staging-sandbox-manifest-${stamp}.json`);
        const writer = createManifestWriter<StagingSandboxManifest>({
            wantedPath,
            fallback: (text) => {
                err('MANIFEST WRITE FAILED. Full record follows; save it now:');
                err(text);
            }
        });
        const manifest = await runStagingSandbox({
            mode,
            api: deps.createApi({ accessToken }),
            sandboxApi,
            sources,
            manifestIds,
            probeIds,
            writer,
            sleep: deps.sleep,
            ...(deps.backoffMs === undefined ? {} : { backoffMs: deps.backoffMs })
        });
        out(
            `${mode}: outcome=${manifest.outcome} found=${manifest.foundIds.length} live=${manifest.liveIds.length} cancelled=${manifest.cancelledIds.length} alreadyCancelled=${manifest.alreadyCancelledIds.length} notFound=${manifest.notFoundIds.length} failures=${manifest.failures.length}`
        );
        out(`manifest: ${writer.currentPath() ?? '(not written, see stderr)'}`);
        if (writer.currentPath() === null) return EXIT_FAILED;
        return manifest.outcome === 'failed' ? EXIT_FAILED : EXIT_OK;
    } catch (error) {
        if (error instanceof EnvironmentRefusal) {
            err(error.message);
            return EXIT_REFUSED;
        }
        const name = error instanceof Error ? error.name : 'unknown';
        err(
            `run failed (${name}): the last checkpoint written (outcome in-progress), if any, holds the ids`
        );
        return EXIT_FAILED;
    }
}
