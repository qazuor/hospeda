import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * B9a exit evidence (AC:B9a:16, HOS-1587, B9a.5): the static half of the
 * "Lista cuando" of B9a and what it takes from B9. The spec assigns this exit
 * check no TEST id of its own (the four ids in AC:B9a:16 belong to other
 * ACs), so this file carries none. It does not run the tests: the exit run
 * and CI do that. It proves that the evidence IS in the tree and is wired:
 *
 * - every clause of LISTA:B9a maps to its LISTA:B9 clause, AC and TEST ids,
 *   each TEST named by a test title and each clause by its evidence files;
 * - the schema-from-empty half and every cut TEST id are in the tree;
 * - the BL clause (S13 over a succession with a retained payment,
 *   AC:B9a:17/TEST:B9a:17) left the cut by letter CU (HOS-1635, phase 2) and
 *   is recorded as deferred;
 * - the integration configs collect the suite and CI Pass waits on it.
 *
 * Every assertion is about PRESENCE: other leaves edit these files in
 * parallel, so this test never pins counts, line numbers, absences nor the
 * relative order of files.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

interface CorteEntry {
    readonly clause: number;
    readonly b9Clause: number;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
}
interface DeferredEntry {
    readonly clause: number;
    readonly what: string;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
    readonly issue: string;
    readonly phase: string;
    readonly letter: string;
}

// LISTA:B9a, B9a.md:1068-1078; numbering from .hoja/notas.md §4 H-7 and the §5 table.
const CORTE_MAP: readonly CorteEntry[] = [
    { clause: 1, b9Clause: 4, acs: ['AC:B9a:12'], tests: ['TEST:B9a:12'] },
    { clause: 2, b9Clause: 7, acs: ['AC:B9a:11'], tests: ['TEST:B9a:11'] },
    { clause: 3, b9Clause: 4, acs: ['AC:B9a:12'], tests: ['TEST:B9a:12'] }
];
// B9a.md:803, :1032; letter CU, .hoja/contexto.md §2b: BL is phase 2 (HOS-1635).
const DEFERRED: readonly DeferredEntry[] = [
    {
        clause: 4,
        what: 'S13 over a succession with a retained payment turns the branch 4 flag off through the B7 interface',
        acs: ['AC:B9a:17'],
        tests: ['TEST:B9a:17'],
        issue: 'HOS-1635',
        phase: 'fase-2',
        letter: 'CU'
    }
];
// AC:B9a:16 "sobre una base creada desde cero"; B9a.md:1296-1308.
const FROM_EMPTY = {
    test: 'TEST:B9a:8',
    file: 'packages/db/test/integration/b9a-schema-from-empty.test.ts'
} as const;
// The evidence files of each clause, .hoja/notas.md §5; each names its TEST in a title.
const CLAUSE_FILES: Readonly<Record<number, readonly string[]>> = {
    1: [
        'packages/service-core/test/services/billing/coverage/b9a-sources-composition.guard.test.ts',
        'apps/api/test/integration/billing-subscription/grant-coverage-case-set.test.ts'
    ],
    2: [
        'packages/service-core/test/integration/services/permanent-grant-floor.test.ts',
        'apps/api/test/integration/billing-permanent-grant/permanent-grant-route-floor.test.ts',
        'apps/api/test/integration/billing-permanent-grant/cutover-step-3b.test.ts'
    ],
    3: ['packages/service-core/test/integration/services/coverage-courtesy-source.test.ts']
};
// The five files of B4 the composition guard protects, b9a-sources-composition.guard.test.ts:10-16.
const B4_FILES = [
    'packages/service-core/src/services/billing/coverage/subscription-sources.ts',
    'packages/service-core/src/services/billing/coverage/addon-sources.ts',
    'packages/service-core/src/services/billing/coverage/can-charge.ts',
    'packages/service-core/src/services/billing/coverage/retention-stopped.ts',
    'packages/service-core/src/services/billing/coverage/coverage-ports.ts'
] as const;
// B9a's own real set, grant-coverage-case-set.ts:6-11.
const GRANT_SET = 'apps/api/test/integration/billing-subscription/grant-coverage-case-set.ts';
const GRANT_SET_TEST =
    'apps/api/test/integration/billing-subscription/grant-coverage-case-set.test.ts';
