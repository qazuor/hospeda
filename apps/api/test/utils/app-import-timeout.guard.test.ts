/**
 * Static guard for cold app imports (HOS-2219).
 *
 * A dynamic `import('…/src/app')` inside a hook or test runs under the 30 s
 * `hookTimeout`/`testTimeout`, and a cold import of the whole app under a
 * loaded CI runner can pass that. Such files must pass `APP_IMPORT_TIMEOUT_MS`.
 *
 * What it cannot see:
 * - It checks per file, not per call: one call with the timeout satisfies it
 *   for every other call in the same file.
 * - A top-level `await import(…)` (column 0) is exempt, because it runs during
 *   collection, which has no timeout.
 * - Static imports and imports through a helper in another file are not seen.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TEST_ROOT = join(import.meta.dirname, '..');
const APP_IMPORT = /import\s*\(\s*['"][^'"]*src\/app(?:\.js)?['"]\s*\)/;

/** True when a dynamic app import appears inside a function body (indented). */
function hasNestedAppImport(source: string): boolean {
    return source.split('\n').some((line) => APP_IMPORT.test(line) && /^\s/.test(line));
}

function testFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) return testFiles(fullPath);
        return entry.isFile() && entry.name.endsWith('.test.ts') ? [fullPath] : [];
    });
}

describe('HOS-2219 app import timeout guard', () => {
    it('every test file importing src/app inside a hook or test references the timeout constant', () => {
        const offenders = testFiles(TEST_ROOT).filter((file) => {
            const source = readFileSync(file, 'utf8');
            return hasNestedAppImport(source) && !source.includes('APP_IMPORT_TIMEOUT_MS');
        });

        expect(offenders.map((file) => file.slice(TEST_ROOT.length + 1))).toEqual([]);
    });
});
