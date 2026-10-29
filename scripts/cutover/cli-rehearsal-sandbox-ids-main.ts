import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { ReadOnlyClient } from './known-ids.ts';
import { openStagingCopy, VAR_STAGING_DB } from './rehearsal-copy-db.ts';
import type { RehearsalSandboxApi } from './rehearsal-sandbox-api.ts';
import type { SandboxIdsManifest } from './rehearsal-sandbox-ids.ts';
import { runSandboxIdRewrite } from './rehearsal-sandbox-ids.ts';
import type { StagingSandboxApi } from './staging-sandbox-api.ts';
import {
    assertSandboxAccount,
    assertStagingTarget,
    EnvironmentRefusal
} from './staging-sandbox-guards.ts';
import { createManifestWriter } from './write-manifest.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Session variables. Their values are never printed or written. */
export const VAR_TOKEN = 'CUTOVER_MP_ACCESS_TOKEN';
/** Payer email of the sandbox mirrors: the same variable step 4b uses. Needed by `--confirm` only. */
export const VAR_PAYER_EMAIL = 'CUTOVER_PAYER_EMAIL';

/** Exit codes: 0 clean (`ok` or `dry-run`), 1 a failure, 2 usage error or environment refusal. */
const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_REFUSED = 2;

const USAGE =
    'usage: cli-rehearsal-sandbox-ids.ts --target=staging [--confirm] [--manifest-out <path>]';

/** Everything the CLI touches outside itself, injected so the wiring is testable without network or DB. */
export interface RehearsalSandboxIdsCliDeps {
    readonly args: readonly string[];
    readonly session: Readonly<Record<string, string | undefined>>;
    /** Reads the account tags (`createStagingSandboxApi` in production): the sandbox proof. */
    readonly createAccountApi: (input: { readonly accessToken: string }) => StagingSandboxApi;
    readonly createSandboxApi: (input: { readonly accessToken: string }) => RehearsalSandboxApi;
    /** Opens a WRITABLE session (`connectWritable` in production). */
    readonly connectDb: (input: { readonly connectionString: string }) => Promise<ReadOnlyClient>;
    readonly out: (line: string) => void;
    readonly err: (line: string) => void;
}

/**
 * Entry logic of `cli-rehearsal-sandbox-ids.ts` (HOS-1957, owner decision 1).
 *
 * Order, fail-closed at every step and before any provider write or database write:
 * `--target=staging`, the session variables, the token's account carries the `test_user` tag
 * (`GET /users/me`), the database answers as staging's. Then the run, as a dry run unless
 * `--confirm` is given.
 *
 * @param deps - arguments, session and injected dependencies
 * @returns the process exit code
 */
export async function runRehearsalSandboxIdsCli(deps: RehearsalSandboxIdsCliDeps): Promise<number> {
    const { err, out } = deps;
    let values: {
        readonly target?: string;
        readonly confirm?: boolean;
        readonly 'manifest-out'?: string;
    };
    try {
        values = parseArgs({
            args: [...deps.args],
            options: {
                target: { type: 'string' },
                confirm: { type: 'boolean' },
                'manifest-out': { type: 'string' }
            },
            strict: true,
            allowPositionals: false
        }).values;
    } catch {
        err(USAGE);
        return EXIT_REFUSED;
    }
    const mode = values.confirm === true ? 'confirm' : 'dry-run';
    const accessToken = deps.session[VAR_TOKEN];
    const connectionString = deps.session[VAR_STAGING_DB];
    const payerEmail = deps.session[VAR_PAYER_EMAIL];

    let client: ReadOnlyClient;
    try {
        assertStagingTarget({ target: values.target });
        if (!accessToken || !connectionString) {
            throw new EnvironmentRefusal({
                message: `${VAR_TOKEN} and ${VAR_STAGING_DB} must be set in the session; refusing to run`
            });
        }
        if (mode === 'confirm' && !payerEmail) {
            throw new EnvironmentRefusal({
                message: `${VAR_PAYER_EMAIL} must be set in the session for --confirm; refusing to run`
            });
        }
        await assertSandboxAccount({ api: deps.createAccountApi({ accessToken }) });
        client = await openStagingCopy({ connectionString, connectDb: deps.connectDb });
    } catch (error) {
        err(
            error instanceof EnvironmentRefusal
                ? error.message
                : 'could not prove the target; refusing to run'
        );
        return EXIT_REFUSED;
    }

    try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const wantedPath =
            values['manifest-out'] ??
            path.join(repoRoot, `scripts/cutover/out/rehearsal-sandbox-ids-manifest-${stamp}.json`);
        const writer = createManifestWriter<SandboxIdsManifest>({
            wantedPath,
            fallback: (text) => {
                err('MANIFEST WRITE FAILED. Full record follows; save it now:');
                err(text);
            }
        });
        const manifest = await runSandboxIdRewrite({
            mode,
            client,
            api: deps.createSandboxApi({ accessToken }),
            ...(payerEmail ? { payerEmail } : {}),
            writer
        });
        const rows = Object.values(manifest.rewrittenRows).reduce((sum, n) => sum + n, 0);
        out(
            `${mode}: outcome=${manifest.outcome} plans=${manifest.knownIds.plans} preapprovals=${manifest.knownIds.preapprovals} alreadySandbox=${manifest.alreadySandboxIds.length} toMirror=${manifest.toMirrorIds.length} mirrored=${manifest.mappings.length} rowsRewritten=${rows} failures=${manifest.failures.length}`
        );
        out(`manifest: ${writer.currentPath() ?? '(not written, see stderr)'}`);
        if (writer.currentPath() === null) return EXIT_FAILED;
        return manifest.outcome === 'failed' ? EXIT_FAILED : EXIT_OK;
    } catch (error) {
        err(
            `run failed (${error instanceof Error ? error.name : 'unknown'}): the last checkpoint written (outcome in-progress), if any, holds the ids`
        );
        return EXIT_FAILED;
    } finally {
        await client.end().catch(() => undefined);
    }
}
