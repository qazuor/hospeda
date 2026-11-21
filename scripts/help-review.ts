/**
 * @file help-review.ts
 * @description `pnpm help:review` (HOS-2410 `docs/guards.md` §4.4): records
 * that a person re-read an article against the running portal. It is the only
 * writer of `packages/help/help.lock.json` and of an article's `reviewedAt`.
 *
 * | Command | Effect |
 * |---|---|
 * | `pnpm help:review <id> [<id>…]` | For each id: set the es frontmatter `reviewedAt` to today (Argentina), recompute its anchor hashes, rewrite its lock line, then rebuild the index (as `help:build`). Refuses unknown ids. Never touches other articles. Writes nothing when any step fails |
 * | `pnpm help:review --list` | Prints the ids whose hashes differ from the lock, with the changed anchors. No writes. Exit 0 |
 *
 * There is no "accept everything" mode on purpose: one would turn guard (c)
 * into a rubber stamp.
 *
 * Exit codes: 0 = done (or listed); 1 = refused, nothing written.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildHelpIndex,
    formatHelpIssues,
    type HelpContentFile,
    readHelpContentFiles
} from '../packages/help/src/generator/index.js';
import { argentinaToday, HELP_CONTENT_PATH, HELP_INDEX_PATH } from './check-help-catalog.js';
import { readEsArticles } from './check-help-lock.js';
import { createAnchorHasher, type HelpHashSources } from './help-anchor-hash.js';
import {
    changedAnchors,
    computeLockEntry,
    formatHelpLock,
    HELP_LOCK_PATH,
    type HelpLockEntry,
    parseHelpLock
} from './help-lock.js';

/** The paths and inputs every command reads. RO-RO. */
export interface HelpReviewContext {
    readonly root: string;
    /** Content dir; defaults to `<root>/packages/help/content`. */
    readonly contentDir?: string;
    /** Lock file; defaults to `<root>/packages/help/help.lock.json`. */
    readonly lockFile?: string;
    /** Committed index; defaults to `<root>/packages/help/generated/help-index.json`. */
    readonly indexFile?: string;
    /** Overrides the code-derived hash inputs (tests). */
    readonly sources?: HelpHashSources;
}

/** What a command returns. */
export interface HelpReviewResult {
    readonly exitCode: 0 | 1;
    readonly output: string;
}

/** The `reviewedAt` line of a frontmatter block. */
const REVIEWED_AT_LINE = /^reviewedAt:.*$/m;

/** Writes a file through a temp file, so it is written whole or not at all. */
function writeWhole({ file, text }: { readonly file: string; readonly text: string }): void {
    const temp = `${file}.tmp`;
    writeFileSync(temp, text);
    renameSync(temp, file);
}

/** The lock entries of a lock file (an absent file reads as none). */
function readLock({ lockFile }: { readonly lockFile: string }): readonly HelpLockEntry[] {
    return existsSync(lockFile)
        ? parseHelpLock({ text: readFileSync(lockFile, 'utf8') }).entries
        : [];
}

/**
 * `pnpm help:review --list`: the articles whose anchors differ from the lock.
 *
 * @param args - See {@link HelpReviewContext}
 * @returns One line per article to review; exit 0 (1 only when the content does not parse)
 */
export function listHelpReviews({
    root,
    contentDir = join(root, HELP_CONTENT_PATH),
    lockFile = join(root, HELP_LOCK_PATH),
    sources
}: HelpReviewContext): HelpReviewResult {
    const articles = readEsArticles({ contentDir });
    if (articles === undefined) {
        return {
            exitCode: 1,
            output: 'help:review: the content does not parse. Run pnpm check:help-catalog'
        };
    }
    const lock = new Map(readLock({ lockFile }).map((entry) => [entry.id, entry]));
    const hash = createAnchorHasher({ root, ...(sources === undefined ? {} : { sources }) });
    const lines: string[] = [];
    for (const article of articles) {
        const fresh = computeLockEntry({ article, hash });
        const locked = lock.get(article.id);
        if (!fresh.ok) {
            lines.push(`${article.id}: ${fresh.errors.join('; ')}`);
        } else if (locked === undefined) {
            lines.push(`${article.id}: no lock entry`);
        } else {
            const changed = changedAnchors({ locked: locked.anchors, fresh: fresh.entry.anchors });
            if (changed.length > 0) lines.push(`${article.id}: ${changed.join(', ')}`);
        }
    }
    return {
        exitCode: 0,
        output:
            lines.length === 0
                ? 'help:review: every article matches the lock.'
                : [
                      `help:review: ${lines.length} article(s) to re-read:`,
                      ...lines.map((line) => `  - ${line}`)
                  ].join('\n')
    };
}

