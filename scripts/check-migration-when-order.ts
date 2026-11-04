/**
 * @file check-migration-when-order.ts
 * @description Drizzle applies a migration only when its `when` (in
 * `packages/db/src/migrations/meta/_journal.json`) is greater than the
 * `created_at` of the last applied one. Every other migration is skipped
 * WITHOUT an error. When an epic (`epic/**`) generates migrations in parallel
 * with `staging`, its `when` values can land below staging's, and on arrival
 * in staging or production those migrations never run.
 *
 * ## The two rules
 *
 * 1. Monotonicity (always). In the branch journal every `entries[i].when` is
 *    strictly greater than `entries[i-1].when`. One historical inversion is
 *    exempt through a CLOSED allowlist (`ALLOWED_INVERSIONS`): idx 44 -> 45,
 *    `1783041491334 -> 1783035614329`, applied long ago in every environment.
 *    It is matched by idx AND both `when` values, never by "from idx N".
 * 2. Above the base (only when the PR target is `staging` or `main`). Every
 *    entry whose `tag` is absent from the base journal
 *    (`git show origin/<base>:<journal>`) has a `when` strictly greater than
 *    the maximum `when` of that journal. If rule 2 has to run and the base
 *    journal cannot be read, the guard FAILS CLOSED (exit 1), never green.
 *
 * The target comes from `--base=<ref>` or the `GITHUB_BASE_REF` variable. With
 * no target, or a target that is not staging/main (for example `epic/**`),
 * rule 2 does not run and the output says so. `pnpm check:guards` locally has
 * no target, so it applies rule 1 only.
 *
 * Test/diagnostic flags: `--journal-ref=<ref>` reads the current journal from
 * a git ref instead of the working tree; `--journal-file=<path>` and
 * `--base-journal-file=<path>` read either journal from a file.
 *
 * ## What it does NOT see
 *
 * - A migration whose tag was renamed: it looks new and is judged as new.
 * - Whether the `.sql` file matches its journal entry (other guards own that).
 * - A base that moves after this run: the check is against `origin/<base>` as
 *   fetched now; a later merge into the base needs a re-run.
 * - Environments that applied something out of band.
 * - Rule 2 against a target other than staging/main (skipped by design).
 *
 * Exit codes: 0 = clean; 1 = a violation, an unreadable journal, or a base
 * journal that is required and unreadable.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo-relative path of the Drizzle journal. */
export const JOURNAL_PATH = 'packages/db/src/migrations/meta/_journal.json';

/** Targets for which rule 2 (above the base) runs. */
export const GUARDED_TARGETS: readonly string[] = ['staging', 'main'];

/** One journal entry, reduced to what the guard reads. */
export interface JournalEntry {
    readonly idx: number;
    readonly when: number;
    readonly tag: string;
}

/** A journal, reduced to its entries. */
export interface Journal {
    readonly entries: readonly JournalEntry[];
}

/** A known historical inversion, matched by idx and both `when` values. */
export interface AllowedInversion {
    readonly previousIdx: number;
    readonly previousWhen: number;
    readonly idx: number;
    readonly when: number;
}

/** Closed allowlist: the only inversion that already exists everywhere. */
export const ALLOWED_INVERSIONS: readonly AllowedInversion[] = [
    { previousIdx: 44, previousWhen: 1783041491334, idx: 45, when: 1783035614329 }
];

/** Result of the pure check. */
export interface CheckResult {
    readonly exitCode: 0 | 1;
    readonly violations: readonly string[];
    readonly notes: readonly string[];
}

/** Input of the pure check. */
export interface CheckInput {
    readonly current: Journal;
    /** Journal of `origin/<target>`, or `null` when it could not be read. */
    readonly base: Journal | null;
    /** PR target branch, or `undefined`/empty when there is none. */
    readonly target?: string | undefined;
}

function isAllowedInversion(params: {
    readonly previous: JournalEntry;
    readonly entry: JournalEntry;
}): boolean {
    const { previous, entry } = params;
    return ALLOWED_INVERSIONS.some(
        (a) =>
            a.previousIdx === previous.idx &&
            a.previousWhen === previous.when &&
            a.idx === entry.idx &&
            a.when === entry.when
    );
}

/** Rule 1: strictly increasing `when`, minus the closed allowlist. */
export function findOrderViolations(params: { readonly journal: Journal }): readonly string[] {
    const out: string[] = [];
    const { entries } = params.journal;
    for (let i = 1; i < entries.length; i++) {
        const previous = entries[i - 1] as JournalEntry;
        const entry = entries[i] as JournalEntry;
        if (entry.when > previous.when) continue;
        if (isAllowedInversion({ previous, entry })) continue;
        out.push(
            `RULE 1: ${entry.tag} (idx ${entry.idx}, when ${entry.when}) is not greater than ` +
                `${previous.tag} (idx ${previous.idx}, when ${previous.when}). Drizzle would skip it ` +
                `wherever ${previous.tag} is already applied. Raise its \`when\` above ${previous.when}.`
        );
    }
    return out;
}

