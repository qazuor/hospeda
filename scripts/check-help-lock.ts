/**
 * @file check-help-lock.ts
 * @description GUARD (c) of the help catalog, change coupling (HOS-2410
 * `docs/guards.md` §4, AC-31, AC-32, AC-34): when code an article is anchored to
 * changes, CI fails until the article is re-read and re-reviewed. The hashes
 * of each article's anchors (`covers` ∪ `entryFor`) are recorded in
 * `packages/help/help.lock.json` by `pnpm help:review <id>`; this guard
 * recomputes them and compares. What each anchor hashes is in
 * `help-anchor-hash.ts` (narrow on purpose, to keep noise low).
 *
 * ## What it checks (a failure exits 1)
 *
 * - (c1) Every article has a lock entry and every lock entry has an article; the
 *   lock parses, is sorted by id and has no duplicate.
 * - (c2) For every article, the freshly computed anchor hashes equal the lock's
 *   `anchors` (and its entry hash), and the anchor set equals
 *   `covers ∪ entryFor`. The message lists the changed anchors. An anchor
 *   several articles cover is hashed in each of their entries, so one change
 *   flags every one of them.
 * - (c3) The lock entry's `reviewedAt` equals the article's.
 * - (c4) Non-vacuity: the content parses, and the lock is not empty when the
 *   catalog is not.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - A hand-edited lock: a forged hash passes. Review of the lock diff is the
 *   control (only `pnpm help:review` writes it).
 * - Behaviour that changed without the hashed file changing: a component three
 *   imports deep, a service, a DB row (plan values, deadlines). Opt into a
 *   component with a `file:` anchor.
 * - Whether the review actually happened: only that the date and hashes moved.
 * - Translations: the lock is keyed by the es article id.
 *
 * There is no "accept everything" command on purpose: one would turn this guard
 * into a rubber stamp.
 *
 * Exit codes: 0 = clean; 1 = a violation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HelpArticle } from '../packages/help/src/article.schema.js';
import { buildHelpIndex, readHelpContentFiles } from '../packages/help/src/generator/index.js';
import { HELP_CONTENT_PATH } from './check-help-catalog.js';
import { createAnchorHasher, type HelpHashSources, lockEntryHash } from './help-anchor-hash.js';
import {
    changedAnchors,
    computeLockEntry,
    HELP_LOCK_PATH,
    type HelpLockEntry,
    parseHelpLock
} from './help-lock.js';

/** Predicate letters, as listed in the file header. */
export type LockPredicate = 'c1' | 'c2' | 'c3' | 'c4';

/** One violation. */
export interface LockViolation {
    readonly predicate: LockPredicate;
    readonly detail: string;
    /** The article whose review fixes it, when there is one. */
    readonly articleId?: string;
}

/** What each predicate means; printed with the violations. */
export const PREDICATE_MESSAGES: Readonly<Record<LockPredicate, string>> = {
    c1: 'GUARD:help-lock (c1): an article has no lock entry, a lock entry has no article, or the lock is malformed.',
    c2: 'GUARD:help-lock (c2): code an article is anchored to changed since the article was last reviewed.',
    c3: 'GUARD:help-lock (c3): an article reviewedAt differs from its lock entry.',
    c4: 'GUARD:help-lock (c4): the content does not parse or the lock is empty, so nothing was checked.'
};

/** Arguments for {@link checkHelpLock}. RO-RO. */
export interface CheckHelpLockArgs {
    readonly root: string;
    /** Content dir; defaults to `<root>/packages/help/content`. */
    readonly contentDir?: string;
    /** Lock file; defaults to `<root>/packages/help/help.lock.json`. */
    readonly lockFile?: string;
    /** Overrides the code-derived hash inputs (tests). */
    readonly sources?: HelpHashSources;
}

/** What {@link checkHelpLock} found. */
export interface CheckHelpLockResult {
    readonly violations: readonly LockViolation[];
    readonly articleCount: number;
}

/**
 * Reads the es articles of a content dir.
 *
 * @param args.contentDir - The content dir
 * @returns The articles, or `undefined` when the content does not parse
 */
export function readEsArticles({
    contentDir
}: {
    readonly contentDir: string;
}): readonly HelpArticle[] | undefined {
    return buildHelpIndex({ files: readHelpContentFiles({ contentDir }) }).index?.locales.es;
}

