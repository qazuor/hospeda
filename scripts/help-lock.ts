/**
 * @file help-lock.ts
 * @description The help lock file `packages/help/help.lock.json` (HOS-2410
 * `docs/guards.md` §4.1): per article, its `reviewedAt` and the hash of every
 * anchor it covers, as they were when a person last re-read it. Shared by
 * guard (c) (`check-help-lock.ts`) and `pnpm help:review` (`help-review.ts`).
 *
 * Layout: a JSON array with one object per line, sorted by `id`, so parallel
 * PRs touching different articles merge without conflict. Only
 * `pnpm help:review` writes it.
 */

import { z } from 'zod';
import type { AnchorHashResult } from './help-anchor-hash.js';
import { lockEntryHash } from './help-anchor-hash.js';

/** The lock file, relative to the repo root. */
export const HELP_LOCK_PATH = 'packages/help/help.lock.json';

/** A sha256 hex digest. */
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/** One line of the lock. */
export const HelpLockEntrySchema = z
    .object({
        id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        reviewedAt: z.iso.date(),
        hash: Sha256Schema,
        anchors: z.record(z.string().min(1), Sha256Schema)
    })
    .strict();

/** One line of the lock. */
export type HelpLockEntry = z.infer<typeof HelpLockEntrySchema>;

/** The fields of an article the lock is computed from. */
export interface HelpLockArticle {
    readonly id: string;
    readonly reviewedAt: string;
    readonly covers: readonly string[];
    readonly entryFor: readonly string[];
}

/**
 * Parses the lock file text.
 *
 * @param args.text - The file content
 * @returns The valid entries, and one message per problem (schema, order, duplicate)
 */
export function parseHelpLock({ text }: { readonly text: string }): {
    readonly entries: readonly HelpLockEntry[];
    readonly problems: readonly string[];
} {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (error) {
        return { entries: [], problems: [`${HELP_LOCK_PATH} is not valid JSON: ${String(error)}`] };
    }
    if (!Array.isArray(raw)) {
        return { entries: [], problems: [`${HELP_LOCK_PATH} is not a JSON array`] };
    }
    const entries: HelpLockEntry[] = [];
    const problems: string[] = [];
    for (const [index, item] of raw.entries()) {
        const parsed = HelpLockEntrySchema.safeParse(item);
        if (parsed.success) {
            entries.push(parsed.data);
        } else {
            problems.push(
                `lock entry ${index}: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || '(entry)'} ${issue.message}`).join('; ')}`
            );
        }
    }
    for (const [index, entry] of entries.entries()) {
        const previous = entries[index - 1];
        if (previous !== undefined && previous.id >= entry.id) {
            problems.push(
                previous.id === entry.id
                    ? `lock entry ${entry.id} appears twice`
                    : `lock entry ${entry.id} is out of order: the lock is sorted by id`
            );
        }
    }
    return { entries, problems };
}

/**
 * Serializes lock entries in the committed layout: one entry per line, sorted
 * by id, fixed key order, anchors sorted.
 *
 * @param args.entries - The entries
 * @returns The file text, ending in a newline
 */
export function formatHelpLock({
    entries
}: {
    readonly entries: readonly HelpLockEntry[];
}): string {
    const lines = [...entries]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((entry) =>
            JSON.stringify({
                id: entry.id,
                reviewedAt: entry.reviewedAt,
                hash: entry.hash,
                anchors: Object.fromEntries(
                    Object.entries(entry.anchors).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                )
            })
        );
    return lines.length === 0 ? '[\n]\n' : `[\n${lines.join(',\n')}\n]\n`;
}

/**
 * Computes the lock entry an article would have now.
 *
 * @param args.article - The article's id, reviewedAt, covers and entryFor
 * @param args.hash - The anchor hasher of the repo
 * @returns The entry, or the anchors that could not be hashed
 */
export function computeLockEntry({
    article,
    hash
}: {
    readonly article: HelpLockArticle;
    readonly hash: (anchor: string) => AnchorHashResult;
}):
    | { readonly ok: true; readonly entry: HelpLockEntry }
    | { readonly ok: false; readonly errors: readonly string[] } {
    const anchors: Record<string, string> = {};
    const errors: string[] = [];
    for (const anchor of [...new Set([...article.covers, ...article.entryFor])].sort()) {
        const result = hash(anchor);
        if (result.ok) {
            anchors[anchor] = result.hash;
        } else {
            errors.push(result.error);
        }
    }
    if (errors.length > 0) {
        return { ok: false, errors };
    }
    return {
        ok: true,
        entry: {
            id: article.id,
            reviewedAt: article.reviewedAt,
            hash: lockEntryHash({ anchors }),
            anchors
        }
    };
}

/**
 * The anchors whose hash differs between the lock and now, including anchors
 * added to or dropped from the article.
 *
 * @param args.locked - The lock's anchors
 * @param args.fresh - The anchors computed now
 * @returns The differing anchors, sorted, each with what changed
 */
export function changedAnchors({
    locked,
    fresh
}: {
    readonly locked: Readonly<Record<string, string>>;
    readonly fresh: Readonly<Record<string, string>>;
}): string[] {
    const all = [...new Set([...Object.keys(locked), ...Object.keys(fresh)])].sort();
    return all.flatMap((anchor) => {
        if (!Object.hasOwn(locked, anchor)) {
            return [`${anchor} (new in the article)`];
        }
        if (!Object.hasOwn(fresh, anchor)) {
            return [`${anchor} (no longer in the article)`];
        }
        return locked[anchor] === fresh[anchor] ? [] : [`${anchor} (changed)`];
    });
}
