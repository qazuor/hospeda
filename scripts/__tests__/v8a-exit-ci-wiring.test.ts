import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:V8a:16 (AC:V8a:14, HOS-1495, V8a.4) pins the V8a exit evidence in the
 * tree. It does not run tests or Playwright; the exit run, CI, and the nightly
 * suite do that. It proves the evidence IS present and wired. V8a has no guards
 * in its column (V8a.md:47, :58, “Guards: ninguno”). Row 1 has a component test
 * because pricing stays empty until HOS-1621, and row 19 is mail-only, so its
 * evidence is the renderer test. Every assertion is about PRESENCE.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

interface E2eContract {
    readonly file: string;
    readonly tests: readonly string[];
    readonly tags: readonly string[];
}

// LISTA:V8, V8a.md:91-110; exact clause map from .hoja/notas.md §5.a.
const CORTE_MAP = [
    { clause: 1, acs: ['AC:V8a:1'], tests: ['TEST:V8a:1'] },
    { clause: 2, acs: ['AC:V8a:2'], tests: ['TEST:V8a:2', 'TEST:V8a:3'] },
    { clause: 3, acs: ['AC:V8a:7', 'AC:V8a:8'], tests: ['TEST:V8a:8', 'TEST:V8a:9'] },
    { clause: 4, acs: ['AC:V8a:3'], tests: ['TEST:V8a:4'] },
    { clause: 5, acs: ['AC:V8a:11'], tests: ['TEST:V8a:13'] }
];

// Evidence files and required title ids by clause, from .hoja/notas.md §5.a.
const CLAUSE_FILES = [
    '1|apps/api/test/routes/publish-subscribe-destination.test.ts|TEST:V8a:1',
    '1|apps/api/test/integration/listing-publication/subscribe-destination-parity.test.ts|TEST:V8a:1',
    '2|packages/verticals/test/publication/subscribe-destination.test.ts|TEST:V8a:2',
    '2|packages/verticals/test/publication/subscribe-destination-canonical.guard.test.ts|TEST:V8a:2',
    '2|apps/e2e/tests/verticals/subscribe-button.spec.ts|TEST:V8a:3',
    '3|packages/service-core/test/integration/services/listing-support-edit.integration.test.ts|TEST:V8a:8',
    '3|apps/api/test/integration/listing-publication/support-edit-route.test.ts|TEST:V8a:8,TEST:V8a:9',
    '4|apps/e2e/tests/verticals/subscribe-button.spec.ts|TEST:V8a:4',
    '4|apps/web/test/components/host/PublishButton.no-plans.test.tsx|TEST:V8a:4',
    '5|apps/api/test/integration/account-closure/close-on-request-writes.test.ts|TEST:V8a:13',
    '5|packages/db/test/integration/account-closure/account-closure.writes.integration.test.ts|TEST:V8a:13'
] as const;
const clauseFiles = CLAUSE_FILES.map((row) => {
    const [clause, file, ids] = row.split('|');
    return { clause: Number(clause), file: file ?? '', tests: ids?.split(',') ?? [] };
});

// AC:V8a:14 and LISTA:V8 clause 5; “sin favoritos” means others' bookmarks (ACC:24, AC:V8a:11, H-9); own bookmarks remain and DB asserts own_bookmarks: 1.
const ACTION_24_ANCHORS = [
    {
        file: 'apps/api/test/integration/account-closure/close-on-request-writes.test.ts',
        anchors: ['FROM account WHERE user_id', 'toEqual([juan.ownBookmarkId])']
    },
    {
        file: 'packages/db/test/integration/account-closure/account-closure.writes.integration.test.ts',
        anchors: ['accounts: 0,', 'foreign_bookmarks: 0,']
    }
] as const;

