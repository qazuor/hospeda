import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM equivalent of __dirname for this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_DATA_BASE = path.resolve(__dirname, '../data');

const SRC_DATA_PREFIX = 'src/data/';

/**
 * Re-anchors a caller-supplied seed folder path to this package's own `src/data`,
 * making seed runs independent of `process.cwd()`.
 *
 * Accepts two caller shapes (absolute paths are NOT supported):
 *  - bare relative (`amenity`, `user/example`) → resolved under `SEED_DATA_BASE`
 *  - relative with the `src/data/` prefix (`src/data/amenity`) → prefix stripped, then anchored
 */
function resolveSeedFolder(folderPath: string): string {
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

    // Resolve the folder once, anchored to this package's own src/data via import.meta.url.
    // All callers must pass a bare relative path (e.g. 'src/data/<entity>' or '<entity>').
    // Absolute paths are not a supported input.
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
