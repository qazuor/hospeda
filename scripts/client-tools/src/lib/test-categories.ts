import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './exec.ts';

/** Where the map lives, relative to the repository root. */
export const CATEGORIES_FILE = '.claude/test-categories.json';

/** One category of tests. */
export interface TestCategory {
    /** Name typed on the command line. */
    readonly name: string;
    /** One line explaining what it covers. */
    readonly description: string;
    /** Globs matched against each test file's path. */
    readonly include: readonly string[];
}

/**
 * Kinds of test excluded unless explicitly asked for.
 *
 * These need infrastructure a plain `vitest run <file>` does not set up — a
 * database, a built app, a browser. Running them by accident does not report a
 * real failure, it reports a missing environment, which is worse than not
 * running them.
 */
const NEEDS_INFRA = [
    'apps/e2e/',
    '/test/e2e/',
    '.e2e.test.',
    '.integration.test.',
    '/integration/'
] as const;

/**
 * Reads the category map.
 *
 * @param input.repoRoot - Repository root.
 * @returns The categories, empty when the file is absent or unparseable.
 */
export function readCategories({
    repoRoot
}: {
    readonly repoRoot: string;
}): readonly TestCategory[] {
    const path = join(repoRoot, CATEGORIES_FILE);
    if (!existsSync(path)) return [];
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        const categories: TestCategory[] = [];
        for (const [name, value] of Object.entries(parsed)) {
            if (name.startsWith('$') || typeof value !== 'object' || value === null) continue;
            const entry = value as { description?: string; include?: unknown };
            if (!Array.isArray(entry.include)) continue;
            categories.push({
                name,
                description: entry.description ?? '',
                include: entry.include.filter((glob): glob is string => typeof glob === 'string')
            });
        }
        return categories;
    } catch {
        return [];
    }
}

/**
 * Lists every test file tracked by git.
 *
 * Tracked files only: an untracked scratch test is not something a category run
 * should pick up.
 *
 * @param input.repoRoot - Repository root.
 * @returns Repo-relative paths.
 */
export async function listTestFiles({
    repoRoot
}: {
    readonly repoRoot: string;
}): Promise<readonly string[]> {
    const listed = await run({
        command: 'git',
        args: ['ls-files', '*.test.ts', '*.test.tsx'],
        cwd: repoRoot,
        timeoutMs: 60_000
    });
    if (!listed.ok) return [];
    return listed.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

/** Whether a file needs infrastructure a plain run does not provide. */
export function needsInfra({ file }: { readonly file: string }): boolean {
    return NEEDS_INFRA.some((marker) => file.includes(marker));
}

/**
 * Selects the test files belonging to a category.
 *
 * @param input.category    - The category to resolve.
 * @param input.files       - Every test file.
 * @param input.includeInfra - Whether to keep e2e/integration files.
 * @returns Matching paths, sorted.
 */
export function filesFor({
    category,
    files,
    includeInfra = false
}: {
    readonly category: TestCategory;
    readonly files: readonly string[];
    readonly includeInfra?: boolean;
}): readonly string[] {
    const globs = category.include.map((pattern) => new Bun.Glob(pattern));
    return files
        .filter((file) => globs.some((glob) => glob.match(file)))
        .filter((file) => includeInfra || !needsInfra({ file }))
        .sort();
}

/**
 * Lists test files that belong to no category at all.
 *
 * The map goes stale silently: a new test that matches no glob is simply never
 * run by any category, and nothing says so. This is how you see it.
 *
 * @param input.categories - Every category.
 * @param input.files      - Every test file.
 * @returns The unmatched paths, sorted.
 */
export function orphanFiles({
    categories,
    files
}: {
    readonly categories: readonly TestCategory[];
    readonly files: readonly string[];
}): readonly string[] {
    const globs = categories.flatMap((category) =>
        category.include.map((pattern) => new Bun.Glob(pattern))
    );
    return files.filter((file) => !globs.some((glob) => glob.match(file))).sort();
}

/** A package and the test files of it that a category selected. */
export interface PackageBatch {
    /** Directory of the package, repo-relative (`apps/api`). */
    readonly dir: string;
    /** Name from its package.json, which is what pnpm filters on. */
    readonly packageName: string;
    /** Test files, relative to the package directory. */
    readonly files: readonly string[];
}

/**
 * Groups selected files into one batch per package.
 *
 * Batching by package is what keeps this from taking the machine down: each
 * batch runs on its own, with only its own files, instead of turbo fanning out
 * across the monorepo.
 *
 * @param input.files    - Repo-relative test paths.
 * @param input.repoRoot - Repository root, for reading package names.
 * @returns One batch per package, ordered by package directory.
 */
export function groupByPackage({
    files,
    repoRoot
}: {
    readonly files: readonly string[];
    readonly repoRoot: string;
}): readonly PackageBatch[] {
    const byDir = new Map<string, string[]>();
    for (const file of files) {
        const parts = file.split('/');
        // Only workspace packages: a test under scripts/ has no package to
        // filter on and would silently become a run of the repo root.
        if (parts.length < 3 || (parts[0] !== 'apps' && parts[0] !== 'packages')) continue;
        const dir = `${parts[0]}/${parts[1]}`;
        const list = byDir.get(dir) ?? [];
        list.push(file.slice(dir.length + 1));
        byDir.set(dir, list);
    }

    return [...byDir.entries()]
        .map(([dir, list]) => ({
            dir,
            packageName: readPackageName({ repoRoot, dir }) ?? dir,
            files: list.sort()
        }))
        .sort((a, b) => a.dir.localeCompare(b.dir));
}

/** Reads a package's declared name, which is what `pnpm --filter` expects. */
function readPackageName({
    repoRoot,
    dir
}: {
    readonly repoRoot: string;
    readonly dir: string;
}): string | null {
    try {
        const parsed = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8')) as {
            name?: string;
        };
        return parsed.name ?? null;
    } catch {
        return null;
    }
}
