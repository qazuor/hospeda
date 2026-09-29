/**
 * Unit tests for the z.coerce.boolean guard (HOS-410).
 *
 * They pin the PREDICATE (what counts as a hit) and the repo-wide state, so the
 * guard cannot quietly become unable to fail.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    blankComments,
    findCoerceBoolean,
    MIN_SCANNED_FILES,
    scanRepo
} from '../check-no-coerce-boolean.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const hits = (source: string) => findCoerceBoolean({ file: 'x.ts', source }).length;

describe('findCoerceBoolean', () => {
    it.each([
        ['plain call', 'const a = z.coerce.boolean();'],
        ['with chain', 'const a = z.coerce.boolean().optional().default(false);'],
        ['reflowed by a formatter', 'const a = z\n    .coerce\n    .boolean();'],
        ['spaced tokens', 'const a = z . coerce . boolean();'],
        [
            'after a URL string on the same line',
            "const u = 'http://x'; const a = z.coerce.boolean();"
        ]
    ])('flags %s', (_name, source) => {
        expect(hits(source)).toBe(1);
    });

    it.each([
        ['line comment', '// never use z.coerce.boolean() here'],
        ['block comment', '/* z.coerce.boolean() */'],
        ['JSDoc', '/**\n * Not z.coerce.boolean()\n */'],
        ['the strict helper', "createBooleanQueryParam('x')"],
        ['number coercion', 'z.coerce.number()'],
        ['a longer identifier', 'const a = xz.coerce.boolean2;']
    ])('ignores %s', (_name, source) => {
        expect(hits(source)).toBe(0);
    });

    it('reports the right line number after a multi-line comment', () => {
        const [v] = findCoerceBoolean({
            file: 'x.ts',
            source: '/**\n * doc\n */\nconst a = z.coerce.boolean();'
        });

        expect(v?.line).toBe(4);
    });
});

describe('blankComments', () => {
    it('keeps the length and the newlines', () => {
        const src = 'a // c\n/* x\ny */ b';

        expect(blankComments(src)).toHaveLength(src.length);
        expect(blankComments(src).split('\n')).toHaveLength(3);
    });
});

describe('scanRepo', () => {
    const makeRoot = (files: Record<string, string>) => {
        const root = mkdtempSync(join(tmpdir(), 'coerce-bool-'));
        dirs.push(root);
        for (const [rel, body] of Object.entries(files)) {
            mkdirSync(dirname(join(root, rel)), { recursive: true });
            writeFileSync(join(root, rel), body);
        }
        return root;
    };

    it('honours the allowlist by exact path', () => {
        const root = makeRoot({
            'apps/api/src/utils/env-schema.ts': 'z.coerce.boolean()',
            'apps/api/src/other.ts': 'z.coerce.boolean()'
        });

        const result = scanRepo({ root, roots: ['apps/api/src'] });

        expect(result.violations.map((v) => v.file)).toEqual(['apps/api/src/other.ts']);
    });
});

describe('the repository', () => {
    it('has no z.coerce.boolean() outside the allowlist', () => {
        const result = scanRepo({ root: join(__dirname, '..', '..') });

        expect(result.violations).toEqual([]);
        expect(result.scannedFiles).toBeGreaterThanOrEqual(MIN_SCANNED_FILES);
    });
});
