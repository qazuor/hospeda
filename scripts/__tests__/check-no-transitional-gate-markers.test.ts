import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-no-transitional-gate-markers';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempDirs: string[] = [];
afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTree(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'no-transitional-gate-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    mkdirSync(path.join(root, 'apps/api/src'), { recursive: true });
    for (const [file, source] of Object.entries(files)) {
        const target = path.join(root, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, source);
    }
    execFileSync('git', ['add', '--', 'apps/api/src'], { cwd: root, stdio: 'pipe' });
    return root;
}

function check(files: Readonly<Record<string, string>>) {
    return run({ root: makeTree(files), minScannedFiles: 1 });
}

const marker = 'HOS-1352: transitional until V3';

describe('TEST:V5:34 exit guard', () => {
    it('accepts the real API source tree with zero markers', () => {
        expect(run().exitCode).toBe(0);
    });

    it.each([
        [
            'apps/api/src/routes/example.ts',
            'const route = 1;\n// HOS-1352: transitional until V3',
            2
        ],
        ['apps/api/src/services/example.ts', `const service = '${marker}';`, 1],
        ['apps/api/src/routes/doc.ts', `/**\n * ${marker}\n */`, 2],
        ['apps/api/src/types.ts', `type Example = 1;\n${marker}`, 2]
    ] as const)('rejects a marker at %s:%i', (file, source, line) => {
        const result = check({ [file]: source });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`${file}:${line}:`);
        expect(result.output).toContain(marker);
    });

    it('ignores markers outside apps/api/src', () => {
        expect(
            check({
                'apps/api/src/clean.ts': 'export const clean = true;',
                'apps/api/test/example.ts': marker
            }).exitCode
        ).toBe(0);
    });

    it('fails closed when the source tree is empty', () => {
        const result = run({ root: makeTree({}) });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('scanned 0 files; expected at least 1000');
    });

    it('reports both marker lines in one file', () => {
        const file = 'apps/api/src/types.ts';
        const result = check({ [file]: `${marker}\nconst x = 1;\n${marker}` });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`${file}:1:`);
        expect(result.output).toContain(`${file}:3:`);
    });

    it('wires the package script, guards chain, and guards job step', async () => {
        const fs = await import('node:fs');
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
        expect(pkg.scripts['check:no-transitional-gate-markers']).toBe(
            'tsx scripts/check-no-transitional-gate-markers.ts'
        );
        const chain = pkg.scripts['check:guards'];
        expect(chain).toContain('pnpm check:no-transitional-gate-markers');
        expect(chain.indexOf('pnpm check:no-transitional-gate-markers')).toBeLessThan(
            chain.indexOf('pnpm check:fake-lies')
        );
        expect(chain.trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
        const block = ci.match(/(?<= {2}guards:\n)[\s\S]*?(?=\n {2}[\w-]+:|$)/)?.[0] ?? '';
        expect(block).toContain(
            'Check no transitional gate markers remain in apps/api/src (AC:V5:29)'
        );
        expect(block).toContain('run: pnpm check:no-transitional-gate-markers');
    });
});
