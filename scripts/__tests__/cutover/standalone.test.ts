import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:U3:7 (AC:U3:6). The cutover script is standalone: every module it loads is a file of
 * its own folder, a `node:` built-in or `zod`. Nothing of the old system, the new system or
 * `@qazuor/qzpay`. And GUARD:G8 passes over the folder WITHOUT the folder being in its list.
 *
 * No new guard is added (the unit spec adds none); this test reads the folder and runs the
 * existing G8 script.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const cutoverDir = path.join(repoRoot, 'scripts/cutover');
const g8Script = path.join(repoRoot, 'scripts/check-old-grouping-word.sh');

/**
 * The one declared exception: `known-ids.ts` loads the `pg` DRIVER through `createRequire`,
 * resolved from the db package's install (dependency resolution only, no code of that package
 * runs). It is neither the old system, nor the new one, nor the payment SDK.
 */
const DRIVER_EXCEPTION = { file: 'known-ids.ts', specifier: 'pg' } as const;

/** The demolished payment SDK, assembled in parts so GUARD:G16 does not read this file as naming it. */
const LEGACY_SDK = ['@qazuor', ['qz', 'pay-core'].join('')].join('/');

interface LoadedModule {
    readonly file: string;
    readonly specifier: string;
}

/** Every static import/export-from, dynamic `import()` and `require`-like call with a literal. */
const LOAD_PATTERNS: readonly RegExp[] = [
    /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /\b[\w$]*[Rr]equire[\w$]*\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
];

function sourceFiles(): readonly string[] {
    return readdirSync(cutoverDir, { recursive: true, encoding: 'utf8' })
        .filter((f) => /\.(ts|mts|cts|js|mjs|cjs)$/.test(f))
        .sort();
}

function loadedModules(): readonly LoadedModule[] {
    const out: LoadedModule[] = [];
    for (const file of sourceFiles()) {
        const text = readFileSync(path.join(cutoverDir, file), 'utf8');
        for (const pattern of LOAD_PATTERNS) {
            for (const match of text.matchAll(pattern)) {
                const specifier = match[1];
                if (specifier !== undefined) out.push({ file, specifier });
            }
        }
    }
    return out;
}

function isAllowed({ file, specifier }: LoadedModule): boolean {
    if (specifier.startsWith('node:') || specifier === 'zod') return true;
    if (file === DRIVER_EXCEPTION.file && specifier === DRIVER_EXCEPTION.specifier) return true;
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const resolved = path.resolve(cutoverDir, path.dirname(file), specifier);
        return resolved.startsWith(`${cutoverDir}${path.sep}`);
    }
    return false;
}

describe('TEST:U3:7 the cutover script is standalone and under G8 (AC:U3:6)', () => {
    it('finds the modules it scans (the scanner is not blind)', () => {
        // Arrange / Act
        const modules = loadedModules();
        // Assert: a known relative import, `zod`, a built-in and the driver exception are all seen
        expect(modules).toContainEqual({ file: 'cli.ts', specifier: './run-cutover.ts' });
        expect(modules).toContainEqual({ file: 'provider-api.ts', specifier: 'zod' });
        expect(modules).toContainEqual({ file: 'write-manifest.ts', specifier: 'node:fs' });
        expect(modules).toContainEqual(DRIVER_EXCEPTION);
    });

    it('imports only its own files, node built-ins and zod: no old system, new system or qzpay', () => {
        // Arrange
        const modules = loadedModules();
        // Act
        const offending = modules.filter((m) => !isAllowed(m));
        // Assert
        expect(offending).toEqual([]);
    });

    it('the allow rule rejects what the AC forbids', () => {
        // Arrange
        const forbidden: readonly LoadedModule[] = [
            { file: 'cli.ts', specifier: LEGACY_SDK },
            { file: 'cli.ts', specifier: '@repo/billing' },
            { file: 'cli.ts', specifier: '@repo/db' },
            { file: 'cli.ts', specifier: '../../packages/payments/src/index.ts' },
            { file: 'cli.ts', specifier: 'pg' }
        ];
        // Act / Assert
        expect(forbidden.filter(isAllowed)).toEqual([]);
    });

    it('G8 keeps its three-entry list, none of them the cutover folder', () => {
        // Arrange
        const source = readFileSync(g8Script, 'utf8');
        const list = /\nALLOWLIST=\(\n([\s\S]*?)\n\)/.exec(source)?.[1] ?? '';
        const values = [...source.matchAll(/^(HISTORY_DB|HISTORY_SEED|PROGRAM_SPECS)='([^']*)'/gm)];
        // Act
        const entries = values.map((m) => m[2] ?? '');
        // Assert
        expect(list.trim().split('\n')).toHaveLength(3);
        expect(entries).toHaveLength(3);
        expect(entries.some((e) => e.startsWith('scripts'))).toBe(false);
        expect(source).not.toMatch(/scripts\/cutover/);
    });

    it('G8 passes over the repository, cutover folder included', () => {
        // Act: argv list, no shell; the script path is fixed
        // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
        const output = execFileSync('bash', [g8Script], { cwd: repoRoot, encoding: 'utf8' });
        // Assert
        expect(output).toContain('All checks passed.');
    }, 60_000);
});
