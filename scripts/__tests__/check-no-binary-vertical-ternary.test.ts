/**
 * @fileoverview
 * HOS-1419 TEST:U1:17. `check-no-binary-vertical-ternary.sh` still turns a
 * `x === 'gastronomy' ? A : B` in shared API code red, its message gives the
 * remedy and never names the retired grouping word, and the two guards that U1
 * deleted (`check-product-domain-vocabulary`, `check-product-domain-raw-sql`) are
 * gone from the tree, `package.json` and `ci.yml`.
 *
 * The guard scans a relative `apps/api/src`, so each case runs it with its own
 * cwd inside a throwaway tree.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GUARD = path.join(REPO_ROOT, 'scripts/check-no-binary-vertical-ternary.sh');

/** The retired grouping word, spelled in parts so it never appears in the tree. */
const RETIRED_WORD = `${'comm'}${'erce'}`;

const tempDirs: string[] = [];

/** Builds a temp tree whose `apps/api/src/<file>` holds `source`, runs the guard in it. */
function runGuardOver(args: { readonly source: string; readonly file?: string }) {
    const root = mkdtempSync(path.join(tmpdir(), 'ternary-guard-'));
    tempDirs.push(root);
    const dir = path.join(root, 'apps/api/src');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, args.file ?? 'shared.ts'), args.source);
    const result = spawnSync('bash', [GUARD], { cwd: root, encoding: 'utf8' });
    return { exitCode: result.status, output: `${result.stdout}${result.stderr}` };
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('check-no-binary-vertical-ternary.sh', () => {
    it('is green over a tree with an exhaustive switch', () => {
        const { exitCode } = runGuardOver({
            source: `export function f(v: string) {
    switch (v) {
        case 'gastronomy':
            return 1;
        default:
            throw new Error('unknown');
    }
}
`
        });
        expect(exitCode).toBe(0);
    });

    it('is red on a binary ternary keyed on the literal, with the remedy and no retired word', () => {
        const { exitCode, output } = runGuardOver({
            source: "export const f = (v: string) => (v === 'gastronomy' ? 1 : 2);\n"
        });
        expect(exitCode).toBe(1);
        expect(output).toContain('shared.ts');
        expect(output).toMatch(/exhaustive `switch`/);
        expect(output).toMatch(/default/);
        expect(output.toLowerCase()).not.toContain(RETIRED_WORD);
    });

    it('still ignores test files', () => {
        const { exitCode } = runGuardOver({
            file: 'shared.test.ts',
            source: "export const f = (v: string) => (v === 'gastronomy' ? 1 : 2);\n"
        });
        expect(exitCode).toBe(0);
    });
});

describe('the two deleted product-domain guards', () => {
    const DELETED = ['check-product-domain-vocabulary', 'check-product-domain-raw-sql'] as const;

    it('have no script file left under scripts/', () => {
        for (const name of DELETED) {
            expect(existsSync(path.join(REPO_ROOT, `scripts/${name}.sh`)), name).toBe(false);
        }
    });

    it('are absent from root package.json and .github/workflows/ci.yml', () => {
        const pkg = readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
        const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
        for (const name of DELETED) {
            expect(pkg, `package.json names ${name}`).not.toContain(name);
            expect(ci, `ci.yml names ${name}`).not.toContain(name);
        }
    });
});
