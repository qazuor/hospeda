import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    buildNameRenames,
    buildRenamedFrom,
    checkFrontier,
    countFrontierHits,
    FRONTIER_FLOOR,
    findRenameConflicts,
    formatViolation,
    run,
    scanFrontier
} from '../check-venue-rename-frontier.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const inv = (files: Record<string, number>) => ({
    $comment: 'fixture',
    outOfScan: ['.specs/', 'packages/db/src/migrations/', 'packages/seed/src/data-migrations/'],
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

describe('TEST:1814:1 AC:1:16 T1 follows renamed files', () => {
    it('TEST:1814:1 AC:1:16 accepts a moved path against its old base count', () => {
        expect(
            checkFrontier({
                scanned: new Map([['new.ts', 2]]),
                inventory: { ...inv({ 'new.ts': 2 }), renamedFrom: { 'new.ts': 'old.ts' } },
                base: inv({ 'old.ts': 2 })
            })
        ).toEqual([]);
        expect(
            checkFrontier({
                scanned: new Map([['new.ts', 2]]),
                inventory: inv({ 'new.ts': 2 }),
                base: inv({ 'old.ts': 2 })
            })
        ).toEqual([
            {
                file: 'new.ts',
                expected: 'absent from base',
                found: 2,
                reason: 'inventory may not grow against base'
            }
        ]);
    });
});

describe('TEST:1814:2 AC:1:16 T1 rejects invalid renamedFrom entries', () => {
    it('TEST:1814:2 AC:1:16 names invalid old, new, increased, and duplicate paths', () => {
        const base = inv({ 'old.ts': 1, 'already.ts': 1, 'old-two.ts': 1 });
        const cases = [
            {
                scanned: new Map([['new.ts', 1]]),
                inventory: { ...inv({ 'new.ts': 1 }), renamedFrom: { 'new.ts': 'missing.ts' } },
                reasons: ['new.ts: renamedFrom old path absent from base']
            },
            {
                scanned: new Map([['already.ts', 1]]),
                inventory: { ...inv({ 'already.ts': 1 }), renamedFrom: { 'already.ts': 'old.ts' } },
                reasons: ['already.ts: renamedFrom new path already exists in base']
            },
            {
                scanned: new Map([['new.ts', 2]]),
                inventory: { ...inv({ 'new.ts': 2 }), renamedFrom: { 'new.ts': 'old.ts' } },
                reasons: ['new.ts: inventory may not grow for renamed path; old path old.ts']
            },
            {
                scanned: new Map([
                    ['new.ts', 1],
                    ['other.ts', 1]
                ]),
                inventory: {
                    ...inv({ 'new.ts': 1, 'other.ts': 1 }),
                    renamedFrom: { 'new.ts': 'old.ts', 'other.ts': 'old.ts' }
                },
                reasons: ['other.ts: renamedFrom old path is duplicated']
            }
        ];
        for (const testCase of cases) {
            const result = checkFrontier({ ...testCase, base });
            expect(result.map(({ file, reason }) => `${file}: ${reason}`)).toEqual(
                testCase.reasons
            );
        }
        const increased = cases[2];
        if (!increased) throw new Error('Missing increased-count test case');
        const growth = checkFrontier({ ...increased, base })[0];
        if (!growth) throw new Error('Expected an increased-count violation');
        expect(formatViolation(growth)).toEqual(
            'new.ts: inventory may not grow for renamed path; old path old.ts; expected 1, found 2'
        );
    });

    it('TEST:1814:2 AC:1:16 builds mappings only from measured paths and base old paths', () => {
        expect(
            buildRenamedFrom({
                scanned: new Map([
                    ['new.ts', 1],
                    ['unmatched.ts', 1]
                ]),
                base: inv({ 'old.ts': 1, 'unmatched.ts': 1 }),
                renames: new Map([
                    ['new.ts', 'old.ts'],
                    ['unmatched.ts', 'not-in-base.ts']
                ])
            })
        ).toEqual({ 'new.ts': 'old.ts' });
        expect(
            buildRenamedFrom({
                scanned: new Map([['already.ts', 1]]),
                base: inv({ 'old.ts': 1, 'already.ts': 1 }),
                renames: new Map([['already.ts', 'old.ts']])
            })
        ).toEqual({});
    });
});
const token = ['Gastronom', 'y'].join('');

describe('TEST:1813:1 AC:1:15 T1 counts exact in-scope hits', () => {
    it('TEST:1813:1 AC:1:15 accepts matching counts and counts both content and path', () => {
        const content = `${token}Foo`;
        expect(countFrontierHits({ file: `packages/${token}.ts`, content })).toBe(2);
        const scanned = scanFrontier({ files: [{ file: `packages/${token}.ts`, content }] });
        expect([...scanned]).toEqual([[`packages/${token}.ts`, 2]]);
        expect(checkFrontier({ scanned, inventory: inv({ [`packages/${token}.ts`]: 2 }) })).toEqual(
            []
        );
    });

    it('TEST:1813:1 AC:1:15 skips accented forms and closed out-of-scan paths', () => {
        const scanned = scanFrontier({
            files: [
                { file: 'packages/a.ts', content: 'gastronomía Gastronomía' },
                { file: 'packages/db/src/migrations/old.sql', content: token },
                { file: 'packages/db/src/migrations/extras/live.sql', content: token },
                { file: 'packages/seed/src/data-migrations/old.ts', content: token },
                { file: '.specs/HOS-1787-x/a.md', content: token },
                { file: '.specs/HOS-9999-any-other-spec/spec.md', content: token }
            ]
        });
        expect([...scanned]).toEqual([['packages/db/src/migrations/extras/live.sql', 1]]);
    });

    it('TEST:1813:1 AC:1:15 excludes the exact theme accesses and declarations', () => {
        const theme = token.toUpperCase();
        const scanned = scanFrontier({
            files: [
                {
                    file: 'apps/web/src/lib/facet-slugs.ts',
                    content: `const event = EventCategoryEnum.${theme};\n`
                },
                {
                    file: 'packages/schemas/src/enums/event-category.enum.ts',
                    content: `enum EventCategoryEnum {\n    ${theme} = '${theme}',\n}\n`
                }
            ]
        });
        expect([...scanned]).toEqual([]);
    });
});

