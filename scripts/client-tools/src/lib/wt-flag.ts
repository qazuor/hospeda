import type { WorktreeEnv } from './worktree.ts';

/** Extracts `--wt <name>` from the argument list. */
export function extractWorktreeFlag({ argv }: { readonly argv: readonly string[] }): {
    readonly name: string | null;
    readonly rest: readonly string[];
} {
    const rest: string[] = [];
    let name: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] ?? '';
        const inline = /^--wt=(.+)$/.exec(arg);
        const value = inline?.[1] ?? (arg === '--wt' ? argv[i + 1] : undefined);
        if (value === undefined) {
            rest.push(arg);
            continue;
        }
        name = value;
        if (inline === null) i += 1;
    }
    return { name, rest };
}

/**
 * Finds a worktree by name, accepting the short form people actually type.
 *
 * `--wt hos-1010` matches `hospeda-hos-1010-ventana-cortesia`, because nobody
 * types the full directory name.
 *
 * @param input.all  - Every worktree.
 * @param input.name - What the user typed.
 * @returns The single match, or `null` when there is none or several.
 */
export function findWorktreeByName({
    all,
    name
}: {
    readonly all: readonly WorktreeEnv[];
    readonly name: string;
}): WorktreeEnv | null {
    const needle = name.toLowerCase();
    const exact = all.find((worktree) => worktree.name.toLowerCase() === needle);
    if (exact !== undefined) return exact;
    if (needle === 'main') return all.find((worktree) => worktree.isMain) ?? null;
    const partial = all.filter((worktree) => worktree.name.toLowerCase().includes(needle));
    return partial.length === 1 ? (partial[0] ?? null) : null;
}
