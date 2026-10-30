/**
 * @fileoverview
 * TEST:V2:8 (HOS-1435, AC:V2:5): no code of the verticals half writes
 * `addon_product.version_id`. Green on the branch, and broken on purpose over
 * throwaway git trees: each case applies ONE mutation to a green tree.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-verticals-no-addon-product-write.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FOLDERS = ['packages/verticals'] as const;

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'v2-8-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

/** A green tree: verticals creates an addon version; billing re-points its product. */
const GREEN: Readonly<Record<string, string>> = {
    'packages/verticals/src/addon.ts':
        "import { addonVersions } from '@repo/db';\nexport const publish = (db, addonId) => db.insert(addonVersions).values({ addonId });\n",
    'packages/billing/src/addon-product.ts':
        "import { addonProducts } from '@repo/db';\nexport const repoint = (db, versionId) => db.update(addonProducts).set({ versionId });\n"
};

const guardOver = (overrides: Readonly<Record<string, string>> = {}) =>
    run({ root: makeTree({ files: { ...GREEN, ...overrides } }), folders: FOLDERS });

describe('TEST:V2:8 on the branch', () => {
    it('is green over the repo', () => {
        const { exitCode, output } = run({ root: REPO_ROOT });
        expect(output).toContain('OK:');
        expect(output).toContain('packages/verticals');
        expect(exitCode).toBe(0);
    });

    it('is green over a tree where only billing re-points the product', () => {
        const { exitCode } = guardOver();
        expect(exitCode).toBe(0);
    });
});

describe('TEST:V2:8 broken on purpose', () => {
    it('a Drizzle write of addonProducts.versionId from verticals is red, naming the file and line', () => {
        const { exitCode, output } = guardOver({
            'packages/verticals/src/publish.ts':
                "import { addonProducts } from '@repo/db';\n\nexport const publish = (db, versionId) =>\n    db.update(addonProducts).set({ versionId });\n"
        });
        expect(exitCode).toBe(1);
        expect(output).toContain('packages/verticals/src/publish.ts:1');
        expect(output).toContain('Re-pointing addon_product.version_id is an act of billing');
    });

    it('a raw SQL write of addon_product.version_id from verticals is red', () => {
        const { exitCode, output } = guardOver({
            'packages/verticals/test/publish.test.ts':
                "const q = 'UPDATE addon_product SET version_id = $1 WHERE id = $2';\nexport { q };\n"
        });
        expect(exitCode).toBe(1);
        expect(output).toContain('packages/verticals/test/publish.test.ts:1');
    });

    it('the table and the column in comments only is green', () => {
        const { exitCode } = guardOver({
            'packages/verticals/src/note.ts':
                '// billing re-points addon_product.version_id, never this half\nexport const n = 1;\n'
        });
        expect(exitCode).toBe(0);
    });
});

describe('TEST:V2:8 fails loud instead of passing an unenforceable rule', () => {
    it('an empty verticals half is an error', () => {
        const { exitCode, output } = run({ root: makeTree({ files: GREEN }), folders: [] });
        expect(exitCode).toBe(1);
        expect(output).toContain('declares no folder');
    });

    it('a folder that holds no code file is an error', () => {
        const { exitCode, output } = run({
            root: makeTree({ files: GREEN }),
            folders: ['packages/vertical']
        });
        expect(exitCode).toBe(1);
        expect(output).toContain('no code file under packages/vertical');
    });
});
