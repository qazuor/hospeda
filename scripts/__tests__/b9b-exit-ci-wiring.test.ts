import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { apiIntegrationCollection } from './helpers/api-integration-collection';

/**
 * Exit evidence for the B9b slice that went to cut (owner letter DB, B9b.md:99-100):
 * AC:B9b:1-6, 9 and 12, from HOS-1588, HOS-1589 and HOS-1591. The B9b PIECE exit
 * (AC:B9b:11, LISTA:B9b) belongs to phase 2 (HOS-1592); this test does not claim it.
 * The spec assigns this exit test no TEST id of its own, so it carries none. It does
 * not run the tests (the exit run and CI do that); it proves their evidence IS in the
 * tree and wired. Every assertion is about PRESENCE, except the one retired guard
 * phrase this leaf removed, checked narrowly in that guard file.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const e2eYml = readFileSync(path.join(repoRoot, '.github/workflows/e2e-pr.yml'), 'utf8');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');
const e2ePkg = JSON.parse(read('apps/e2e/package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
};

interface SliceClause {
    readonly clause: number;
    readonly tests: readonly string[];
}
interface OtherClause {
    readonly clause: number;
    readonly owner: string;
    readonly phase: string;
}
interface SliceExtra {
    readonly what: string;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
}
interface DeferredEntry {
    readonly acs: readonly string[];
    readonly issue: string;
    readonly phase: string;
    readonly letter: string;
}
interface E2eContract {
    readonly file: string;
    readonly tests: readonly string[];
    readonly ac: string;
}

// LISTA:B9, B9a.md:1036-1060; clauses from the cut slice, excluding grants and phase 2.
const SLICE_CLAUSES: readonly SliceClause[] = [
    { clause: 1, tests: ['TEST:B9b:1'] },
    { clause: 2, tests: ['TEST:B9b:2'] },
    { clause: 5, tests: ['TEST:B9b:6'] },
    { clause: 8, tests: ['TEST:B9b:1'] },
    { clause: 9, tests: ['TEST:B9b:4'] }
];
// LISTA:B9, B9a.md:1036-1060; grants and other owners' phase/cut clauses.
const NOT_THIS_SLICE: readonly OtherClause[] = [
    { clause: 3, owner: 'HOS-1590', phase: 'fase-2' },
    { clause: 4, owner: 'B9a', phase: 'corte' },
    { clause: 6, owner: 'HOS-1592', phase: 'fase-2' },
    { clause: 7, owner: 'B9a', phase: 'corte' }
];
// B9b.md:210-219 and :248-258; ACC:21 and row 7-bis added by this slice.
const SLICE_EXTRAS: readonly SliceExtra[] = [
    {
        what: 'create or close a code from the panel editor (ACC:21)',
        acs: ['AC:B9b:9'],
        tests: ['TEST:B9b:9']
    },
    {
        what: 'what the redemption says (row 7-bis)',
        acs: ['AC:B9b:12'],
        tests: ['TEST:B9b:12']
    }
];
// B9b.md:100, owner letter DB; temporary courtesy and its crossings stay in phase 2.
const DEFERRED: readonly DeferredEntry[] = [
    {
        acs: ['AC:B9b:7', 'AC:B9b:8', 'AC:B9b:13'],
        issue: 'HOS-1590',
        phase: 'fase-2',
        letter: 'DB'
    },
    {
        acs: ['AC:B9b:10', 'AC:B9b:11', 'AC:B9b:14'],
        issue: 'HOS-1592',
        phase: 'fase-2',
        letter: 'DB'
    }
];
// B9b.md:99 and testing map :429-446; cut IDs only.
const CUT_TESTS = [
    'TEST:B9b:1',
    'TEST:B9b:2',
    'TEST:B9b:3',
    'TEST:B9b:4',
    'TEST:B9b:5',
    'TEST:B9b:6',
    'TEST:B9b:9',
    'TEST:B9b:12'
] as const;
// B9b.md:547-557 and :583-594; e2e files as named in the tree.
const E2E: readonly E2eContract[] = [
    {
        file: 'apps/e2e/tests/admin/adm-14-promo-code-editor.spec.ts',
        tests: ['TEST:B9b:9'],
        ac: 'AC:B9b:9'
    },
    {
        file: 'apps/e2e/tests/billing/billing-14-promo-redeem-notice.spec.ts',
        tests: ['TEST:B9b:12', 'TEST:B9b:2'],
        ac: 'AC:B9b:12'
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
/** Lists the test roots used by the exit corpus, including app roots with nested tests. */
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
    for (const root of ['apps/e2e/tests', 'apps/admin/src', 'apps/web/test']) {
        const candidate = path.join(repoRoot, root);
        if (existsSync(candidate) && !roots.includes(candidate)) roots.push(candidate);
    }
    const scriptsTests = path.join(repoRoot, 'scripts/__tests__');
    if (existsSync(scriptsTests)) roots.push(scriptsTests);
    return roots;
}
/** Recursively collects test source files while skipping generated and installed trees. */
function collectTestFiles({ dir, out }: { readonly dir: string; readonly out: string[] }): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectTestFiles({ dir: full, out });
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
}
/** Returns literal titles of describe/it/test calls, including Playwright test.describe. */
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}
/** True when a title names an id at a numeric boundary (`:1` does not match `:12`). */
function namesId({ text, id }: { readonly text: string; readonly id: string }): boolean {
    return new RegExp(`${id}(?![0-9])`).test(text);
}
/** Reads all corpus sources except this file. */
function collectSources(): readonly string[] {
    const files: string[] = [];
    for (const root of collectTestRoots()) collectTestFiles({ dir: root, out: files });
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .map((file) => readFileSync(file, 'utf8'));
}
/** Returns all literal test titles under a repo-relative root. */
function titlesInRoot({ root }: { readonly root: string }): readonly string[] {
    const files: string[] = [];
    const full = path.join(repoRoot, root);
    if (!existsSync(full)) return [];
    collectTestFiles({ dir: full, out: files });
    return files
        .filter((file) => path.resolve(file) !== path.resolve(selfPath))
        .flatMap((file) => testTitles({ source: readFileSync(file, 'utf8') }));
}

