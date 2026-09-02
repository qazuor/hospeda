import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { run } from './exec.ts';

/** Directory name of the dedicated staging checkout, beside the main clone. */
export const STAGING_DIR_NAME = 'hospeda-staging';

/** Branch it always sits on. */
export const STAGING_BRANCH = 'staging';

/**
 * Where the staging checkout lives, or would live.
 *
 * Beside the main clone, matching the project's own worktree path pattern
 * (`../hospeda-{slug}`), so it sits with the rest instead of somewhere only
 * this tool knows about.
 *
 * @param input.mainRepoPath - Absolute path of the main clone.
 * @returns The absolute path.
 */
export function stagingClonePath({ mainRepoPath }: { readonly mainRepoPath: string }): string {
    return join(dirname(mainRepoPath), STAGING_DIR_NAME);
}

/**
 * Where this CLI's own source lives inside a checkout.
 *
 * @param input.repoPath - A checkout root.
 * @returns Absolute path to `scripts/client-tools`.
 */
export function clientToolsPath({ repoPath }: { readonly repoPath: string }): string {
    return join(repoPath, 'scripts', 'client-tools');
}

/**
 * Whether the staging checkout exists at all.
 *
 * In a git worktree `.git` is a FILE pointing at the main repository's gitdir,
 * never a directory — testing for a directory reports a perfectly good checkout
 * as absent.
 *
 * @param input.path - Candidate path.
 * @returns `true` when a checkout is there.
 */
export function stagingCloneExists({ path }: { readonly path: string }): boolean {
    return existsSync(join(path, '.git'));
}

/**
 * Whether the staging checkout can host this CLI.
 *
 * Existing is not enough: until `client-tools` is merged into staging, the
 * checkout is there and cannot serve as the tool's home. The two states get
 * different messages because they need different actions.
 *
 * @param input.path - Candidate path.
 * @returns `true` when it holds the CLI.
 */
export function isUsableStagingClone({ path }: { readonly path: string }): boolean {
    return (
        stagingCloneExists({ path }) &&
        existsSync(join(clientToolsPath({ repoPath: path }), 'package.json'))
    );
}

/** Outcome of preparing the staging checkout. */
export type PrepareResult =
    | { readonly ok: true; readonly path: string; readonly created: boolean }
    | { readonly ok: false; readonly reason: string };

/**
 * Creates the staging checkout if it is missing.
 *
 * It is a git worktree of the main clone rather than a second `git clone`: the
 * object store is shared, so it costs a checkout rather than the whole history.
 *
 * @param input.mainRepoPath - Absolute path of the main clone.
 * @returns The prepared path, or the reason it could not be prepared.
 */
export async function ensureStagingClone({
    mainRepoPath
}: {
    readonly mainRepoPath: string;
}): Promise<PrepareResult> {
    const path = stagingClonePath({ mainRepoPath });

    // Only "is there a checkout" is asked here. Whether it also carries
    // `client-tools` is a separate question that concerns exactly one caller
    // (`hops update`, which runs FROM it); `db-update-template` needs the
    // database code and nothing else, and refusing it over a missing CLI would
    // block a command that has no use for one.
    if (stagingCloneExists({ path })) return { ok: true, path, created: false };

    if (existsSync(path)) {
        return {
            ok: false,
            reason: `${path} existe pero no es un checkout de git. Revisalo a mano.`
        };
    }

    const fetched = await run({
        command: 'git',
        args: ['fetch', 'origin', STAGING_BRANCH],
        cwd: mainRepoPath,
        timeoutMs: 120_000
    });
    if (!fetched.ok)
        return { ok: false, reason: `no pude traer origin/${STAGING_BRANCH}: ${fetched.error}` };

    // `--force` because staging may already be checked out somewhere; git
    // refuses a second checkout of the same branch by default, and this
    // dedicated tree is precisely where it should live.
    const added = await run({
        command: 'git',
        args: ['worktree', 'add', '--force', path, `${STAGING_BRANCH}`],
        cwd: mainRepoPath,
        timeoutMs: 300_000
    });
    if (!added.ok)
        return { ok: false, reason: `no pude crear el worktree de staging: ${added.error}` };

    return { ok: true, path, created: true };
}
