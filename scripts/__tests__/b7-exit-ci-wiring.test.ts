import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:B7:15 (AC:B7:24, HOS-1567, B7.9), the exit-evidence half. Its other
 * half is `packages/db/test/integration/b7-pause-reason-no-provider-dunning.test.ts`.
 * This test does not run the tests, guards, or Playwright; the exit run and CI
 * do that. It proves that the required evidence IS in the tree and wired.
 * Clause 9 and the manual path of AC:B7:32 left the cut for CV / HOS-1632
 * (phase 4); the S31 call in clause 13 and RC-8 left it for CY / HOS-1631
 * (phase 2). Every assertion is about PRESENCE.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const e2eYml = readFileSync(path.join(repoRoot, '.github/workflows/e2e-pr.yml'), 'utf8');
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};
const e2ePkg = JSON.parse(readFileSync(path.join(repoRoot, 'apps/e2e/package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};

interface CorteEntry {
    readonly clause: number;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
}

interface DeferredEntry {
    readonly clause: number;
    readonly what: string;
    readonly acs: readonly string[];
    readonly issue: string;
    readonly phase: string;
    readonly letter: string;
}

interface GuardContract {
    readonly guard: string;
    readonly checkName: string;
    readonly checkScript: string;
    readonly mutationTest: string;
    readonly mutationTestId: string;
}

interface UnknownRow {
    readonly row: string;
    readonly test: string;
    readonly branches?: readonly string[];
    readonly marker?: string;
    readonly minTitles?: number;
}

interface E2eContract {
    readonly file: string;
    readonly test: string;
    readonly ac: string;
}

// LISTA:B7, B7.md:412-465; clause-to-AC-to-TEST map from .hoja/notas.md §5.
const CORTE_MAP: readonly CorteEntry[] = [
    { clause: 1, acs: ['AC:B7:3', 'AC:B7:4'], tests: ['TEST:B7:1', 'TEST:B7:2'] },
    { clause: 2, acs: ['AC:B7:7'], tests: ['TEST:B7:5'] },
    { clause: 3, acs: ['AC:B7:19'], tests: ['TEST:B7:13'] },
    { clause: 4, acs: ['AC:B7:2'], tests: ['TEST:B7:1'] },
    { clause: 5, acs: ['AC:B7:8'], tests: ['TEST:B7:4'] },
    { clause: 6, acs: ['AC:B7:1'], tests: ['TEST:B7:1'] },
    { clause: 7, acs: ['AC:B7:16'], tests: ['TEST:B7:10', 'TEST:B7:4'] },
    { clause: 8, acs: ['AC:B7:25', 'AC:B7:26'], tests: ['TEST:B7:16', 'TEST:B7:10'] },
    { clause: 10, acs: ['AC:B7:15'], tests: ['TEST:B7:9'] },
    { clause: 11, acs: ['AC:B7:14'], tests: ['TEST:B7:8'] },
    { clause: 12, acs: ['AC:B7:21'], tests: ['TEST:B7:14'] },
    {
        clause: 13,
        acs: ['AC:B7:28', 'AC:B7:29', 'AC:B7:32'],
        tests: ['TEST:B7:16', 'TEST:B7:17', 'TEST:B7:20']
    },
    { clause: 14, acs: ['AC:B7:30', 'AC:B7:31'], tests: ['TEST:B7:18', 'TEST:B7:19'] }
];

// B7.md:107, :171, :245, :263, :274, :288, :329, :352, :524; Coord-678.
const DEFERRED: readonly DeferredEntry[] = [
    {
        clause: 9,
        what: 'a payment registered by hand on a predecessor in succession',
        acs: ['AC:B7:16', 'AC:B7:13'],
        issue: 'HOS-1632',
        phase: 'fase-4',
        letter: 'CV'
    },
    {
        clause: 13,
        what: 'S6 by its third event calls S31',
        acs: ['AC:B7:27'],
        issue: 'HOS-1631',
        phase: 'fase-2',
        letter: 'CY'
    },
    {
        clause: 13,
        what: 'the manual-payer path of the arrears cycle end to end',
        acs: ['AC:B7:32'],
        issue: 'HOS-1632',
        phase: 'fase-4',
        letter: 'CV'
    }
];

// B7.md:1599-1807; cut TEST ids, excluding phase 2 and phase 4.
const CUT_TESTS = [
    'TEST:B7:1',
    'TEST:B7:2',
    'TEST:B7:4',
    'TEST:B7:5',
    'TEST:B7:6',
    'TEST:B7:8',
    'TEST:B7:9',
    'TEST:B7:10',
    'TEST:B7:11',
    'TEST:B7:13',
    'TEST:B7:14',
    'TEST:B7:15',
    'TEST:B7:16',
    'TEST:B7:17',
    'TEST:B7:18',
    'TEST:B7:19',
    'TEST:B7:20',
    'TEST:B7:21'
] as const;

// B7.md:1746, :1789, :1800; tests whose Cubre names AC:B7:24 (Linear verification).
const SPEC_EXIT_TESTS = ['TEST:B7:15', 'TEST:B7:18', 'TEST:B7:19'] as const;

// B7.md:48 and GATE:M1.2; G15 is also required by AC:B7:34.
const GUARDS: readonly GuardContract[] = [
    {
        guard: 'G-R1-D',
        checkName: 'check:succession-retention',
        checkScript: 'scripts/check-succession-retention.ts',
        mutationTest: 'scripts/__tests__/check-succession-retention.test.ts',
        mutationTestId: 'TEST:B7:11'
    },
    {
        guard: 'G15',
        checkName: 'check:fake-lies',
        checkScript: 'scripts/check-fake-lies.ts',
        mutationTest: 'scripts/__tests__/check-fake-lies.test.ts',
        mutationTestId: 'TEST:B1:9'
    }
];

// AC:B7:34, B7.md:141; fake-provider rules that ground the cut's evidence.
const FAKE_RULES_B7 = ['RP7', 'RP8', 'RP11'] as const;

// GATE:M1.4, B7.md:1594-1597; RC-8 is deferred to phase 2.
const UNKNOWN_ROWS: readonly UnknownRow[] = [
    {
        row: 'MP:GR-2',
        test: 'TEST:B7:5',
        branches: ['GR-2 branch 1', 'GR-2 branch 2']
    },
    { row: 'MP:PA-6', test: 'TEST:B7:2', marker: 'PA-6', minTitles: 2 }
];

// GATE:M1.5; B7 end-to-end specs for grace expiry and the arrears cycle.
const E2E: readonly E2eContract[] = [
    {
        file: 'apps/e2e/tests/billing/billing-06-grace-expiry-end-to-end.spec.ts',
        test: 'TEST:B7:17',
        ac: 'AC:B7:29'
    },
    {
        file: 'apps/e2e/tests/billing/billing-07-arrears-cycle-end-to-end.spec.ts',
        test: 'TEST:B7:20',
        ac: 'AC:B7:32'
    }
];

/** Returns the lines of one job under `jobs:` up to the next job header. */
function jobBlock({ source, job }: { readonly source: string; readonly job: string }): string {
    const lines = source.split('\n');
    const jobsAt = lines.findIndex((line) => /^jobs:\s*$/.test(line));
    if (jobsAt === -1) return '';
    const headerAt = lines.findIndex((line, index) => index > jobsAt && line === `  ${job}:`);
    if (headerAt === -1) return '';
    const body: string[] = [];
    for (const line of lines.slice(headerAt + 1)) {
        if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line) || /^\S/.test(line)) break;
        body.push(line);
    }
    return body.join('\n');
}

/** Returns job names listed in a job's `needs:` in list or single-value form. */
function needsOf({ block }: { readonly block: string }): readonly string[] {
    const inline = /^ {4}needs:\s*([A-Za-z0-9_-]+)\s*$/m.exec(block);
    if (inline?.[1]) return [inline[1]];
    const lines = block.split('\n');
    const at = lines.findIndex((line) => /^ {4}needs:\s*$/.test(line));
    if (at === -1) return [];
    const needs: string[] = [];
    for (const line of lines.slice(at + 1)) {
        const item = /^ {6}- ([A-Za-z0-9_-]+)\s*$/.exec(line);
        if (!item?.[1]) break;
        needs.push(item[1]);
    }
    return needs;
}

/** Returns the single-line `run:` commands of a job. */
function stepRuns({ block }: { readonly block: string }): readonly string[] {
    return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => (match[1] ?? '').trim());
}

