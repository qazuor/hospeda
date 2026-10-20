/**
 * AC:B1:17, "ningún build de producción importa el package de pruebas": the
 * adjustable clock never reaches production.
 *
 * Two predicates over the repo:
 * - no `package.json` under `apps/*` or `packages/*` declares this package
 *   anywhere but in `devDependencies`;
 * - no production source (under `apps/*\/src` or `packages/*\/src`, test files
 *   and test folders excluded) imports it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');
const PACKAGE_NAME = (
    JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { name: string }
).name;

/** Folders never walked: installed or built output, not source. */
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.astro', '.turbo', '.output']);

/** A folder whose whole content is test code. */
const TEST_DIRS = new Set(['test', 'tests', '__tests__', '__mocks__', 'test-utils', 'testing']);

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;
const TEST_FILE = /\.(?:test|spec)\.[a-z]+$/;

/** `apps/<x>` and `packages/<x>` folders that hold a package.json. */
const workspaceDirs: readonly string[] = ['apps', 'packages'].flatMap((group) =>
    readdirSync(join(REPO_ROOT, group))
        .map((name) => join(REPO_ROOT, group, name))
        .filter((dir) => {
            try {
                return statSync(join(dir, 'package.json')).isFile();
            } catch {
                return false;
            }
        })
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

describe(`${PACKAGE_NAME} never reaches production`, () => {
    it('reads the workspace it scans', () => {
        expect(PACKAGE_NAME).toBe('@repo/test-clock');
        expect(workspaceDirs.length).toBeGreaterThan(10);
    });

    it('is declared only as a devDependency', () => {
        // Arrange
        const offenders = workspaceDirs.flatMap((dir) => {
            const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<
                string,
                unknown
            >;
            return (['dependencies', 'peerDependencies', 'optionalDependencies'] as const)
                .filter((block) => {
                    const deps = manifest[block] as Record<string, string> | undefined;
                    return deps !== undefined && PACKAGE_NAME in deps;
                })
                .map((block) => `${dir}: ${block}`);
        });

        // Assert
        expect(offenders).toEqual([]);
    });

    it('is imported by no production source', () => {
        // Arrange
        const files = workspaceDirs.flatMap((dir) => {
            const src = join(dir, 'src');
            try {
                return statSync(src).isDirectory() ? productionFiles({ dir: src }) : [];
            } catch {
                return [];
            }
        });
        const specifier = new RegExp(`['"]${PACKAGE_NAME.replace('/', '\\/')}(?:/[^'"]*)?['"]`);

        // Act
        const offenders = files.filter((file) => specifier.test(readFileSync(file, 'utf8')));

        // Assert: the walk is not vacuous, and nothing imports the package
        expect(files.length).toBeGreaterThan(1000);
        expect(offenders).toEqual([]);
    });
});
