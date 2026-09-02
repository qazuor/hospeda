import pc from 'picocolors';
import { resolveRepoRoot } from './repo.ts';
import type { BarContext } from './statusbar.ts';
import type { Target } from './target.ts';
import {
    currentWorktree,
    type DbConfig,
    databaseFor,
    listWorktrees,
    readDbConfig,
    type WorktreeEnv
} from './worktree.ts';
import { findWorktreeByName } from './wt-flag.ts';

/**
 * Everything any command needs to know before acting.
 *
 * Resolved once by the dispatcher so no command can ship without saying where
 * it ran — including the ones that fail before doing anything.
 */
export interface RunContext {
    /** Where the command acts. */
    readonly target: Target;
    /** Repository root the shell resolves to. */
    readonly repoRoot: string;
    /** Worktree the shell stands in, or `null` when outside the repository. */
    readonly worktree: WorktreeEnv | null;
    /** Every worktree, for the commands that operate across them. */
    readonly all: readonly WorktreeEnv[];
    /** Project database settings. */
    readonly dbConfig: DbConfig | null;
    /** Database the current worktree acts on. */
    readonly database: string | null;
    /**
     * What the user asked for with `--wt`, if anything.
     *
     * Kept so the dispatcher can tell "no worktree because you are outside the
     * repo" apart from "no worktree because your `--wt` matched nothing" — two
     * situations that need very different messages.
     */
    readonly requestedWorktree: string | null;
}

/**
 * Resolves where a command is about to act.
 *
 * @param input.cwd    - Directory the shell is in.
 * @param input.target - Requested target.
 * @returns The resolved {@link RunContext}.
 */
export async function resolveRunContext({
    cwd,
    target,
    worktreeName = null
}: {
    readonly cwd: string;
    readonly target: Target;
    readonly worktreeName?: string | null;
}): Promise<RunContext> {
    const repoRoot = await resolveRepoRoot({ cwd });
    const [standingIn, all] = await Promise.all([
        currentWorktree({ cwd, repoRoot }),
        listWorktrees({ repoRoot })
    ]);
    const dbConfig = readDbConfig({ repoRoot: all[0]?.path ?? repoRoot });

    // `--wt` is resolved HERE, beside `--target`, and not inside the commands
    // that accept it. Both answer "where does this act", and both have to be
    // settled before the status bar is drawn — otherwise the bar names the
    // directory you are standing in while the command works on another one.
    const worktree =
        worktreeName === null ? standingIn : findWorktreeByName({ all, name: worktreeName });

    return {
        target,
        repoRoot,
        worktree,
        all,
        dbConfig,
        database: worktree === null ? null : databaseFor({ worktree, dbConfig }),
        requestedWorktree: worktreeName
    };
}

/**
 * Builds the context lines painted under the status bar.
 *
 * The database name is always the REAL one, never "la base del worktree": the
 * whole point is that you can tell at a glance which of the forty databases in
 * the shared container is about to be touched.
 *
 * @param input.context - The resolved context.
 * @returns Lines for the {@link BarContext}.
 */
export function runBarContext({ context }: { readonly context: RunContext }): BarContext {
    const lines: string[] = [];
    let subject: string | undefined;

    if (context.worktree === null) {
        subject = 'fuera del repo';
    } else if (context.worktree.isMain) {
        subject = 'main';
    } else {
        // The `hospeda-` prefix is on every single one; spending badge width on
        // it costs the part that actually distinguishes them.
        subject = context.worktree.name.replace(/^hospeda-/, '');
    }

    if (context.worktree !== null) {
        lines.push(`${pc.dim('db  ')}${context.database ?? pc.yellow('(sin base registrada)')}`);
    }
    if (context.dbConfig !== null) {
        lines.push(pc.dim(`pg  ${context.dbConfig.container}`));
    }
    return { target: context.target, subject, lines };
}

/**
 * Lists the worktrees currently running servers.
 *
 * Used by the commands that affect the shared container: stopping Postgres
 * takes down every one of these, and that is worth seeing before doing it.
 *
 * @param input.context - The resolved context.
 * @returns The worktrees with at least one server recorded.
 */
export function worktreesWithServers({
    context
}: {
    readonly context: RunContext;
}): readonly WorktreeEnv[] {
    return context.all.filter((worktree) => worktree.servers.length > 0);
}
