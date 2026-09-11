/**
 * Lifecycle state of a worktree, derived exclusively from LOCAL git state.
 *
 * The classification answers one question: is it safe to delete this?
 * - `merged`      — no commits of its own over the base branch and no local
 *                   changes: whatever was here already landed.
 * - `unmerged`    — has commits the base branch does not have.
 * - `uncommitted` — has changes that were never committed anywhere.
 * - `missing`     — registered in git but its directory is gone.
 *
 * It is derived without consulting PR state, so `merged` means "nothing here is
 * unique to this worktree", not "its pull request was merged".
 */
export type WorktreeState = 'merged' | 'unmerged' | 'uncommitted' | 'missing';

/** A single worktree with everything needed to decide whether to remove it. */
export interface WorktreeInfo {
    /** Directory name (last path segment) — what the list shows first. */
    readonly name: string;
    /** Absolute path to the worktree directory. */
    readonly path: string;
    /** Whether this is the main clone (never removable). */
    readonly isMain: boolean;
    /** Whether the tool was invoked from inside this worktree. */
    readonly isCurrent: boolean;
    /** Checked-out branch, or `(detached)` / `—` when unavailable. */
    readonly branch: string;
    /** Derived removal-safety state. */
    readonly state: WorktreeState;
    /** Commits ahead of the base branch. */
    readonly ahead: number;
    /** Number of entries reported by `git status --porcelain`. */
    readonly dirty: number;
    /**
     * Commits not present on the upstream branch, or `null` when the branch has
     * NO upstream at all. `null` is not zero: it means nothing was ever pushed.
     */
    readonly unpushed: number | null;
    /** Disk usage in MB, or 0 when not measured. */
    readonly mb: number;
    /** Relative date of the last commit, e.g. `2 days ago`. */
    readonly lastRelative: string;
    /** Subject line of the last commit. */
    readonly lastSubject: string;
}

/** Outcome of removing one worktree. */
export interface RemovalResult {
    /** The worktree that was targeted. */
    readonly worktree: WorktreeInfo;
    /** Exit code returned by `wt-remove.sh`. */
    readonly exitCode: number;
    /** Whether `--force` was passed. */
    readonly forced: boolean;
}

/** Command-line options, after parsing argv. */
export interface CliOptions {
    /** Path the repository is resolved from. */
    readonly repoPath: string;
    /** Whether to measure disk usage (the slow part). */
    readonly measureDisk: boolean;
    /** Whether the user asked for the help page. */
    readonly help: boolean;
}
