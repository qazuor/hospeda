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

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../src');

/** Module specifiers the runtime must never import. */
const FORBIDDEN = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises', 'yaml', 'marked']);

/** Every `import … from '<x>'` / `export … from '<x>'` / `import('<x>')` specifier of a source. */
function specifiersOf(source: string): string[] {
    const pattern =
        /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    return [...source.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? '');
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

describe('the @repo/help runtime (AC-12)', () => {
    const modules = walk(join(SRC, 'index.ts'));

    it('reaches every runtime module from src/index.ts', () => {
        expect(modules.size).toBeGreaterThanOrEqual(10);
    });

    it('imports neither node:fs, fs, yaml nor marked, directly or through another module', () => {
        const offenders = [...modules].flatMap(([file, specifiers]) =>
            specifiers
                .filter((specifier) => FORBIDDEN.has(specifier))
                .map((specifier) => `${relative(SRC, file)} → ${specifier}`)
        );
        expect(offenders).toEqual([]);
    });

    it('never reaches the generator folder', () => {
        expect(
            [...modules.keys()]
                .map((file) => relative(SRC, file))
                .filter((file) => file.startsWith('generator'))
        ).toEqual([]);
    });

    it('detects a forbidden import when there is one (the scan is not vacuous)', () => {
        expect(specifiersOf("import { parse } from 'yaml';\nexport * from './x';")).toEqual([
            'yaml',
            './x'
        ]);
        expect(specifiersOf("import {\n  readFileSync\n} from 'node:fs';")).toEqual(['node:fs']);
    });
});
