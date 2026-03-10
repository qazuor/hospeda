import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves the absolute path to the monorepo root directory.
 *
 * Walks up from the directory containing this file until it finds
 * `pnpm-workspace.yaml`, which serves as a reliable marker for the
 * monorepo root. Falls back to walking up two levels if the marker
 * is not found (e.g. when running from a build output directory).
 *
 * @returns Absolute path string of the monorepo root.
 *
 * @example
 * ```ts
 * const root = findMonorepoRoot();
 * // "/home/user/projects/hospeda"
 * ```
 */
export function findMonorepoRoot(): string {
    const thisFile = fileURLToPath(import.meta.url);
    let current = dirname(thisFile);

    // Walk up looking for pnpm-workspace.yaml
    for (let i = 0; i < 10; i++) {
        if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
            return current;
        }
        const parent = dirname(current);
        if (parent === current) break; // reached filesystem root
        current = parent;
    }

    // Fallback: assume scripts/cli/ is two levels below root
    const fallback = join(dirname(thisFile), '..', '..');
    return fallback;
}

/**
 * Type guard that checks if an error is an ExitPromptError from @inquirer/prompts.
 * Centralizes the duck-typing check to avoid fragile duplication across modules.
 *
 * @param error - The unknown value to inspect
 * @returns `true` if the error has `name === 'ExitPromptError'`, `false` otherwise
 *
 * @example
 * ```ts
 * try {
 *   await select({ message: 'Pick one', choices });
 * } catch (error) {
 *   if (isExitPromptError(error)) process.exit(0);
 *   throw error;
 * }
 * ```
 */
export function isExitPromptError(error: unknown): boolean {
    return (
        error !== null &&
        typeof error === 'object' &&
        'name' in error &&
        (error as { name: string }).name === 'ExitPromptError'
    );
}