const LIVE_GRANT_CASE =
    'a live permanent grant covers its anchored vertical with a GRANT source that carries its floor (AC:B9a:12)';
const REAL_COURTESY_CASE =
    'the real COURTESY source emits nothing from empty tables and one source from a seeded row (AC:B9a:12)';
// B9a.md:1206-1405; cut TEST ids, excluding phase 2 (6, 7, 13, 14, 17).
const CUT_TESTS = [
    'TEST:B9a:1',
    'TEST:B9a:2',
    'TEST:B9a:3',
    'TEST:B9a:4',
    'TEST:B9a:5',
    'TEST:B9a:8',
    'TEST:B9a:9',
    'TEST:B9a:10',
    'TEST:B9a:11',
    'TEST:B9a:12',
    'TEST:B9a:16'
] as const;
// B9a.md:1301, :1339, :1351; cut tests whose "Cubre" names AC:B9a:16.
const SPEC_EXIT_TESTS = ['TEST:B9a:8', 'TEST:B9a:11', 'TEST:B9a:12'] as const;

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
/** Lists the test roots: `test/` and `tests/` of `apps/*` and `packages/*`, plus `scripts/__tests__`. */
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
/** Recursively collects `*.test.ts(x)`/`*.spec.ts` files, skipping build output. */
function collectTestFiles(dir: string, out: string[]): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTestFiles(full, out);
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
}
/** Returns the literal titles of the `describe(`, `it(`, `test(` and `test.describe(` calls. */
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}
/** True when the text names the id with a numeric boundary (`TEST:B9a:1` is not `TEST:B9a:11`). */
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
/** Every title of the test files under one root (relative to the repo root). */
function titlesInRoot({ root }: { readonly root: string }): readonly string[] {
    const files: string[] = [];
    const full = path.join(repoRoot, root);
    if (!existsSync(full)) return [];
    collectTestFiles(full, files);
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .flatMap((file) => testTitles({ source: readFileSync(file, 'utf8') }));
}

