import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:V5:27 (AC:V5:23, HOS-1464, V5.10) pins the V5 exit evidence in the
 * tree. It does not run tests, guards, or Playwright; the exit run and CI do
 * that. It proves the evidence IS present and wired. The LISTING-addon half
 * of clause 7 has no surface at this cut because no addon purchase route
 * exists (B10, HOS-1593, phase 3). Every assertion is about PRESENCE.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const e2eYml = readFileSync(path.join(repoRoot, '.github/workflows/e2e-nightly.yml'), 'utf8');
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};

interface CorteEntry {
    readonly clause: number;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
}

interface GuardContract {
    readonly guard: string;
    readonly checkName: string;
    readonly checkScript: string;
    readonly mutationTest: string;
    readonly mutationTestId: string;
}

interface E2eContract {
    readonly file: string;
    readonly test: string;
}

// LISTA:V5, V5.md:86-131; exact clause-to-AC-to-TEST table from .hoja/notas.md §5.a.
const CORTE_MAP: readonly CorteEntry[] = [
    { clause: 1, acs: ['AC:V5:1', 'AC:V5:2'], tests: ['TEST:V5:1', 'TEST:V5:2'] },
    { clause: 2, acs: ['AC:V5:3'], tests: ['TEST:V5:3'] },
    { clause: 3, acs: ['AC:V5:4'], tests: ['TEST:V5:4', 'TEST:V5:5'] },
    { clause: 4, acs: ['AC:V5:5'], tests: ['TEST:V5:6', 'TEST:V5:1'] },
    { clause: 5, acs: ['AC:V5:6'], tests: ['TEST:V5:7'] },
    { clause: 6, acs: ['AC:V5:7'], tests: ['TEST:V5:8'] },
    { clause: 7, acs: ['AC:V5:5', 'AC:V5:8'], tests: ['TEST:V5:6', 'TEST:V5:9'] },
    { clause: 8, acs: ['AC:V5:9'], tests: ['TEST:V5:10'] },
    { clause: 9, acs: ['AC:V5:5'], tests: ['TEST:V5:6'] },
    {
        clause: 10,
        acs: ['AC:V5:10'],
        tests: ['TEST:V5:11', 'TEST:V5:12', 'TEST:V5:29']
    },
    { clause: 11, acs: ['AC:V5:11'], tests: ['TEST:V5:11', 'TEST:V5:13'] },
    { clause: 12, acs: ['AC:V5:12', 'AC:V5:13'], tests: ['TEST:V5:14', 'TEST:V5:15'] },
    { clause: 13, acs: ['AC:V5:14'], tests: ['TEST:V5:16'] },
    { clause: 14, acs: ['AC:V5:25'], tests: ['TEST:V5:30'] }
];

// V5.md:102-106; .hoja/notas.md §4 I-3.
const DEFERRED = {
    clause: 7,
    what: 'buying a LISTING addon with a foreign PUBLISHED listing as its target answers not found',
    acs: ['AC:V5:5'],
    issue: 'HOS-1593',
    phase: 'fase-3',
    reason: 'no addon purchase route exists at the cut (B10.1)'
} as const;

// AC:V5:23 range, including AC:V5:24 by default I-2; mappings from V5.md:1325-1580.
const CASE_ACS: Readonly<Record<string, readonly string[]>> = {
    'AC:V5:1': ['TEST:V5:1'],
    'AC:V5:2': ['TEST:V5:2'],
    'AC:V5:3': ['TEST:V5:3'],
    'AC:V5:4': ['TEST:V5:4', 'TEST:V5:5'],
    'AC:V5:5': ['TEST:V5:6'],
    'AC:V5:6': ['TEST:V5:7'],
    'AC:V5:7': ['TEST:V5:8'],
    'AC:V5:8': ['TEST:V5:9'],
    'AC:V5:9': ['TEST:V5:10'],
    'AC:V5:10': ['TEST:V5:11', 'TEST:V5:12', 'TEST:V5:29'],
    'AC:V5:11': ['TEST:V5:11', 'TEST:V5:13'],
    'AC:V5:12': ['TEST:V5:14'],
    'AC:V5:13': ['TEST:V5:15'],
    'AC:V5:14': ['TEST:V5:16'],
    'AC:V5:24': ['TEST:V5:28'],
    'AC:V5:15': ['TEST:V5:17', 'TEST:V5:18'],
    'AC:V5:16': ['TEST:V5:19'],
    'AC:V5:25': ['TEST:V5:30'],
    'AC:V5:26': ['TEST:V5:31'],
    'AC:V5:27': ['TEST:V5:32'],
    'AC:V5:28': ['TEST:V5:33'],
    'AC:V5:29': ['TEST:V5:34']
};

