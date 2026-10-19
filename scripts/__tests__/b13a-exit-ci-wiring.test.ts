import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static evidence for AC:B13a:15: the LISTA:B13a clauses, explicit phase 2/4
 * deferrals, from-empty integration test, staging checklist and CI wiring.
 * It does NOT run those tests; the E2E exit run, the PR E2E P0 suite and
 * test:integration run them. Assertions check PRESENCE or compute missing,
 * conflicting and ungated lists, so additional evidence does not make this
 * test brittle.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const e2eCiYml = readFileSync(path.join(repoRoot, '.github/workflows/e2e-pr.yml'), 'utf8');
const e2ePackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'apps/e2e/package.json'), 'utf8')
) as {
    scripts: Record<string, string>;
};
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');
interface CorteEntry {
    readonly clause: 'A' | 'B' | 'D' | 'E';
    readonly b13Clause?: number;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
    readonly files: readonly string[];
}
interface DeferredEntry {
    readonly clause?: 'C';
    readonly acs: readonly string[];
    readonly tests: readonly string[];
    readonly issue: string;
    readonly phase: string;
    readonly letter: string;
}
const CORTE_MAP: readonly CorteEntry[] = [
    {
        clause: 'A',
        b13Clause: 1,
        acs: ['AC:B13a:1'],
        tests: ['TEST:B13a:1'],
        files: ['apps/e2e/tests/billing/billing-08-self-cancel.spec.ts']
    },
    {
        clause: 'A',
        b13Clause: 2,
        acs: ['AC:B13a:1', 'AC:B13a:19'],
        tests: ['TEST:B13a:1', 'TEST:B13a:20'],
        files: [
            'apps/e2e/tests/billing/billing-08-self-cancel.spec.ts',
            'apps/e2e/tests/billing/billing-15-cancellation-end-to-end.spec.ts'
        ]
    },
    {
        clause: 'A',
        b13Clause: 3,
        acs: ['AC:B13a:12'],
        tests: ['TEST:B13a:12'],
        files: ['apps/api/test/integration/billing-subscription/hidden-operations-rejected.test.ts']
    },
    {
        clause: 'A',
        b13Clause: 4,
        acs: ['AC:B13a:2'],
        tests: ['TEST:B13a:2'],
        files: ['apps/api/test/integration/webhooks/grace-and-suspension-texts.test.ts']
    },
    {
        clause: 'A',
        b13Clause: 5,
        acs: ['AC:B13a:3'],
        tests: ['TEST:B13a:2'],
        files: ['apps/api/test/integration/webhooks/grace-and-suspension-texts.test.ts']
    },
    {
        clause: 'A',
        b13Clause: 6,
        acs: ['AC:B13a:10'],
        tests: ['TEST:B13a:10'],
        files: ['apps/e2e/tests/billing/billing-13-pricing-subscribe.spec.ts']
    },
    {
        clause: 'A',
        b13Clause: 7,
        acs: ['AC:B13a:10'],
        tests: ['TEST:B13a:10'],
        files: ['apps/e2e/tests/admin/adm-13-action-14-from-marks.spec.ts']
    },
    {
        clause: 'A',
        b13Clause: 8,
        acs: ['AC:B13a:14'],
        tests: ['TEST:B13a:14', 'TEST:B13a:15'],
        files: ['scripts/__tests__/billing-smoke-checklist.test.ts']
    },
    {
        clause: 'B',
        acs: ['AC:B13a:7'],
        tests: ['TEST:B13a:6'],
        files: ['apps/e2e/tests/billing/billing-09-my-subscription-notices.spec.ts']
    },
    {
        clause: 'D',
        acs: ['AC:B13a:16'],
        tests: ['TEST:B13a:17'],
        files: ['apps/e2e/tests/billing/billing-11-tourist-vip-suspended-warning.spec.ts']
    },
    {
        clause: 'E',
        acs: ['AC:B13a:19'],
        tests: ['TEST:B13a:20'],
        files: ['apps/e2e/tests/billing/billing-15-cancellation-end-to-end.spec.ts']
    }
];
const DEFERRED: readonly DeferredEntry[] = [
    {
        clause: 'C',
        acs: ['AC:B13a:6'],
        tests: ['TEST:B13a:5'],
        issue: 'HOS-1619',
        phase: 'fase-2',
        letter: 'CU'
    },
    { acs: ['AC:B13a:25'], tests: [], issue: 'HOS-1639', phase: 'fase-2', letter: 'CY' },
    {
        acs: ['AC:B13a:18'],
        tests: ['TEST:B13a:19'],
        issue: 'HOS-1640',
        phase: 'fase-4',
        letter: 'CV'
    }
];
const SCAN_ROOTS = [
    'apps/e2e/tests',
    'apps/api/test',
    'apps/web/test',
    'apps/admin/test',
    'packages/service-core/test',
    'packages/db/test',
    'packages/notifications/test',
    'packages/billing/test',
    'packages/schemas/test',
    'scripts/__tests__'
] as const;
const CUT_TESTS = Array.from({ length: 25 }, (_, index) => `TEST:B13a:${index + 1}`).filter(
    (id) => id !== 'TEST:B13a:5' && id !== 'TEST:B13a:19'
);
const SPEC_EXIT_TESTS = ['TEST:B13a:14', 'TEST:B13a:16'] as const;
const TEST_1624 = 'TEST:1624:1';
const RETURN_SPEC = 'apps/e2e/tests/billing/billing-16-return-after-suspension.spec.ts';
const PHASE_FILES = [
    'scripts/__tests__/b5-exit-ci-wiring.test.ts',
    'scripts/__tests__/b7-exit-ci-wiring.test.ts',
    'scripts/__tests__/b8a-exit-ci-wiring.test.ts',
    'scripts/__tests__/b9a-exit-ci-wiring.test.ts'
] as const;