describe('AC:B9a:16 - B9a exit: LISTA:B9a evidence in the tree, BL deferred, suite collected (HOS-1587)', () => {
    const allTitles = collectSources().flatMap((source) => testTitles({ source }));
    const guards = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guards });

    describe('(a) the scanner is not blind', () => {
        it('reads TEST:B9a titles under the API, db and service-core test roots', () => {
            // Arrange
            const roots = ['apps/api/test', 'packages/db/test', 'packages/service-core/test'];
            // Act
            const blindRoots = roots.filter(
                (root) => !titlesInRoot({ root }).some((title) => title.includes('TEST:B9a:'))
            );
            // Assert
            expect(blindRoots).toEqual([]);
        });
    });

    describe('(b) every clause names its TEST in a title and its evidence files', () => {
        for (const entry of CORTE_MAP) {
            it(`clause ${entry.clause} (B9 ${entry.b9Clause}, ${entry.acs.join(', ')}): ${entry.tests.join(', ')}`, () => {
                // Arrange
                const clauseFiles = CLAUSE_FILES[entry.clause] ?? [];
                // Act
                const missingTitles = entry.tests.filter(
                    (id) => !allTitles.some((title) => namesId({ text: title, id }))
                );
                const missingFiles: string[] = [];
                for (const file of clauseFiles) {
                    if (!existsSync(path.join(repoRoot, file))) {
                        missingFiles.push(`${file} (missing)`);
                        continue;
                    }
                    const titles = testTitles({ source: read(file) });
                    const named = entry.tests.some((id) =>
                        titles.some((title) => namesId({ text: title, id }))
                    );
                    if (!named)
                        missingFiles.push(`${file} (no title names ${entry.tests.join(', ')})`);
                }
                // Assert
                expect(
                    missingTitles,
                    `TEST ids without a title: ${missingTitles.join(', ')}`
                ).toEqual([]);
                expect(
                    missingFiles,
                    `evidence files without the title: ${missingFiles.join(', ')}`
                ).toEqual([]);
                if (entry.clause === 1) {
                    const guard = read(
                        'packages/service-core/test/services/billing/coverage/b9a-sources-composition.guard.test.ts'
                    );
                    const grantSet = read(GRANT_SET);
                    const grantSetTest = read(GRANT_SET_TEST);
                    const missingB4 = B4_FILES.filter((file) => !guard.includes(file));
                    expect(missingB4, `B4 files the guard misses: ${missingB4.join(', ')}`).toEqual(
                        []
                    );
                    expect(grantSet).toContain(LIVE_GRANT_CASE);
                    expect(grantSet).toContain('floor');
                    expect(grantSetTest).toContain('createApiBillingCoverage({');
                    expect(grantSetTest).toContain('grantCoverageCaseSet(');
                }
                if (entry.clause === 3) expect(read(GRANT_SET)).toContain(REAL_COURTESY_CASE);
            });
        }
    });

    describe('(c) the schema from empty', () => {
        it(`${FROM_EMPTY.test} exists and is named by a title of ${FROM_EMPTY.file}`, () => {
            // Arrange
            const exists = existsSync(path.join(repoRoot, FROM_EMPTY.file));
            // Act
            const titles = exists ? testTitles({ source: read(FROM_EMPTY.file) }) : [];
            // Assert
            expect(exists).toBe(true);
            expect(titles.some((title) => namesId({ text: title, id: FROM_EMPTY.test }))).toBe(
                true
            );
        });
    });

    describe('(d) the cut TEST ids, the clause coverage and the deferred BL', () => {
        it('every cut TEST id appears in at least one test title and every exit id is in the cut', () => {
            // Arrange
            const missing = CUT_TESTS.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            // Act
            const unused = SPEC_EXIT_TESTS.filter(
                (id) => !(CUT_TESTS as readonly string[]).includes(id)
            );
            // Assert
            expect(missing, `cut TEST ids without a title: ${missing.join(', ')}`).toEqual([]);
            expect(unused).toEqual([]);
        });
        it('the cut map plus the deferred clause cover clauses 1 to 4 without repeating', () => {
            // Arrange
            const clauses = [
                ...CORTE_MAP.map((entry) => entry.clause),
                ...DEFERRED.map((entry) => entry.clause)
            ];
            // Act
            const unique = new Set(clauses);
            const missing = [1, 2, 3, 4].filter((clause) => !unique.has(clause));
            // Assert
            expect(unique.size).toBe(clauses.length);
            expect(missing).toEqual([]);
        });
        it('the BL clause is exactly one deferred entry pointing at HOS-1635 phase 2', () => {
            // Arrange
            const entry = DEFERRED[0];
            // Act
            // Assert
            expect(DEFERRED).toHaveLength(1);
            expect(entry?.issue).toBe('HOS-1635');
            expect(entry?.phase).toBe('fase-2');
            expect(entry?.letter).toBe('CU');
            expect(entry?.tests).toEqual(['TEST:B9a:17']);
        });
    });

    describe('(e) the suite is collected and gated', () => {
        it('the integration configs collect the B9a suites', () => {
            // Arrange
            const api = read('apps/api/vitest.config.integration.ts');
            const serviceCore = read('packages/service-core/vitest.integration.config.ts');
            const db = read('packages/db/vitest.config.integration.ts');
            // Act
            const includes = [
                'test/integration/billing-permanent-grant/**/*.test.ts',
                'test/integration/billing-subscription/**/*.test.ts'
            ];
            // Assert
            for (const dir of includes) expect(api).toContain(`'${dir}'`);
            expect(serviceCore).toContain("'test/integration/services/**/*.test.ts'");
            expect(db).toContain("'test/integration/**/*.test.ts'");
        });
        it('the guards job runs the scripts suite and CI Pass waits on it', () => {
            // Arrange
            const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
            // Act
            const missingJobs = ['guards', 'test-unit', 'test-integration'].filter(
                (job) => !needs.includes(job)
            );
            // Assert
            expect(guards.length).toBeGreaterThan(0);
            expect(guardsRuns).toContain('pnpm test:scripts');
            expect(missingJobs).toEqual([]);
        });
    });
});