// V5.md:1325-1580; all cut TEST ids except this static exit test.
const CUT_TESTS = Array.from({ length: 34 }, (_, index) => index + 1)
    .filter((id) => id !== 27)
    .map((id) => `TEST:V5:${id}`);
const SELF_TEST = 'TEST:V5:27';

// V5.md:55-57, GATE:M1.2; eight contracts over seven scripts, .hoja/notas.md §5.b.
const GUARDS: readonly GuardContract[] = [
    {
        guard: 'G2 (c)',
        checkName: 'check:vertical-immutable',
        checkScript: 'scripts/check-vertical-immutable.ts',
        mutationTest: 'scripts/__tests__/check-vertical-immutable.test.ts',
        mutationTestId: 'TEST:V5:5'
    },
    {
        guard: 'G2 (a, b)',
        checkName: 'check:vertical-context',
        checkScript: 'scripts/check-vertical-context.ts',
        mutationTest: 'scripts/__tests__/check-vertical-context.test.ts',
        mutationTestId: 'TEST:V5:26'
    },
    {
        guard: 'G4',
        checkName: 'check:transitions-never-write-roles',
        checkScript: 'scripts/check-transitions-never-write-roles.ts',
        mutationTest: 'scripts/__tests__/check-transitions-never-write-roles.test.ts',
        mutationTestId: 'TEST:V5:23'
    },
    {
        guard: 'G6 (a)',
        checkName: 'check:role-never-decides',
        checkScript: 'scripts/check-role-never-decides.ts',
        mutationTest: 'scripts/__tests__/check-role-never-decides.test.ts',
        mutationTestId: 'TEST:V5:20'
    },
    {
        guard: 'G6 (b)',
        checkName: 'check:role-never-decides',
        checkScript: 'scripts/check-role-never-decides.ts',
        mutationTest: 'scripts/__tests__/check-role-never-decides-effective-set.test.ts',
        mutationTestId: 'TEST:V5:21'
    },
    {
        guard: 'G-R3-B',
        checkName: 'check:clock-transitions-never-grant',
        checkScript: 'scripts/check-clock-transitions-never-grant.ts',
        mutationTest: 'scripts/__tests__/check-clock-transitions-never-grant.test.ts',
        mutationTestId: 'TEST:V5:24'
    },
    {
        guard: 'G-R3-C',
        checkName: 'check:step5-declared',
        checkScript: 'scripts/check-step5-declared.ts',
        mutationTest: 'scripts/__tests__/check-step5-declared.test.ts',
        mutationTestId: 'TEST:V5:25'
    },
    {
        guard: 'G19',
        checkName: 'check:system-actor-factory',
        checkScript: 'scripts/check-system-actor-factory.ts',
        mutationTest: 'scripts/__tests__/check-system-actor-factory.test.ts',
        mutationTestId: 'TEST:V5:15'
    }
];

// AC:V5:29; V5.md guard row and .hoja/notas.md §5.b.
const OTHER_V5_CHECKS: readonly GuardContract[] = [
    {
        guard: 'AC:V5:29',
        checkName: 'check:no-transitional-gate-markers',
        checkScript: 'scripts/check-no-transitional-gate-markers.ts',
        mutationTest: 'scripts/__tests__/check-no-transitional-gate-markers.test.ts',
        mutationTestId: 'TEST:V5:34'
    }
];

