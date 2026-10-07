import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Clock } from '../src/index';

const DEFINING_STATEMENT = 'The single place where verticals and billing talk to each other';
const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

/** Every TypeScript source file of the package, at any depth. */
function sourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return sourceFiles({ dir: full });
        return name.endsWith('.ts') ? [full] : [];
    });
}

/** Every module specifier a source imports or re-exports from. */
function specifiersOf({ source }: { readonly source: string }): readonly string[] {
    const pattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
    return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

describe('@repo/billing-verticals-contract package shape', () => {
    it('exports no runtime value from its entry point: types only', async () => {
        // Arrange / Act
        const entry = await import('../src/index');

        // Assert
        expect(Object.keys(entry)).toEqual([]);
    });

    it('exports the Clock type (AC:B1:17), checked by the package typecheck', () => {
        // Arrange: a conforming clock compiles; a clock without `now` does not.
        const clock: Clock = { now: () => new Date(0) };
        // @ts-expect-error a clock must have `now(): Date`
        const _broken: Clock = { now: () => 0 };

        // Assert
        expectTypeOf<Clock['now']>().toEqualTypeOf<() => Date>();
        expect(clock.now()).toEqual(new Date(0));
        expect(_broken).toBeDefined();
    });

    it('imports nothing from either half nor from the database layer: only its own files', () => {
        // Arrange
        const files = sourceFiles({ dir: join(PACKAGE_ROOT, 'src') });
        const specifiers = files.flatMap((file) =>
            specifiersOf({ source: readFileSync(file, 'utf8') }).map((specifier) => ({
                file,
                specifier
            }))
        );

        // Assert: the scan sees the entry's own re-export, so it is not vacuous
        expect(files.length).toBeGreaterThanOrEqual(2);
        expect(specifiers.map(({ specifier }) => specifier)).toContain('./clock');
        for (const { file, specifier } of specifiers) {
            expect(specifier.startsWith('./'), `${file} imports ${specifier}`).toBe(true);
        }
    });

    it('declares no runtime dependency, so it cannot pull in either half', () => {
        // Arrange
        const manifest = JSON.parse(
            readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')
        ) as { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };

        // Assert
        expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
        expect(Object.keys(manifest.peerDependencies ?? {})).toEqual([]);
    });

    it('states in package.json what the package is', () => {
        // Arrange
        const manifest = JSON.parse(
            readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')
        ) as {
            description: string;
        };

        // Act / Assert
        expect(manifest.description).toContain(DEFINING_STATEMENT);
    });

    it('states in README.md what the package is', () => {
        // Arrange
        const readme = readFileSync(resolve(PACKAGE_ROOT, 'README.md'), 'utf8');

        // Act / Assert
        expect(readme).toContain(DEFINING_STATEMENT);
    });
});
