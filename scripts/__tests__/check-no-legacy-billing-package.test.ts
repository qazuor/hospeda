/**
 * @fileoverview TEST:1626:3 (AC:1626:3): the retired package guard rejects
 * each declared predicate, keeps the similarly named contract package green,
 * and is wired into local and CI guard entry points.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-no-legacy-billing-package.js';

const legacyPackage = ['@repo', 'billing'].join('/');
const contractPackage = ['@repo', 'billing-verticals-contract'].join('/');
const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Create a temporary Git tree with the supplied files. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'no-legacy-billing-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

const GREEN: Readonly<Record<string, string>> = {
    'package.json': JSON.stringify({ name: 'fixture-root' }),
    'packages/billing-verticals-contract/package.json': JSON.stringify({
        name: contractPackage
    }),
    'apps/web/package.json': JSON.stringify({ dependencies: { [contractPackage]: 'workspace:*' } }),
    'apps/web/src/contract.ts': `import type { Contract } from '${contractPackage}';\n`,
    'apps/web/tsconfig.json': JSON.stringify({
        compilerOptions: {
            paths: { [contractPackage]: ['../../packages/billing-verticals-contract/src'] }
        }
    }),
    'apps/web/src/entry.ts': 'export const clean = true;\n'
};

/** Assert one new tree violates the named predicate at the named file. */
function expectViolation({
    files,
    predicate,
    file,
    line
}: {
    readonly files: Readonly<Record<string, string>>;
    readonly predicate: string;
    readonly file: string;
    readonly line?: number;
}): void {
    const result = run({ root: makeTree({ files: { ...GREEN, ...files } }), minScannedFiles: 0 });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(`FAIL predicate (${predicate}):`);
    expect(result.output).toContain(`${file}${line === undefined ? '' : `:${line}`}`);
}

describe('TEST:1626:3 — GUARD:no legacy billing package', () => {
    it('keeps the similarly named verticals contract package green', () => {
        const result = run({ root: makeTree({ files: GREEN }), minScannedFiles: 0 });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('no legacy billing package references found');
    });

    it('fails predicate (a) when the retired package directory returns', () => {
        expectViolation({
            files: { 'packages/billing/package.json': JSON.stringify({ name: 'fixture' }) },
            predicate: 'a',
            file: 'packages/billing'
        });
    });

    it.each([
        ['dependencies', { dependencies: { [legacyPackage]: 'workspace:*' } }],
        ['devDependencies', { devDependencies: { [legacyPackage]: 'workspace:*' } }],
        ['pnpm.overrides', { pnpm: { overrides: { [legacyPackage]: '1.0.0' } } }]
    ])('fails predicate (b) for %s', (_name, manifest) => {
        expectViolation({
            files: { 'apps/web/package.json': JSON.stringify(manifest) },
            predicate: 'b',
            file: 'apps/web/package.json'
        });
    });

    it('fails predicate (b) when a manifest value points to the anchored package path', () => {
        expectViolation({
            files: {
                'apps/web/package.json': JSON.stringify({
                    dependencies: { retired: 'link:../../packages/billing' }
                })
            },
            predicate: 'b',
            file: 'apps/web/package.json'
        });
    });

    it('fails predicate (b) closed when a package manifest is malformed JSON', () => {
        expectViolation({
            files: { 'apps/web/package.json': '{not json' },
            predicate: 'b',
            file: 'apps/web/package.json'
        });
    });

    it.each([
        [`import { x } from '${legacyPackage}';\n`, 1],
        [`export { x } from '${legacyPackage}/sub';\n`, 1],
        [`const x = await import('${legacyPackage}');\n`, 1]
    ])('fails predicate (c) on a production module string', (source, line) => {
        expectViolation({
            files: { 'apps/web/src/legacy.ts': source },
            predicate: 'c',
            file: 'apps/web/src/legacy.ts',
            line
        });
    });

    it('ignores a package string inside a comment, with a production control that fails', () => {
        const commented = run({
            root: makeTree({
                files: { ...GREEN, 'apps/web/src/legacy.ts': `// from '${legacyPackage}'\n` }
            }),
            minScannedFiles: 0
        });
        const productionControl = run({
            root: makeTree({
                files: { ...GREEN, 'apps/web/src/legacy.ts': `import '${legacyPackage}';\n` }
            }),
            minScannedFiles: 0
        });

        expect(commented.exitCode).toBe(0);
        expect(productionControl.exitCode).toBe(1);
        expect(productionControl.output).toContain('apps/web/src/legacy.ts:1');
    });

    it('ignores the same package import in a test file, with a production control that fails', () => {
        const testImport = run({
            root: makeTree({
                files: { ...GREEN, 'apps/web/test/x.test.ts': `import '${legacyPackage}';\n` }
            }),
            minScannedFiles: 0
        });
        const productionControl = run({
            root: makeTree({
                files: { ...GREEN, 'apps/web/src/x.ts': `import '${legacyPackage}';\n` }
            }),
            minScannedFiles: 0
        });

        expect(testImport.exitCode).toBe(0);
        expect(productionControl.exitCode).toBe(1);
        expect(productionControl.output).toContain('apps/web/src/x.ts:1');
    });

    it.each([
        [
            'packages/typescript-config/package-base.json',
            'packages/typescript-config/package-base.json'
        ],
        ['apps/web/tsconfig.json', 'apps/web/tsconfig.json']
    ])('fails predicate (d) for TypeScript paths in %s', (file, reportedFile) => {
        expectViolation({
            files: {
                [file]: JSON.stringify({ compilerOptions: { paths: { [legacyPackage]: ['x'] } } })
            },
            predicate: 'd',
            file: reportedFile
        });
    });

    it('fails closed when the production code scan is below its floor', () => {
        const result = run({ root: makeTree({ files: GREEN }) });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('The scan is broken.');
    });

    it('is green over the real branch and reports more than 1000 scanned files', () => {
        const result = run();
        const count = result.output.match(/(\d+) code file\(s\) scanned/);

        expect(result.exitCode).toBe(0);
        expect(count).not.toBeNull();
        expect(Number(count?.[1])).toBeGreaterThan(1000);
    });

    it('is wired as a script, before role-never-decides, and in the guards CI job', () => {
        const root = path.resolve(import.meta.dirname, '../..');
        const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
        const ci = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
        const guards = pkg.scripts['check:guards'].split('&&').map((part: string) => part.trim());
        const guardIndex = guards.indexOf('pnpm check:no-legacy-billing-package');
        const roleIndex = guards.indexOf('pnpm check:role-never-decides');

        expect(pkg.scripts['check:no-legacy-billing-package']).toBe(
            'tsx scripts/check-no-legacy-billing-package.ts'
        );
        expect(guardIndex).toBeGreaterThanOrEqual(0);
        expect(roleIndex).toBeGreaterThan(guardIndex);
        expect(guards.at(-1)).toBe('pnpm check:fake-lies');
        expect(ci).toContain('run: pnpm check:no-legacy-billing-package');
    });
});
