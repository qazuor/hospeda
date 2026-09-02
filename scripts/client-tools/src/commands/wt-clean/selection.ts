import { formatWorktreeHint, formatWorktreeLabel } from './format.ts';
import { isRisky } from './inventory.ts';
import type { WorktreeInfo } from './types.ts';

/** Word the user must type to authorise destroying unmerged work. */
export const CONFIRM_WORD = 'borrar';

/**
 * Branches whose worktree is never offered for deletion.
 *
 * The staging checkout is where `hops` itself runs from and where the database
 * template is built. It has no commits of its own over the base — by
 * construction — so it classifies as "finished" and would sort to the very top
 * of the deletion list. Deleting it silently breaks the tool doing the
 * deleting.
 */
const PROTECTED_BRANCHES = new Set(['staging', 'main', 'master']);

/**
 * Whether a worktree is protected from deletion by its branch.
 *
 * @param input.branch - The checked-out branch.
 * @returns `true` when it must never be offered.
 */
export function isProtectedBranch({ branch }: { readonly branch: string }): boolean {
    return PROTECTED_BRANCHES.has(branch.trim());
}

/** One entry of the multiselect prompt. */
export interface WorktreeOption {
    /** Absolute path, used as the option's identity. */
    readonly value: string;
    /** The line shown in the list. */
    readonly label: string;
    /** The secondary line shown for the highlighted option. */
    readonly hint: string;
}

/**
 * Builds the multiselect options from the removable worktrees.
 *
 * Only what can actually be torn down is offered. The main clone and stale
 * registrations are reported in the inventory note instead: an option you are
 * not allowed to pick is noise in a list this long.
 *
 * @param input.worktrees - The full inventory.
 * @returns One option per removable worktree.
 */
export function buildOptions({
    worktrees
}: {
    readonly worktrees: readonly WorktreeInfo[];
}): readonly WorktreeOption[] {
    return worktrees
        .filter(
            (worktree) =>
                !worktree.isMain &&
                worktree.state !== 'missing' &&
                !isProtectedBranch({ branch: worktree.branch })
        )
        .map((worktree) => ({
            value: worktree.path,
            label: formatWorktreeLabel({ worktree }),
            hint: formatWorktreeHint({ worktree })
        }));
}

/**
 * Splits a selection into the worktrees that need `--force` and the rest.
 *
 * @param input.selected - The worktrees the user checked.
 * @returns The risky ones and the safe ones, preserving order.
 */
export function partitionSelection({ selected }: { readonly selected: readonly WorktreeInfo[] }): {
    readonly risky: readonly WorktreeInfo[];
    readonly safe: readonly WorktreeInfo[];
} {
    return {
        risky: selected.filter((worktree) => isRisky({ worktree })),
        safe: selected.filter((worktree) => !isRisky({ worktree }))
    };
}

/**
 * Whether a typed confirmation authorises the destructive removal.
 *
 * @param input.answer - What the user typed.
 * @returns `true` only for the exact confirmation word, case-insensitively.
 */
export function isConfirmed({ answer }: { readonly answer: string }): boolean {
    return answer.trim().toLowerCase() === CONFIRM_WORD;
}
