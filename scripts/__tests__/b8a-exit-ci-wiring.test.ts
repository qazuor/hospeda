import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static evidence for AC:B8a:14: the LISTA:B8a clauses, the B8/B8b split,
 * the phase 2 deferral, the schema-from-empty test and the suite/CI wiring.
 * It does NOT run those tests; the exit run and CI do. All assertions check
 * PRESENCE or compute a missing/conflicting list, so parallel leaves may add
 * evidence without making this test brittle.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');
interface CorteEntry {
    readonly clause: number;
    readonly b8Clause?: number;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
    readonly file: string;
}
interface DeferredEntry {
    readonly acs: readonly string[];
    readonly tests: readonly string[];
    readonly issue: string;
    readonly phase: string;
    readonly letter: string;
}
const CORTE_MAP: readonly CorteEntry[] = [
    {
        clause: 1,
        b8Clause: 8,
        acs: ['AC:B8a:3'],
        tests: ['TEST:B8a:3'],
        file: 'packages/service-core/test/integration/services/subscription-cancel-active-complements.test.ts'
    },
    {
        clause: 2,

        acs: ['AC:B8a:9'],
        tests: ['TEST:B8a:9'],
        file: 'packages/service-core/test/integration/services/subscription-cancel-direct-grace.test.ts'
    },
    {
        clause: 3,

        acs: ['AC:B8a:8'],
        tests: ['TEST:B8a:8'],
        file: 'packages/service-core/test/integration/services/subscription-cancel-direct-suspended.test.ts'
    }
];
const B8_TO_B8B = [1, 2, 3, 4, 5, 6, 7, 9] as const;
const B8B_EXIT = { issue: 'HOS-1411', exit: 'HOS-1581', phase: 'fase-2', letter: 'Z' } as const;
const DEFERRED: readonly DeferredEntry[] = [
    { acs: ['AC:B8a:7'], tests: ['TEST:B8a:7'], issue: 'HOS-1633', phase: 'fase-2', letter: 'CY' }
];
const FROM_EMPTY = {
    test: 'TEST:B8a:14',
    file: 'packages/db/test/integration/b8a-schema-from-empty.test.ts'
} as const;
const CUT_TESTS = [
    ...Array.from({ length: 6 }, (_, index) => `TEST:B8a:${index + 1}`),
    ...Array.from({ length: 7 }, (_, index) => `TEST:B8a:${index + 8}`)
];
const SPEC_EXIT_TESTS = ['TEST:B8a:3', 'TEST:B8a:8', 'TEST:B8a:9', 'TEST:B8a:14'] as const;

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
function allTitles(): readonly string[] {
    return ['packages/service-core/test', 'packages/db/test'].flatMap((root) =>
        titlesInRoot({ root })
    );
}

