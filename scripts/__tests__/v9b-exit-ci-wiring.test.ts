import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    apiIntegrationCollection,
    integrationJobRunsBothSuites
} from './helpers/api-integration-collection';

/**
 * Static exit evidence for V9b (AC:V9b:13, HOS-1505, V9b.5). The spec assigns
 * this check no TEST id of its own; its two tests, TEST:V9b:11 and :14, already
 * exist, so this file carries no TEST:V9b id. It does not run those tests: the
 * exit run and CI do. It proves their evidence IS present and wired.
 *
 * By H17 V9b travels in the cut epic, so “the Phase 1 branch” means that epic.
 * TEST:V9b:14 is a hash freeze, and AC:V9b:11's “no structural migration” is
 * measured with git in the exit run, not here. V9b's column has no guards
 * (“Guards: none”, V9b.md:52); its only static check is TEST:V9b:14. TEST:V9b:12
 * is a manual staging smoke. Every assertion here is about PRESENCE.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};
function checkGuardsCommands(): readonly string[] {
    const chain = rootPkg.scripts['check:guards'] ?? '';
    return chain.split('&&').map((part) => {
        const step = part.trim();
        const script = /^pnpm (?:run )?(\S+)$/.exec(step)?.[1];
        return script ? (rootPkg.scripts[script] ?? step) : step;
    });
}
// LISTA:V9b clauses and their AC/test mapping, inferred per .hoja/notas.md §4 H-9.
const LISTA_MAP = [
    { clause: 1, acs: ['AC:V9b:1', 'AC:V9b:2'], tests: ['TEST:V9b:1', 'TEST:V9b:2'] },
    { clause: 2, acs: ['AC:V9b:3'], tests: ['TEST:V9b:3'] },
    { clause: 3, acs: ['AC:V9b:4', 'AC:V9b:5'], tests: ['TEST:V9b:4', 'TEST:V9b:5'] },
    { clause: 4, acs: ['AC:V9b:9'], tests: ['TEST:V9b:9'] },
    { clause: 5, acs: ['AC:V9b:7'], tests: ['TEST:V9b:7'] },
    { clause: 6, acs: ['AC:V9b:14'], tests: ['TEST:V9b:13', 'TEST:V9b:14'] }
] as const;
// Clause files and required title ids, from .hoja/notas.md §1.
const API_LISTING = 'apps/api/test/integration/listing-publication/';
const VERTICALS_INTEGRATION = 'packages/verticals/test/integration/';
const CLAUSE_FILES = [
    [1, `${VERTICALS_INTEGRATION}publication-purge-inactive.integration.test.ts`, 'TEST:V9b:1'],
    [1, `${API_LISTING}purge-inactive-events.test.ts`, 'TEST:V9b:2'],
    [
        2,
        `${VERTICALS_INTEGRATION}publication-purge-inactive-remote.integration.test.ts`,
        'TEST:V9b:3'
    ],
    [2, `${API_LISTING}purge-inactive-remote-deletion.test.ts`, 'TEST:V9b:3'],
    [3, `${API_LISTING}purge-inactive-dependents.test.ts`, 'TEST:V9b:4'],
    [
        3,
        `${VERTICALS_INTEGRATION}publication-purge-inactive-lock.integration.test.ts`,
        'TEST:V9b:5'
    ],
    [4, 'packages/verticals/test/publication/inactivity-clock.test.ts', 'TEST:V9b:9'],
    [
        4,
        `${VERTICALS_INTEGRATION}publication-purge-inactive-owner-act.integration.test.ts`,
        'TEST:V9b:9'
    ],
    [
        4,
        'packages/db/test/integration/listing-retention-schedule.integration.test.ts',
        'TEST:V9b:9'
    ],
    [5, `${VERTICALS_INTEGRATION}publication-purge-inactive.integration.test.ts`, 'TEST:V9b:7'],
    [5, 'packages/verticals/test/publication/purge-inactive-listing.test.ts', 'TEST:V9b:7'],
    [6, `${API_LISTING}retention-pass.test.ts`, 'TEST:V9b:13'],
    [6, `${VERTICALS_INTEGRATION}publication-retention-pass.integration.test.ts`, 'TEST:V9b:13'],
    [6, 'scripts/__tests__/check-retention-archive-untouched.test.ts', 'TEST:V9b:14']
] as const;
// AC-to-TEST mapping, V9b.md:658-764.
const CASE_ACS = {
    'AC:V9b:1': ['TEST:V9b:1'],
    'AC:V9b:2': ['TEST:V9b:2'],
    'AC:V9b:3': ['TEST:V9b:3'],
    'AC:V9b:4': ['TEST:V9b:4'],
    'AC:V9b:5': ['TEST:V9b:5'],
    'AC:V9b:6': ['TEST:V9b:6'],
    'AC:V9b:7': ['TEST:V9b:7'],
    'AC:V9b:8': ['TEST:V9b:8'],
    'AC:V9b:9': ['TEST:V9b:9'],
    'AC:V9b:10': ['TEST:V9b:10'],
    'AC:V9b:11': ['TEST:V9b:11'],
    'AC:V9b:14': ['TEST:V9b:13', 'TEST:V9b:14']
} as const;
// Cut test titles, excluding the manual smoke TEST:V9b:12 (V9b.md:741-749).
const CUT_TESTS = Array.from({ length: 11 }, (_, index) => `TEST:V9b:${index + 1}`).concat([
    'TEST:V9b:13',
    'TEST:V9b:14'
]);
// Manual staging smoke, V9b.md:741-749 and GATE:FP.2; .hoja/notas.md §4 H-7.
const MANUAL_SMOKES = {
    'TEST:V9b:12':
        'staging smoke of the phase checklist: the limit date (cut + plazo 1 - plazo 4, version 1) is after the planned production merge, and one notice with a forced date is sent once'
} as const;
// The ids that name AC:V9b:13 in its Cubre, V9b.md:738 and :762.
const SPEC_EXIT_TESTS = ['TEST:V9b:11', 'TEST:V9b:14'] as const;
// TEST:V9b:11 from-empty evidence and its integration setup, .hoja/notas.md §1 / H-11.
const FROM_EMPTY = {
    test: 'TEST:V9b:11',
    file: 'packages/verticals/test/integration/publication-purge-inactive-deadlines.integration.test.ts',
    config: 'packages/verticals/vitest.integration.config.ts',
    setup: 'packages/verticals/test/integration/global-setup.ts'
} as const;
const SETUP_ANCHORS = [
    'DROP DATABASE IF EXISTS',
    "'drizzle-kit', 'migrate'",
    'apply-postgres-extras.mjs'
] as const;
const NO_DELETED_AT_ANCHORS = ["table_name IN ('trial", "'domain_event'"] as const;
// TEST:V9b:14 HOS-1504 freeze evidence, .hoja/notas.md §1 / H-2.
const FREEZE = {
    check: 'check:retention-archive-untouched',
    script: 'scripts/check-retention-archive-untouched.ts',
    mutationTest: 'scripts/__tests__/check-retention-archive-untouched.test.ts',
    inventory: 'scripts/guards/retention-archive-untouched.json'
} as const;
const FROZEN_FILES = [
    'packages/verticals/src/publication/archive-inactive-listing.ts',
    'packages/verticals/src/publication/archive-notices.ts',
    'packages/verticals/src/publication/inactivity-archive-run.ts',
    'packages/verticals/src/publication/retention-clock.ts',
    'packages/db/src/models/listing/listing-retention.model.ts',
    'apps/api/src/cron/jobs/listing-inactivity-archive.job.ts',
    'apps/api/src/utils/listing-publication/archive-ports.ts',
    'packages/notifications/src/services/outbox/listing-archived-renderers.tsx',
    'packages/notifications/src/templates/listing/listing-archived.tsx'
] as const;
// Daily retention job evidence, LISTA:V9b clause 6 and HOS-1504 D2 / Coord-750.
const RETENTION_JOB = {
    job: 'apps/api/src/cron/jobs/listing-retention-pass.job.ts',
    anchors: ['enabled: true', 'runRetentionPass'],
    manifest: 'apps/api/src/cron/schedules.manifest.ts',
    name: "'listing-retention-pass'",
    registry: 'apps/api/src/cron/registry.ts',
    symbol: 'listingRetentionPassJob'
} as const;
// Neighbor HOS-1686 review visibility evidence, .hoja/notas.md §1 / H-13.
const NEIGHBOR_TESTS = [
    {
        file: 'packages/db/test/integration/listing-reviews-shown.integration.test.ts',
        tests: ['TEST:1686:1']
    },
    {
        file: 'apps/api/test/integration/listing-publication/purged-listing-review-aggregates.test.ts',
        tests: ['TEST:1686:2', 'TEST:1686:3', 'TEST:1686:4']
    },
    {
        file: 'packages/service-core/test/integration/services/accommodation-review-purged-search.integration.test.ts',
        tests: ['TEST:1686:3']
    },
    { file: 'apps/api/test/routes/public-review-readers.guard.test.ts', tests: ['TEST:1686:5'] },
    {
        file: 'apps/api/test/integration/listing-publication/purged-listing-review-author.test.ts',
        tests: ['TEST:1686:6']
    }
] as const;
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
/** Lists test/ and tests/ roots of apps/packages, plus scripts tests. */
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
function collectTestFiles({ dir, out }: { readonly dir: string; readonly out: string[] }): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTestFiles({ dir: full, out });
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
}
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme))|(?:\.(?:skipIf|runIf|each)\((?:[^()]|\([^()]*\))*\)))*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}
function namesId({ text, id }: { readonly text: string; readonly id: string }): boolean {
    return new RegExp(`${id}(?![0-9])`).test(text);
}
function collectSources(): readonly { readonly file: string; readonly source: string }[] {
    const files: string[] = [];
    for (const root of collectTestRoots()) collectTestFiles({ dir: root, out: files });
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .map((file) => ({ file, source: readFileSync(file, 'utf8') }));
}
// Static evidence for AC:V9b:13. This exit test has no TEST id by spec (H-10).
describe('AC:V9b:13 - V9b exit: LISTA:V9b evidence in the tree, from-empty base and PB4/PB5 freeze wired, suite collected (HOS-1505)', () => {
    const sources = collectSources();
    const titledSources = sources.map(({ file, source }) => ({
        file,
        source,
        titles: testTitles({ source })
    }));
    const allTitles = titledSources.flatMap(({ titles }) => titles);
    describe('(a) the scanner finds V9b test titles in required roots', () => {
        it('finds titles under every required root', () => {
            // Arrange
            const roots = [
                'apps/api/test',
                'packages/verticals/test',
                'packages/db/test',
                'packages/notifications/test',
                'scripts/__tests__'
            ];
            // Act
            const missing = roots.filter(
                (root) =>
                    !titledSources.some(
                        ({ file, titles }) =>
                            file.includes(root) &&
                            titles.some((title) => title.includes('TEST:V9b:'))
                    )
            );
            // Assert
            expect(missing, `roots without TEST:V9b titles: ${missing.join(', ')}`).toEqual([]);
        });
    });
    describe('(b) each LISTA clause has its mapped title and named file evidence', () => {
        for (const entry of LISTA_MAP) {
            it(`clause ${entry.clause} (${entry.acs.join(', ')}): ${entry.tests.join(', ')}`, () => {
                // Arrange
                const missingTitles = entry.tests.filter(
                    (id) => !allTitles.some((title) => namesId({ text: title, id }))
                );
                const missingFiles = CLAUSE_FILES.filter(
                    ([clause]) => clause === entry.clause
                ).flatMap(([, file, id]) => {
                    const source = titledSources.find((item) => item.file.endsWith(file));
                    if (!source) return [`${file} (file missing)`];
                    return source.titles.some((title) => namesId({ text: title, id }))
                        ? []
                        : [`${file} (${id} title missing)`];
                });
                // Act
                const missing = [
                    ...missingTitles.map((id) => `${id} (title missing)`),
                    ...missingFiles
                ];
                // Assert
                expect(
                    missing,
                    `missing clause ${entry.clause} evidence: ${missing.join('; ')}`
                ).toEqual([]);
            });
        }
    });
    describe('(c) TEST:V9b:11 starts from empty and the exit tests are named', () => {
        it('has the from-empty title, schema anchors, migration config, and setup', () => {
            const file = readFileSync(path.join(repoRoot, FROM_EMPTY.file), 'utf8');
            const config = readFileSync(path.join(repoRoot, FROM_EMPTY.config), 'utf8');
            const setup = readFileSync(path.join(repoRoot, FROM_EMPTY.setup), 'utf8');
            const titles = testTitles({ source: file });
            const missing = [
                !titles.some((title) =>
                    namesId({ text: title, id: FROM_EMPTY.test }) ? '' : FROM_EMPTY.test
                ),
                ...NO_DELETED_AT_ANCHORS.filter((anchor) => !file.includes(anchor)),
                ...["'test/integration/**/*.test.ts'", 'test/integration/global-setup.ts'].filter(
                    (anchor) => !config.includes(anchor)
                ),
                ...SETUP_ANCHORS.filter((anchor) => !setup.includes(anchor))
            ].filter(Boolean);
            expect(existsSync(path.join(repoRoot, FROM_EMPTY.file))).toBe(true);
            expect(missing, `missing from-empty evidence: ${missing.join('; ')}`).toEqual([]);
        });
        it('names each spec exit test in CUT_TESTS and a corpus title', () => {
            for (const id of SPEC_EXIT_TESTS) {
                expect(CUT_TESTS).toContain(id);
                expect(
                    allTitles.some((title) => namesId({ text: title, id })),
                    `${id} title`
                ).toBe(true);
            }
        });
    });
    describe('(d) the AC cases, cut ids, and manual smoke mapping close', () => {
        it('maps the clauses, AC cases, cut ids, and titles', () => {
            // Arrange
            const clauses = LISTA_MAP.map(({ clause }) => clause).sort((a, b) => a - b);
            const acs = Object.keys(CASE_ACS).sort();
            const mapped = [
                ...LISTA_MAP.flatMap(({ tests }) => tests),
                ...Object.values(CASE_ACS).flat()
            ];
            const outside = mapped.filter((id) => !CUT_TESTS.includes(id));
            const missingTitles = CUT_TESTS.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            const overlap = Object.keys(MANUAL_SMOKES).filter((id) => CUT_TESTS.includes(id));
            // Act
            const missing = [...outside, ...missingTitles, ...overlap];
            // Assert
            expect(clauses).toEqual([1, 2, 3, 4, 5, 6]);
            expect(acs).toEqual(
                [...Array.from({ length: 11 }, (_, i) => `AC:V9b:${i + 1}`), 'AC:V9b:14'].sort()
            );
            expect(missing, `mapping problems: ${missing.join(', ')}`).toEqual([]);
        });
    });
    describe('(e) TEST:V9b:14 is written and wired to guard CI', () => {
        it('resolves check:guards to the freeze script and has its evidence files', () => {
            const resolved = checkGuardsCommands();
            expect(resolved.some((command) => command.includes(FREEZE.script))).toBe(true);
            for (const file of [FREEZE.script, FREEZE.mutationTest, FREEZE.inventory])
                expect(existsSync(path.join(repoRoot, file)), file).toBe(true);
        });
        it('guards job runs the freeze check and mutation suite', () => {
            const runs = stepRuns({ block: jobBlock({ source: ciYml, job: 'guards' }) });
            expect(runs).toContain(`pnpm ${FREEZE.check}`);
            expect(runs).toContain('pnpm test:scripts');
        });
        it('mutation test title names TEST:V9b:14 and inventory includes frozen paths', () => {
            const test = readFileSync(path.join(repoRoot, FREEZE.mutationTest), 'utf8');
            const titles = testTitles({ source: test });
            const inventory = JSON.parse(
                readFileSync(path.join(repoRoot, FREEZE.inventory), 'utf8')
            ) as { readonly files?: readonly { readonly file?: string }[] };
            const listed = inventory.files?.map(({ file }) => file) ?? [];
            const missing = FROZEN_FILES.filter((file) => !listed.includes(file));
            expect(
                titles.some((title) => namesId({ text: title, id: 'TEST:V9b:14' })).toString()
            ).toBe('true');
            expect(missing, `frozen inventory files missing: ${missing.join(', ')}`).toEqual([]);
        });
    });
    describe('(f) the daily retention job is enabled and registered', () => {
        it('has its call anchors, manifest name, and registry symbol', () => {
            const job = readFileSync(path.join(repoRoot, RETENTION_JOB.job), 'utf8');
            const manifest = readFileSync(path.join(repoRoot, RETENTION_JOB.manifest), 'utf8');
            const registry = readFileSync(path.join(repoRoot, RETENTION_JOB.registry), 'utf8');
            const missing = [
                ...RETENTION_JOB.anchors.filter((anchor) => !job.includes(anchor)),
                ...(manifest.includes(RETENTION_JOB.name) ? [] : [RETENTION_JOB.name]),
                ...(registry.includes(RETENTION_JOB.symbol) ? [] : [RETENTION_JOB.symbol])
            ];
            expect(missing, `retention job evidence missing: ${missing.join(', ')}`).toEqual([]);
        });
    });
    describe('(g) integration configs and CI Pass collect the suite', () => {
        it('includes API, db, service-core, and verticals integration tests', () => {
            for (const dir of ['listing-publication']) {
                const api = apiIntegrationCollection({ target: `test/integration/${dir}` });
                expect(api.collected.length, dir).toBeGreaterThan(0);
                expect(api.excluded, dir).toEqual([]);
            }
            const includes: Readonly<Record<string, readonly string[]>> = {
                'packages/db/vitest.config.integration.ts': ['test/integration/**/*.test.ts'],
                'packages/service-core/vitest.integration.config.ts': [
                    'test/integration/services/**/*.test.ts'
                ],
                'packages/verticals/vitest.integration.config.ts': [
                    'test/integration/**/*.test.ts',
                    'test/integration/global-setup.ts'
                ]
            };
            const missing = Object.entries(includes).flatMap(([file, anchors]) => {
                const source = readFileSync(path.join(repoRoot, file), 'utf8');
                return anchors
                    .filter((anchor) => !source.includes(anchor))
                    .map((anchor) => `${file} (${anchor})`);
            });
            expect(missing, `integration config evidence missing: ${missing.join('; ')}`).toEqual(
                []
            );
            const verticalsPkg = JSON.parse(
                readFileSync(path.join(repoRoot, 'packages/verticals/package.json'), 'utf8')
            ) as { readonly scripts?: Readonly<Record<string, string>> };
            expect(verticalsPkg.scripts?.['test:integration']).toBeTruthy();
        });
        it('test-integration runs and CI Pass needs guards, unit, and integration', () => {
            expect(
                integrationJobRunsBothSuites({
                    runs: stepRuns({ block: jobBlock({ source: ciYml, job: 'test-integration' }) })
                })
            ).toBe(true);
            const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
            for (const job of ['guards', 'test-unit', 'test-integration'])
                expect(needs).toContain(job);
        });
    });
    describe('(h) HOS-1686 neighbor evidence is present in its named titles', () => {
        it('finds every required neighbor title in its named file', () => {
            // Arrange
            const missing = NEIGHBOR_TESTS.flatMap((item) => {
                const source = titledSources.find(({ file }) => file.endsWith(item.file));
                return [
                    ...(existsSync(path.join(repoRoot, item.file))
                        ? []
                        : [`${item.file} (file missing)`]),
                    ...item.tests
                        .filter(
                            (id) => !source?.titles.some((title) => namesId({ text: title, id }))
                        )
                        .map((id) => `${item.file} (${id} title missing)`)
                ];
            });
            // Act
            const result = missing;
            // Assert
            expect(result, `neighbor evidence missing: ${result.join('; ')}`).toEqual([]);
        });
    });
});
