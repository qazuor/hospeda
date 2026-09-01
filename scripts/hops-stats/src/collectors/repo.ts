import { run } from '../exec.js';
import type { Outcome, RepoStats, WorktreeInfo, WorktreeState } from '../types.js';

/** Parse `git worktree list --porcelain` down to the worktree paths. */
function parseWorktrees(porcelain: string): string[] {
    return porcelain
        .split('\n')
        .filter((line) => line.startsWith('worktree '))
        .map((line) => line.slice('worktree '.length))
        .filter((path) => path.length > 0);
}

const int = (text: string): number => {
    const n = Number.parseInt(text.trim(), 10);
    return Number.isNaN(n) ? 0 : n;
};

/**
 * Inspect one worktree using only local git state.
 *
 * The classification answers the question that matters when disk runs out:
 * which of these can I delete? `merged` means nothing here is unique — no
 * commits the integration branch lacks, nothing uncommitted. It is a directory
 * whose work already landed.
 */
async function inspect(
    path: string,
    base: string,
    measureDisk: boolean,
    mainPath: string
): Promise<WorktreeInfo> {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const isMain = path === mainPath;
    const missing: WorktreeInfo = {
        name,
        path,
        isMain,
        branch: '—',
        state: 'missing',
        ahead: 0,
        dirty: 0,
        unpushed: null,
        mb: 0,
        lastCommit: 'el directorio ya no existe'
    };

    const branchResult = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: path,
        timeoutMs: 20_000
    });
    if (!branchResult.ok) return missing;
    const branch =
        branchResult.stdout.trim() === 'HEAD' ? '(detached)' : branchResult.stdout.trim();

    const [aheadResult, statusResult, upstreamResult, subjectResult] = await Promise.all([
        run('git', ['rev-list', '--count', `${base}..HEAD`], { cwd: path, timeoutMs: 30_000 }),
        run('git', ['status', '--porcelain'], { cwd: path, timeoutMs: 30_000 }),
        run('git', ['rev-list', '--count', '@{upstream}..HEAD'], { cwd: path, timeoutMs: 30_000 }),
        run('git', ['log', '-1', '--format=%cr — %s'], { cwd: path, timeoutMs: 20_000 })
    ]);

    const ahead = aheadResult.ok ? int(aheadResult.stdout) : 0;
    const dirty = statusResult.ok
        ? statusResult.stdout.split('\n').filter((l) => l.trim().length > 0).length
        : 0;
    // No upstream is not zero unpushed commits: it means nothing was ever pushed.
    const unpushed = upstreamResult.ok ? int(upstreamResult.stdout) : null;

    let mb = 0;
    if (measureDisk) {
        const du = await run('du', ['-sm', '--', path], { timeoutMs: 180_000 });
        if (du.ok) mb = int(du.stdout.split('\t')[0] ?? '');
    }

    const state: WorktreeState = dirty > 0 ? 'uncommitted' : ahead > 0 ? 'unmerged' : 'merged';

    return {
        name,
        path,
        isMain,
        branch,
        state,
        ahead,
        dirty,
        unpushed,
        mb,
        lastCommit: subjectResult.ok ? subjectResult.stdout.trim().slice(0, 64) : '—'
    };
}

/**
 * Worktree inventory: what each one is holding, and what can be reclaimed.
 *
 * The `du` pass is what makes this section slow, so it is the only part that
 * can be skipped.
 */
export async function collectRepo(
    repo: string,
    base: string,
    measureDisk = true
): Promise<Outcome<RepoStats>> {
    const listed = await run('git', ['worktree', 'list', '--porcelain'], { cwd: repo });
    if (!listed.ok) return { ok: false, reason: `git worktree list falló: ${listed.error}` };

    const paths = parseWorktrees(listed.stdout);
    if (paths.length === 0) return { ok: false, reason: 'no se encontraron worktrees' };

    const worktrees: WorktreeInfo[] = [];
    for (const path of paths) worktrees.push(await inspect(path, base, measureDisk, repo));

    const gitDir = await run('du', ['-sm', '--', `${repo}/.git`], { timeoutMs: 120_000 });
    const gitMb = measureDisk && gitDir.ok ? int(gitDir.stdout.split('\t')[0] ?? '') : 0;

    const order: Record<WorktreeState, number> = {
        uncommitted: 0,
        unmerged: 1,
        merged: 2,
        missing: 3
    };
    // The main clone sorts last within its group and is never counted as
    // reclaimable: deleting it is not a cleanup, it is losing the repository.
    worktrees.sort(
        (a, b) =>
            order[a.state] - order[b.state] || Number(a.isMain) - Number(b.isMain) || b.mb - a.mb
    );

    return {
        ok: true,
        data: {
            worktrees,
            totalMb: worktrees.reduce((sum, w) => sum + w.mb, 0),
            gitMb,
            reclaimableMb: worktrees
                .filter((w) => w.state === 'merged' && w.path !== repo)
                .reduce((sum, w) => sum + w.mb, 0)
        }
    };
}
