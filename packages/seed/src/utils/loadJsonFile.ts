import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM equivalent of __dirname for this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_DATA_BASE = path.resolve(__dirname, '../data');

const SRC_DATA_SEGMENT = '/src/data/';
const SRC_DATA_PREFIX = 'src/data/';

/**
 * Re-anchors a caller-supplied seed folder path to this package's own `src/data`,
 * making seed runs independent of `process.cwd()`.
 *
 * Handles three caller shapes:
 *  - bare relative (`amenity`, `user/example`) → resolved under `SEED_DATA_BASE`
 *  - relative with the `src/data/` prefix (`src/data/amenity`) → prefix stripped, then anchored
 *  - absolute (`path.resolve('src/data/amenity')`) → the segment after the LAST
 *    `/src/data/` is anchored. Using `lastIndexOf` (not `indexOf`) keeps this correct
 *    even when the repository itself lives under a path that contains `/src/data/`.
 *
 * An absolute path with no `/src/data/` segment is treated as already-correct and used as-is.
 */
function resolveSeedFolder(folderPath: string): string {
    if (path.isAbsolute(folderPath)) {
        const segmentIndex = folderPath.lastIndexOf(SRC_DATA_SEGMENT);
        if (segmentIndex !== -1) {
            const afterSrcData = folderPath.slice(segmentIndex + SRC_DATA_SEGMENT.length);
            return path.resolve(SEED_DATA_BASE, afterSrcData);
        }
        return folderPath;
    }

    const withoutSrcData = folderPath.startsWith(SRC_DATA_PREFIX)
        ? folderPath.slice(SRC_DATA_PREFIX.length)
        : folderPath;
    return path.resolve(SEED_DATA_BASE, withoutSrcData);
}

export async function loadJsonFiles<T = unknown>(
    folderPath: string,
    files: string[]
): Promise<T[]> {
    const results: T[] = [];

    // Resolve the folder once: it does not change between files. Several callers
    // pass `path.resolve('src/data/<entity>')`, which yields a cwd-absolute path,
    // while others pass a bare relative path. Both must be re-anchored to this
    // package's own `src/data` so the seed is cwd-independent.
    const resolvedFolderPath = resolveSeedFolder(folderPath);

    for (const file of files) {
        const fullPath = path.join(resolvedFolderPath, file);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            results.push(JSON.parse(content));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(
                `Failed to load seed file "${fullPath}" (folderPath="${folderPath}"): ${message}`
            );
        }
    }

    return results;
}