// TEST:V5:12 and TEST:V5:18; .hoja/notas.md §1.
const E2E: readonly E2eContract[] = [
    { file: 'apps/e2e/tests/admin/adm-05-no-impersonate.spec.ts', test: 'TEST:V5:12' },
    { file: 'apps/e2e/tests/admin/adm-10-super-admin-role.spec.ts', test: 'TEST:V5:18' }
];

/** Returns the lines of one named job under `jobs:` up to the next job header. */
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

function stepRuns({ block }: { readonly block: string }): readonly string[] {
    return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => (match[1] ?? '').trim());
}

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

/** Extracts literal titles from test calls, including conditional and each calls. */
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme))|(?:\.(?:skipIf|runIf|each)\((?:[^()]|\([^()]*\))*\)))*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}

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

describe('TEST:V5:27 AC:V5:23 - V5 exit: LISTA:V5 evidence in the tree, six guards wired and mutation-tested in the guards job (HOS-1464)', () => {
    const sources = collectSources();
    const titledSources = sources.map(({ file, source }) => ({
        file,
        source,
        titles: testTitles({ source })
    }));
    const allTitles = titledSources.flatMap(({ titles }) => titles);
    const guards = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guards });

    describe('(a) the scanner finds V5 titles in required roots and sees describe.each', () => {
        for (const root of [
            'apps/api/test',
            'apps/admin/test',
            'apps/e2e/tests',
            'packages/verticals/test',
            'packages/service-core/test',
            'packages/db/test',
            'scripts/__tests__'
        ]) {
            it(`finds TEST:V5 titles under ${root}`, () => {
                expect(
                    titledSources.some(
                        ({ file, titles }) =>
                            file.includes(root) &&
                            titles.some((title) => title.includes('TEST:V5:'))
                    )
                ).toBe(true);
            });
        }
        it('extracts TEST:V5:1 from the describe.each title', () => {
            const apiTest = titledSources.find(({ file }) =>
                file.endsWith('apps/api/test/routes/listing-access-resource-step.test.ts')
            );
            expect(apiTest?.titles.some((title) => namesId({ text: title, id: 'TEST:V5:1' }))).toBe(
                true
            );
        });
    });

    describe('(b) each LISTA:V5 clause names its mapped TEST in a title', () => {
        for (const entry of CORTE_MAP) {
            it(`clause ${entry.clause} (${entry.acs.join(', ')}): ${entry.tests.join(', ')}`, () => {
                const missing = entry.tests.filter(
                    (id) => !allTitles.some((title) => namesId({ text: title, id }))
                );
                expect(missing, `TEST ids without a title: ${missing.join(', ')}`).toEqual([]);
            });
        }
    });

    describe('(c) cut tests, AC mappings, deferred clause, and clause coverage are accounted for', () => {
        it('has a title for every cut TEST:V5 id', () => {
            const missing = CUT_TESTS.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            expect(missing, `missing TEST:V5 titles: ${missing.join(', ')}`).toEqual([]);
        });
        it('keeps the static exit TEST:V5:27 owned only by this excluded file', () => {
            expect(allTitles.some((title) => namesId({ text: title, id: SELF_TEST }))).toBe(false);
        });
        it('maps every AC case to TEST ids included in CUT_TESTS', () => {
            const outside = Object.entries(CASE_ACS).flatMap(([ac, tests]) =>
                tests.filter((test) => !CUT_TESTS.includes(test)).map((test) => `${ac} → ${test}`)
            );
            expect(outside, `AC mappings outside the cut: ${outside.join(', ')}`).toEqual([]);
        });
        it('covers clauses 1 to 14, including the deferred half of clause 7', () => {
            const clauses = new Set([...CORTE_MAP.map(({ clause }) => clause), DEFERRED.clause]);
            const missing = Array.from({ length: 14 }, (_, index) => index + 1).filter(
                (clause) => !clauses.has(clause)
            );
            expect(missing, `LISTA:V5 clauses without an entry: ${missing.join(', ')}`).toEqual([]);
            expect(DEFERRED.issue).toBe('HOS-1593');
            expect(DEFERRED.phase).toBe('fase-3');
        });
    });

    describe('(d) V5 guards and AC:V5:29 are wired and mutation-tested in guards', () => {
        for (const contract of [...GUARDS, ...OTHER_V5_CHECKS]) {
            it(`${contract.guard} resolves ${contract.checkName} to ${contract.checkScript}`, () => {
                expect(
                    checkGuardsCommands().some((command) => command.includes(contract.checkScript))
                ).toBe(true);
                expect(existsSync(path.join(repoRoot, contract.checkScript))).toBe(true);
            });
            it(`the guards job runs pnpm ${contract.checkName} (${contract.guard})`, () => {
                expect(guardsRuns).toContain(`pnpm ${contract.checkName}`);
            });
            it(`${contract.guard} mutation test exists and names ${contract.mutationTestId}`, () => {
                const file = path.join(repoRoot, contract.mutationTest);
                expect(existsSync(file)).toBe(true);
                expect(
                    namesId({ text: readFileSync(file, 'utf8'), id: contract.mutationTestId })
                ).toBe(true);
            });
        }
        it('the guards job runs pnpm test:scripts', () => {
            expect(guards.length).toBeGreaterThan(0);
            expect(guardsRuns).toContain('pnpm test:scripts');
        });
        it('ends check:guards with pnpm check:fake-lies', () => {
            expect(rootPkg.scripts['check:guards']?.trim().split('&&').at(-1)?.trim()).toBe(
                'pnpm check:fake-lies'
            );
        });
    });

    describe('(e) the admin e2e specs are tagged and collected by the nightly suite', () => {
        for (const contract of E2E) {
            it(`${contract.file} has ${contract.test} and @p1 on test.describe`, () => {
                const source = readFileSync(path.join(repoRoot, contract.file), 'utf8');
                expect(
                    testTitles({ source }).some((title) =>
                        namesId({ text: title, id: contract.test })
                    )
                ).toBe(true);
                const describeLine =
                    source.split('\n').find((line) => line.includes('test.describe(')) ?? '';
                expect(describeLine).toContain('@p1');
            });
        }
        it('e2e-full runs pnpm --filter hospeda-e2e e2e:test', () => {
            expect(stepRuns({ block: jobBlock({ source: e2eYml, job: 'e2e-full' }) })).toContain(
                'pnpm --filter hospeda-e2e e2e:test'
            );
        });
    });

    describe('(f) integration suites are included and CI Pass waits for their job', () => {
        it('the API integration config includes the V5 suites', () => {
            const config = readFileSync(
                path.join(repoRoot, 'apps/api/vitest.config.integration.ts'),
                'utf8'
            );
            for (const include of [
                'test/integration/partners/**/*.test.ts',
                'test/integration/super-admin/**/*.test.ts',
                'test/integration/ai/**/*.test.ts',
                'test/integration/auth/banned-user-signin.test.ts'
            ])
                expect(config).toContain(`'${include}'`);
        });
        it('verticals and db collect integration tests', () => {
            for (const file of [
                'packages/verticals/vitest.integration.config.ts',
                'packages/db/vitest.config.integration.ts'
            ]) {
                expect(readFileSync(path.join(repoRoot, file), 'utf8')).toContain(
                    "'test/integration/**/*.test.ts'"
                );
            }
        });
        it('service-core collects its integration services', () => {
            expect(
                readFileSync(
                    path.join(repoRoot, 'packages/service-core/vitest.integration.config.ts'),
                    'utf8'
                )
            ).toContain("'test/integration/services/**/*.test.ts'");
        });
        it('test-integration runs pnpm test:integration', () => {
            expect(
                stepRuns({ block: jobBlock({ source: ciYml, job: 'test-integration' }) })
            ).toContain('pnpm test:integration');
        });
        it('CI Pass waits on guards, test-unit, and test-integration', () => {
            const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
            for (const job of ['guards', 'test-unit', 'test-integration'])
                expect(needs).toContain(job);
        });
    });
});
