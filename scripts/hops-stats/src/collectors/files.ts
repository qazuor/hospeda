import { run, runLines } from '../exec.js';

/** A tracked file and its line count. */
export type FileEntry = { readonly path: string; readonly loc: number };

/**
 * `xargs` splits its input into batches to stay under the kernel's argument
 * limit. Doing the same explicitly keeps the whole pipeline shell-free; 2000
 * paths per call is comfortably below ARG_MAX on every platform this runs on.
 */
const BATCH = 2000;

/**
 * List the files git tracks, optionally restricted to pathspecs.
 *
 * @param repo - Repository root.
 * @param pathspecs - Git pathspecs such as `*.ts`. Empty lists every file.
 * @returns Repo-relative paths, or `null` if git failed.
 */
export async function listTracked(
    repo: string,
    pathspecs: readonly string[] = []
): Promise<string[] | null> {
    return runLines('git', ['ls-files', '-z', ...pathspecs], { cwd: repo }).then((lines) => {
        if (lines === null) return null;
        // -z means NUL separators, so the whole listing arrives as one line.
        return lines
            .join('')
            .split('\0')
            .filter((p) => p.length > 0);
    });
}

/**
 * Count lines in the given files by batching them through `wc -l`.
 *
 * Paths are passed as argv entries, so spaces and glob characters in filenames
 * are inert.
 *
 * @returns One entry per file that could be read. Files `wc` could not open are
 *          skipped rather than counted as zero.
 */
export async function countLines(repo: string, paths: readonly string[]): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    for (let i = 0; i < paths.length; i += BATCH) {
        const batch = paths.slice(i, i + BATCH);
        if (batch.length === 0) continue;
        const result = await run('wc', ['-l', '--', ...batch], { cwd: repo, timeoutMs: 120_000 });
        if (!result.ok) continue;
        for (const line of result.stdout.split('\n')) {
            const match = /^\s*(\d+)\s+(.*)$/.exec(line);
            if (match === null) continue;
            const [, countRaw, path] = match;
            if (countRaw === undefined || path === undefined || path === 'total') continue;
            entries.push({ path, loc: Number.parseInt(countRaw, 10) });
        }
    }
    return entries;
}

export type FileKind = 'src' | 'test' | 'generated';

/**
 * Classify a tracked file.
 *
 * Tests live in `test/` directories in this repo, not as `foo.test.ts` siblings,
 * so both shapes have to be recognised.
 */
export function classify(path: string): FileKind {
    if (/(^|\/)(dist|build|\.turbo|coverage)\//.test(path)) return 'generated';
    if (/\.gen\.tsx?$/.test(path) || /(^|\/)generated\//.test(path)) return 'generated';
    if (/(^|\/)(test|tests|__tests__)\//.test(path)) return 'test';
    if (/\.(test|spec)\.[tj]sx?$/.test(path)) return 'test';
    return 'src';
}

/** Extension without the dot, or an empty string when there is none. */
export function extensionOf(path: string): string {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? '' : base.slice(dot + 1);
}

/** The workspace package a path belongs to, e.g. `packages/db`, or null. */
export function packageOf(path: string): string | null {
    const parts = path.split('/');
    const [top, name] = parts;
    if (top === undefined || name === undefined) return null;
    if (top !== 'apps' && top !== 'packages') return null;
    return `${top}/${name}`;
}