function jobBlock({ source, job }: { readonly source: string; readonly job: string }): string {
    const lines = source.split('\n');
    const jobsAt = lines.findIndex((line) => /^jobs:\s*$/.test(line));
    const headerAt = lines.findIndex((line, index) => index > jobsAt && line === `  ${job}:`);
    if (jobsAt === -1 || headerAt === -1) return '';
    const body: string[] = [];
    for (const line of lines.slice(headerAt + 1)) {
        if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line) || /^\S/.test(line)) break;
        body.push(line);
    }
    return body.join('\n');
}
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
function collectTestFiles(dir: string, out: string[]): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', '.turbo'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTestFiles(full, out);
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
}
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}
function namesId({ text, id }: { readonly text: string; readonly id: string }): boolean {
    return new RegExp(`${id}(?![0-9])`).test(text);
}
function titlesInRoot({ root }: { readonly root: string }): readonly string[] {
    const full = path.join(repoRoot, root);
    if (!existsSync(full) || !statSync(full).isDirectory()) return [];
    const files: string[] = [];
    collectTestFiles(full, files);
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .flatMap((file) => testTitles({ source: readFileSync(file, 'utf8') }));
}
function titlesInFile({ file }: { readonly file: string }): readonly string[] {
    return existsSync(path.join(repoRoot, file)) ? testTitles({ source: read(file) }) : [];
}
function allTitles(): readonly string[] {
    return SCAN_ROOTS.flatMap((root) => titlesInRoot({ root }));
}
function firstDescribeTitle({ file }: { readonly file: string }): string {
    const match = /test\.describe\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/.exec(read(file));
    return match?.[2] ?? '';
}