/** Rule 2: entries new relative to the base sit above the base's maximum `when`. */
export function findBaseViolations(params: {
    readonly current: Journal;
    readonly base: Journal;
    readonly target: string;
}): readonly string[] {
    const { current, base, target } = params;
    const baseTags = new Set(base.entries.map((e) => e.tag));
    const baseMax = base.entries.reduce((m, e) => Math.max(m, e.when), Number.NEGATIVE_INFINITY);
    const out: string[] = [];
    for (const entry of current.entries) {
        if (baseTags.has(entry.tag)) continue;
        if (entry.when > baseMax) continue;
        out.push(
            `RULE 2: ${entry.tag} (idx ${entry.idx}, when ${entry.when}) is new relative to ` +
                `origin/${target} but its \`when\` is not above that journal's maximum (${baseMax}). ` +
                `Drizzle would never apply it on an environment already at ${target}. Regenerate the ` +
                `migration behind the last one of ${target}, or raise its \`when\` above ${baseMax}; ` +
                `renumbering the idx alone is not enough.`
        );
    }
    return out;
}

/** Normalizes a PR target: trims and strips `refs/heads/` and `origin/` prefixes. */
export function normalizeTarget(raw: string | undefined): string {
    return (raw ?? '')
        .trim()
        .replace(/^refs\/heads\//, '')
        .replace(/^origin\//, '');
}

/** Pure check: both rules over already-parsed journals. */
export function checkJournals(input: CheckInput): CheckResult {
    const { current, base } = input;
    const target = normalizeTarget(input.target);
    const violations: string[] = [...findOrderViolations({ journal: current })];
    const notes: string[] = [];
    if (target === '') {
        notes.push('RULE 2 skipped: no PR target (no --base and no GITHUB_BASE_REF).');
    } else if (!GUARDED_TARGETS.includes(target)) {
        notes.push(`RULE 2 skipped: target "${target}" is not ${GUARDED_TARGETS.join(' or ')}.`);
    } else if (base === null) {
        violations.push(
            `RULE 2 cannot run: the journal of origin/${target} could not be read. Failing closed. ` +
                `Fetch it (git fetch origin ${target}) and re-run.`
        );
    } else {
        violations.push(...findBaseViolations({ current, base, target }));
    }
    return { exitCode: violations.length > 0 ? 1 : 0, violations, notes };
}

/** Parses and shape-checks a journal; throws on anything unexpected. */
export function parseJournal(params: { readonly text: string; readonly label: string }): Journal {
    const raw: unknown = JSON.parse(params.text);
    const entries = (raw as { entries?: unknown } | null)?.entries;
    if (!Array.isArray(entries)) throw new Error(`${params.label}: no "entries" array`);
    for (const e of entries) {
        const x = e as Partial<JournalEntry> | null;
        if (
            !x ||
            typeof x.idx !== 'number' ||
            typeof x.when !== 'number' ||
            typeof x.tag !== 'string'
        ) {
            throw new Error(`${params.label}: malformed entry ${JSON.stringify(e)}`);
        }
    }
    if (entries.length === 0) {
        throw new Error(`${params.label}: "entries" is empty, treated as a broken read`);
    }
    return { entries: entries as readonly JournalEntry[] };
}

function readFromGit(params: { readonly ref: string; readonly root: string }): string {
    return execFileSync('git', ['show', `${params.ref}:${JOURNAL_PATH}`], {
        cwd: params.root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 16 * 1024 * 1024
    });
}

function flag(args: readonly string[], name: string): string | undefined {
    const prefix = `--${name}=`;
    return args.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

/** Reads the journals per the CLI args and the PR target, then runs the check. */
export function run(params: {
    readonly args: readonly string[];
    /** Value of `GITHUB_BASE_REF`, when set. */
    readonly baseRef?: string | undefined;
    readonly root: string;
}): { readonly exitCode: 0 | 1; readonly output: string } {
    const { args, root } = params;
    const target = normalizeTarget(flag(args, 'base') || params.baseRef);
    const journalFile = flag(args, 'journal-file');
    const journalRef = flag(args, 'journal-ref');
    const baseFile = flag(args, 'base-journal-file');

    let current: Journal;
    try {
        const text = journalFile
            ? readFileSync(resolve(root, journalFile), 'utf8')
            : journalRef
              ? readFromGit({ ref: journalRef, root })
              : readFileSync(resolve(root, JOURNAL_PATH), 'utf8');
        current = parseJournal({ text, label: 'current journal' });
    } catch (error) {
        return {
            exitCode: 1,
            output: `ERROR: cannot read the current journal: ${(error as Error).message}`
        };
    }

    let base: Journal | null = null;
    if (GUARDED_TARGETS.includes(target)) {
        try {
            const text = baseFile
                ? readFileSync(resolve(root, baseFile), 'utf8')
                : readFromGit({ ref: `origin/${target}`, root });
            base = parseJournal({ text, label: `journal of origin/${target}` });
        } catch {
            base = null;
        }
    }

    const result = checkJournals({ current, base, target });
    const lines = [...result.notes];
    if (result.exitCode === 0) {
        lines.push(
            `OK: ${current.entries.length} journal entries are in order` +
                (base && GUARDED_TARGETS.includes(target)
                    ? `; entries new vs origin/${target} sit above its max when.`
                    : '.')
        );
    } else {
        lines.push(
            'FAIL migration journal `when` order:',
            ...result.violations.map((v) => `  ${v}`)
        );
    }
    return { exitCode: result.exitCode, output: lines.join('\n') };
}

function isMainScript(): boolean {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return fileURLToPath(import.meta.url) === realpathSync(entry);
    } catch {
        return false;
    }
}

if (isMainScript()) {
    const root = resolve(fileURLToPath(import.meta.url), '../..');
    const { exitCode, output } = run({
        args: process.argv.slice(2),
        baseRef: process.env.GITHUB_BASE_REF,
        root
    });
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
