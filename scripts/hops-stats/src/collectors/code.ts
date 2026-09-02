import type { CodeStats, Outcome, PackageStats } from '../types.js';
import {
    classify,
    countLines,
    extensionOf,
    type FileEntry,
    listTracked,
    packageOf
} from './files.js';

const SOURCE_EXTENSIONS = new Set(['ts', 'tsx', 'astro', 'css']);

/** Extensions worth measuring at all. Binary files are excluded deliberately:
 *  `wc -l` happily counts "lines" in a PNG, which is noise, not data. */
const MEASURED = ['*.ts', '*.tsx', '*.astro', '*.css', '*.json', '*.md', '*.sql'];

export type Workspace = {
    readonly entries: readonly FileEntry[];
    readonly trackedFiles: number;
    /** Basenames of every test file, without the `.test`/`.spec` suffix. */
    readonly testBasenames: ReadonlySet<string>;
};

/**
 * Read the repository once so every code-facing section can share the result.
 *
 * @returns The measured files with their line counts, or a failure reason.
 */
export async function scanWorkspace(repo: string): Promise<Outcome<Workspace>> {
    const all = await listTracked(repo);
    if (all === null) return { ok: false, reason: 'git ls-files falló' };

    const measured = await listTracked(repo, MEASURED);
    if (measured === null)
        return { ok: false, reason: 'git ls-files falló al filtrar por extensión' };

    const entries = await countLines(repo, measured);
    if (entries.length === 0) {
        return { ok: false, reason: 'wc no devolvió ningún archivo contable' };
    }

    const testBasenames = new Set<string>();
    for (const path of all) {
        if (!/\.(test|spec)\.[tj]sx?$/.test(path)) continue;
        const base = path.slice(path.lastIndexOf('/') + 1).replace(/\.(test|spec)\.[tj]sx?$/, '');
        testBasenames.add(base);
    }

    return { ok: true, data: { entries, trackedFiles: all.length, testBasenames } };
}

/**
 * Summarise size, split by what the lines actually are.
 *
 * A single repository-wide LOC total is meaningless here: JSON alone is nearly
 * three times the size of the source, so every figure names its bucket.
 */
const LANGUAGE_OF: Readonly<Record<string, string>> = {
    ts: 'TypeScript',
    tsx: 'TypeScript (JSX)',
    astro: 'Astro',
    css: 'CSS'
};

export function collectCode(ws: Workspace): CodeStats {
    const srcLang = new Map<string, { loc: number; files: number }>();
    const testLang = new Map<string, { loc: number; files: number }>();
    const bump = (
        m: Map<string, { loc: number; files: number }>,
        key: string,
        loc: number
    ): void => {
        const cur = m.get(key) ?? { loc: 0, files: 0 };
        m.set(key, { loc: cur.loc + loc, files: cur.files + 1 });
    };
    let srcLoc = 0,
        srcFiles = 0,
        testLoc = 0,
        testFiles = 0;
    let jsonLoc = 0,
        jsonFiles = 0,
        mdLoc = 0,
        mdFiles = 0,
        sqlLoc = 0,
        sqlFiles = 0;
    let filesOver500 = 0,
        filesOver1000 = 0;
    const big: { path: string; loc: number }[] = [];

    for (const entry of ws.entries) {
        const ext = extensionOf(entry.path);
        const kind = classify(entry.path);
        if (ext === 'json') {
            jsonLoc += entry.loc;
            jsonFiles += 1;
            continue;
        }
        if (ext === 'md') {
            mdLoc += entry.loc;
            mdFiles += 1;
            continue;
        }
        if (ext === 'sql') {
            sqlLoc += entry.loc;
            sqlFiles += 1;
            continue;
        }
        if (!SOURCE_EXTENSIONS.has(ext)) continue;
        if (kind === 'generated') continue;
        const language = LANGUAGE_OF[ext] ?? ext;
        if (kind === 'test') {
            testLoc += entry.loc;
            testFiles += 1;
            bump(testLang, language, entry.loc);
            continue;
        }
        srcLoc += entry.loc;
        srcFiles += 1;
        bump(srcLang, language, entry.loc);
        if (entry.loc > 500) {
            filesOver500 += 1;
            if (entry.loc > 1000) filesOver1000 += 1;
            big.push(entry);
        }
    }

    big.sort((a, b) => b.loc - a.loc);
    const rank = (m: Map<string, { loc: number; files: number }>) =>
        [...m.entries()]
            .map(([language, v]) => ({ language, loc: v.loc, files: v.files }))
            .sort((a, b) => b.loc - a.loc);

    return {
        trackedFiles: ws.trackedFiles,
        srcLoc,
        srcFiles,
        testLoc,
        testFiles,
        srcByLanguage: rank(srcLang),
        testByLanguage: rank(testLang),
        jsonLoc,
        jsonFiles,
        mdLoc,
        mdFiles,
        sqlLoc,
        sqlFiles,
        filesOver500,
        filesOver1000,
        biggestFiles: big.slice(0, 8)
    };
}

/**
 * Per-package size and declarative coverage.
 *
 * Coverage is matched by FILENAME, never by sibling path: this repo keeps tests
 * in `test/` directories, so looking for `foo.test.ts` next to `foo.ts` reports
 * every single file as untested. A matching name still does not prove that test
 * covers that file — it only proves nobody wrote one under that name.
 */
export function collectPackages(
    ws: Workspace,
    caseCounts: ReadonlyMap<string, number>
): PackageStats[] {
    type Acc = { srcLoc: number; testLoc: number; untested: number; total: number };
    const byPackage = new Map<string, Acc>();

    const acc = (name: string): Acc => {
        const existing = byPackage.get(name);
        if (existing !== undefined) return existing;
        const fresh: Acc = { srcLoc: 0, testLoc: 0, untested: 0, total: 0 };
        byPackage.set(name, fresh);
        return fresh;
    };

    for (const entry of ws.entries) {
        const ext = extensionOf(entry.path);
        if (ext !== 'ts' && ext !== 'tsx' && ext !== 'astro') continue;
        const pkg = packageOf(entry.path);
        if (pkg === null) continue;
        const kind = classify(entry.path);
        if (kind === 'generated') continue;
        const bucket = acc(pkg);
        if (kind === 'test') {
            bucket.testLoc += entry.loc;
            continue;
        }
        bucket.srcLoc += entry.loc;
        if (/\/src\//.test(entry.path) && !/\.d\.ts$/.test(entry.path)) {
            bucket.total += 1;
            const base = entry.path.slice(entry.path.lastIndexOf('/') + 1).replace(/\.tsx?$/, '');
            if (!ws.testBasenames.has(base)) bucket.untested += 1;
        }
    }

    return [...byPackage.entries()]
        .map(([name, v]) => ({
            name,
            srcLoc: v.srcLoc,
            testLoc: v.testLoc,
            cases: caseCounts.get(name) ?? 0,
            untested: v.untested,
            total: v.total
        }))
        .filter((p) => p.srcLoc > 0 || p.testLoc > 0)
        .sort((a, b) => b.srcLoc - a.srcLoc);
}
