/** AC:B3:42: the test-only payment fake cannot enter production source. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.astro', '.turbo', '.output']);
const TEST_DIRS = new Set(['test', 'tests', '__tests__', '__mocks__', 'test-utils', 'testing']);
const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;
const TEST_FILE = /\.(?:test|spec)\.[a-z]+$/;

function productionFiles(args: { readonly dir: string }): readonly string[] {
    return readdirSync(args.dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(args.dir, entry.name);
        if (entry.isDirectory()) {
            return SKIPPED_DIRS.has(entry.name) || TEST_DIRS.has(entry.name)
                ? []
                : productionFiles({ dir: full });
        }
        return CODE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [full] : [];
    });
}

describe('TEST:B3:44 fake subpath boundary', () => {
    it('is absent from production imports across apps and packages', () => {
        const files = ['apps', 'packages'].flatMap((group) =>
            readdirSync(join(REPO_ROOT, group)).flatMap((name) => {
                const src = join(REPO_ROOT, group, name, 'src');
                try {
                    return statSync(src).isDirectory() ? productionFiles({ dir: src }) : [];
                } catch {
                    return [];
                }
            })
        );
        const offenders = files.filter((file) =>
            /['"]@repo\/payments\/fake['"]/.test(readFileSync(file, 'utf8'))
        );
        expect(files.length).toBeGreaterThan(1000);
        expect(offenders).toEqual([]);
    });

    it('exports the fake only from its own package subpath', async () => {
        const main = await import('../src/index');
        const fake = await import('../src/fake/index');
        expect('FakePaymentProvider' in main).toBe(false);
        expect(typeof fake.FakePaymentProvider).toBe('function');
        const manifest = JSON.parse(
            readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')
        ) as { readonly exports: Readonly<Record<string, unknown>> };
        expect(manifest.exports['./fake']).toBeDefined();
    });
});
