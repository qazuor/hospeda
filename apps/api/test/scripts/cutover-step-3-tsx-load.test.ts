/**
 * Proves the V6 cutover step 3 module graph loads under tsx (HOS-1745).
 *
 * `hops cutover-step-3` runs the script as
 * `pnpm --dir apps/api exec tsx scripts/cutover-v6-step-3.ts`, so tsx picks
 * `apps/api/tsconfig.json` and transpiles every workspace source the script
 * reaches. This test spawns that same invocation over a throwaway entry that
 * imports each module the script imports dynamically. It never runs `main()`,
 * never opens a connection and needs no database: module loading is the whole
 * subject under test.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const API_ROOT = join(REPO_ROOT, 'apps/api');
const TIMEOUT_MS = 180_000;

/** Absolute file URLs for every module the script imports dynamically. */
function moduleUrls(): readonly string[] {
    const require = createRequire(join(API_ROOT, 'package.json'));
    return [
        require.resolve('pg'),
        join(REPO_ROOT, 'packages/db/src/index.ts'),
        join(REPO_ROOT, 'packages/service-core/src/index.ts'),
        join(API_ROOT, 'src/services/cutover-v6/step-3.service.ts'),
        join(API_ROOT, 'src/utils/clock.ts')
    ].map((path) => pathToFileURL(path).href);
}

describe('TEST:1745d:1 cutover step 3 module graph loads under tsx', () => {
    it(
        'exits 0 when tsx imports every dynamically imported module',
        () => {
            // Arrange
            const tempDir = mkdtempSync(join(tmpdir(), 'hos-1745-tsx-load-'));
            const entry = join(tempDir, 'load-graph.mts');
            const imports = moduleUrls().map((url) => `await import('${url}');`);
            writeFileSync(entry, `${imports.join('\n')}\nconsole.log('LOADED');\n`, 'utf8');

            try {
                // Act
                const child = spawnSync('pnpm', ['--dir', 'apps/api', 'exec', 'tsx', entry], {
                    cwd: REPO_ROOT,
                    env: { ...process.env, CI: 'true' },
                    encoding: 'utf8',
                    timeout: TIMEOUT_MS
                });

                // Assert
                const details = [
                    `exit=${child.status}`,
                    `error=${child.error?.message ?? 'none'}`,
                    `stdout:\n${child.stdout}`,
                    `stderr:\n${child.stderr}`
                ].join('\n');
                expect(child.error, details).toBeUndefined();
                expect(child.status, details).toBe(0);
                expect(child.stdout, details).toContain('LOADED');
            } finally {
                rmSync(tempDir, { recursive: true, force: true });
            }
        },
        TIMEOUT_MS
    );
});

describe('TEST:1745e:2 step 3 invocation exit code', () => {
    it(
        'preserves exit code 2 from the child script',
        () => {
            const tempDir = mkdtempSync(join(tmpdir(), 'hos-1745-exit-'));
            const entry = join(tempDir, 'exit-two.ts');
            writeFileSync(entry, 'process.exit(2);\n', 'utf8');

            try {
                const child = spawnSync('pnpm', ['--dir', 'apps/api', 'exec', 'tsx', entry], {
                    cwd: REPO_ROOT,
                    env: { ...process.env, CI: 'true' },
                    encoding: 'utf8',
                    timeout: TIMEOUT_MS
                });
                const details = [
                    `exit=${child.status}`,
                    `error=${child.error?.message ?? 'none'}`,
                    `stdout:\n${child.stdout}`,
                    `stderr:\n${child.stderr}`
                ].join('\n');
                expect(child.error, details).toBeUndefined();
                expect(child.status, details).toBe(2);
                expect(`${child.stdout}\n${child.stderr}`, details).not.toContain('undefined');
            } finally {
                rmSync(tempDir, { recursive: true, force: true });
            }
        },
        TIMEOUT_MS
    );
});
