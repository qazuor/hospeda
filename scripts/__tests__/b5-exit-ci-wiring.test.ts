import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { apiIntegrationCollection } from './helpers/api-integration-collection';

/**
 * TEST:B5:17 (AC:B5:33, HOS-1550, B5.9), the evidence half of the B5 exit.
 * This static test does not run the tests; the suite exit run and CI do that.
 * The manual-payment half of clause 2 (AC:B5:19) and the MP5 → S38 call in
 * clause 12 (AC:B5:35) are deferred to HOS-1542, phase 4, letter CV. Every
 * assertion is about PRESENCE in the tree.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const e2eYml = readFileSync(path.join(repoRoot, '.github/workflows/e2e-pr.yml'), 'utf8');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');
const rootPkg = JSON.parse(read('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
};
const e2ePkg = JSON.parse(read('apps/e2e/package.json')) as {
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
interface E2eContract {
    readonly file: string;
    readonly test: string;
    readonly ac: string;
}

// LISTA:B5, B5.md:679-718; clause map from .hoja/notas.md §4 H-15.
const CORTE_MAP: readonly CorteEntry[] = [
    { clause: 1, acs: ['AC:B5:2'], tests: ['TEST:B5:2'] },
    { clause: 2, acs: ['AC:B5:3'], tests: ['TEST:B5:3'] },
    { clause: 3, acs: ['AC:B5:2'], tests: ['TEST:B5:2'] },
    { clause: 4, acs: ['AC:B5:6'], tests: ['TEST:B5:4'] },
    { clause: 5, acs: ['AC:B5:10'], tests: ['TEST:B5:6'] },
    { clause: 6, acs: ['AC:B5:11'], tests: ['TEST:B5:6'] },
    { clause: 7, acs: ['AC:B5:22'], tests: ['TEST:B5:12'] },
    { clause: 8, acs: ['AC:B5:12'], tests: ['TEST:B5:6'] },
    { clause: 9, acs: ['AC:B5:4'], tests: ['TEST:B5:1'] },
    { clause: 10, acs: ['AC:B5:4'], tests: ['TEST:B5:1'] },
    {
        clause: 11,
        acs: ['AC:B5:24', 'AC:B5:28'],
        tests: ['TEST:B5:12', 'TEST:B5:13', 'TEST:B5:14']
    },
    { clause: 12, acs: ['AC:B5:34', 'AC:B5:36'], tests: ['TEST:B5:18'] },
    { clause: 13, acs: ['AC:B5:32', 'AC:B5:37'], tests: ['TEST:B5:16', 'TEST:B5:19'] },
    { clause: 14, acs: ['AC:B5:38'], tests: ['TEST:B5:20'] }
];
// B5.md:138, :597-599; manual and MP5 halves deferred by letter CV.
const DEFERRED: readonly DeferredEntry[] = [
    {
        clause: 2,
        what: 'the manual payment registered second is settled by MP6 with reason 20',
        acs: ['AC:B5:19'],
        issue: 'HOS-1542',
        phase: 'fase-4',
        letter: 'CV'
    },
    {
        clause: 12,
        what: 'MP5 calls S38 through the B8b interface before opening the instalment',
        acs: ['AC:B5:35'],
        issue: 'HOS-1542',
        phase: 'fase-4',
        letter: 'CV'
    }
];
// Evidence file for each clause, copied from H-15; paths are repo-relative.
const CLAUSE_FILES: Readonly<Record<number, readonly string[]>> = {
    1: ['packages/service-core/test/integration/services/provider-notice-payment-dedup.test.ts'],
    2: ['packages/service-core/test/integration/services/payment-duplicate-period.test.ts'],
    3: ['packages/service-core/test/integration/services/provider-notice-payment-dedup.test.ts'],
    4: ['packages/service-core/test/integration/services/payment-refund-accumulation.test.ts'],
    5: [
        'packages/service-core/test/integration/services/refund-settle-external.test.ts',
        'apps/api/test/integration/billing-refund/settle-external-route.test.ts'
    ],
    6: [
        'packages/service-core/test/integration/services/charge-settle-external.test.ts',
        'packages/service-core/test/integration/services/charge-settle-external-reception.test.ts',
        'apps/api/test/integration/billing-refund/settle-external-charge-route.test.ts'
    ],
    7: [
        'packages/service-core/test/integration/services/subscription-revocation-successor.test.ts'
    ],
    8: ['packages/service-core/test/integration/services/refund-calls.test.ts'],
    9: ['packages/service-core/test/integration/services/payment-receipt.test.ts'],
    10: ['packages/service-core/test/integration/services/payment-receipt.test.ts'],
    11: [
        'packages/service-core/test/integration/services/subscription-revocation-addons.test.ts',
        'packages/service-core/test/integration/services/addon-orphanhood-provider.test.ts',
        'packages/service-core/test/integration/services/addon-complement-s21.test.ts'
    ],
    12: [
        'packages/service-core/test/integration/services/subscription-revocation-succession.test.ts',
        'packages/service-core/test/integration/services/reconciliation-addon-listing-purged.test.ts'
    ],
    13: [
        'packages/db/test/integration/b5-schema-from-empty.test.ts',
        'packages/service-core/test/integration/services/reconciliation-mark-payment-hang.test.ts'
    ],
    14: [
        'packages/service-core/test/integration/services/reconciliation-mark-payment-guard.test.ts'
    ]
};
// AC:B5:33's migrated-from-empty evidence, B5.md:724-734.
const FROM_EMPTY = {
    test: 'TEST:B5:16',
    file: 'packages/db/test/integration/b5-schema-from-empty.test.ts'
} as const;
// B5.md:989-1231, cut ids excluding phase 2/4 (5, 7, 8, 9, 10) and this test.
const CUT_TESTS = [
    'TEST:B5:1',
    'TEST:B5:2',
    'TEST:B5:3',
    'TEST:B5:4',
    'TEST:B5:6',
    'TEST:B5:11',
    'TEST:B5:12',
    'TEST:B5:13',
    'TEST:B5:14',
    'TEST:B5:15',
    'TEST:B5:16',
    'TEST:B5:18',
    'TEST:B5:19',
    'TEST:B5:20',
    'TEST:B5:21',
    'TEST:B5:22',
    'TEST:B5:23',
    'TEST:B5:24'
] as const;
// B5.md:1171, :1201; TEST:B5:17 is asserted by this file's own describe title.
const SPEC_EXIT_TESTS = ['TEST:B5:20'] as const;
// G-R1-F, copied from b3-exit-ci-wiring.test.ts:141-147.
const GUARDS: readonly GuardContract[] = [
    {
        guard: 'G-R1-F',
        checkName: 'check:reconciliation-mark-discipline',
        checkScript: 'scripts/check-reconciliation-mark-discipline.ts',
        mutationTest: 'scripts/__tests__/check-reconciliation-mark-discipline.test.ts',
        mutationTestId: 'TEST:B3:27'
    }
];
// AC:B5:39 e2e evidence, B5.md:1197-1207.
const E2E: readonly E2eContract[] = [
    {
        file: 'apps/e2e/tests/billing/billing-10-admin-revocation.spec.ts',
        test: 'TEST:B5:22',
        ac: 'AC:B5:39'
    }
];

/** Returns the lines of one job under `jobs:` (header up to the next job or top-level key). */
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
/** Returns the job names listed in a job's `needs:` (list or single-value form). */
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
/** Returns the commands of every `run:` step of a job (single-line form). */
function stepRuns({ block }: { readonly block: string }): readonly string[] {
    return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => (match[1] ?? '').trim());
}
/** Lists `test/` and `tests/` roots of apps/packages plus scripts tests. */
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
/** Recursively collects test source files, skipping generated output. */
function collectTestFiles(dir: string, out: string[]): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTestFiles(full, out);
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
}
/** Returns literal titles of describe/it/test/test.describe calls. */
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}
/** True when an id ends at a numeric boundary, so TEST:B5:1 is not TEST:B5:12. */
function namesId({ text, id }: { readonly text: string; readonly id: string }): boolean {
    return new RegExp(`${id}(?![0-9])`).test(text);
}
/** Every test file under the roots but this one, with its source. */
function collectSources(): readonly string[] {
    const files: string[] = [];
    for (const root of collectTestRoots()) collectTestFiles(root, files);
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .map((file) => readFileSync(file, 'utf8'));
}
/** Every title of files under one repo-relative test root. */
function titlesInRoot({ root }: { readonly root: string }): readonly string[] {
    const files: string[] = [];
    const full = path.join(repoRoot, root);
    if (!existsSync(full)) return [];
    collectTestFiles(full, files);
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .flatMap((file) => testTitles({ source: readFileSync(file, 'utf8') }));
}

