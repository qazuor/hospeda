/**
 * @file fs-utils.ts
 * @description Shared recursive file collector for the icon-manifest analyzer
 * (HOS-369 sprite-manifest). Same walk shape as the pre-existing
 * `apps/web/test/static-guards/icon-sprite-shipped-weights.test.ts` file
 * collector, extracted here so the analyzer and its data-driven-group reader
 * (which walks a different directory, `packages/icons/src/icons/`) share one
 * implementation instead of two copies drifting apart.
 *
 * @module scripts/icon-manifest/fs-utils
 */

import fs from 'node:fs';
import path from 'node:path';

/** Directory names never worth descending into. */
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.astro']);

/**
 * Recursively collects every file under `dir` whose extension is in
 * `extensions`.
 *
 * @param params.dir - Root directory to walk. A missing directory yields an
 *   empty list rather than throwing, so a caller can point this at an
 *   optional location without a pre-flight existence check.
 * @param params.extensions - File extensions to include, each with its
 *   leading dot (e.g. `['.astro', '.ts', '.tsx']`).
 * @returns Absolute paths of every matching file, in directory-walk order.
 */
export function collectSourceFiles({
    dir,
    extensions
}: {
    readonly dir: string;
    readonly extensions: ReadonlyArray<string>;
}): string[] {
    if (!fs.existsSync(dir)) return [];

    const extensionSet = new Set(extensions);
    const files: string[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIPPED_DIRS.has(entry.name)) continue;
            files.push(...collectSourceFiles({ dir: full, extensions }));
            continue;
        }
        if (extensionSet.has(path.extname(entry.name))) files.push(full);
    }

    return files;
}
