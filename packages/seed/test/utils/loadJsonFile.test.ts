import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadJsonFiles } from '../../src/utils/loadJsonFile.js';

const WIFI_FILE = '001-amenity-connectivity-wifi.json';

/**
 * Regression coverage for the cwd-independent path resolution in `loadJsonFiles`.
 *
 * The bug: paths were resolved against `process.cwd()` (`path.resolve('src/data/...')`),
 * so running the seed from any directory other than `packages/seed` (e.g. a git
 * worktree root, the monorepo root, or a tmp dir) failed with ENOENT. The fix anchors
 * resolution to the package's own `src/data` via `import.meta.url`.
 *
 * Contract: `loadJsonFiles` accepts ONLY relative paths — either a bare entity folder
 * (e.g. 'amenity') or a 'src/data/<entity>' prefixed path. Absolute paths are NOT
 * a supported input and callers must not pass them.
 */
describe('loadJsonFiles — cwd-independent path resolution', () => {
    const originalCwd = process.cwd();

    afterEach(() => {
        process.chdir(originalCwd);
    });

    it('resolves a relative "src/data/<entity>" path regardless of cwd', async () => {
        // Arrange: move cwd somewhere unrelated to the package, reproducing the bug condition.
        process.chdir(os.tmpdir());

        // Act
        const [amenity] = await loadJsonFiles<{ slug: string }>('src/data/amenity', [WIFI_FILE]);

        // Assert
        expect(amenity?.slug).toBe('wifi');
    });

    it('resolves a bare entity folder path (no "src/data/" prefix) from cwd-independent base', async () => {
        process.chdir(os.tmpdir());

        const [amenity] = await loadJsonFiles<{ slug: string }>('amenity', [WIFI_FILE]);

        expect(amenity?.slug).toBe('wifi');
    });

    it('throws an error naming the resolved path and folderPath when a file is missing', async () => {
        process.chdir(os.tmpdir());

        await expect(loadJsonFiles('src/data/amenity', ['does-not-exist.json'])).rejects.toThrow(
            /Failed to load seed file.*does-not-exist\.json.*folderPath="src\/data\/amenity"/
        );
    });

    it('loads multiple files in declared order', async () => {
        process.chdir(os.tmpdir());

        const files = [WIFI_FILE, '002-amenity-climate-control-air-conditioning.json'];
        const results = await loadJsonFiles<{ id: string }>('src/data/amenity', files);

        expect(results).toHaveLength(2);
        expect(results[0]?.id).toBe('001-amenity-connectivity-wifi');
        expect(results[1]?.id).toBe('002-amenity-climate-control-air-conditioning');
    });
});
