/**
 * AC:V1:6 item 3 (contract §7.1): the simulators and case sets live "bajo una
 * ruta de pruebas que ningún build de producción importa".
 *
 * Three predicates over the repo, mirroring `@repo/test-clock`'s own test:
 * - no production source (under `apps/*\/src` or `packages/*\/src`, test files
 *   and test folders excluded) imports `@repo/billing-verticals-contract/testing`;
 * - the contract's production entry (`src/index.ts`), followed through every
 *   relative import, never reaches `src/testing/`;
 * - no `package.json` names the `/testing` subpath in a dependency block other
 *   than `devDependencies`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');
const TESTING_SPECIFIER = '@repo/billing-verticals-contract/testing';

const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.astro', '.turbo', '.output']);
const TEST_DIRS = new Set(['test', 'tests', '__tests__', '__mocks__', 'test-utils', 'testing']);
const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;
const TEST_FILE = /\.(?:test|spec)\.[a-z]+$/;

/** `apps/<x>` and `packages/<x>` folders that hold a package.json. */
const workspaceDirs: readonly string[] = ['apps', 'packages'].flatMap((group) =>
    readdirSync(join(REPO_ROOT, group))
        .map((name) => join(REPO_ROOT, group, name))
        .filter((dir) => existsSync(join(dir, 'package.json')))
);

/** Every production code file under a folder, test folders and files excluded. */
function productionFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIPPED_DIRS.has(entry.name) || TEST_DIRS.has(entry.name)) return [];
            return productionFiles({ dir: full });
        }
        return CODE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [full] : [];
    });
}

/** The relative module specifiers a source imports or re-exports from. */
function relativeSpecifiers({ source }: { readonly source: string }): readonly string[] {
    const pattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"](\.{1,2}\/[^'"]+)['"]/g;
    return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

/** Resolves a relative specifier to a `.ts` file (or a folder's `index.ts`). */
function resolveTs({
    from,
    specifier
}: {
    readonly from: string;
    readonly specifier: string;
}): string {
    const base = resolve(dirname(from), specifier);
    for (const candidate of [`${base}.ts`, join(base, 'index.ts'), base]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    throw new Error(`cannot resolve ${specifier} from ${from}`);
}

/** Every file the entry reaches through relative imports, the entry included. */
function reachableFrom({ entry }: { readonly entry: string }): readonly string[] {
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
        const file = queue.pop() as string;
        if (seen.has(file)) continue;
        seen.add(file);
        for (const specifier of relativeSpecifiers({ source: readFileSync(file, 'utf8') })) {
            queue.push(resolveTs({ from: file, specifier }));
        }
    }
    return [...seen];
}

describe(`${TESTING_SPECIFIER} never reaches production`, () => {
    it('is imported by no production source', () => {
        // Arrange
        const files = workspaceDirs.flatMap((dir) => {
            const src = join(dir, 'src');
            return existsSync(src) && statSync(src).isDirectory()
                ? productionFiles({ dir: src })
                : [];
        });
        const specifier = /['"]@repo\/billing-verticals-contract\/testing(?:\/[^'"]*)?['"]/;

        // Act
        const offenders = files.filter((file) => specifier.test(readFileSync(file, 'utf8')));

        // Assert: the walk is not vacuous, and nothing imports the subpath
        expect(files.length).toBeGreaterThan(1000);
        expect(offenders).toEqual([]);
    });

    it('is not reached from the production entry of the contract', () => {
        // Arrange
        const entry = join(PACKAGE_ROOT, 'src', 'index.ts');

        // Act
        const reached = reachableFrom({ entry }).map((file) => relative(PACKAGE_ROOT, file));

        // Assert: the walk follows the entry's re-exports, and none is under testing/
        expect(reached).toContain('src/validation.ts');
        expect(reached.filter((file) => file.startsWith('src/testing/'))).toEqual([]);
    });

    it('is named by no package.json outside devDependencies', () => {
        // Arrange
        const offenders = workspaceDirs.flatMap((dir) => {
            const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<
                string,
                unknown
            >;
            return (['dependencies', 'peerDependencies', 'optionalDependencies'] as const)
                .filter((block) =>
                    JSON.stringify(manifest[block] ?? {}).includes(TESTING_SPECIFIER)
                )
                .map((block) => `${relative(REPO_ROOT, dir)}: ${block}`);
        });

        // Assert
        expect(workspaceDirs.length).toBeGreaterThan(10);
        expect(offenders).toEqual([]);
    });
});