describe('AC:B13a:15 - B13a exit: LISTA:B13a evidence in the tree, phase 2 and 4 deferred, its e2e gated in CI (HOS-1624)', () => {
    it('(a) the scanner sees TEST:B13a titles in E2E and API roots', () => {
        const blindRoots = ['apps/e2e/tests', 'apps/api/test'].filter(
            (root) => !titlesInRoot({ root }).some((title) => title.includes('TEST:B13a:'))
        );
        expect(blindRoots, `roots without TEST:B13a titles: ${blindRoots.join(', ')}`).toEqual([]);
    });

    describe('(b) LISTA:B13a clauses map clause by clause to named evidence', () => {
        for (const entry of CORTE_MAP) {
            it(`${entry.clause}${entry.b13Clause ? `.${entry.b13Clause}` : ''}: ${entry.acs.join(', ')} → ${entry.tests.join(', ')}`, () => {
                const titles = entry.files.flatMap((file) => titlesInFile({ file }));
                const missingFiles = entry.files.filter(
                    (file) => !existsSync(path.join(repoRoot, file))
                );
                const missing = entry.tests.filter(
                    (id) => !titles.some((title) => namesId({ text: title, id }))
                );
                expect(missingFiles, `missing evidence files: ${missingFiles.join(', ')}`).toEqual(
                    []
                );
                expect(
                    missing,
                    `TEST ids without a title in mapped files: ${missing.join(', ')}`
                ).toEqual([]);
            });
        }
        it('covers LISTA:B13 clauses 1–8 once', () => {
            const covered = CORTE_MAP.flatMap(({ clause, b13Clause }) =>
                clause === 'A' && b13Clause !== undefined ? [b13Clause] : []
            );
            const missing = Array.from({ length: 8 }, (_, index) => index + 1).filter(
                (clause) => !covered.includes(clause)
            );
            expect(new Set(covered).size).toBe(covered.length);
            expect(missing).toEqual([]);
        });
    });

    it('(c) deferred clauses are phase 2/4 and have no AC overlap with the cut map', () => {
        const clauses = [...new Set([...CORTE_MAP.map(({ clause }) => clause), 'C'])].sort();
        const cutAcs = CORTE_MAP.flatMap(({ acs }) => acs);
        const deferredAcs = DEFERRED.flatMap(({ acs }) => acs);
        const conflicts = deferredAcs.filter((ac) => cutAcs.includes(ac));
        expect(clauses).toEqual(['A', 'B', 'C', 'D', 'E']);
        expect(DEFERRED).toEqual([
            {
                clause: 'C',
                acs: ['AC:B13a:6'],
                tests: ['TEST:B13a:5'],
                issue: 'HOS-1619',
                phase: 'fase-2',
                letter: 'CU'
            },
            { acs: ['AC:B13a:25'], tests: [], issue: 'HOS-1639', phase: 'fase-2', letter: 'CY' },
            {
                acs: ['AC:B13a:18'],
                tests: ['TEST:B13a:19'],
                issue: 'HOS-1640',
                phase: 'fase-4',
                letter: 'CV'
            }
        ]);
        expect(conflicts, `ACs both cut and deferred: ${conflicts.join(', ')}`).toEqual([]);
    });

    it('(d) TEST:B13a:16 names the from-empty integration test and the API config runs it', () => {
        const file =
            'apps/api/test/integration/billing-subscription/b13a-surfaces-from-empty.test.ts';
        const titles = titlesInFile({ file });
        const include = read('apps/api/vitest.config.integration.ts');
        const setup = read('apps/api/test/integration/global-setup.ts');
        expect(existsSync(path.join(repoRoot, file))).toBe(true);
        expect(titles.some((title) => namesId({ text: title, id: 'TEST:B13a:16' }))).toBe(true);
        expect(include).toContain('test/integration/billing-subscription/**/*.test.ts');
        expect(include).toContain('global-setup');
        expect(setup).toContain('DROP DATABASE IF EXISTS');
        expect(setup).toContain('CREATE DATABASE');
        expect(setup).toContain('migrate');
    });

    it('(e) every non-deferred cut TEST and each exit test has a title', () => {
        const titles = allTitles();
        const missing = CUT_TESTS.filter(
            (id) => !titles.some((title) => namesId({ text: title, id }))
        );
        const missingExit = SPEC_EXIT_TESTS.filter((id) => !CUT_TESTS.includes(id));
        const missingCancellation = CUT_TESTS.includes('TEST:B13a:20') ? [] : ['TEST:B13a:20'];
        expect(missing, `cut TEST ids without titles: ${missing.join(', ')}`).toEqual([]);
        expect(missingExit).toEqual([]);
        expect(missingCancellation).toEqual([]);
    });

    it('(f) the owner return-after-suspension case has its requested TEST title', () => {
        const titles = titlesInFile({ file: RETURN_SPEC });
        expect(existsSync(path.join(repoRoot, RETURN_SPEC))).toBe(true);
        expect(titles.some((title) => namesId({ text: title, id: TEST_1624 }))).toBe(true);
    });

    it('(g) cut E2E files and the owner case are gated in the first describe and PR CI', () => {
        const e2eFiles = [
            ...new Set([
                ...CORTE_MAP.flatMap(({ files }) => files).filter((file) =>
                    file.startsWith('apps/e2e/tests/')
                ),
                RETURN_SPEC
            ])
        ];
        const ungated = e2eFiles.filter((file) => !/@p0|@clock/.test(firstDescribeTitle({ file })));
        expect(ungated, `E2E files without @p0 or @clock: ${ungated.join(', ')}`).toEqual([]);
        expect(e2ePackage.scripts['e2e:test:p0']).toContain('--grep @p0');
        expect(e2ePackage.scripts['e2e:test:p0']).toContain('--grep @clock');
        expect(e2eCiYml).toContain("'epic/**'");
        expect(e2eCiYml).toContain('e2e:test:p0');
    });

    it('(h) B5, B7, B8a and B9a exit evidence files exist', () => {
        const missing = PHASE_FILES.filter((file) => !existsSync(path.join(repoRoot, file)));
        expect(missing, `missing phase evidence: ${missing.join(', ')}`).toEqual([]);
    });

    it('(i) the staging checklist includes TEST:B13a:14 and its full-path cancellation step', () => {
        const checklist = read('docs/billing/smoke-checklist.md');
        expect(checklist).toContain('## Part 1 — Staging (cutover rehearsal)');
        expect(checklist).toContain('TEST:B13a:14');
        expect(checklist).toContain('### S3 — Self-service cancellation (full path)');
    });

    it('(j) CI runs script and integration suites and makes both required by ci-pass', () => {
        const guards = stepRuns({ block: jobBlock({ source: ciYml, job: 'guards' }) });
        const integration = stepRuns({
            block: jobBlock({ source: ciYml, job: 'test-integration' })
        });
        const passNeeds = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
        expect(guards.some((run) => run.includes('pnpm test:scripts'))).toBe(true);
        expect(integration.some((run) => run.includes('pnpm test:integration'))).toBe(true);
        expect(passNeeds).toContain('guards');
        expect(passNeeds).toContain('test-integration');
    });
});