describe('TEST:1813:2 AC:1:15 T1 rejects inventory and base mutations', () => {
    it('TEST:1813:2 AC:1:15 rejects mismatches and inventory growth', () => {
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
    it('TEST:1813:3 AC:1:15 scans the real repository and excludes its own literals', () => {
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

describe('TEST:1813:9 AC:1:15 the run-2 inventory is exact and lower than run 1', () => {
    // Totals recorded when run 1 (identifier renames) closed; run 2 renames the enum keys on top.
    const RUN_1_TOTALS = { files: 1804, occurrences: 16015 } as const;

    it('TEST:1813:9 AC:1:15 records the scanned tree exactly and below the run-1 totals', () => {
        const inventory = JSON.parse(
            readFileSync(resolve(ROOT, 'scripts/guards/venue-rename-frontier.json'), 'utf8')
        ) as { files: Record<string, number> };
        const counts = Object.values(inventory.files);
        const occurrences = counts.reduce((sum, count) => sum + count, 0);

        expect(run({ root: ROOT, baseInventory: null }).exitCode).toBe(0);
        expect(counts.length).toBeLessThan(RUN_1_TOTALS.files);
        expect(occurrences).toBeLessThan(RUN_1_TOTALS.occurrences);
    });
});

describe('TEST:1813:4 AC:1:15 T1 is wired to guards CI and package scripts', () => {
    it('TEST:1813:4 AC:1:15 wires the dedicated package command and CI Guards step', () => {
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

describe('TEST:1814:1 AC:1:16 T1 derives renames from paths', () => {
    it('TEST:1814:1 AC:1:16 accepts a strongly edited moved path by its mapped name', () => {
        const measured = new Map([['packages/db/src/models/venue/venueMenuItem.model.ts', 4]]);
        const base = inv({ 'packages/db/src/models/gastronomy/gastronomyMenuItem.model.ts': 4 });
        expect(buildNameRenames(measured, base)).toEqual(
            new Map([
                [
                    'packages/db/src/models/venue/venueMenuItem.model.ts',
                    'packages/db/src/models/gastronomy/gastronomyMenuItem.model.ts'
                ]
            ])
        );
        expect(
            checkFrontier({
                scanned: measured,
                inventory: {
                    ...inv(Object.fromEntries(measured)),
                    renamedFrom: Object.fromEntries(buildNameRenames(measured, base))
                },
                base
            })
        ).toEqual([]);
        const noCounterpart = new Map([['packages/db/src/models/venue/brandNew.ts', 1]]);
        expect(buildNameRenames(noCounterpart, base)).toEqual(new Map());
        expect(
            checkFrontier({
                scanned: noCounterpart,
                inventory: inv(Object.fromEntries(noCounterpart)),
                base
            })[0]
        ).toEqual({
            file: 'packages/db/src/models/venue/brandNew.ts',
            expected: 'absent from base',
            found: 1,
            reason: 'inventory may not grow against base'
        });
    });

    it('TEST:1814:1 AC:1:16 rejects conflicting git and path rename sources', () => {
        expect(
            findRenameConflicts(
                new Map([['new.ts', 'git-old.ts']]),
                new Map([['new.ts', 'mapped-old.ts']])
            )
        ).toEqual([{ file: 'new.ts', oldPath: 'mapped-old.ts' }]);
    });
});

describe('TEST:1814:3 AC:1:16 T1 compares the committed inventory with staging', () => {
    const stagingInventory = (() => {
        try {
            return JSON.parse(
                execFileSync(
                    'git',
                    ['show', 'origin/staging:scripts/guards/venue-rename-frontier.json'],
                    { cwd: ROOT }
                ).toString()
            ) as ReturnType<typeof inv>;
        } catch {
            return null;
        }
    })();

    it.skipIf(stagingInventory === null)(
        'TEST:1814:3 AC:1:16 checks real renamedFrom entries against staging (requires origin/staging)',
        () => {
            const result = run({ root: ROOT, baseInventory: stagingInventory });
            expect(result.exitCode, result.output).toBe(0);
            const inventory = JSON.parse(
                readFileSync(resolve(ROOT, 'scripts/guards/venue-rename-frontier.json'), 'utf8')
            ) as { files: Record<string, number> };
            const counts = Object.values(inventory.files);
            expect(counts.length).toBeLessThan(1715);
            expect(counts.reduce((sum, count) => sum + count, 0)).toBeLessThan(15365);
        }
    );

    it.skipIf(stagingInventory === null)(
        'TEST:1815:1 AC:1:17 checks the lower committed inventory against staging (requires origin/staging)',
        () => {
            const result = run({ root: ROOT, baseInventory: stagingInventory });
            expect(result.exitCode, result.output).toBe(0);
            const inventory = JSON.parse(
                readFileSync(resolve(ROOT, 'scripts/guards/venue-rename-frontier.json'), 'utf8')
            ) as { files: Record<string, number> };
            const counts = Object.values(inventory.files);
            expect(counts.length).toBeLessThan(1678);
            expect(counts.reduce((sum, count) => sum + count, 0)).toBeLessThan(11767);
        }
    );
});
