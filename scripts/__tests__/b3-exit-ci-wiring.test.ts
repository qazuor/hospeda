import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * AC:B3:35 (HOS-1531, B3.11): the automatic evidence of the B3 exit, the
 * signup-and-its-window piece.
 *
 * - It carries no TEST id of its own: the AC-to-test map of the spec assigns
 *   AC:B3:35 the tests of its sibling leaves and none of its own, so inventing
 *   one would put an id in the tree that the spec does not have.
 * - It does not run the tests, the guards nor Playwright (the exit run and CI
 *   do that): it proves that the evidence the exit demands IS in the tree and
 *   is wired. Every LISTA:B3 point of the cut names a TEST id that appears in a
 *   test title; the four B3 guards are plugged into `pnpm check:guards`, are a
 *   step of the `guards` job and are broken on purpose by their own mutation
 *   tests (run there through `pnpm test:scripts`); the three B3 e2e specs run
 *   in the `e2e-p0` job; and the UNKNOWN row PA-6 has its test.
 * - Points 10 (half: the manual payer's first instalment, AC:B3:4) and 12
 *   (AC:B3:40) of LISTA:B3 left the MVP cut: CV moves the first to HOS-1629
 *   (phase 4) and CW moves the second to HOS-1628 (phase 2).
 * - The manual smokes TEST:B3:23 and TEST:B3:36 belong to the owner; a test
 *   title may only name them as support, never as if it automated them.
 *
 * Every assertion is about PRESENCE: other leaves edit these files in
 * parallel, so this test never pins counts, line numbers, absences nor the
 * relative order of guards. The workflows are read as text by indentation:
 * the repo has no YAML parser among its root dependencies.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ciYml = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const e2eYml = readFileSync(path.join(repoRoot, '.github/workflows/e2e-pr.yml'), 'utf8');
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};
const e2ePkg = JSON.parse(readFileSync(path.join(repoRoot, 'apps/e2e/package.json'), 'utf8')) as {
    readonly scripts: Readonly<Record<string, string>>;
};

interface CorteEntry {
    readonly point: number;
    readonly acs: readonly string[];
    readonly tests: readonly string[];
}

interface DeferredEntry {
    readonly point: number;
    readonly ac: string;
    readonly test: string;
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
    readonly spec: string;
    readonly testId: string;
}

// LISTA:B3, B3.md:163-197, read with the MVP cut adjustment of B3.md:204 (point 12 is fully deferred).
const CORTE_MAP: readonly CorteEntry[] = [
    { point: 1, acs: ['AC:B3:6'], tests: ['TEST:B3:6'] },
    { point: 2, acs: ['AC:B3:10'], tests: ['TEST:B3:11'] },
    { point: 3, acs: ['AC:B3:18'], tests: ['TEST:B3:18'] },
    { point: 4, acs: ['AC:B3:2'], tests: ['TEST:B3:2'] },
    { point: 5, acs: ['AC:B3:5'], tests: ['TEST:B3:5', 'TEST:B3:39'] },
    { point: 6, acs: ['AC:B3:27'], tests: ['TEST:B3:28'] },
    { point: 7, acs: ['AC:B3:11'], tests: ['TEST:B3:12'] },
    { point: 8, acs: ['AC:B3:28'], tests: ['TEST:B3:29'] },
    { point: 9, acs: ['AC:B3:37'], tests: ['TEST:B3:39'] },
    { point: 10, acs: ['AC:B3:38', 'AC:B3:6'], tests: ['TEST:B3:40', 'TEST:B3:6'] },
    { point: 11, acs: ['AC:B3:27', 'AC:B3:39'], tests: ['TEST:B3:28', 'TEST:B3:37'] },
    { point: 13, acs: ['AC:B3:41'], tests: ['TEST:B3:42'] }
];

// B3.md:204, :263 and :744: the two LISTA:B3 halves the owner moved out of the MVP cut (CV, CW).
const DEFERRED: readonly DeferredEntry[] = [
    {
        point: 10,
        ac: 'AC:B3:4',
        test: 'TEST:B3:4',
        issue: 'HOS-1629',
        phase: 'fase-4',
        letter: 'CV'
    },
    {
        point: 12,
        ac: 'AC:B3:40',
        test: 'TEST:B3:41',
        issue: 'HOS-1628',
        phase: 'fase-2',
        letter: 'CW'
    }
];

