/**
 * Static guard for the API cutover scripts (HOS-1745 third correction).
 *
 * Every `.ts` file under `apps/api/scripts/` must obtain the database URL from
 * the env module namespace after validation. Destructuring `env` out of
 * `await import('.../utils/env')` captures the `undefined` of an `export let`
 * that `validateApiEnv()` populates later, which is the bug that broke the
 * staging smoke. No script is executed here: the guard only reads its text.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPTS_DIR = resolve(import.meta.dirname, '../../scripts');
const DESTRUCTURED_ENV_FROM_UTILS_ENV =
    /const\s*\{[^}]*\benv\b[^}]*\}\s*=\s*await\s+import\(\s*['"][^'"]*utils\/env(\.js)?['"]\s*\)/;

/** Lists every TypeScript file under `dir`, recursively. */
function listTypeScriptFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return listTypeScriptFiles(path);
        return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
    });
}

describe('TEST:1745c:2 no cutover script destructures env before validation', () => {
    it('scans every script and finds no destructured env from utils/env', () => {
        // Arrange
        const files = listTypeScriptFiles(SCRIPTS_DIR);

        // Act
        const offenders = files.filter((file) =>
            DESTRUCTURED_ENV_FROM_UTILS_ENV.test(readFileSync(file, 'utf8'))
        );

        // Assert
        expect(files.length).toBeGreaterThan(0);
        expect(offenders).toEqual([]);
    });

    it('delegates the step 3 database url read to resolveStep3DatabaseUrl', () => {
        // Arrange
        const script = join(SCRIPTS_DIR, 'cutover-v6-step-3.ts');

        // Act
        const source = readFileSync(script, 'utf8');

        // Assert
        expect(source).toContain('resolveStep3DatabaseUrl(');
    });
});
