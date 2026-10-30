import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:V6:35 AC:V6:27 (HOS-1483): the exit evidence of V6, the publication and
 * surplus piece, for the CI wiring the momento-1 gate relies on.
 *
 * - The three guards of V6's column, G5, G-R9 and G-R6-B, are plugged into
 *   `pnpm check:guards` AND are a step of the `guards` job (owner 2026-09-26,
 *   G5-5: one CI step per guard is the repo convention), and so are the other
 *   three static checks of V6. Each guard is broken on purpose by its own
 *   mutation test, and those tests run inside the same `guards` job through
 *   `pnpm test:scripts`.
 * - `guards`, `test-unit` and `test-integration` gate `CI Pass`, and
 *   `test-integration` runs `pnpm test:cutover-db` (TEST:V6:26 lives there).
 * - Every V6 test id (1..39) has a test file under the package test roots,
 *   except this guard's own and the three manual smokes.
 *
 * This test does not run the guards: it proves the wiring. Every assertion is
 * anchored on its own job block, never on a whole-file match. The workflow is
 * read as text by indentation: the repo has no YAML parser among its root
 * dependencies and this test does not add one.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const selfPath = fileURLToPath(import.meta.url);
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};

const TOTAL_V6_TESTS = 39;
const SELF_TEST_ID = 35;

/**
 * V6 test ids that are manual smokes, so no test file can carry them
 * (GATE:M1/M3, `V6.md` «Smoke y etiquetas»).
 */
const MANUAL_SMOKES: Readonly<Record<number, string>> = {
    25: 'staging smoke in the cutover rehearsal (GATE:M3): step 4c, 5b and the five trials',
    27: 'production smoke of step 6 (GATE:M1)',
    37: 'production read-only count of repeated partners.owner_user_id before the merge'
};

interface GuardContract {
    readonly guard: string;
    readonly checkScript: string;
    readonly checkName: string;
    readonly mutationTest: string;
    readonly mutationTestId: string;
}

/** The three guards of V6's column (`04-catalogos`: G5, G-R6-B, G-R9). */
const GUARDS: readonly GuardContract[] = [
    {
        guard: 'G5',
        checkScript: 'scripts/check-surplus-reconciler.ts',
        checkName: 'check:surplus-reconciler',
        mutationTest: 'scripts/__tests__/check-surplus-reconciler.test.ts',
        mutationTestId: 'TEST:V6:6'
    },
    {
        guard: 'G-R9',
        checkScript: 'scripts/check-purged-closed-list.ts',
        checkName: 'check:purged-closed-list',
        mutationTest: 'scripts/__tests__/check-purged-closed-list.test.ts',
        mutationTestId: 'TEST:V6:14'
    },
    {
        guard: 'G-R6-B',
        checkScript: 'scripts/check-listing-clock.ts',
        checkName: 'check:listing-clock',
        mutationTest: 'scripts/__tests__/check-listing-clock.test.ts',
        mutationTestId: 'TEST:V6:16'
    }
];

/** The other static checks of V6, each its own step of the guards job. */
const OTHER_V6_CHECKS: readonly { readonly checkName: string; readonly testId: string }[] = [
    { checkName: 'check:listing-delete-doors', testId: 'TEST:V6:33' },
    { checkName: 'check:listing-old-columns', testId: 'TEST:V6:18' },
    { checkName: 'check:partner-no-tier-and-dates', testId: 'TEST:V6:31' }
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

/** Lists the package test roots the V6 ids are expected to live under. */
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

describe('TEST:V6:35 AC:V6:27 - V6 exit: guards wired, broken on purpose in the job, every V6 test present', () => {
    const guards = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guards });

    describe('(a) the three guards of the column are written and plugged into pnpm check:guards', () => {
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

    describe('(b) the guards and the other V6 static checks are steps of the guards job', () => {
        it('the guards job exists', () => {
            expect(guards.length).toBeGreaterThan(0);
        });

        for (const contract of GUARDS) {
            it(`runs pnpm ${contract.checkName} (${contract.guard})`, () => {
                expect(guardsRuns).toContain(`pnpm ${contract.checkName}`);
            });
        }

        for (const check of OTHER_V6_CHECKS) {
            it(`runs pnpm ${check.checkName} (${check.testId})`, () => {
                expect(guardsRuns).toContain(`pnpm ${check.checkName}`);
            });
        }
    });

    describe('(c) the guards are broken on purpose inside the same guards job', () => {
        it('the guards job runs pnpm test:scripts (the mutation tests run there)', () => {
            expect(guardsRuns).toContain('pnpm test:scripts');
        });

        for (const contract of GUARDS) {
            it(`${contract.guard} has its mutation test ${contract.mutationTest} carrying ${contract.mutationTestId}`, () => {
                const full = path.join(repoRoot, contract.mutationTest);
                expect(existsSync(full)).toBe(true);
                const pattern = new RegExp(`${contract.mutationTestId}(?![0-9])`);
                expect(readFileSync(full, 'utf8')).toMatch(pattern);
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

        it('test-integration runs pnpm test:cutover-db (TEST:V6:26)', () => {
            const runs = stepRuns({ block: jobBlock({ source: ciYml, job: 'test-integration' }) });
            expect(runs).toContain('pnpm test:cutover-db');
        });
    });

    describe('(e) every V6 test id has a test file', () => {
        it(`has a test for every TEST:V6 id (1..${TOTAL_V6_TESTS} except ${SELF_TEST_ID} and the manual smokes)`, () => {
            const files: string[] = [];
            for (const root of collectTestRoots()) collectTestFiles(root, files);
            const corpus = files
                .filter((file) => path.resolve(file) !== path.resolve(selfPath))
                .map((file) => readFileSync(file, 'utf8'));
            const missing: number[] = [];
            for (let n = 1; n <= TOTAL_V6_TESTS; n += 1) {
                if (n === SELF_TEST_ID || n in MANUAL_SMOKES) continue;
                const pattern = new RegExp(`TEST:V6:${n}(?![0-9])`);
                if (!corpus.some((content) => pattern.test(content))) missing.push(n);
            }
            const listed = missing.map((n) => `TEST:V6:${n}`).join(', ');
            expect(missing, `missing TEST:V6 ids: ${listed}`).toEqual([]);
        });
    });
});