/** Resolves each `pnpm <script>` in `check:guards` to its package script. */
function checkGuardsCommands(): readonly string[] {
    const chain = rootPkg.scripts['check:guards'] ?? '';
    return chain.split('&&').map((part) => {
        const step = part.trim();
        const script = /^pnpm (?:run )?(\S+)$/.exec(step)?.[1];
        return script ? (rootPkg.scripts[script] ?? step) : step;
    });
}

/** Lists `test/` and `tests/` roots of apps/packages, plus scripts tests. */
function collectTestRoots(): readonly string[] {
    const roots: string[] = [];
    for (const area of ['apps', 'packages'] as const) {
        const areaDir = path.join(repoRoot, area);
        if (!existsSync(areaDir)) continue;
        for (const entry of readdirSync(areaDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            for (const leaf of ['test', 'tests'] as const) {
                const candidate = path.join(areaDir, entry.name, leaf);
                if (existsSync(candidate) && statSync(candidate).isDirectory())
                    roots.push(candidate);
            }
        }
    }
    const scriptsTests = path.join(repoRoot, 'scripts/__tests__');
    if (existsSync(scriptsTests)) roots.push(scriptsTests);
    return roots;
}

/** Recursively collects test files, skipping dependencies and build output. */
function collectTestFiles(dir: string, out: string[]): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTestFiles(full, out);
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
}

