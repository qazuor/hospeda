import { run } from '../../lib/exec.ts';
import type { WorktreeInfo, WorktreeState } from './types.ts';

/** Branches tried, in order, as the reference every worktree is measured against. */
const BASE_CANDIDATES = [
    'origin/staging',
    'origin/main',
    'origin/master',
    'main',
    'master'
] as const;

/** `du` over a worktree walks a full dependency tree, so it gets its own ceiling. */
const DISK_TIMEOUT_MS = 180_000;

/** Parses an integer, treating anything unparseable as 0. */
function toInt(text: string): number {
    const parsed = Number.parseInt(text.trim(), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Extracts the worktree paths from `git worktree list --porcelain` output.
 *
 * The first entry is always the main clone, and that order is relied upon by
 * {@link collectWorktrees} to identify it.
 *
 * @param input.porcelain - Raw stdout of `git worktree list --porcelain`.
 * @returns The absolute paths, in the order git reported them.
 */
export function parseWorktreePaths({
    porcelain
}: {
    readonly porcelain: string;
}): readonly string[] {
    return porcelain
        .split('\n')
        .filter((line) => line.startsWith('worktree '))
        .map((line) => line.slice('worktree '.length).trim())
        .filter((path) => path.length > 0);
}

/**
 * Derives the removal-safety state from raw counters.
 *
 * Uncommitted work outranks unmerged commits because it is the only thing that
 * exists nowhere else: unmerged commits at least survive in the reflog.
 *
 * @param input.dirty - Count of `git status --porcelain` entries.
 * @param input.ahead - Commits ahead of the base branch.
 * @returns The resulting {@link WorktreeState}.
 */
export function classifyWorktree({
    dirty,
    ahead
}: {
    readonly dirty: number;
    readonly ahead: number;
}): WorktreeState {
    if (dirty > 0) return 'uncommitted';
    if (ahead > 0) return 'unmerged';
    return 'merged';
}

/**
 * Whether removing this worktree can destroy work that exists nowhere else.
 *
 * A branch with NO upstream (`unpushed === null`) carrying its own commits is
 * risky for the same reason as uncommitted changes: the commits live only here.
 *
 * @param input.worktree - The worktree to assess.
 * @returns `true` when removal requires an explicit extra confirmation.
 */
export function isRisky({ worktree }: { readonly worktree: WorktreeInfo }): boolean {
    if (worktree.state === 'uncommitted') return true;
    if (worktree.state === 'unmerged') return true;
    return false;
}

/**
 * Resolves the branch every worktree is measured against.
 *
 * @param input.repoRoot - Any path inside the repository.
 * @returns The first existing candidate ref, falling back to `HEAD`.
 */
export async function resolveBaseRef({ repoRoot }: { readonly repoRoot: string }): Promise<string> {
    for (const candidate of BASE_CANDIDATES) {
        const found = await run({
            command: 'git',
            args: ['rev-parse', '--verify', '--quiet', candidate],
            cwd: repoRoot
        });
        if (found.ok) return candidate;
    }
    return 'HEAD';
}

/**
 * Splits `git log --format=%cr%x00%s` output into its two fields.
 *
 * The separator is a NUL byte because a commit subject can contain any
 * printable character, an em dash included: splitting on one would truncate a
 * subject at the author's punctuation.
 *
 * @param input.raw - Raw stdout of the log command.
 * @returns The relative date and the subject, dashed out when unavailable.
 */
export function splitLastCommit({ raw }: { readonly raw: string }): {
    readonly lastRelative: string;
    readonly lastSubject: string;
} {
    const [relative, subject] = raw.trim().split('\0');
    return {
        lastRelative: relative?.trim() || '—',
        lastSubject: subject?.trim().slice(0, 72) || '—'
    };
}

/**
 * Inspects one worktree using only local git state.
 *
 * A worktree whose directory no longer exists yields the `missing` state
 * instead of an error: it is a stale git registration, and reporting it is the
 * point (it is what `git worktree prune` cleans up).
 *
 * @param input.path        - Absolute path of the worktree.
 * @param input.base        - Ref to compare commits against.
 * @param input.mainPath    - Absolute path of the main clone.
 * @param input.currentPath - Toplevel of the worktree the tool runs from, if any.
 * @param input.measureDisk - Whether to run `du` (the slow part).
 * @returns A fully populated {@link WorktreeInfo}.
 */
export async function inspectWorktree({
    path,
    base,
    mainPath,
    currentPath,
    measureDisk
}: {
    readonly path: string;
    readonly base: string;
    readonly mainPath: string;
    readonly currentPath: string | null;
    readonly measureDisk: boolean;
}): Promise<WorktreeInfo> {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const isMain = path === mainPath;
    const isCurrent = currentPath !== null && path === currentPath;

    const branchResult = await run({
        command: 'git',
        args: ['rev-parse', '--abbrev-ref', 'HEAD'],
        cwd: path,
        timeoutMs: 20_000
    });

    if (!branchResult.ok) {
        return {
            name,
            path,
            isMain,
            isCurrent,
            branch: '—',
            state: 'missing',
            ahead: 0,
            dirty: 0,
            unpushed: null,
            mb: 0,
            lastRelative: '—',
            lastSubject: 'el directorio ya no existe'
        };
    }

    const rawBranch = branchResult.stdout.trim();
    const branch = rawBranch === 'HEAD' ? '(detached)' : rawBranch;

    const [aheadResult, statusResult, upstreamResult, subjectResult, diskResult] =
        await Promise.all([
            run({ command: 'git', args: ['rev-list', '--count', `${base}..HEAD`], cwd: path }),
            run({ command: 'git', args: ['status', '--porcelain'], cwd: path }),
            run({ command: 'git', args: ['rev-list', '--count', '@{upstream}..HEAD'], cwd: path }),
            run({
                command: 'git',
                args: ['log', '-1', '--format=%cr%x00%s'],
                cwd: path,
                timeoutMs: 20_000
            }),
            measureDisk
                ? run({ command: 'du', args: ['-sm', '--', path], timeoutMs: DISK_TIMEOUT_MS })
                : Promise.resolve({ ok: false, stdout: '', error: 'skipped' })
        ]);

    const ahead = aheadResult.ok ? toInt(aheadResult.stdout) : 0;
    const dirty = statusResult.ok
        ? statusResult.stdout.split('\n').filter((line) => line.trim().length > 0).length
        : 0;
    // No upstream is not zero unpushed commits: it means nothing was ever pushed.
    const unpushed = upstreamResult.ok ? toInt(upstreamResult.stdout) : null;
    const mb = diskResult.ok ? toInt(diskResult.stdout.split('\t')[0] ?? '') : 0;

    return {
        name,
        path,
        isMain,
        isCurrent,
        branch,
        state: classifyWorktree({ dirty, ahead }),
        ahead,
        dirty,
        unpushed,
        mb,
        ...splitLastCommit({ raw: subjectResult.ok ? subjectResult.stdout : '' })
    };
}

/**
 * Sorts worktrees for a removal picker: the safest to delete first.
 *
 * This is the inverse of a status report's order. Here the list is a menu of
 * candidates, so `merged` (nothing unique left) leads, largest first, and the
 * main clone always sinks to the bottom of its group.
 *
 * @param input.worktrees - The inventory to order.
 * @returns A new, sorted array.
 */
export function sortForCleanup({
    worktrees
}: {
    readonly worktrees: readonly WorktreeInfo[];
}): readonly WorktreeInfo[] {
    const order: Record<WorktreeState, number> = {
        merged: 0,
        missing: 1,
        unmerged: 2,
        uncommitted: 3
    };
    return [...worktrees].sort(
        (a, b) =>
            order[a.state] - order[b.state] ||
            Number(a.isMain) - Number(b.isMain) ||
            b.mb - a.mb ||
            a.name.localeCompare(b.name)
    );
}

/**
 * Builds the full worktree inventory for the repository.
 *
 * Every worktree is inspected in parallel, which matters because the `du` pass
 * dominates the total time.
 *
 * @param input.repoRoot    - Any path inside the repository.
 * @param input.currentPath - Toplevel of the worktree the tool runs from, if any.
 * @param input.measureDisk - Whether to measure disk usage.
 * @returns The sorted inventory, or an empty array when git reports nothing.
 */
export async function collectWorktrees({
    repoRoot,
    currentPath,
    measureDisk = true
}: {
    readonly repoRoot: string;
    readonly currentPath: string | null;
    readonly measureDisk?: boolean;
}): Promise<readonly WorktreeInfo[]> {
    const listed = await run({
        command: 'git',
        args: ['worktree', 'list', '--porcelain'],
        cwd: repoRoot
    });
    if (!listed.ok) return [];

    const paths = parseWorktreePaths({ porcelain: listed.stdout });
    if (paths.length === 0) return [];

    const base = await resolveBaseRef({ repoRoot });
    // git always lists the main clone first, and that is the only reliable way
    // to identify it: the tool may well be running from inside a worktree.
    const mainPath = paths[0] ?? repoRoot;

    const worktrees = await Promise.all(
        paths.map((path) => inspectWorktree({ path, base, mainPath, currentPath, measureDisk }))
    );

    return sortForCleanup({ worktrees });
}

/**
 * Resolves the toplevel directory of the worktree the process runs from.
 *
 * @param input.cwd - Directory to resolve from.
 * @returns The absolute toplevel path, or `null` when outside a repository.
 */
export async function resolveCurrentWorktree({
    cwd
}: {
    readonly cwd: string;
}): Promise<string | null> {
    const top = await run({ command: 'git', args: ['rev-parse', '--show-toplevel'], cwd });
    return top.ok ? top.stdout.trim() : null;
}
