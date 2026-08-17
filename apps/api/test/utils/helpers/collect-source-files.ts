/**
 * Recursively lists the `.ts` source files a static guard should scan.
 *
 * Kept as a helper so the guard asserts against a real directory walk rather
 * than a hand-listed set of paths — a hand-listed set silently stops covering
 * whatever gets added next, which is precisely what a static guard is for.
 *
 * @module test/utils/helpers/collect-source-files
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Directories that never contain route or middleware logic. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '__snapshots__']);

/**
 * Walks `root` and returns every non-test TypeScript file beneath it.
 *
 * @param root - Absolute path to start from
 * @returns Absolute paths of every `.ts` file, excluding `.test.ts`/`.d.ts`
 *
 * @example
 * const files = collectSourceFiles(join(__dirname, '../../src'));
 */
export const collectSourceFiles = (root: string): string[] => {
    const found: string[] = [];

    const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!SKIPPED_DIRECTORIES.has(entry.name)) {
                    walk(join(directory, entry.name));
                }
                continue;
            }
            if (
                entry.name.endsWith('.ts') &&
                !entry.name.endsWith('.d.ts') &&
                !entry.name.includes('.test.')
            ) {
                found.push(join(directory, entry.name));
            }
        }
    };

    walk(root);
    return found;
};
