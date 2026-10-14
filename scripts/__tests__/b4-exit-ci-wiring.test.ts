import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:B4:10 (AC:B4:10, HOS-1536, B4.5): the exit evidence of B4, the
 * coverage contract for real.
 *
 * "La suite completa de `B4` en la rama: los tests 1 a 9 y el 11 en verde y,
 * cuando `B9a` enchufe los grants, el caso de `GRANT` con su `piso` en el
 * juego de la real." The suite itself runs in CI (`test-integration`,
 * `test-unit`, `guards`) and in the exit run of the leaf; this test proves
 * that the evidence each clause of LISTA:B4 demands IS in the tree and is
 * wired:
 *
 * - every clause of the cut maps to its AC and TEST ids, each named by a test
 *   title under the test roots;
 * - clause 3 (a GRANT case with its `floor` in the real implementation's own
 *   set) is deferred to B9a (HOS-1585, AC:B9a:12), and the real set's docblock
 *   names that promise;
 * - every TEST:B4 id (1..12 but this one) appears in a test file;
 * - the inventories of G-R1-E and G-R1-F name `can-charge.ts` (clause 6), and
 *   the real set holds the exact G-R2-C case (clause 7);
 * - G-R2-C, G-R1-E and G-R1-F are in `check:guards`, are steps of the `guards`
 *   job and are broken on purpose by their mutation tests, which run there
 *   through `pnpm test:scripts`;
 * - the integration configs collect the suite and `CI Pass` waits on it.
 *
 * Every assertion is about PRESENCE: other leaves edit these files in
 * parallel, so this test never pins counts, line numbers, absences nor the
 * relative order of guards. The workflows are read as text by indentation:
 * the repo has no YAML parser among its root dependencies.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};

const REAL_SET = 'apps/api/test/integration/billing-subscription/real-coverage-case-set.ts';
const G_R2_C_CASE =
    'a USER and a GLOBAL addon appear only in the verticals their product declares compatible (G-R2-C)';
const CAN_CHARGE = 'packages/service-core/src/services/billing/coverage/can-charge.ts';
const TOTAL_B4_TESTS = 12;
const SELF_TEST_ID = 10;

interface CorteEntry {
    readonly clause: number;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
}

interface DeferredEntry {
    readonly clause: number;
    readonly what: string;
    readonly ac: string;
    readonly issue: string;
    readonly reason: string;
}

interface GuardContract {
    readonly guard: string;
    readonly checkName: string;
    readonly checkScript: string;
    readonly mutationTest: string;
    readonly mutationTestId: string;
}

// LISTA:B4, B4.md:239-264: clause -> AC -> TEST, the map verified against the tree (HOS-1536).
const CORTE_MAP: readonly CorteEntry[] = [
    { clause: 1, acs: ['AC:B4:9'], tests: ['TEST:B4:9'] },
    { clause: 2, acs: ['AC:B4:9'], tests: ['TEST:B4:9'] },
    { clause: 4, acs: ['AC:B4:3'], tests: ['TEST:B4:2'] },
    { clause: 5, acs: ['AC:B4:2'], tests: ['TEST:B4:2'] },
    { clause: 6, acs: ['AC:B4:5'], tests: ['TEST:B4:4', 'TEST:B4:5'] },
    { clause: 7, acs: ['AC:B4:7', 'AC:B4:8'], tests: ['TEST:B4:6', 'TEST:B4:7', 'TEST:B4:8'] },
    { clause: 8, acs: ['AC:B4:11'], tests: ['TEST:B4:11'] }
];

// B4.md:246-247 and :511-512: clause 3 waits until B9a plugs the grants in.
const DEFERRED: readonly DeferredEntry[] = [
    {
        clause: 3,
        what: 'GRANT case with its floor in the real implementation own set',
        ac: 'AC:B9a:12',
        issue: 'HOS-1585',
        reason: 'un caso de `GRANT` que traiga su `piso` en el juego de la real, cuando `B9a` (Z) enchufe los grants'
    }
];

