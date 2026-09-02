import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './exec.ts';

/** A server recorded in a worktree's state file. */
export interface WorktreeServer {
    /** Server name, e.g. `api`. */
    readonly name: string;
    /** Port it was started on. */
    readonly port: number;
    /** PID of the process-group leader. */
    readonly pid: number;
}

/** One worktree, as far as these commands care. */
export interface WorktreeEnv {
    /** Directory name. */
    readonly name: string;
    /** Absolute path. */
    readonly path: string;
    /** Whether this is the main clone. */
    readonly isMain: boolean;
    /**
     * Checked-out branch, as git reports it.
     *
     * Read from `git worktree list --porcelain`, NOT from the state file. The
     * state file is written by the creation script, so a worktree made by hand
     * has none — and the placeholder that used to fill the gap travelled intact
     * into `gh pr list --head '(desconocida)'`, which answers "no pull request"
     * for a branch that has one.
     */
    readonly branch: string;
    /**
     * Whether git reports a detached HEAD rather than a branch.
     *
     * Its own field because "no branch" is a fact a command must be able to act
     * on: asking GitHub about a branch that does not exist gets a confident,
     * wrong answer instead of an error.
     */
    readonly detached: boolean;
    /**
     * Postgres database this worktree uses.
     *
     * Read from the state file, which records the name actually created. It is
     * NOT derived from the branch: deriving it caused a real name-drift bug,
     * and the directory is what the pattern is built from.
     */
    readonly database: string | null;
    /** Servers recorded as running. Empty after a `stop`. */
    readonly servers: readonly WorktreeServer[];
}

interface RawState {
    readonly branch?: string;
    readonly db?: string | null;
    readonly servers?: readonly { name?: string; port?: number; pid?: number }[];
}

/** Reads a worktree's state file, tolerating every way it can be absent. */
function readState({ worktreePath }: { readonly worktreePath: string }): RawState {
    const path = join(worktreePath, '.claude', 'worktree-state.local.json');
    if (!existsSync(path)) return {};
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as RawState;
    } catch {
        return {};
    }
}

/** One worktree as git's porcelain describes it. */
export interface PorcelainWorktree {
    /** Absolute path. */
    readonly path: string;
    /** Branch name without the `refs/heads/` prefix, empty when detached. */
    readonly branch: string;
    /** Whether git reported a detached HEAD. */
    readonly detached: boolean;
}

/**
 * Parses `git worktree list --porcelain`.
 *
 * Records are separated by a blank line and each opens with `worktree <path>`,
 * so the branch is attributed to the record it belongs to rather than to
 * whichever path was seen last.
 *
 * @param input.stdout - Raw porcelain output.
 * @returns One entry per worktree, in git's order.
 */
export function parseWorktreePorcelain({
    stdout
}: {
    readonly stdout: string;
}): readonly PorcelainWorktree[] {
    const found: PorcelainWorktree[] = [];
    let path: string | null = null;
    let branch = '';
    let detached = false;

    const flush = () => {
        if (path !== null) found.push({ path, branch, detached });
        path = null;
        branch = '';
        detached = false;
    };

    for (const line of stdout.split('\n')) {
        if (line.startsWith('worktree ')) {
            flush();
            path = line.slice('worktree '.length).trim();
        } else if (line.startsWith('branch ')) {
            branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '');
        } else if (line.trim() === 'detached') {
            detached = true;
        }
    }
    flush();

    return found.filter((worktree) => worktree.path.length > 0);
}

/**
 * Lists every worktree of the repository, main clone included.
 *
 * The main clone is always git's first entry, which is the only reliable way to
 * identify it — the tool may well be running from inside a worktree.
 *
 * @param input.repoRoot - Any path inside the repository.
 * @returns The worktrees, in git's order.
 */