// AC-to-TEST mapping from V8a.md:484-592.
const CASE_ACS: Readonly<Record<string, readonly string[]>> = {
    'AC:V8a:1': ['TEST:V8a:1'],
    'AC:V8a:2': ['TEST:V8a:2', 'TEST:V8a:3'],
    'AC:V8a:3': ['TEST:V8a:4'],
    'AC:V8a:4': ['TEST:V8a:5'],
    'AC:V8a:5': ['TEST:V8a:6'],
    'AC:V8a:6': ['TEST:V8a:7'],
    'AC:V8a:7': ['TEST:V8a:8'],
    'AC:V8a:8': ['TEST:V8a:9'],
    'AC:V8a:9': ['TEST:V8a:10', 'TEST:V8a:11'],
    'AC:V8a:10': ['TEST:V8a:12'],
    'AC:V8a:11': ['TEST:V8a:13', 'TEST:V8a:11'],
    'AC:V8a:12': ['TEST:V8a:14'],
    'AC:V8a:13': ['TEST:V8a:15']
};

// TEST:V8a:1 through TEST:V8a:15 are the cut suite from V8a.md:484-592.
const CUT_TESTS = Array.from({ length: 15 }, (_, index) => `TEST:V8a:${index + 1}`);
// Static exit test id assigned by V8a.md:594-599 and .hoja/notas.md §4 H-1.
const SELF_TEST = 'TEST:V8a:16';

// AC:V8a:6 / TEST:V8a:7 row evidence from .hoja/notas.md §5.b.
const ROW_EVIDENCE = [
    '1|apps/web/test/components/billing/PricingCardsGrid.tourist-trial.test.ts|the row 1 copy|component|the pricing is empty until HOS-1621',
    '2|apps/e2e/tests/verticals/listing-notices.spec.ts|TEST:V8a:7 row 2:|e2e',
    '4|apps/e2e/tests/verticals/listing-notices.spec.ts|TEST:V8a:7 row 4:|e2e',
    '8,9|apps/e2e/tests/verticals/listing-notices.spec.ts|TEST:V8a:7 rows 8 and 9:|e2e',
    '18|apps/e2e/tests/verticals/listing-notices.spec.ts|TEST:V8a:7 row 18:|e2e',
    '19|packages/notifications/test/services/outbox/vertical-listing-renderers.test.tsx|TEST:V8a:7 row 19:|mail',
    '24|apps/e2e/tests/verticals/listing-notices.spec.ts|TEST:V8a:7 row 24:|e2e',
    '25|apps/e2e/tests/verticals/listing-notices-recurring.spec.ts|TEST:V8a:7 row 25:|e2e',
    '30|apps/e2e/tests/verticals/listing-notices.spec.ts|TEST:V8a:7 row 30:|e2e',
    '31|apps/e2e/tests/verticals/listing-notices.spec.ts|TEST:V8a:7 row 31:|e2e',
    '35|apps/e2e/tests/verticals/listing-notices.spec.ts|TEST:V8a:7 row 35:|e2e'
] as const;
const rowEvidence = ROW_EVIDENCE.map((row) => {
    const [rows, file, title, kind, why] = row.split('|');
    return {
        rows: (rows ?? '').split(',').map(Number),
        file: file ?? '',
        title: title ?? '',
        kind: (kind ?? 'e2e') as 'component' | 'e2e' | 'mail',
        ...(why ? { why } : {})
    };
});
// AC:V8a:6, V8a.md:211-215.
const AC6_ROWS = [1, 2, 4, 8, 9, 18, 19, 24, 25, 30, 31, 35];