/** Arguments for {@link reviewHelpArticles}. */
export interface ReviewHelpArticlesArgs extends HelpReviewContext {
    /** The article ids to mark reviewed. */
    readonly ids: readonly string[];
    /** The clock; defaults to now. */
    readonly now?: Date;
}

/**
 * `pnpm help:review <id>…`: marks articles reviewed today and rewrites their
 * lock lines and the index. Every step runs in memory first; nothing is
 * written unless all of them succeed.
 *
 * @param args - See {@link ReviewHelpArticlesArgs}
 * @returns What was done, or why nothing was
 */
export function reviewHelpArticles({
    root,
    contentDir = join(root, HELP_CONTENT_PATH),
    lockFile = join(root, HELP_LOCK_PATH),
    indexFile = join(root, HELP_INDEX_PATH),
    sources,
    ids,
    now = new Date()
}: ReviewHelpArticlesArgs): HelpReviewResult {
    if (ids.length === 0) {
        return { exitCode: 1, output: 'Usage: pnpm help:review <id> [<id>…] | --list' };
    }
    const today = argentinaToday({ now });
    const files = readHelpContentFiles({ contentDir });
    const byId = new Map<string, HelpContentFile>();
    for (const file of files) {
        const [locale, , name] = file.path.split('/');
        if (locale === 'es' && name?.endsWith('.md')) byId.set(name.slice(0, -'.md'.length), file);
    }
    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
        return {
            exitCode: 1,
            output: `help:review: unknown article id(s): ${unknown.join(', ')}. Nothing written.`
        };
    }
    const edited = new Map<string, string>();
    for (const id of new Set(ids)) {
        const file = byId.get(id) as HelpContentFile;
        const end = file.source.indexOf('\n---', 3);
        const frontmatter = end === -1 ? '' : file.source.slice(0, end);
        if (!REVIEWED_AT_LINE.test(frontmatter)) {
            return {
                exitCode: 1,
                output: `help:review: ${file.path} has no reviewedAt line. Nothing written.`
            };
        }
        edited.set(
            file.path,
            `${frontmatter.replace(REVIEWED_AT_LINE, `reviewedAt: "${today}"`)}${file.source.slice(end)}`
        );
    }
    const nextFiles = files.map((file) => ({
        path: file.path,
        source: edited.get(file.path) ?? file.source
    }));
    const built = buildHelpIndex({ files: nextFiles });
    if (built.issues.length > 0 || built.index === undefined || built.json === undefined) {
        return {
            exitCode: 1,
            output: `${formatHelpIssues({ issues: built.issues })}\nhelp:review wrote nothing. Fix the articles above and run it again.`
        };
    }
    const hash = createAnchorHasher({ root, ...(sources === undefined ? {} : { sources }) });
    const lock = new Map(readLock({ lockFile }).map((entry) => [entry.id, entry]));
    for (const id of new Set(ids)) {
        const article = built.index.locales.es.find((candidate) => candidate.id === id);
        const fresh = article === undefined ? undefined : computeLockEntry({ article, hash });
        if (fresh === undefined || !fresh.ok) {
            return {
                exitCode: 1,
                output: `help:review: ${id}: ${fresh === undefined ? 'not in the index' : fresh.errors.join('; ')}. Nothing written.`
            };
        }
        lock.set(id, fresh.entry);
    }
    for (const [path, source] of edited) writeWhole({ file: join(contentDir, path), text: source });
    writeWhole({ file: lockFile, text: formatHelpLock({ entries: [...lock.values()] }) });
    writeWhole({ file: indexFile, text: built.json });
    return {
        exitCode: 0,
        output: `help:review: ${[...new Set(ids)].join(', ')} reviewed on ${today}; lock and index rewritten.`
    };
}

/** Repo root of this script. */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const result = args.includes('--list')
        ? listHelpReviews({ root: REPO_ROOT })
        : reviewHelpArticles({ root: REPO_ROOT, ids: args });
    process[result.exitCode === 0 ? 'stdout' : 'stderr'].write(`${result.output}\n`);
    process.exit(result.exitCode);
}