export async function listWorktrees({
    repoRoot
}: {
    readonly repoRoot: string;
}): Promise<readonly WorktreeEnv[]> {
    const listed = await run({
        command: 'git',
        args: ['worktree', 'list', '--porcelain'],
        cwd: repoRoot
    });
    if (!listed.ok) return [];

    return parseWorktreePorcelain({ stdout: listed.stdout }).map((entry, index) => {
        const state = readState({ worktreePath: entry.path });
        const servers = (state.servers ?? [])
            .filter((s) => typeof s.name === 'string' && typeof s.port === 'number')
            .map((s) => ({ name: s.name as string, port: s.port as number, pid: s.pid ?? 0 }));
        return {
            name: entry.path.slice(entry.path.lastIndexOf('/') + 1),
            path: entry.path,
            isMain: index === 0,
            // Git first, state file only as a last resort: the state file
            // records what the branch was at creation, and a worktree that was
            // switched since would report the old name with full confidence.
            branch: entry.branch !== '' ? entry.branch : (state.branch ?? ''),
            detached: entry.detached,
            database: state.db ?? null,
            servers
        };
    });
}

/**
 * Resolves the worktree the shell is standing in.
 *
 * @param input.cwd      - Directory to resolve from.
 * @param input.repoRoot - Any path inside the repository.
 * @returns The worktree, or `null` when the shell is outside the repository.
 */
export async function currentWorktree({
    cwd,
    repoRoot
}: {
    readonly cwd: string;
    readonly repoRoot: string;
}): Promise<WorktreeEnv | null> {
    const top = await run({ command: 'git', args: ['rev-parse', '--show-toplevel'], cwd });
    if (!top.ok) return null;
    const path = top.stdout.trim();
    const all = await listWorktrees({ repoRoot });
    return all.find((worktree) => worktree.path === path) ?? null;
}

/** The database of the main clone, and the shared Postgres container. */
export interface DbConfig {
    /** Development database of the main clone. */
    readonly devDb: string;
    /** Frozen template every worktree database is cloned from. */
    readonly templateDb: string;
    /** Docker container holding all of them. */
    readonly container: string;
    /** Postgres user. */
    readonly user: string;
    /** Connection string with a `{dbname}` placeholder. */
    readonly connStringTemplate: string;
    /** Environment variable the apps read the connection string from. */
    readonly connStringEnvVar: string;
}

/**
 * Reads the database settings from the project's worktree config.
 *
 * @param input.repoRoot - Repository root holding `.claude/project.config.json`.
 * @returns The settings, or `null` when the config is missing or unreadable.
 */
export function readDbConfig({ repoRoot }: { readonly repoRoot: string }): DbConfig | null {
    const path = join(repoRoot, '.claude', 'project.config.json');
    if (!existsSync(path)) return null;
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
            db?: {
                devDb?: string;
                templateDb?: string;
                container?: string;
                user?: string;
                connStringTemplate?: string;
                connStringEnvVar?: string;
            };
        };
        const db = parsed.db;
        if (db?.devDb === undefined || db.templateDb === undefined) return null;
        return {
            devDb: db.devDb,
            templateDb: db.templateDb,
            container: db.container ?? 'hospeda-postgres',
            user: db.user ?? 'postgres',
            connStringTemplate: db.connStringTemplate ?? '',
            connStringEnvVar: db.connStringEnvVar ?? 'HOSPEDA_DATABASE_URL'
        };
    } catch {
        return null;
    }
}

/**
 * Names the database a given worktree acts on.
 *
 * The main clone has no per-worktree database: it uses the shared development
 * one. Getting this backwards is how a migration lands on the wrong database.
 *
 * @param input.worktree - The worktree in question.
 * @param input.dbConfig - Project database settings.
 * @returns The database name, or `null` when it cannot be determined.
 */
export function databaseFor({
    worktree,
    dbConfig
}: {
    readonly worktree: WorktreeEnv;
    readonly dbConfig: DbConfig | null;
}): string | null {
    if (worktree.isMain) return dbConfig?.devDb ?? null;
    return worktree.database;
}