describe('TEST:B5:17 AC:B5:33 - B5 exit: LISTA:B5 evidence in the tree, manual halves deferred, suite collected (HOS-1550)', () => {
    const allTitles = collectSources().flatMap((source) => testTitles({ source }));
    const guardsBlock = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guardsBlock });

    describe('(a) the scanner is not blind', () => {
        it('reads TEST:B5 titles under the API, db and service-core test roots', () => {
            const roots = ['apps/api/test', 'packages/db/test', 'packages/service-core/test'];
            const blindRoots = roots.filter(
                (root) => !titlesInRoot({ root }).some((title) => title.includes('TEST:B5:'))
            );
            expect(blindRoots).toEqual([]);
        });
    });

    describe('(b) each clause has its TEST title and evidence titles', () => {
        for (const entry of CORTE_MAP) {
            it(`clause ${entry.clause} (${entry.acs.join(', ')}): ${entry.tests.join(', ')}`, () => {
                const missingTitles = entry.tests.filter(
                    (id) => !allTitles.some((title) => namesId({ text: title, id }))
                );
                const missingFiles: string[] = [];
                for (const file of CLAUSE_FILES[entry.clause] ?? []) {
                    if (!existsSync(path.join(repoRoot, file))) {
                        missingFiles.push(`${file} (missing)`);
                        continue;
                    }
                    const titles = testTitles({ source: read(file) });
                    const evidenceTitle =
                        entry.clause === 13 && file === FROM_EMPTY.file ? (titles[0] ?? '') : '';
                    const hasEvidenceTitle =
                        entry.clause === 13 && file === FROM_EMPTY.file
                            ? namesId({ text: evidenceTitle, id: FROM_EMPTY.test })
                            : entry.tests.some((id) =>
                                  titles.some((title) => namesId({ text: title, id }))
                              );
                    if (!hasEvidenceTitle)
                        missingFiles.push(`${file} (no title names ${entry.tests.join(', ')})`);
                }
                expect(
                    missingTitles,
                    `TEST ids without a title: ${missingTitles.join(', ')}`
                ).toEqual([]);
                expect(
                    missingFiles,
                    `evidence files without the title: ${missingFiles.join(', ')}`
                ).toEqual([]);
                if (entry.clause === 1 || entry.clause === 3) {
                    const file = CLAUSE_FILES[entry.clause]?.[0] ?? '';
                    const evidenceTitles = existsSync(path.join(repoRoot, file))
                        ? testTitles({ source: read(file) })
                        : [];
                    const matchingTitles = evidenceTitles.filter((title) =>
                        namesId({ text: title, id: 'TEST:B5:2' })
                    );
                    expect(
                        matchingTitles.length,
                        `clause ${entry.clause} needs three TEST:B5:2 titles in ${file}`
                    ).toBeGreaterThanOrEqual(3);
                }
                if (entry.clause === 6) {
                    const missingAC = (CLAUSE_FILES[6] ?? []).filter(
                        (file) =>
                            !testTitles({ source: read(file) }).some((title) =>
                                title.includes('AC:B5:11')
                            )
                    );
                    expect(
                        missingAC,
                        `clause 6 files without AC:B5:11 title: ${missingAC.join(', ')}`
                    ).toEqual([]);
                }
            });
        }
    });

    describe('(c) schema from empty', () => {
        it(`${FROM_EMPTY.test} exists and a title names it`, () => {
            const exists = existsSync(path.join(repoRoot, FROM_EMPTY.file));
            const titles = exists ? testTitles({ source: read(FROM_EMPTY.file) }) : [];
            expect(exists).toBe(true);
            expect(namesId({ text: titles[0] ?? '', id: FROM_EMPTY.test })).toBe(true);
        });
    });

    describe('(d) cut ids, exit ids and deferred halves', () => {
        it('every cut TEST id has a title and SPEC_EXIT_TESTS is a subset', () => {
            const missing = CUT_TESTS.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            const outside = SPEC_EXIT_TESTS.filter(
                (id) => !(CUT_TESTS as readonly string[]).includes(id)
            );
            expect(missing, `cut TEST ids without a title: ${missing.join(', ')}`).toEqual([]);
            expect(outside).toEqual([]);
        });
        it('the file title names TEST:B5:17 and the map covers clauses 1 to 14 once', () => {
            const source = read('scripts/__tests__/b5-exit-ci-wiring.test.ts');
            const ownTitles = testTitles({ source });
            const clauses = CORTE_MAP.map((entry) => entry.clause);
            expect(ownTitles.some((title) => namesId({ text: title, id: 'TEST:B5:17' }))).toBe(
                true
            );
            expect(new Set(clauses).size).toBe(clauses.length);
            expect([...clauses].sort((a, b) => a - b)).toEqual(
                Array.from({ length: 14 }, (_, i) => i + 1)
            );
        });
        it('records exactly the two HOS-1542 phase 4 CV halves, both mapped to cut clauses', () => {
            expect(DEFERRED).toEqual([
                {
                    clause: 2,
                    what: 'the manual payment registered second is settled by MP6 with reason 20',
                    acs: ['AC:B5:19'],
                    issue: 'HOS-1542',
                    phase: 'fase-4',
                    letter: 'CV'
                },
                {
                    clause: 12,
                    what: 'MP5 calls S38 through the B8b interface before opening the instalment',
                    acs: ['AC:B5:35'],
                    issue: 'HOS-1542',
                    phase: 'fase-4',
                    letter: 'CV'
                }
            ]);
            expect(
                DEFERRED.every((entry) =>
                    CORTE_MAP.some((mapped) => mapped.clause === entry.clause)
                )
            ).toBe(true);
        });
    });

    describe('(e) G-R1-F is checked and its test is collected', () => {
        for (const guard of GUARDS) {
            it(`${guard.guard} has a script and mutation test`, () => {
                expect(rootPkg.scripts[guard.checkName]).toBeTruthy();
                expect(rootPkg.scripts['check:guards']).toContain(guard.checkName);
                expect(guardsRuns.some((run) => run.includes(guard.checkName))).toBe(true);
                expect(existsSync(path.join(repoRoot, guard.checkScript))).toBe(true);
                expect(existsSync(path.join(repoRoot, guard.mutationTest))).toBe(true);
                const titles = testTitles({ source: read(guard.mutationTest) });
                expect(
                    titles.some((title) => namesId({ text: title, id: guard.mutationTestId }))
                ).toBe(true);
            });
        }
        it('check:guards ends in check:fake-lies', () => {
            expect(rootPkg.scripts['check:guards']).toContain('check:fake-lies');
        });
    });

    describe('(f) TEST:B5:22 is tagged and selected by P0', () => {
        for (const contract of E2E) {
            it(`${contract.file} test.describe names TEST, AC, @p0 and @clock`, () => {
                const source = read(contract.file);
                const title =
                    source.split('\n').find((line) => line.includes('test.describe(')) ?? '';
                for (const token of [contract.test, contract.ac, '@p0', '@clock'])
                    expect(title).toContain(token);
            });
        }
        it('e2e-pr runs e2e:test:p0', () => {
            expect(stepRuns({ block: jobBlock({ source: e2eYml, job: 'e2e-p0' }) })).toContain(
                'pnpm --filter hospeda-e2e e2e:test:p0'
            );
        });
        it('e2e:test:p0 selects @p0 and @clock', () => {
            const script = e2ePkg.scripts['e2e:test:p0'] ?? '';
            expect(script).toContain('--grep @p0');
            expect(script).toContain('--grep @clock');
        });
    });

    describe('(g) the suite is collected by integration configs and CI', () => {
        it('integration configs include the B5 evidence roots', () => {
            expect(read('packages/service-core/vitest.integration.config.ts')).toContain(
                "'test/integration/services/**/*.test.ts'"
            );
            for (const dir of ['billing-refund', 'billing-subscription']) {
                const api = apiIntegrationCollection({ target: `test/integration/${dir}` });
                expect(api.collected.length, dir).toBeGreaterThan(0);
                expect(api.excluded, dir).toEqual([]);
            }
            expect(read('packages/db/vitest.config.integration.ts')).toContain(
                "'test/integration/**/*.test.ts'"
            );
        });
        it('guards runs test:scripts and ci-pass needs the guards and test jobs', () => {
            const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
            const missing = ['guards', 'test-unit', 'test-integration'].filter(
                (job) => !needs.includes(job)
            );
            expect(guardsBlock.length).toBeGreaterThan(0);
            expect(guardsRuns).toContain('pnpm test:scripts');
            expect(missing).toEqual([]);
        });
    });
});