/** c2 and c3 for one article against its lock entry. */
function compareEntry({
    article,
    locked,
    hash
}: {
    readonly article: HelpArticle;
    readonly locked: HelpLockEntry;
    readonly hash: ReturnType<typeof createAnchorHasher>;
}): LockViolation[] {
    const violations: LockViolation[] = [];
    const at = { articleId: article.id };
    const fresh = computeLockEntry({ article, hash });
    if (fresh.ok) {
        const changed = changedAnchors({ locked: locked.anchors, fresh: fresh.entry.anchors });
        if (changed.length > 0) {
            violations.push({
                predicate: 'c2',
                ...at,
                detail: `${article.id}: ${changed.join(', ')}. Re-read the article against the portal, edit it if needed, then run: pnpm help:review ${article.id}`
            });
        } else if (locked.hash !== lockEntryHash({ anchors: locked.anchors })) {
            violations.push({
                predicate: 'c2',
                ...at,
                detail: `${article.id}: the entry hash does not match its anchors. Run: pnpm help:review ${article.id}`
            });
        }
    } else {
        violations.push(
            ...fresh.errors.map((error) => ({
                predicate: 'c2' as const,
                ...at,
                detail: `${article.id}: ${error}`
            }))
        );
    }
    if (locked.reviewedAt !== article.reviewedAt) {
        violations.push({
            predicate: 'c3',
            ...at,
            detail: `${article.id}: the article says reviewedAt ${article.reviewedAt}, the lock says ${locked.reviewedAt}. Only pnpm help:review ${article.id} moves the date`
        });
    }
    return violations;
}

/**
 * Checks the lock against the content and the repo.
 *
 * @param args - See {@link CheckHelpLockArgs}
 * @returns The violations and how many articles were checked
 */
export function checkHelpLock({
    root,
    contentDir = join(root, HELP_CONTENT_PATH),
    lockFile = join(root, HELP_LOCK_PATH),
    sources
}: CheckHelpLockArgs): CheckHelpLockResult {
    const articles = readEsArticles({ contentDir });
    if (articles === undefined) {
        return {
            violations: [
                {
                    predicate: 'c4',
                    detail: `the help content under ${contentDir} does not parse: run pnpm check:help-catalog`
                }
            ],
            articleCount: 0
        };
    }
    const violations: LockViolation[] = [];
    const parsed = existsSync(lockFile)
        ? parseHelpLock({ text: readFileSync(lockFile, 'utf8') })
        : { entries: [], problems: [`${HELP_LOCK_PATH} does not exist`] };
    violations.push(...parsed.problems.map((detail) => ({ predicate: 'c1' as const, detail })));
    if (articles.length > 0 && parsed.entries.length === 0) {
        violations.push({
            predicate: 'c4',
            detail: `the lock is empty but the catalog has ${articles.length} articles. Run pnpm help:review <id> for each, after re-reading it`
        });
    }

    const hash = createAnchorHasher({ root, ...(sources === undefined ? {} : { sources }) });
    const lock = new Map(parsed.entries.map((entry) => [entry.id, entry]));
    for (const article of articles) {
        const locked = lock.get(article.id);
        if (locked === undefined) {
            violations.push({
                predicate: 'c1',
                articleId: article.id,
                detail: `${article.id} has no lock entry. Re-read it, then run: pnpm help:review ${article.id}`
            });
            continue;
        }
        violations.push(...compareEntry({ article, locked, hash }));
    }
    const ids = new Set(articles.map((article) => article.id));
    for (const entry of parsed.entries) {
        if (!ids.has(entry.id)) {
            violations.push({
                predicate: 'c1',
                detail: `lock entry ${entry.id} has no article: remove its line from ${HELP_LOCK_PATH}`
            });
        }
    }
    return { violations, articleCount: articles.length };
}

/** Repo root of this script. */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Runs the guard.
 *
 * @param args - See {@link CheckHelpLockArgs}; the root defaults to this repo
 * @returns The exit code and the text to print
 */
export function run(args: Partial<CheckHelpLockArgs> = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const { violations, articleCount } = checkHelpLock({ root: REPO_ROOT, ...args });
    if (violations.length > 0) {
        const predicates = [...new Set(violations.map((violation) => violation.predicate))].sort();
        const toReview = [
            ...new Set(violations.flatMap((violation) => violation.articleId ?? []))
        ].sort();
        return {
            exitCode: 1,
            output: [
                ...predicates.map((predicate) => `FAIL ${PREDICATE_MESSAGES[predicate]}`),
                ...violations.map(
                    (violation) => `  - (${violation.predicate}) ${violation.detail}`
                ),
                toReview.length > 0
                    ? `Fix: re-read each article against the running portal, edit it if needed, then run: pnpm help:review ${toReview.join(' ')}`
                    : `Fix: correct ${HELP_LOCK_PATH} (only pnpm help:review writes it).`
            ].join('\n')
        };
    }
    return {
        exitCode: 0,
        output: `OK GUARD:help-lock: ${articleCount} articles match the code they are anchored to, as last reviewed`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    process[result.exitCode === 0 ? 'stdout' : 'stderr'].write(`${result.output}\n`);
    process.exit(result.exitCode);
}