// E2E specs and tags for this piece, from .hoja/notas.md §1.
const E2E: readonly E2eContract[] = [
    {
        file: 'apps/e2e/tests/verticals/subscribe-button.spec.ts',
        tests: ['TEST:V8a:3', 'TEST:V8a:4'],
        tags: ['@p0', '@verticals']
    },
    {
        file: 'apps/e2e/tests/verticals/listing-notices.spec.ts',
        tests: ['TEST:V8a:5', 'TEST:V8a:7'],
        tags: ['@verticals']
    },
    {
        file: 'apps/e2e/tests/verticals/listing-notices-recurring.spec.ts',
        tests: ['TEST:V8a:7'],
        tags: ['@verticals']
    },
    {
        file: 'apps/e2e/tests/verticals/purged-listing-inbox.spec.ts',
        tests: ['TEST:V8a:6'],
        tags: ['@verticals']
    },
    {
        file: 'apps/e2e/tests/admin/adm-07-listing-purge-on-request.spec.ts',
        tests: ['TEST:V8a:11'],
        tags: ['@p1']
    },
    {
        file: 'apps/e2e/tests/admin/adm-08-account-close-on-request.spec.ts',
        tests: ['TEST:V8a:11'],
        tags: ['@p1']
    },
    {
        file: 'apps/e2e/tests/admin/adm-11-user-trial-summary.spec.ts',
        tests: ['TEST:V8a:7'],
        tags: ['@p1']
    }
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

/** Returns job names listed in `needs:` in list or single-value form. */
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

describe('TEST:V8a:16 AC:V8a:14 - V8a exit: LISTA:V8 evidence in the tree, every row of AC:V8a:6 covered, suite collected (HOS-1495)', () => {
    const sources = collectSources();
    const titledSources = sources.map(({ file, source }) => ({
        file,
        source,
        titles: testTitles({ source })
    }));
    const allTitles = titledSources.flatMap(({ titles }) => titles);

    describe('(a) the scanner finds TEST:V8a titles in required roots', () => {
        for (const root of [
            'apps/api/test',
            'apps/web/test',
            'apps/e2e/tests',
            'packages/db/test',
            'packages/verticals/test'
        ]) {
            it(`finds TEST:V8a titles under ${root}`, () => {
                expect(
                    titledSources.some(
                        ({ file, titles }) =>
                            file.includes(root) &&
                            titles.some((title) => title.includes('TEST:V8a:'))
                    )
                ).toBe(true);
            });
        }
    });

    describe('(b) every LISTA:V8 clause has its mapped titles and file evidence', () => {
        for (const entry of CORTE_MAP) {
            it(`clause ${entry.clause} (${entry.acs.join(', ')}): ${entry.tests.join(', ')}`, () => {
                // Arrange
                const missingTitles = entry.tests.filter(
                    (id) => !allTitles.some((title) => namesId({ text: title, id }))
                );
                const missingFiles = clauseFiles
                    .filter((item) => item.clause === entry.clause)
                    .flatMap((item) => {
                        const source = titledSources.find(({ file }) => file.endsWith(item.file));
                        if (!source) return [`${item.file} (file missing)`];
                        return item.tests
                            .filter(
                                (id) => !source.titles.some((title) => namesId({ text: title, id }))
                            )
                            .map((id) => `${item.file} (${id} title missing)`);
                    });
                const missingAnchors =
                    entry.clause === 5
                        ? ACTION_24_ANCHORS.flatMap(({ file, anchors }) => {
                              const source = sources.find((item) => item.file.endsWith(file));
                              return anchors
                                  .filter((anchor) => !source?.source.includes(anchor))
                                  .map((anchor) => `${file} (${anchor})`);
                          })
                        : [];
                // Act
                const missing = [
                    ...missingTitles.map((id) => `${id} (title missing)`),
                    ...missingFiles,
                    ...missingAnchors
                ];
                // Assert
                expect(
                    missing,
                    `missing clause ${entry.clause} evidence: ${missing.join('; ')}`
                ).toEqual([]);
            });
        }
    });

    describe('(c) the five clauses and thirteen AC mappings close over TEST:V8a:1..15', () => {
        it('maps clauses exactly once from 1 to 5', () => {
            const clauses = CORTE_MAP.map(({ clause }) => clause);
            expect([...clauses].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
        });
        it('maps every LISTA and AC test into CUT_TESTS', () => {
            const mapped = [
                ...CORTE_MAP.flatMap(({ tests }) => tests),
                ...Object.values(CASE_ACS).flat()
            ];
            const outside = mapped.filter((test) => !CUT_TESTS.includes(test));
            expect(outside, `mapped tests outside CUT_TESTS: ${outside.join(', ')}`).toEqual([]);
        });
        it('maps exactly AC:V8a:1 through AC:V8a:13 and keeps the static exit id distinct', () => {
            expect(Object.keys(CASE_ACS).sort()).toEqual(
                Array.from({ length: 13 }, (_, index) => `AC:V8a:${index + 1}`).sort()
            );
            expect(CUT_TESTS).not.toContain(SELF_TEST);
        });
    });

    describe('(d) every cut TEST id has a corpus title', () => {
        it('finds a title for TEST:V8a:1 through TEST:V8a:15', () => {
            const missing = CUT_TESTS.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            expect(missing, `missing TEST:V8a titles: ${missing.join(', ')}`).toEqual([]);
        });
    });

    describe('(e) the integration suite is included and CI Pass waits for its jobs', () => {
        it('API, db, and service-core integration configs include the piece suites', () => {
            const includes: Readonly<Record<string, readonly string[]>> = {
                'apps/api/vitest.config.integration.ts': [
                    'test/integration/account-closure/**/*.test.ts',
                    'test/integration/listing-publication/**/*.test.ts',
                    'test/integration/outbox/**/*.test.ts'
                ],
                'packages/db/vitest.config.integration.ts': ['test/integration/**/*.test.ts'],
                'packages/service-core/vitest.integration.config.ts': [
                    'test/integration/services/**/*.test.ts'
                ]
            };
            const missing = Object.entries(includes).flatMap(([file, globs]) => {
                const source = readFileSync(path.join(repoRoot, file), 'utf8');
                return globs
                    .filter((glob) => !source.includes(`'${glob}'`))
                    .map((glob) => `${file} (${glob})`);
            });
            expect(missing, `integration includes missing: ${missing.join('; ')}`).toEqual([]);
        });
        it('guards runs pnpm test:scripts and test-integration runs pnpm test:integration', () => {
            const guards = stepRuns({ block: jobBlock({ source: ciYml, job: 'guards' }) });
            const integration = stepRuns({
                block: jobBlock({ source: ciYml, job: 'test-integration' })
            });
            expect(guards).toContain('pnpm test:scripts');
            expect(integration).toContain('pnpm test:integration');
        });
        it('CI Pass needs guards, test-unit, and test-integration', () => {
            const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
            for (const job of ['guards', 'test-unit', 'test-integration'])
                expect(needs).toContain(job);
        });
    });

    describe('(f) each AC:V8a:6 row has its named evidence title', () => {
        it.each(rowEvidence)('$kind evidence covers row(s) $rows', ({ file, title }) => {
            const source = titledSources.find((item) => item.file.endsWith(file));
            const matching =
                source?.titles.filter(
                    (item) => item.includes(title) && namesId({ text: item, id: 'TEST:V8a:7' })
                ) ?? [];
            expect(existsSync(path.join(repoRoot, file)), `${file} exists`).toBe(true);
            expect(
                matching.length,
                `${file} title containing “${title}” and TEST:V8a:7`
            ).toBeGreaterThan(0);
        });
        it('covers exactly the AC:V8a:6 rows listed for this cut', () => {
            const rows = [...new Set(rowEvidence.flatMap(({ rows: entryRows }) => entryRows))].sort(
                (a, b) => a - b
            );
            expect(rows).toEqual(AC6_ROWS);
        });
    });

    describe('(g) piece e2e titles and tags are collected by PR and nightly workflows', () => {
        for (const contract of E2E) {
            it(`${contract.file} has its TEST titles and test.describe tags`, () => {
                const source = readFileSync(path.join(repoRoot, contract.file), 'utf8');
                const titles = testTitles({ source });
                for (const id of contract.tests)
                    expect(
                        titles.some((title) => namesId({ text: title, id })),
                        `${contract.file} title ${id}`
                    ).toBe(true);
                const describeLines = source
                    .split('\n')
                    .filter((line) => line.includes('test.describe('));
                for (const tag of contract.tags)
                    expect(
                        describeLines.some((line) => line.includes(tag)),
                        `${contract.file} test.describe ${tag}`
                    ).toBe(true);
            });
        }
        it('the PR e2e-p0 job runs the P0 suite', () => {
            const workflow = readFileSync(
                path.join(repoRoot, '.github/workflows/e2e-pr.yml'),
                'utf8'
            );
            expect(stepRuns({ block: jobBlock({ source: workflow, job: 'e2e-p0' }) })).toContain(
                'pnpm --filter hospeda-e2e e2e:test:p0'
            );
        });
        it('the nightly e2e-full job runs the full suite', () => {
            const workflow = readFileSync(
                path.join(repoRoot, '.github/workflows/e2e-nightly.yml'),
                'utf8'
            );
            expect(stepRuns({ block: jobBlock({ source: workflow, job: 'e2e-full' }) })).toContain(
                'pnpm --filter hospeda-e2e e2e:test'
            );
        });
    });
});
