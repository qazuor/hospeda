import { run } from '../exec.ts';
import type { MisplacedTests, Outcome, TestKind, TestLocation, TestStats } from '../types.ts';
import { listTracked, packageOf } from './files.ts';

const TEST_GLOBS = ['-g', '*.test.ts', '-g', '*.test.tsx', '-g', '*.spec.ts', '-g', '*.spec.tsx'];

/**
 * Run `rg -c` and return `path -> count`.
 *
 * The search root is always passed explicitly. Without a path argument ripgrep
 * reads stdin whenever stdin is not a TTY, which inside a program means it
 * blocks forever, or returns zero matches if the stream closes — and a zero
 * here reads as "this repository has no tests".
 *
 * @returns Counts per file, or `null` when ripgrep itself failed. Exit code 1
 *          means "no matches" and is a legitimate empty result, not a failure.
 */
async function countPerFile(
    repo: string,
    patterns: readonly string[],
    globs: readonly string[]
): Promise<Map<string, number> | null> {
    const args = ['-c', '--no-messages'];
    for (const pattern of patterns) args.push('-e', pattern);
    args.push(...globs, '--', '.');

    const result = await run('rg', args, { cwd: repo, okCodes: [1], timeoutMs: 120_000 });
    if (!result.ok) return null;

    const counts = new Map<string, number>();
    for (const line of result.stdout.split('\n')) {
        const sep = line.lastIndexOf(':');
        if (sep <= 0) continue;
        const path = line.slice(0, sep).replace(/^\.\//, '');
        const n = Number.parseInt(line.slice(sep + 1), 10);
        if (Number.isNaN(n)) continue;
        counts.set(path, n);
    }
    return counts;
}

const sum = (counts: Map<string, number> | null): number =>
    counts === null ? 0 : [...counts.values()].reduce((a, b) => a + b, 0);

/** Which flavour of test a file holds, inferred from its path. */
function kindOf(path: string): TestKind {
    if (/e2e|playwright/.test(path)) return 'e2e';
    if (/integration|\.int\./.test(path)) return 'integration';
    if (/guard/.test(path)) return 'guard';
    return 'unit';
}

/**
 * Where a test file sits relative to the project rule.
 *
 * The rule is `<package>/test/` beside `src/`. Order matters: a file under
 * `__tests__/` is almost always ALSO under `src/`, so the misplacement has to be
 * named by the most specific pattern, not the first one that happens to match.
 *
 * `docs/` holds documentation examples rather than product tests, and a nested
 * integration with its own `test/` directory already follows the rule, so both
 * are exempt instead of being reported as debt someone has to pay.
 */
export function locationOf(path: string, packagesWithSrc: ReadonlySet<string>): TestLocation {
    if (path.startsWith('docs/')) return 'exempt';
    if (/(^|\/)(apps|packages)\/[^/]+\/test\//.test(path)) return 'policy';

    // The rule is "a test/ directory beside src/". Where there is no src/ there
    // is nothing to sit beside, so the rule has no claim: apps/e2e is Playwright
    // with an explicit `testDir: './tests'`, and scripts/ is loose tooling.
    // Calling either one misplaced would invent 67 files of debt that nobody owes.
    const pkg = packageOf(path);
    if (pkg === null || !packagesWithSrc.has(pkg)) return 'exempt';

    if (/(^|\/)__tests__\//.test(path)) return '__tests__';
    if (/(^|\/)(apps|packages)\/[^/]+\/tests\//.test(path)) return 'tests-plural';
    if (/\/src\//.test(path)) return 'beside-code';
    return 'exempt';
}

export type TestScan = {
    readonly stats: TestStats;
    /** Test cases per workspace package, for the per-package table. */
    readonly casesByPackage: ReadonlyMap<string, number>;
};

/**
 * Count declared tests.
 *
 * Everything here is static: it counts occurrences in the source. It does not
 * prove a single test runs, and it UNDERCOUNTS, because each `.each` block
 * expands into N tests at run time. Both facts are reported alongside the
 * numbers rather than left for the reader to guess.
 */
export async function collectTests(repo: string): Promise<Outcome<TestScan>> {
    const cases = await countPerFile(repo, ['^\\s*(it|test)(\\.\\w+)?\\s*\\('], TEST_GLOBS);
    if (cases === null) return { ok: false, reason: 'ripgrep falló al contar casos de test' };

    // Location is judged over every tracked test file, not only the ones that
    // happened to contain a matching case: an empty misplaced file is still
    // misplaced.
    const allTestFiles = await listTracked(repo, [
        '*.test.ts',
        '*.test.tsx',
        '*.spec.ts',
        '*.spec.tsx'
    ]);
    const sourceFiles = await listTracked(repo, ['apps/*/src/**', 'packages/*/src/**']);
    const packagesWithSrc = new Set<string>();
    for (const path of sourceFiles ?? []) {
        const pkg = packageOf(path);
        if (pkg !== null) packagesWithSrc.add(pkg);
    }
    const buckets = new Map<TestLocation, string[]>();
    for (const path of allTestFiles ?? []) {
        const where = locationOf(path, packagesWithSrc);
        const bucket = buckets.get(where) ?? [];
        bucket.push(path);
        buckets.set(where, bucket);
    }
    const misplaced: MisplacedTests[] = (['__tests__', 'tests-plural', 'beside-code'] as const)
        .map((location) => ({ location, files: (buckets.get(location) ?? []).sort() }))
        .filter((group) => group.files.length > 0);

    const [suites, assertions, parameterised, hardSkips, conditionalSkips] = await Promise.all([
        countPerFile(repo, ['^\\s*describe(\\.\\w+)?\\s*\\('], TEST_GLOBS),
        countPerFile(repo, ['\\bexpect\\s*\\('], TEST_GLOBS),
        countPerFile(repo, ['^\\s*(it|test|describe)\\.each'], TEST_GLOBS),
        countPerFile(repo, ['^\\s*(it|test|describe)\\.(skip|todo)\\b'], TEST_GLOBS),
        countPerFile(repo, ['(it|test|describe)\\.skipIf'], TEST_GLOBS)
    ]);

    const byKind: Record<TestKind, { cases: number; files: number }> = {
        unit: { cases: 0, files: 0 },
        guard: { cases: 0, files: 0 },
        integration: { cases: 0, files: 0 },
        e2e: { cases: 0, files: 0 }
    };
    const casesByPackage = new Map<string, number>();

    for (const [path, count] of cases) {
        const bucket = byKind[kindOf(path)];
        bucket.cases += count;
        bucket.files += 1;
        const pkg = packageOf(path);
        if (pkg !== null) casesByPackage.set(pkg, (casesByPackage.get(pkg) ?? 0) + count);
    }

    return {
        ok: true,
        data: {
            stats: {
                suites: sum(suites),
                cases: sum(cases),
                byKind,
                assertions: sum(assertions),
                parameterised: sum(parameterised),
                hardSkips: sum(hardSkips),
                conditionalSkips: sum(conditionalSkips),
                filesInPolicy: (buckets.get('policy') ?? []).length,
                filesExempt: (buckets.get('exempt') ?? []).length,
                misplaced,
                misplacedTotal: misplaced.reduce((total, group) => total + group.files.length, 0)
            },
            casesByPackage
        }
    };
}