/** Extracts literal titles from test calls, including conditional calls and next-line titles. */
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}

/** True when an id has a numeric boundary (`TEST:B7:1` is not `TEST:B7:13`). */
function namesId({ text, id }: { readonly text: string; readonly id: string }): boolean {
    return new RegExp(`${id}(?![0-9])`).test(text);
}

/** Reads all test sources except this file, retaining each source's path. */
function collectSources(): readonly { readonly file: string; readonly source: string }[] {
    const files: string[] = [];
    for (const root of collectTestRoots()) collectTestFiles(root, files);
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .map((file) => ({ file, source: readFileSync(file, 'utf8') }));
}

describe('TEST:B7:15 AC:B7:24 - B7 exit: LISTA:B7 evidence in the tree, guards wired, e2e in P0 (HOS-1567)', () => {
    const sources = collectSources();
    const titledSources = sources.map(({ file, source }) => ({
        file,
        source,
        titles: testTitles({ source })
    }));
    const allTitles = titledSources.flatMap(({ titles }) => titles);
    const guards = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guards });

    describe('(a) the scanner finds B7 titles in the required roots', () => {
        for (const root of [
            'apps/api/test',
            'apps/e2e/tests',
            'packages/db/test',
            'packages/service-core/test',
            'scripts/__tests__'
        ]) {
            it(`finds TEST:B7 titles under ${root}`, () => {
                const found = titledSources.some(
                    ({ file, titles }) =>
                        file.includes(root) && titles.some((title) => title.includes('TEST:B7:'))
                );
                expect(found).toBe(true);
            });
        }
    });

    describe('(b) each LISTA:B7 clause names its mapped TEST in a title', () => {
        for (const entry of CORTE_MAP) {
            it(`clause ${entry.clause} (${entry.acs.join(', ')}): ${entry.tests.join(', ')}`, () => {
                const missing = entry.tests.filter(
                    (id) => !allTitles.some((title) => namesId({ text: title, id }))
                );
                expect(missing, `TEST ids without a title: ${missing.join(', ')}`).toEqual([]);
            });
        }
    });

    describe('(c) the cut tests, exit tests, and deferred clauses are accounted for', () => {
        it('has a title for every cut TEST:B7 id', () => {
            const missing = CUT_TESTS.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            expect(missing, `missing TEST:B7 titles: ${missing.join(', ')}`).toEqual([]);
        });

        it('keeps the AC:B7:24 tests inside the cut test list', () => {
            expect(SPEC_EXIT_TESTS.every((test) => CUT_TESTS.includes(test))).toBe(true);
        });

        it('covers clauses 1 to 14 with cut and deferred entries', () => {
            const clauses = new Set([
                ...CORTE_MAP.map((entry) => entry.clause),
                ...DEFERRED.map((entry) => entry.clause)
            ]);
            for (let clause = 1; clause <= 14; clause += 1) expect(clauses.has(clause)).toBe(true);
        });
    });

    describe('(d) G-R1-D and G15 are wired into the guard gate and mutation-tested', () => {
        for (const contract of GUARDS) {
            it(`${contract.guard} resolves ${contract.checkName} to ${contract.checkScript}`, () => {
                expect(
                    checkGuardsCommands().some((command) => command.includes(contract.checkScript))
                ).toBe(true);
                expect(existsSync(path.join(repoRoot, contract.checkScript))).toBe(true);
            });

            it(`the guards job runs pnpm ${contract.checkName}`, () => {
                expect(guardsRuns).toContain(`pnpm ${contract.checkName}`);
            });

            it(`${contract.guard} mutation test exists and names ${contract.mutationTestId}`, () => {
                const file = path.join(repoRoot, contract.mutationTest);
                expect(existsSync(file)).toBe(true);
                expect(readFileSync(file, 'utf8')).toContain(contract.mutationTestId);
            });
        }

        it('the guards job runs pnpm test:scripts', () => {
            expect(guards.length).toBeGreaterThan(0);
            expect(guardsRuns).toContain('pnpm test:scripts');
        });

        it('ends the check:guards chain with pnpm check:fake-lies', () => {
            expect(rootPkg.scripts['check:guards']?.trim().split('&&').at(-1)?.trim()).toBe(
                'pnpm check:fake-lies'
            );
        });
    });

    describe('(e) AC:B7:34 has its measured fake rules in the list', () => {
        it('includes RP7, RP8, and RP11 in fake-lists rules', () => {
            const fakeLists = JSON.parse(
                readFileSync(
                    path.join(repoRoot, 'packages/payments/src/fake/fake-lists.json'),
                    'utf8'
                )
            ) as { readonly rules: readonly { readonly id: string }[] };
            const ids = fakeLists.rules.map(({ id }) => id);
            for (const id of FAKE_RULES_B7) expect(ids).toContain(id);
        });
    });

    describe('(f) GATE:M1.4 UNKNOWN rows keep their named branches', () => {
        for (const row of UNKNOWN_ROWS) {
            it(`${row.row} is present with ${row.test} and its branch titles`, () => {
                const matchingFiles = titledSources.filter(({ titles }) =>
                    titles.some(
                        (title) =>
                            namesId({ text: title, id: row.test }) &&
                            (row.branches
                                ? row.branches.every((branch) =>
                                      titles.some((t) => t.includes(branch))
                                  )
                                : true)
                    )
                );
                if (row.branches) {
                    expect(
                        matchingFiles.length,
                        `${row.row} file with both branch titles`
                    ).toBeGreaterThan(0);
                    return;
                }
                const marked = matchingFiles.flatMap(({ titles }) =>
                    titles.filter((title) => title.includes(row.marker ?? ''))
                );
                expect(
                    marked.length,
                    `${row.row} titles containing ${row.marker}`
                ).toBeGreaterThanOrEqual(row.minTitles ?? 0);
            });
        }
    });

    describe('(g) the grace e2e specs are tagged and collected by P0', () => {
        for (const contract of E2E) {
            it(`${contract.file} names its TEST, AC, @p0, and @clock on test.describe`, () => {
                const source = readFileSync(path.join(repoRoot, contract.file), 'utf8');
                const line =
                    source.split('\n').find((candidate) => candidate.includes('test.describe(')) ??
                    '';
                for (const token of [contract.test, contract.ac, '@p0', '@clock'])
                    expect(line).toContain(token);
            });
        }

        it('the e2e-p0 job runs the P0 script', () => {
            expect(stepRuns({ block: jobBlock({ source: e2eYml, job: 'e2e-p0' }) })).toContain(
                'pnpm --filter hospeda-e2e e2e:test:p0'
            );
        });

        it('e2e:test:p0 selects both @p0 and @clock', () => {
            const script = e2ePkg.scripts['e2e:test:p0'] ?? '';
            expect(script).toContain('--grep @p0');
            expect(script).toContain('--grep @clock');
        });
    });

    describe('(h) integration configs collect the suite and CI Pass waits for its gates', () => {
        it('the API integration config includes all required billing suites', () => {
            const config = readFileSync(
                path.join(repoRoot, 'apps/api/vitest.config.integration.ts'),
                'utf8'
            );
            for (const dir of [
                'webhooks',
                'plan-publication',
                'billing-subscription',
                'billing-refund'
            ])
                expect(config).toContain(`'test/integration/${dir}/**/*.test.ts'`);
        });

        it('service-core and db integration configs collect their suites', () => {
            const serviceConfig = readFileSync(
                path.join(repoRoot, 'packages/service-core/vitest.integration.config.ts'),
                'utf8'
            );
            const dbConfig = readFileSync(
                path.join(repoRoot, 'packages/db/vitest.config.integration.ts'),
                'utf8'
            );
            expect(serviceConfig).toContain("'test/integration/services/**/*.test.ts'");
            expect(dbConfig).toContain("'test/integration/**/*.test.ts'");
        });

        const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
        for (const job of ['guards', 'test-unit', 'test-integration']) {
            it(`CI Pass waits on ${job}`, () => expect(needs).toContain(job));
        }
    });
});
