import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { RemovalResult, WorktreeInfo } from './types.ts';

/**
 * Absolute path of the teardown script this tool delegates to.
 *
 * Removal is NOT reimplemented here on purpose: `wt-remove.sh` is the single
 * place that knows the full teardown (stop servers → drop the per-worktree DB →
 * `git worktree remove` → delete the branch). Duplicating any of that would
 * leave orphan servers and databases behind.
 *
 * @returns The script path, or `null` when the worktree skill is not installed.
 */
export function resolveRemoveScript(): string | null {
    const path = join(homedir(), '.claude', 'skills', 'worktree', 'scripts', 'wt-remove.sh');
    return existsSync(path) ? path : null;
}

/**
 * Builds the spawn arguments for removing one worktree.
 *
 * @param input.scriptPath - Absolute path to `wt-remove.sh`.
 * @param input.worktree   - The worktree to remove.
 * @param input.force      - Whether to pass `--force`.
 * @returns The executable and its argument list.
 */
export function buildRemoveArgs({
    scriptPath,
    worktree,
    force
}: {
    readonly scriptPath: string;
    readonly worktree: WorktreeInfo;
    readonly force: boolean;
}): { readonly command: string; readonly args: readonly string[] } {
    const args = [scriptPath, worktree.path];
    if (force) args.push('--force');
    return { command: 'bash', args };
}

/**
 * Orders the removal queue so the current worktree goes last.
 *
 * Removing the worktree the tool runs from leaves the user's shell sitting in a
 * deleted directory, so everything else is torn down first and that one is
 * handled at the very end, right before the `cd` reminder is printed.
 *
 * @param input.worktrees - The selected worktrees.
 * @returns A new array with the current worktree, if any, moved to the end.
 */
export function orderForRemoval({
    worktrees
}: {
    readonly worktrees: readonly WorktreeInfo[];
}): readonly WorktreeInfo[] {
    return [...worktrees].sort((a, b) => Number(a.isCurrent) - Number(b.isCurrent));
}

/**
 * Removes one worktree by delegating to `wt-remove.sh`, streaming its output.
 *
 * @param input.scriptPath - Absolute path to `wt-remove.sh`.
 * @param input.worktree   - The worktree to remove.
 * @param input.force      - Whether to pass `--force`.
 * @param input.cwd        - Directory to spawn from (must outlive the removal).
 * @returns A {@link RemovalResult} carrying the script's exit code.
 */
export function removeWorktree({
    scriptPath,
    worktree,
    force,
    cwd
}: {
    readonly scriptPath: string;
    readonly worktree: WorktreeInfo;
    readonly force: boolean;
    readonly cwd: string;
}): Promise<RemovalResult> {
    const { command, args } = buildRemoveArgs({ scriptPath, worktree, force });

    return new Promise<RemovalResult>((resolve) => {
        const child = spawn(command, [...args], { stdio: 'inherit', cwd });
        child.on('error', () => resolve({ worktree, exitCode: 1, forced: force }));
        child.on('close', (code: number | null) =>
            resolve({ worktree, exitCode: code ?? 1, forced: force })
        );
    });
}

/**
 * Prunes stale worktree registrations whose directories are already gone.
 *
 * @param input.cwd - Directory to run `git worktree prune` from.
 * @returns The exit code of the prune.
 */
export function pruneMissingWorktrees({ cwd }: { readonly cwd: string }): Promise<number> {
    return new Promise<number>((resolve) => {
        const child = spawn('git', ['worktree', 'prune', '-v'], { stdio: 'inherit', cwd });
        child.on('error', () => resolve(1));
        child.on('close', (code: number | null) => resolve(code ?? 1));
    });
}