// GUARD:G-R2-C (B4), G-R1-E and G-R1-F (the two halves of clause 6's inventories).
const GUARDS: readonly GuardContract[] = [
    {
        guard: 'G-R2-C',
        checkName: 'check:addon-compatible-verticals',
        checkScript: 'scripts/check-addon-compatible-verticals.ts',
        mutationTest: 'scripts/__tests__/check-addon-compatible-verticals.test.ts',
        mutationTestId: 'TEST:B4:8'
    },
    {
        guard: 'G-R1-E',
        checkName: 'check:live-term-inventories',
        checkScript: 'scripts/check-live-term-inventories.ts',
        mutationTest: 'scripts/__tests__/check-live-term-inventories.test.ts',
        mutationTestId: 'TEST:B3:26'
    },
    {
        guard: 'G-R1-F',
        checkName: 'check:reconciliation-mark-discipline',
        checkScript: 'scripts/check-reconciliation-mark-discipline.ts',
        mutationTest: 'scripts/__tests__/check-reconciliation-mark-discipline.test.ts',
        mutationTestId: 'TEST:B3:27'
    }
];

/**
 * Returns the lines of one job under `jobs:` (its header up to the next job
 * header or the next top-level key). Empty when the job does not exist.
 */
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

/** Resolves the shell command each `pnpm <script>` of `check:guards` runs. */
function checkGuardsCommands(): readonly string[] {
    const chain = rootPkg.scripts['check:guards'] ?? '';
    return chain.split('&&').map((part) => {
        const step = part.trim();
        const script = /^pnpm (?:run )?(\S+)$/.exec(step)?.[1];
        return script ? (rootPkg.scripts[script] ?? step) : step;
    });
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

/**
 * Returns the titles of the `describe(`, `it(`, `test(` and `test.describe(`
 * calls of a source, also behind `.skipIf(...)`/`.runIf(...)` (TEST:B4:6 and
 * TEST:B4:7 live under `describe.skipIf(!isServiceTestDbAvailable())`): the
 * first argument when it is a single-quoted, double-quoted or backtick literal.
 */
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme)|\.(?:skipIf|runIf)\((?:[^()]|\([^()]*\))*\)\s*)*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}

/** True when the text names the id with a numeric boundary (`TEST:B4:1` is not `TEST:B4:11`). */
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