// B3.md §5: the 13 TEST ids whose «Cubre» names AC:B3:35 (also the leaf's «Verificación» in Linear).
const SPEC_EXIT_TESTS: readonly string[] = [2, 4, 5, 6, 11, 12, 18, 28, 29, 37, 39, 40, 42].map(
    (n) => `TEST:B3:${n}`
);

// B3.md:1275-1280 and :1382-1387: the owner's manual smokes (rehearsal and production step 5c).
const MANUAL_SMOKES: readonly string[] = ['TEST:B3:23', 'TEST:B3:36'];

// GATE:M1.4, 80-abiertos.md row PA-6: S16 with both branches (the provider cancels or not, B3.md:1233-1237).
const UNKNOWN_ROWS: readonly { readonly row: string; readonly test: string }[] = [
    { row: 'MP:PA-6', test: 'TEST:B3:17' }
];

// B3.md:77 and :102; TEST:B3:24-27: the four B3 guards and their mutation tests.
const GUARDS: readonly GuardContract[] = [
    {
        guard: 'G-R1-A',
        checkName: 'check:succession-predecessor',
        checkScript: 'scripts/check-succession-predecessor.ts',
        mutationTest: 'scripts/__tests__/check-succession-predecessor.test.ts',
        mutationTestId: 'TEST:B3:24'
    },
    {
        guard: 'G-R1-B',
        checkName: 'check:succession-first-charge',
        checkScript: 'scripts/check-succession-first-charge.ts',
        mutationTest: 'scripts/__tests__/check-succession-first-charge.test.ts',
        mutationTestId: 'TEST:B3:25'
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

// GATE:M1.5: the B3 e2e specs that must run in the P0 suite.
const E2E: readonly E2eContract[] = [
    { spec: 'apps/e2e/tests/billing/billing-02-signup-end-to-end.spec.ts', testId: 'TEST:B3:35' },
    {
        spec: 'apps/e2e/tests/billing/billing-03-tourist-vip-inherited-checkout.spec.ts',
        testId: 'TEST:B3:30'
    },
    { spec: 'apps/e2e/tests/billing/billing-01-fake-provider-server.spec.ts', testId: 'TEST:B3:43' }
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

/** Returns the commands of every `run:` step of a job (single-line form). */
function stepRuns({ block }: { readonly block: string }): readonly string[] {
    return [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => (match[1] ?? '').trim());
}

/** Returns the raw `pnpm <script>` steps of `check:guards`, in chain order. */
function checkGuardsSteps(): readonly string[] {
    const chain = rootPkg.scripts['check:guards'] ?? '';
    return chain.split('&&').map((part) => part.trim());
}

/** Resolves the shell command each `pnpm <script>` of `check:guards` runs. */
function checkGuardsCommands(): readonly string[] {
    return checkGuardsSteps().map((step) => {
        const script = /^pnpm (?:run )?(\S+)$/.exec(step)?.[1];
        return script ? (rootPkg.scripts[script] ?? step) : step;
    });
}

/** Lists the package test roots (`test/` and `tests/` of `apps/*` and `packages/*`). */
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
    return roots;
}

/** Recursively collects `*.test.ts(x)`/`*.spec.ts` files, skipping build output. */
function collectTestFiles({ dir }: { readonly dir: string }): readonly string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectTestFiles({ dir: full }));
        else if (entry.isFile() && /\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

/**
 * Returns the titles of the `describe(`, `it(`, `test(` and `test.describe(`
 * calls of a source (modifiers such as `.skipIf(...)` are not followed): the
 * first argument when it is a single-quoted, double-quoted or backtick literal.
 */
function testTitles({ source }: { readonly source: string }): readonly string[] {
    const call =
        /(?<![\w.$])(?:describe|it|test(?:\.describe)?)(?:\.(?:only|skip|concurrent|sequential|serial|parallel|fixme))*\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    return [...source.matchAll(call)].map((match) => match[2] ?? '');
}

/** True when the title names the id with a numeric boundary (`TEST:B3:2` is not `TEST:B3:28`). */
function namesId({ title, id }: { readonly title: string; readonly id: string }): boolean {
    return new RegExp(`${id}(?![0-9])`).test(title);
}

/** True when a title naming a manual smoke marks it as support only. */
function smokeTitleIsSupport({ title }: { readonly title: string }): boolean {
    if (!MANUAL_SMOKES.some((id) => namesId({ title, id }))) return true;
    return /\b(?:soporte|support)\b/i.test(title);
}

interface TitledFile {
    readonly root: string;
    readonly titles: readonly string[];
}

/** Reads every test file of the package test roots and keeps its titles. */
function collectCorpus(): readonly TitledFile[] {
    const corpus: TitledFile[] = [];
    for (const root of collectTestRoots()) {
        for (const file of collectTestFiles({ dir: root })) {
            corpus.push({
                root: path.relative(repoRoot, root),
                titles: testTitles({ source: readFileSync(file, 'utf8') })
            });
        }
    }
    return corpus;
}

describe('AC:B3:35 the B3 exit: LISTA:B3 evidence, guards wired, e2e in P0 (HOS-1531)', () => {
    const corpus = collectCorpus();
    const allTitles = corpus.flatMap((file) => file.titles);
    const guards = jobBlock({ source: ciYml, job: 'guards' });
    const guardsRuns = stepRuns({ block: guards });

    it('(a) the scanner is not blind: B3 ids appear in titles under the four main test roots', () => {
        // Arrange
        const expectedRoots = [
            'apps/api/test',
            'apps/e2e/tests',
            'packages/db/test',
            'packages/service-core/test'
        ];

        // Act
        const rootsWithB3 = new Set(
            corpus
                .filter((file) => file.titles.some((title) => title.includes('TEST:B3:')))
                .map((file) => file.root)
        );
        const blind = expectedRoots.filter((root) => !rootsWithB3.has(root));

        // Assert
        expect(blind, `roots without a TEST:B3 title: ${blind.join(', ')}`).toEqual([]);
    });

    it('(b) every TEST of the cut map is named by at least one test title', () => {
        // Arrange
        const ids = [...new Set(CORTE_MAP.flatMap((entry) => entry.tests))];

        // Act
        const missing = ids.filter((id) => !allTitles.some((title) => namesId({ title, id })));

        // Assert
        expect(missing, `TEST ids without a title: ${missing.join(', ')}`).toEqual([]);
    });

    it('(c) the cut map plus the deferred half is exactly the spec exit list, and covers points 1 to 13', () => {
        // Arrange
        const deferredInExit = DEFERRED.filter((entry) => entry.ac === 'AC:B3:4').map(
            (entry) => entry.test
        );

        // Act
        const union = [
            ...new Set([...CORTE_MAP.flatMap((entry) => entry.tests), ...deferredInExit])
        ].sort();
        const points = new Set([
            ...CORTE_MAP.map((entry) => entry.point),
            ...DEFERRED.map((entry) => entry.point)
        ]);
        const pointTen = [
            CORTE_MAP.some((entry) => entry.point === 10),
            DEFERRED.some((entry) => entry.point === 10)
        ];

        // Assert
        expect(union).toEqual([...SPEC_EXIT_TESTS].sort());
        expect([...points].sort((a, b) => a - b)).toEqual(
            Array.from({ length: 13 }, (_, index) => index + 1)
        );
        expect(pointTen).toEqual([true, true]);
        expect(DEFERRED.map((entry) => entry.issue)).toEqual(['HOS-1629', 'HOS-1628']);
    });

    describe('(d) no title names a manual smoke as if it were automated', () => {
        it('every title naming TEST:B3:23 or TEST:B3:36 says soporte or support', () => {
            // Arrange
            const naming = allTitles.filter((title) =>
                MANUAL_SMOKES.some((id) => namesId({ title, id }))
            );

            // Act
            const claiming = naming.filter((title) => !smokeTitleIsSupport({ title }));

            // Assert
            expect(claiming, `titles claiming a manual smoke: ${claiming.join(' | ')}`).toEqual([]);
        });

        it('the rule rejects what it forbids and lets support and other ids through', () => {
            // Arrange
            const rejected = [
                'TEST:B3:36 unsupported provider notice acknowledgment',
                'TEST:B3:23 stores IPN'
            ];
            const accepted = [
                'TEST:B3:36 (soporte) unsupported provider notice acknowledgment',
                'TEST:B3:360 something'
            ];

            // Act
            const rejectedResults = rejected.map((title) => smokeTitleIsSupport({ title }));
            const acceptedResults = accepted.map((title) => smokeTitleIsSupport({ title }));

            // Assert
            expect(rejectedResults).toEqual([false, false]);
            expect(acceptedResults).toEqual([true, true]);
        });
    });

    describe('(e) the four B3 guards are wired and broken on purpose', () => {
        for (const contract of GUARDS) {
            it(`(e1) ${contract.guard} resolves to ${contract.checkScript} in check:guards`, () => {
                // Arrange
                const commands = checkGuardsCommands();

                // Act
                const plugged = commands.some((command) => command.includes(contract.checkScript));

                // Assert
                expect(plugged).toBe(true);
                expect(existsSync(path.join(repoRoot, contract.checkScript))).toBe(true);
            });

            it(`(e2) the guards job of ci.yml runs pnpm ${contract.checkName}`, () => {
                // Arrange
                const expected = `pnpm ${contract.checkName}`;

                // Act
                const present = guardsRuns.includes(expected);

                // Assert
                expect(guards.length).toBeGreaterThan(0);
                expect(present).toBe(true);
            });

            it(`(e4) ${contract.guard} has its mutation test carrying ${contract.mutationTestId}`, () => {
                // Arrange
                const full = path.join(repoRoot, contract.mutationTest);

                // Act
                const exists = existsSync(full);

                // Assert
                expect(exists).toBe(true);
                expect(readFileSync(full, 'utf8')).toContain(contract.mutationTestId);
            });
        }

        it('(e3) the guards job runs pnpm test:scripts (the mutation tests run there)', () => {
            // Arrange
            const expected = 'pnpm test:scripts';

            // Act
            const present = guardsRuns.includes(expected);

            // Assert
            expect(present).toBe(true);
        });

        it('(e5) the last link of check:guards is pnpm check:fake-lies', () => {
            // Arrange
            const steps = checkGuardsSteps();

            // Act
            const last = steps[steps.length - 1];

            // Assert
            expect(last).toBe('pnpm check:fake-lies');
        });
    });

    describe('(f) the B3 e2e specs run in the P0 suite', () => {
        for (const contract of E2E) {
            it(`(f1) the test.describe of ${contract.spec} names ${contract.testId} and @p0`, () => {
                // Arrange
                const spec = readFileSync(path.join(repoRoot, contract.spec), 'utf8');

                // Act
                const describeLines = spec
                    .split('\n')
                    .filter((line) => line.includes('test.describe('));

                // Assert
                expect(
                    describeLines.some(
                        (line) =>
                            namesId({ title: line, id: contract.testId }) &&
                            /@p0(?![\w-])/.test(line)
                    )
                ).toBe(true);
            });
        }

        it('(f2) the e2e-p0 job runs pnpm --filter hospeda-e2e e2e:test:p0', () => {
            // Arrange
            const block = jobBlock({ source: e2eYml, job: 'e2e-p0' });

            // Act
            const runs = stepRuns({ block });

            // Assert
            expect(runs).toContain('pnpm --filter hospeda-e2e e2e:test:p0');
        });

        it('(f3) the e2e:test:p0 script greps @p0', () => {
            // Arrange
            const script = e2ePkg.scripts['e2e:test:p0'] ?? '';

            // Act
            const greps = script.includes('--grep @p0');

            // Assert
            expect(greps).toBe(true);
        });
    });

    it('(g) every UNKNOWN row B3 leans on has its test named in a title', () => {
        // Arrange
        const rows = UNKNOWN_ROWS;

        // Act
        const missing = rows.filter(
            (row) => !allTitles.some((title) => namesId({ title, id: row.test }))
        );

        // Assert
        expect(
            missing,
            `UNKNOWN rows without a titled test: ${missing.map((row) => `${row.row} -> ${row.test}`).join(', ')}`
        ).toEqual([]);
    });
});