describe('B9b cut slice exit: LISTA:B9 clauses of the slice, action 21 and row 7-bis in the tree, phase 2 deferred (HOS-1591)', () => {
    const allTitles = collectSources().flatMap((source) => testTitles({ source }));

    describe('(a) the scanner is not blind', () => {
        it('finds TEST:B9b titles in API, service-core and e2e roots', () => {
            const roots = ['apps/api/test', 'packages/service-core/test', 'apps/e2e/tests'];
            const blindRoots = roots.filter(
                (root) => !titlesInRoot({ root }).some((title) => title.includes('TEST:B9b:'))
            );
            expect(blindRoots).toEqual([]);
        });
    });

    describe('(b) slice clauses and extras have titles', () => {
        for (const entry of [...SLICE_CLAUSES, ...SLICE_EXTRAS]) {
            const title = 'clause' in entry ? `LISTA:B9 clause ${entry.clause}` : entry.what;
            it(`${title} names its TEST ids`, () => {
                for (const id of entry.tests)
                    expect(allTitles.some((testTitle) => namesId({ text: testTitle, id }))).toBe(
                        true
                    );
            });
        }
    });

    describe('(c) cut tests, clauses and deferred AC coverage', () => {
        it('every cut TEST id appears in at least one title', () => {
            const missing = CUT_TESTS.filter(
                (id) => !allTitles.some((title) => namesId({ text: title, id }))
            );
            expect(missing).toEqual([]);
        });
        it('LISTA:B9 clauses 1 to 9 are covered once by the slice and other owners', () => {
            const clauses = [
                ...SLICE_CLAUSES.map((entry) => entry.clause),
                ...NOT_THIS_SLICE.map((entry) => entry.clause)
            ];
            expect(new Set(clauses).size).toBe(clauses.length);
            expect([...clauses].sort((left, right) => left - right)).toEqual([
                1, 2, 3, 4, 5, 6, 7, 8, 9
            ]);
        });
        it('the DB deferrals identify both phase 2 owners and cover ACs 1 to 14 once', () => {
            expect(DEFERRED).toHaveLength(2);
            expect(DEFERRED.map(({ issue }) => issue)).toEqual(['HOS-1590', 'HOS-1592']);
            expect(
                DEFERRED.every(({ phase, letter }) => phase === 'fase-2' && letter === 'DB')
            ).toBe(true);
            const cutAcs = [
                'AC:B9b:1',
                'AC:B9b:2',
                'AC:B9b:3',
                'AC:B9b:4',
                'AC:B9b:5',
                'AC:B9b:6',
                'AC:B9b:9',
                'AC:B9b:12'
            ];
            const acs = [...cutAcs, ...DEFERRED.flatMap(({ acs: deferredAcs }) => deferredAcs)];
            expect(new Set(acs).size).toBe(acs.length);
            expect([...acs].sort()).toEqual(
                Array.from({ length: 14 }, (_, index) => `AC:B9b:${index + 1}`).sort()
            );
        });
    });

    describe('(d) e2e evidence is selected by P0', () => {
        for (const contract of E2E) {
            it(`${contract.file} first test.describe names its TEST, AC and @p0`, () => {
                expect(existsSync(path.join(repoRoot, contract.file))).toBe(true);
                const source = read(contract.file);
                const title =
                    source.split('\n').find((line) => line.includes('test.describe(')) ?? '';
                for (const token of [...contract.tests, contract.ac, '@p0'])
                    expect(title).toContain(token);
            });
        }
        it('the e2e-p0 job runs the P0 script', () => {
            const runs = stepRuns({ block: jobBlock({ source: e2eYml, job: 'e2e-p0' }) });
            expect(runs).toContain('pnpm --filter hospeda-e2e e2e:test:p0');
        });
        it('e2e:test:p0 selects @p0 and @clock', () => {
            const script = e2ePkg.scripts['e2e:test:p0'] ?? '';
            expect(script).toContain('--grep @p0');
            expect(script).toContain('--grep @clock');
        });
    });

    describe('(e) integration and CI collect the evidence', () => {
        it('integration configs include the promo suites', () => {
            for (const dir of ['billing-promo']) {
                const api = apiIntegrationCollection({ target: `test/integration/${dir}` });
                expect(api.collected.length, dir).toBeGreaterThan(0);
                expect(api.excluded, dir).toEqual([]);
            }
            expect(read('packages/service-core/vitest.integration.config.ts')).toContain(
                "'test/integration/services/**/*.test.ts'"
            );
            expect(read('packages/db/vitest.config.integration.ts')).toContain(
                "'test/integration/**/*.test.ts'"
            );
        });
        it('guards run scripts tests and ci-pass waits for all required gates', () => {
            const guards = jobBlock({ source: ciYml, job: 'guards' });
            const passNeeds = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
            expect(stepRuns({ block: guards })).toContain('pnpm test:scripts');
            for (const job of ['guards', 'test-unit', 'test-integration'])
                expect(passNeeds).toContain(job);
        });
    });

    describe('(f) action 21 owns its permission', () => {
        it('ACC_21 declares the promo permission and has no pending owner', () => {
            const source = read('packages/verticals/src/authorization/administrative-actions.ts');
            const action = source.match(/ACC_21\s*:\s*\{[^}]+\}/s)?.[0] ?? '';
            expect(action).toContain('PermissionEnum.BILLING_MANAGE_PROMO_CODES');
            expect(action).toContain('pendingOwnPermission: null');
        });
        it('the route guard no longer carries the retired placeholder for this leaf', () => {
            const guard = read(
                'apps/api/test/routes/administrative-action-route-permissions.guard.test.ts'
            );
            // This is the sole narrow absence assertion: this leaf removed this exact placeholder.
            expect(guard).not.toContain('B9b (HOS-1591) builds it');
        });
    });
});
