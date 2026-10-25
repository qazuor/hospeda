import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    checkFrontier,
    countFrontierHits,
    FRONTIER_FLOOR,
    run,
    scanFrontier
} from '../check-venue-rename-frontier.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const inv = (files: Record<string, number>) => ({
    $comment: 'fixture',
    outOfScan: [
        '.specs/HOS-1352-*',
        '.specs/HOS-1353-*',
        '.specs/HOS-1354-*',
        '.specs/HOS-1787-*',
        'packages/db/src/migrations/',
        'packages/seed/src/data-migrations/'
    ],
    exempt: {
        files: [
            'scripts/__tests__/check-venue-rename-frontier.test.ts',
            'scripts/check-venue-rename-frontier.ts',
            'scripts/guards/venue-rename-frontier.json'
        ],
        themeOccurrences: {}
    },
    files
});
const token = ['Gastronom', 'y'].join('');

describe('TEST:1813:1 AC:1:15 T1 counts exact in-scope hits', () => {
    it('accepts matching counts and counts both content and path', () => {
        const content = `${token}Foo`;
        expect(countFrontierHits({ file: `packages/${token}.ts`, content })).toBe(2);
        const scanned = scanFrontier({ files: [{ file: `packages/${token}.ts`, content }] });
        expect([...scanned]).toEqual([[`packages/${token}.ts`, 2]]);
        expect(checkFrontier({ scanned, inventory: inv({ [`packages/${token}.ts`]: 2 }) })).toEqual(
            []
        );
    });

    it('does not match Spanish accented forms and skips closed out-of-scan paths', () => {
        const scanned = scanFrontier({
            files: [
                { file: 'packages/a.ts', content: 'gastronomía Gastronomía' },
                { file: 'packages/db/src/migrations/old.sql', content: token },
                { file: 'packages/db/src/migrations/extras/live.sql', content: token },
                { file: 'packages/seed/src/data-migrations/old.ts', content: token },
                { file: '.specs/HOS-1787-x/a.md', content: token }
            ]
        });
        expect([...scanned]).toEqual([['packages/db/src/migrations/extras/live.sql', 1]]);
    });
});

describe('TEST:1813:2 AC:1:15 T1 rejects inventory and base mutations', () => {
    it('reports a new hit, raised or lowered count, and stale inventory file', () => {
        const base = inv({ 'a.ts': 2 });
        const cases = [
            {
                scanned: new Map([
                    ['a.ts', 2],
                    ['new.ts', 1]
                ]),
                inventory: inv({ 'a.ts': 2 })
            },
            { scanned: new Map([['a.ts', 2]]), inventory: inv({ 'a.ts': 3 }) },
            { scanned: new Map([['a.ts', 1]]), inventory: inv({ 'a.ts': 2 }) },
            { scanned: new Map(), inventory: inv({ 'a.ts': 2 }) }
        ];
        const results = cases.map((current) => checkFrontier(current));
        expect(results).toEqual([
            [{ file: 'new.ts', expected: 0, found: 1, reason: 'inventory mismatch' }],
            [{ file: 'a.ts', expected: 3, found: 2, reason: 'inventory mismatch' }],
            [{ file: 'a.ts', expected: 2, found: 1, reason: 'inventory mismatch' }],
            [{ file: 'a.ts', expected: 2, found: 0, reason: 'inventory mismatch' }]
        ]);
        expect(
            checkFrontier({ scanned: new Map([['a.ts', 2]]), inventory: inv({ 'a.ts': 2 }), base })
        ).toEqual([]);
        expect(
            checkFrontier({
                scanned: new Map([['a.ts', 2]]),
                inventory: inv({ 'a.ts': 3 }),
                base
            }).find((violation) => violation.reason === 'inventory may not grow against base')
        ).toEqual({
            file: 'a.ts',
            expected: 2,
            found: 3,
            reason: 'inventory may not grow against base'
        });
        expect(
            checkFrontier({
                scanned: new Map([['new.ts', 1]]),
                inventory: inv({ 'new.ts': 1 }),
                base
            }).find((violation) => violation.reason === 'inventory may not grow against base')
        ).toEqual({
            file: 'new.ts',
            expected: 'absent from base',
            found: 1,
            reason: 'inventory may not grow against base'
        });
    });
});

describe('TEST:1813:3 AC:1:15 T1 scans the committed repository', () => {
    it('has no self literals, meets the floor, and passes the real inventory', () => {
        const result = run({ root: ROOT, baseInventory: null });
        expect(result.exitCode, result.output).toBe(0);
        expect(FRONTIER_FLOOR).toBe(10000);
        for (const file of [
            'scripts/check-venue-rename-frontier.ts',
            'scripts/__tests__/check-venue-rename-frontier.test.ts',
            'scripts/guards/venue-rename-frontier.json'
        ]) {
            expect(readFileSync(resolve(ROOT, file), 'utf8').includes(token)).toBe(false);
        }
    });
});

describe('TEST:1813:4 AC:1:15 T1 is wired to guards CI and package scripts', () => {
    it('has a dedicated package command and a dedicated CI Guards step', () => {
        const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
        };
        const workflow = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');
        expect(packageJson.scripts['check:venue-rename-frontier']).toBe(
            'tsx scripts/check-venue-rename-frontier.ts'
        );
        expect(
            packageJson.scripts['check:guards']?.includes('pnpm check:venue-rename-frontier')
        ).toBe(true);
        expect(workflow).toContain('run: pnpm check:venue-rename-frontier');
    });
});