describe('AC:B8a:14 - B8a exit: LISTA:B8a evidence in the tree, B8 split to B8b, phase 2 deferred, suite collected (HOS-1572)', () => {
    it('(a) the scanner reads TEST:B8a titles under service-core and db', () => {
        const blindRoots = ['packages/service-core/test', 'packages/db/test'].filter(
            (root) => !titlesInRoot({ root }).some((title) => title.includes('TEST:B8a:'))
        );
        expect(blindRoots, `roots without TEST:B8a titles: ${blindRoots.join(', ')}`).toEqual([]);
    });
    describe('(b) every LISTA:B8a clause names its TEST and evidence file', () => {
        for (const entry of CORTE_MAP)
            it(`clause ${entry.clause} (B8 clause ${entry.b8Clause || 'derived'}, ${entry.acs.join(', ')}): ${entry.tests.join(', ')}`, () => {
                const titles = testTitles({ source: read(entry.file) });
                const missingTitles = entry.tests.filter(
                    (id) => !allTitles().some((title) => namesId({ text: title, id }))
                );
                const missingFiles =
                    !existsSync(path.join(repoRoot, entry.file)) ||
                    !entry.tests.some((id) => titles.some((title) => namesId({ text: title, id })))
                        ? [entry.file]
                        : [];
                expect(
                    missingTitles,
                    `TEST ids without a title: ${missingTitles.join(', ')}`
                ).toEqual([]);
                expect(
                    missingFiles,
                    `evidence files without titles: ${missingFiles.join(', ')}`
                ).toEqual([]);
                if (entry.clause === 3)
                    expect(titles.some((title) => title.includes('TEST:1570:1 (h)'))).toBe(true);
            });
    });
    it('(c) CORTE_MAP and B8_TO_B8B cover LISTA:B8 clauses 1–9 without repetition', () => {
        const clauses = [
            ...CORTE_MAP.flatMap(({ b8Clause }) => (b8Clause === undefined ? [] : [b8Clause])),
            ...B8_TO_B8B
        ];
        const covered = clauses.filter((clause) => clause > 0);
        const missing = Array.from({ length: 9 }, (_, index) => index + 1).filter(
            (clause) => !covered.includes(clause)
        );
        expect(B8_TO_B8B).toEqual([1, 2, 3, 4, 5, 6, 7, 9]);
        expect(B8B_EXIT).toEqual({
            issue: 'HOS-1411',
            exit: 'HOS-1581',
            phase: 'fase-2',
            letter: 'Z'
        });
        expect(new Set(covered).size).toBe(covered.length);
        expect(missing).toEqual([]);
    });
    it('(d) AC:B8a:7 is the single phase 2 deferral', () => {
        expect(DEFERRED).toEqual([
            {
                acs: ['AC:B8a:7'],
                tests: ['TEST:B8a:7'],
                issue: 'HOS-1633',
                phase: 'fase-2',
                letter: 'CY'
            }
        ]);
    });
    it('(e) TEST:B8a:14 names the schema-from-empty test', () => {
        const exists = existsSync(path.join(repoRoot, FROM_EMPTY.file));
        const titles = exists ? testTitles({ source: read(FROM_EMPTY.file) }) : [];
        expect(exists).toBe(true);
        expect(titles.some((title) => namesId({ text: title, id: FROM_EMPTY.test }))).toBe(true);
    });
    it('(f) every cut TEST id appears in a title and the AC exit tests are in the cut', () => {
        const titles = allTitles();
        const missing = CUT_TESTS.filter(
            (id) => !titles.some((title) => namesId({ text: title, id }))
        );
        const unused = SPEC_EXIT_TESTS.filter((id) => !CUT_TESTS.includes(id));
        expect(missing, `cut TEST ids without titles: ${missing.join(', ')}`).toEqual([]);
        expect(unused).toEqual([]);
    });
    it('(g) the subscription transition corpus has no prohibited exits and the catalog names both rules', () => {
        const corpus = JSON.parse(read('scripts/guards/transition-tables.json')) as {
            machines: Record<
                string,
                { transitions: { id: string; from: string[]; to: string[] | string }[] }
            >;
        };
        const subscription = corpus.machines.subscription?.transitions ?? [];
        const conflicts = subscription
            .filter((row) => {
                const to = Array.isArray(row.to) ? row.to : [row.to];
                return (
                    (row.from.includes('CANCEL_SCHEDULED') && to.includes('ACTIVE')) ||
                    (row.from.includes('CANCELLED') &&
                        to.some((state) => state !== 'CANCELLED' && state !== '*SAME'))
                );
            })
            .map(({ id }) => id);
        const catalog = read(
            'packages/service-core/src/services/billing/subscription/subscription-prohibited-transitions.ts'
        );
        expect(conflicts, `conflicting subscription transitions: ${conflicts.join(', ')}`).toEqual(
            []
        );
        for (const value of ['PROH:B:1', 'PROH:B:2', 'CANCEL_SCHEDULED', 'CANCELLED'])
            expect(catalog).toContain(value);
    });
    it('(h) the rule 1 function is wired into activation and opens the required mark', () => {
        expect(
            read(
                'packages/service-core/src/services/billing/subscription/activate-subscription.service.ts'
            )
        ).toContain('refuseUndeclaredSubscriptionTransition(');
        expect(
            read(
                'packages/service-core/src/services/billing/subscription/refuse-undeclared-transition.ts'
            )
        ).toContain('TRANSICION_NO_DECLARADA');
    });
    it('(i) integration suites are collected from fresh databases and CI waits for their gates', () => {
        const service = read('packages/service-core/vitest.integration.config.ts');
        const serviceSetup = read(
            'packages/service-core/test/integration/services/global-setup.ts'
        );
        const db = read('packages/db/vitest.config.integration.ts');
        const guards = jobBlock({ source: ciYml, job: 'guards' });
        const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
        expect(service).toContain("'test/integration/services/**/*.test.ts'");
        expect(service).toContain('global-setup.ts');
        for (const value of ['DROP DATABASE IF EXISTS', 'CREATE DATABASE', 'migrate'])
            expect(serviceSetup).toContain(value);
        expect(db).toContain("'test/integration/**/*.test.ts'");
        expect(stepRuns({ block: guards })).toContain('pnpm test:scripts');
        const missingJobs = ['guards', 'test-unit', 'test-integration'].filter(
            (job) => !needs.includes(job)
        );
        expect(guards.length).toBeGreaterThan(0);
        expect(missingJobs).toEqual([]);
    });
});
