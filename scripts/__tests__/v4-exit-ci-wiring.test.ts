import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:V4:20 (AC:V4:15): the exit evidence of V4 (HOS-1449), the trial
 * end-to-end piece, for the CI wiring the momento-1 gate relies on.
 *
 * - G-R4, G-R4-B, G-R6 and G13 are plugged into `pnpm check:guards` AND are a
 *   step of the `guards` job (owner 2026-09-26, G5-5: one CI step per guard is
 *   the repo convention). Each guard is broken on purpose by its own mutation
 *   test, and those tests run inside the same `guards` job through
 *   `pnpm test:scripts`.
 * - `guards`, `test-unit` and `test-integration` gate `CI Pass`.
 * - Every V4 test id (1..23 except this guard's own 20) has a test file under
 *   the package test roots, so the piece ships with all of its tests present.
 * - The V4 e2e runs in the `e2e-p0` job of the PR workflow, isolated under
 *   `--grep @clock`.
 *
 * This test does not run the guards nor Playwright: it proves the wiring. The
 * green guards are the job's (and `pnpm check:guards`), `CI Pass` reaching
 * SUCCESS is verified on the PR, and the e2e lives in a separate check.
 *
 * Every assertion is anchored on its own job block, never on a whole-file
 * match. The workflows are read as text by indentation: the repo has no YAML
 * parser among its root dependencies and this test does not add one.
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

const V4_SPEC = 'apps/e2e/tests/verticals/trial-01-end-to-end.spec.ts';
const TOTAL_V4_TESTS = 23;
const SELF_TEST_ID = 20;

interface GuardContract {
    readonly guard: string;
    readonly checkScript: string;
    readonly checkName: string;
    readonly mutationTest: string;
    readonly mutationTestId: string;
}

const GUARDS: readonly GuardContract[] = [
    {
        guard: 'G-R4',
        checkScript: 'scripts/check-transition-guards-disjoint.ts',
        checkName: 'check:transition-guards-disjoint',
        mutationTest: 'scripts/__tests__/check-transition-guards-disjoint.test.ts',
        mutationTestId: 'TEST:V4:16'
    },
    {
        guard: 'G-R4-B',
        checkScript: 'scripts/check-verticals-machines-vocabulary.ts',
        checkName: 'check:verticals-machines-vocabulary',
        mutationTest: 'scripts/__tests__/check-verticals-machines-vocabulary.test.ts',
        mutationTestId: 'TEST:V4:17'
    },
    {
        guard: 'G-R6',
        checkScript: 'scripts/check-read-columns-written.ts',
        checkName: 'check:read-columns-written',
        mutationTest: 'scripts/__tests__/check-read-columns-written.test.ts',
        mutationTestId: 'TEST:V4:18'
    },
    {
        guard: 'G13',
        checkScript: 'scripts/check-bootstrap-answers-never-in-production.ts',
        checkName: 'check:bootstrap-answers-never-in-production',
        mutationTest: 'scripts/__tests__/check-bootstrap-answers-never-in-production.test.ts',
        mutationTestId: 'TEST:V4:15'
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

/**
 * Returns the whole text of the step whose `run:` command matches, so an
 * assertion about a guard's environment stays anchored to its own step and not
 * to another step of the same job that shares the variable.
 */
function stepBlock({ block, run }: { readonly block: string; readonly run: string }): string {
    const lines = block.split('\n');
    const runAt = lines.findIndex((line) => line.trim() === `run: ${run}`);
    if (runAt === -1) return '';
    let start = runAt;
    while (start > 0 && !/^\s*- /.test(lines[start] ?? '')) start -= 1;
    let end = runAt;
    for (let index = runAt + 1; index < lines.length; index += 1) {
        if (/^\s*- /.test(lines[index] ?? '')) break;
        end = index;
    }
    return lines.slice(start, end + 1).join('\n');
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

/** Lists the package test roots the V4 ids are expected to live under. */
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

describe('TEST:V4:20 AC:V4:15 - V4 exit: guards wired, broken on purpose in the job, every V4 test present', () => {
    const guards = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guards });

    describe('(a) the four guards are written and plugged into pnpm check:guards', () => {
        for (const contract of GUARDS) {
            it(`${contract.guard} resolves to ${contract.checkScript} in check:guards`, () => {
                const commands = checkGuardsCommands();
                expect(commands.some((command) => command.includes(contract.checkScript))).toBe(
                    true
                );
            });

            it(`${contract.guard} script file exists (${contract.checkScript})`, () => {
                expect(existsSync(path.join(repoRoot, contract.checkScript))).toBe(true);
            });
        }
    });

    describe('(b) the four guards are steps of the guards job of ci.yml', () => {
        it('the guards job exists', () => {
            expect(guards.length).toBeGreaterThan(0);
        });

        for (const contract of GUARDS) {
            it(`runs pnpm ${contract.checkName} (${contract.guard})`, () => {
                expect(guardsRuns).toContain(`pnpm ${contract.checkName}`);
            });
        }

        it('the G13 step declares HOSPEDA_PRODUCTION_BUILD (silent on the branch, red on a production build)', () => {
            const g13 = stepBlock({
                block: guards,
                run: 'pnpm check:bootstrap-answers-never-in-production'
            });
            expect(g13.length).toBeGreaterThan(0);
            expect(g13).toMatch(/^\s+HOSPEDA_PRODUCTION_BUILD:/m);
        });
    });

    describe('(c) the guards are broken on purpose inside the same guards job', () => {
        it('the guards job runs pnpm test:scripts (the mutation tests run there)', () => {
            expect(guardsRuns).toContain('pnpm test:scripts');
        });

        for (const contract of GUARDS) {
            it(`${contract.guard} has its mutation test ${contract.mutationTest} carrying ${contract.mutationTestId}`, () => {
                const full = path.join(repoRoot, contract.mutationTest);
                expect(existsSync(full)).toBe(true);
                expect(readFileSync(full, 'utf8')).toContain(contract.mutationTestId);
            });
        }
    });

    describe('(d) CI Pass waits on guards, test-unit and test-integration', () => {
        const needs = needsOf({ block: jobBlock({ source: ciYml, job: 'ci-pass' }) });

        it('waits on the guards job', () => {
            expect(needs).toContain('guards');
        });

        it('waits on test-unit', () => {
            expect(needs).toContain('test-unit');
        });

        it('waits on test-integration', () => {
            expect(needs).toContain('test-integration');
        });
    });

    describe('(e) every V4 test id has a test file', () => {
        it(`has a test for every TEST:V4 id (1..${TOTAL_V4_TESTS} except this guard's own ${SELF_TEST_ID})`, () => {
            const files: string[] = [];
            for (const root of collectTestRoots()) collectTestFiles(root, files);
            const corpus = files
                .filter((file) => path.resolve(file) !== path.resolve(selfPath))
                .map((file) => readFileSync(file, 'utf8'));
            const missing: number[] = [];
            for (let n = 1; n <= TOTAL_V4_TESTS; n += 1) {
                if (n === SELF_TEST_ID) continue;
                const pattern = new RegExp(`TEST:V4:${n}(?![0-9])`);
                if (!corpus.some((content) => pattern.test(content))) missing.push(n);
            }
            const listed = missing.map((n) => `TEST:V4:${n}`).join(', ');
            expect(missing, `missing TEST:V4 ids: ${listed}`).toEqual([]);
        });
    });

    describe('(f) the V4 e2e runs in the e2e-p0 job, isolated under @clock', () => {
        it('the e2e-p0 job runs pnpm --filter hospeda-e2e e2e:test:p0', () => {
            const runs = stepRuns({ block: jobBlock({ source: e2eYml, job: 'e2e-p0' }) });
            expect(runs).toContain('pnpm --filter hospeda-e2e e2e:test:p0');
        });

        it('the e2e:test:p0 script invokes --grep @clock', () => {
            expect(e2ePkg.scripts['e2e:test:p0'] ?? '').toContain('--grep @clock');
        });

        it(`the ${V4_SPEC} describe carries TEST:V4:23, @p0 and @clock`, () => {
            const spec = readFileSync(path.join(repoRoot, V4_SPEC), 'utf8');
            const describeLines = spec
                .split('\n')
                .filter((line) => line.includes('test.describe('));
            expect(
                describeLines.some(
                    (line) =>
                        line.includes('TEST:V4:23') &&
                        line.includes('@p0') &&
                        line.includes('@clock')
                )
            ).toBe(true);
        });
    });
});