describe('TEST:B4:10 AC:B4:10 - B4 exit: LISTA:B4 evidence in the tree, guards wired, suite collected (HOS-1536)', () => {
    const sources = collectSources();
    const allTitles = sources.flatMap((source) => testTitles({ source }));
    const guards = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guards });

    describe('(a) every clause of the cut names its TEST in a test title', () => {
        it('the scanner is not blind: it reads TEST:B4 titles', () => {
            expect(allTitles.some((title) => title.includes('TEST:B4:'))).toBe(true);
        });

        for (const entry of CORTE_MAP) {
            it(`clause ${entry.clause} (${entry.acs.join(', ')}): ${entry.tests.join(', ')} named by a title`, () => {
                const missing = entry.tests.filter(
                    (id) => !allTitles.some((title) => namesId({ text: title, id }))
                );
                expect(missing, `TEST ids without a title: ${missing.join(', ')}`).toEqual([]);
            });
        }

        it('the cut map plus the deferred clause cover clauses 1 to 8', () => {
            const clauses = new Set([
                ...CORTE_MAP.map((entry) => entry.clause),
                ...DEFERRED.map((entry) => entry.clause)
            ]);
            for (let clause = 1; clause <= 8; clause += 1) expect(clauses.has(clause)).toBe(true);
        });
    });

    describe('(b) clause 3 is deferred to B9a, and the real set names that promise', () => {
        for (const entry of DEFERRED) {
            it(`clause ${entry.clause} waits on ${entry.issue} (${entry.ac}): ${entry.what}`, () => {
                const realSet = readFileSync(path.join(repoRoot, REAL_SET), 'utf8');
                expect(entry.reason).toContain('B9a');
                expect(realSet).toContain('B9a');
                expect(realSet).toContain('GRANT');
            });
        }
    });

    describe('(c) every TEST:B4 id has a test file', () => {
        it(`has a test for every TEST:B4 id (1..${TOTAL_B4_TESTS} except this one, ${SELF_TEST_ID})`, () => {
            const missing: string[] = [];
            for (let n = 1; n <= TOTAL_B4_TESTS; n += 1) {
                if (n === SELF_TEST_ID) continue;
                const id = `TEST:B4:${n}`;
                if (!sources.some((source) => namesId({ text: source, id }))) missing.push(id);
            }
            expect(missing, `missing TEST:B4 ids: ${missing.join(', ')}`).toEqual([]);
        });
    });

    describe('(d) clause 6 inventories and clause 7 real-set case', () => {
        it(`the live-term inventories name ${CAN_CHARGE} (G-R1-E and G-R1-F halves)`, () => {
            const inventories = readFileSync(
                path.join(repoRoot, 'scripts/guards/live-term-inventories.json'),
                'utf8'
            );
            expect(inventories).toContain(CAN_CHARGE);
        });

        it("the real implementation's own set holds the exact G-R2-C case", () => {
            expect(readFileSync(path.join(repoRoot, REAL_SET), 'utf8')).toContain(G_R2_C_CASE);
        });
    });

    describe('(e) the B4 guards are wired and broken on purpose', () => {
        it('the guards job exists and runs pnpm test:scripts (the mutation tests run there)', () => {
            expect(guards.length).toBeGreaterThan(0);
            expect(guardsRuns).toContain('pnpm test:scripts');
        });

        for (const contract of GUARDS) {
            it(`${contract.guard} resolves to ${contract.checkScript} in check:guards`, () => {
                expect(
                    checkGuardsCommands().some((command) => command.includes(contract.checkScript))
                ).toBe(true);
                expect(existsSync(path.join(repoRoot, contract.checkScript))).toBe(true);
            });

            it(`the guards job runs pnpm ${contract.checkName} (${contract.guard})`, () => {
                expect(guardsRuns).toContain(`pnpm ${contract.checkName}`);
            });

            it(`${contract.guard} has its mutation test carrying ${contract.mutationTestId}`, () => {
                const full = path.join(repoRoot, contract.mutationTest);
                expect(existsSync(full)).toBe(true);
                expect(readFileSync(full, 'utf8')).toContain(contract.mutationTestId);
            });
        }
    });

    describe('(f) the suite is collected by the integration configs and gates CI Pass', () => {
        it('the API integration config includes billing-subscription, plan-publication and listing-publication', () => {
            const config = readFileSync(
                path.join(repoRoot, 'apps/api/vitest.config.integration.ts'),
                'utf8'
            );
            for (const dir of ['billing-subscription', 'plan-publication', 'listing-publication'])
                expect(config).toContain(`'test/integration/${dir}/**/*.test.ts'`);
        });

        it('the service-core integration config collects the coverage-* tests', () => {
            const config = readFileSync(
                path.join(repoRoot, 'packages/service-core/vitest.integration.config.ts'),
                'utf8'
            );
            expect(config).toContain("'test/integration/services/**/*.test.ts'");
            const dir = path.join(repoRoot, 'packages/service-core/test/integration/services');
            expect(
                readdirSync(dir).some((name) => /^coverage-.*\.test\.ts$/.test(name)),
                'coverage-* tests live under the collected directory'
            ).toBe(true);
        });

        const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });
        for (const job of ['guards', 'test-unit', 'test-integration']) {
            it(`CI Pass waits on ${job}`, () => {
                expect(needs).toContain(job);
            });
        }
    });
});
