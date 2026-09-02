import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from '../../lib/exec.ts';

/** One runnable script found in the repository. */
export interface RepoScript {
    /** Id typed on the command line: `lint`, `web:preview`. */
    readonly id: string;
    /** Package name, as pnpm filters on it. */
    readonly packageName: string;
    /** Package directory, repo-relative. `.` for the root. */
    readonly dir: string;
    /** Script name inside that package.json. */
    readonly script: string;
    /** The command it runs. */
    readonly command: string;
}

/**
 * Scripts never worth offering: npm lifecycle hooks, and this CLI's own entry.
 */
const HIDDEN = new Set(['prepare', 'preinstall', 'postinstall', 'prepublishOnly']);

/**
 * Commands that destroy shared state, matched on what they DO.
 *
 * Matched on the command rather than the name because the name is a label and
 * the command is the act: `db:fresh-dev` is dangerous because it runs
 * `compose down -v`, which wipes the Postgres volume — every worktree database
 * included — not because of what it is called.
 */
const DANGEROUS = [
    { pattern: /down\s+-v|--volumes|compose\s+down/, why: 'borra el volumen de Postgres ENTERO' },
    { pattern: /drizzle-kit\s+push|db:push/, why: 'empuja el esquema sin migración' },
    { pattern: /rm\s+-rf/, why: 'borra archivos' },
    { pattern: /--target=prod|db-migrate.*prod/, why: 'toca producción' }
] as const;

/** Shortens a package name into the prefix used by script ids. */
function prefixOf({ name }: { readonly name: string }): string {
    if (name === 'hospeda') return '';
    return name.replace('@repo/', '').replace('hospeda-', '');
}

/** Reads one package.json, tolerating anything unreadable. */
function readScripts({
    repoRoot,
    file
}: {
    readonly repoRoot: string;
    readonly file: string;
}): readonly RepoScript[] {
    let parsed: { name?: string; scripts?: Record<string, string> };
    try {
        parsed = JSON.parse(readFileSync(join(repoRoot, file), 'utf8')) as typeof parsed;
    } catch {
        return [];
    }
    const name = parsed.name;
    if (name === undefined) return [];
    const dir = file === 'package.json' ? '.' : file.slice(0, -'/package.json'.length);
    const prefix = prefixOf({ name });

    return Object.entries(parsed.scripts ?? {})
        .filter(([script]) => !HIDDEN.has(script))
        .map(([script, command]) => ({
            id: prefix === '' ? script : `${prefix}:${script}`,
            packageName: name,
            dir,
            script,
            command
        }));
}

/**
 * Finds every script in every package.json of the repository.
 *
 * Including the ROOT one, which is the whole reason this exists: the previous
 * CLI expanded the workspace globs (`apps/*`, `packages/*`) and never opened
 * the root package.json, leaving 43 scripts — among them the twenty CI guards —
 * impossible to discover from it.
 *
 * @param input.repoRoot - Repository root.
 * @returns Every script, sorted by id.
 */
export async function findScripts({
    repoRoot
}: {
    readonly repoRoot: string;
}): Promise<readonly RepoScript[]> {
    const listed = await run({
        command: 'git',
        args: ['ls-files', '*package.json'],
        cwd: repoRoot,
        timeoutMs: 60_000
    });
    if (!listed.ok) return [];

    const files = listed.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.includes('node_modules'));

    const scripts = files.flatMap((file) => readScripts({ repoRoot, file }));
    const seen = new Set<string>();
    return scripts
        .filter((script) => {
            if (seen.has(script.id)) return false;
            seen.add(script.id);
            return true;
        })
        .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Whether a script destroys shared state, and why.
 *
 * @param input.script - The script to assess.
 * @returns The reason, or `null` when it is ordinary.
 */
export function dangerOf({ script }: { readonly script: RepoScript }): string | null {
    const entry = DANGEROUS.find((candidate) => candidate.pattern.test(script.command));
    return entry?.why ?? null;
}

/**
 * Scores how well a script matches a query, for ordering.
 *
 * @param input.script - Candidate script.
 * @param input.query  - What the user typed.
 * @returns A score; 0 means no match.
 */
export function scoreScript({
    script,
    query
}: {
    readonly script: RepoScript;
    readonly query: string;
}): number {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return 1;
    const id = script.id.toLowerCase();
    if (id === needle) return 100;
    if (id.startsWith(needle)) return 50;
    if (id.includes(needle)) return 25;
    if (script.command.toLowerCase().includes(needle)) return 5;
    return 0;
}

/**
 * Filters and orders scripts by a query.
 *
 * @param input.scripts - Every script.
 * @param input.query   - What the user typed.
 * @returns Matching scripts, best first.
 */
export function searchScripts({
    scripts,
    query
}: {
    readonly scripts: readonly RepoScript[];
    readonly query: string;
}): readonly RepoScript[] {
    return scripts
        .map((script) => ({ script, score: scoreScript({ script, query }) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.script.id.localeCompare(b.script.id))
        .map((entry) => entry.script);
}
