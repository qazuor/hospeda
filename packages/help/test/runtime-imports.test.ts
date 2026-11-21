/**
 * HOS-2410 AC-12 — the runtime of `@repo/help` never reads the file system and
 * never ships the generator's parsers. The index reaches production inlined by
 * the bundlers (spec §5.3); a runtime `fs` read would break the API container,
 * which ships only the bundle.
 *
 * The scan follows every relative import from `src/index.ts`, so a runtime
 * module that pulls the generator in transitively fails too, and it asserts the
 * walk reached a believable number of modules, so an emptied entry cannot turn
 * it green.
 *
 * @module test/runtime-imports
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../src');

/** Module specifiers the runtime must never import. */
const FORBIDDEN = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises', 'yaml', 'marked']);

/**
 * Every module specifier of a source: `import … from '<x>'`, `export … from
 * '<x>'`, a side-effect `import '<x>'` and a dynamic `import('<x>')`.
 */
function specifiersOf(source: string): string[] {
    const pattern =
        /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    return [...source.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');
}

/** Every module reachable from an entry through relative imports, with its specifiers. */
function walk(entry: string): Map<string, string[]> {
    const seen = new Map<string, string[]>();
    const visit = (file: string) => {
        if (seen.has(file)) return;
        const specifiers = specifiersOf(readFileSync(file, 'utf8'));
        seen.set(file, specifiers);
        for (const specifier of specifiers) {
            if (specifier.startsWith('.') && !specifier.endsWith('.json')) {
                visit(`${join(dirname(file), specifier)}.ts`);
            }
        }
    };
    visit(entry);
    return seen;
}

/** The forbidden imports of a walked graph, as `<file> → <specifier>`. */
function forbiddenImportsOf({ modules, root }: { modules: Map<string, string[]>; root: string }) {
    return [...modules].flatMap(([file, specifiers]) =>
        specifiers
            .filter((specifier) => FORBIDDEN.has(specifier))
            .map((specifier) => `${relative(root, file)} → ${specifier}`)
    );
}

/** The walked modules under the generator folder. */
function generatorModulesOf({ modules, root }: { modules: Map<string, string[]>; root: string }) {
    return [...modules.keys()]
        .map((file) => relative(root, file))
        .filter((file) => file.startsWith('generator'));
}

describe('the @repo/help runtime (AC-12)', () => {
    const modules = walk(join(SRC, 'index.ts'));

    it('reaches every runtime module from src/index.ts', () => {
        expect(modules.size).toBeGreaterThanOrEqual(10);
    });

    it('imports neither node:fs, fs, yaml nor marked, directly or through another module', () => {
        expect(forbiddenImportsOf({ modules, root: SRC })).toEqual([]);
    });

    it('never reaches the generator folder', () => {
        expect(generatorModulesOf({ modules, root: SRC })).toEqual([]);
    });
});

describe('the AC-12 scan itself (it is not vacuous)', () => {
    it('reads every import form, side-effect imports included', () => {
        expect(
            specifiersOf(
                "import { parse } from 'yaml';\nexport * from './x';\nimport 'node:fs';\nimport {\n  a\n} from 'marked';\nconst m = import('fs');"
            )
        ).toEqual(['yaml', './x', 'node:fs', 'marked', 'fs']);
    });

    it('finds a forbidden import and a generator module two hops away from the entry', () => {
        // Arrange: index → a (side-effect) → b, which imports node:fs and the generator.
        const root = mkdtempSync(join(tmpdir(), 'help-ac12-'));
        try {
            mkdirSync(join(root, 'generator'));
            writeFileSync(join(root, 'index.ts'), "export * from './a';\n");
            writeFileSync(join(root, 'a.ts'), "import './b';\n");
            writeFileSync(
                join(root, 'b.ts'),
                "import 'node:fs';\nexport { x } from './generator/cli';\n"
            );
            writeFileSync(join(root, 'generator', 'cli.ts'), "import { parse } from 'yaml';\n");

            // Act
            const graph = walk(join(root, 'index.ts'));

            // Assert
            expect(graph.size).toBe(4);
            expect(forbiddenImportsOf({ modules: graph, root })).toEqual([
                'b.ts → node:fs',
                `${join('generator', 'cli.ts')} → yaml`
            ]);
            expect(generatorModulesOf({ modules: graph, root })).toEqual([
                join('generator', 'cli.ts')
            ]);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
