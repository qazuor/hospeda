import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Absolute path of the monorepo this CLI is checked out in.
 *
 * Derived from the CLI's own location rather than hardcoded: `client-tools`
 * lives inside the repo, so walking up to the `pnpm-workspace.yaml` finds the
 * clone that owns this copy of the tool — which is the right default even when
 * the shell is somewhere else entirely.
 *
 * @returns The repository root.
 */
export function ownRepoRoot(): string {
    let current = dirname(import.meta.dir);
    for (let depth = 0; depth < 10; depth += 1) {
        if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
    }
    // scripts/client-tools/src/lib → four levels up is the repo root.
    return join(import.meta.dir, '..', '..', '..', '..');
}

/**
 * Resolves the repository the user means.
 *
 * The shell's own worktree wins when there is one, because running `hops` from
 * inside a worktree and having it report on a different clone is the kind of
 * wrong answer that reads as correct. Falls back to the clone this CLI lives in.
 *
 * @param input.cwd - Directory to resolve from.
 * @returns The absolute repository root.
 */
export async function resolveRepoRoot({ cwd }: { readonly cwd: string }): Promise<string> {
    const top = await new Promise<string | null>((resolve) => {
        execFile(
            'git',
            ['rev-parse', '--show-toplevel'],
            { cwd, timeout: 15_000 },
            (error, stdout) => resolve(error ? null : stdout.trim())
        );
    });
    return top !== null && top.length > 0 ? top : ownRepoRoot();
}
