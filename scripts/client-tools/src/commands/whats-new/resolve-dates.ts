/**
 * Resolves unresolved `publishedAt: 'on-promotion'` markers in the What's New
 * catalog (HOS-1214 §6.2, AC-14).
 *
 * The sign-off flow (block 4's sibling, §6.1) writes entries with the literal
 * marker `'on-promotion'` instead of a date — D-1's whole point is that the
 * WRITER never guesses a promotion date. This module is the ONE place that
 * turns those markers into real dates, and it does so only after the change
 * has actually merged to `main` (the caller — `resolve-dates-cli.ts`, invoked
 * by `.github/workflows/whats-new-resolve-dates.yml` on `push: [main]` — never
 * calls this before that point). That ordering is what makes AC-14's second
 * half true by construction: a promotion PR that is opened and then closed
 * without merging never triggers a `push` to `main`, so this function is never
 * called for it, and its markers stay unresolved (invisible, per F-3c) rather
 * than being dated to a release that never happened.
 *
 * ## Ordering rule (mirrors HOS-964's manual precedent)
 *
 * Entries are declared **newest-first** in the catalog array (the file's own
 * authoring convention). Markers are resolved in the order they are
 * ENCOUNTERED while scanning the file top-to-bottom, so the first marker
 * found (the topmost, "newest declared") gets the merge timestamp itself, and
 * each subsequent marker steps `hoursApart` hours earlier. This is exactly
 * what HOS-964 did by hand when it moved four entries to the same release day
 * spread across distinct hours (`whats-new.ts:124-138`) — this function
 * automates that same shape, not a new one.
 *
 * ## What is deliberately left untouched
 *
 * - An entry whose `publishedAt` already carries a real ISO date (hand-written
 *   or previously resolved) is never touched — only the literal marker string
 *   is matched.
 * - Everything else in the file (formatting, comments, other fields) is
 *   copied through byte-for-byte; only the matched `publishedAt: '<marker>'`
 *   substrings are replaced.
 * - When `onlyIds` is given, a marker whose entry id is NOT in it is left
 *   as-is. See "Why `main` alone is not enough" below.
 *
 * ## Why `main` alone is not enough
 *
 * The resolved dates reach `staging` through a PR, never `main`. So after a
 * promotion `main` keeps its `'on-promotion'` markers until the NEXT
 * promotion, and every push to `main` in between — a Dependabot security
 * merge, a hotfix — found them again and opened another PR re-dating entries
 * `staging` had already dated (#3432, #3435, #3439, #3441, #3442 in a single
 * night). The caller therefore passes `onlyIds` = the ids still pending on
 * `staging` ({@link collectPendingMarkerIds}) MINUS the ids any open
 * resolve-dates PR already dates ({@link collectDatedIds}).
 *
 * The PRs are subtracted, never intersected: a PR branch is cut from an
 * older `main`, so an entry promoted after it is simply absent there.
 * Treating that absence as "already being resolved" would leave every later
 * promotion undated for as long as one resolve PR stays open.
 */

/** The literal unresolved-date marker written by the sign-off flow (D-1). */
export const ON_PROMOTION_MARKER = 'on-promotion';

/**
 * Matches an `id: '...'` or `publishedAt: '...'` field (either quote style),
 * capturing the field name, the quote character, and the raw value.
 *
 * Anchored on `\b` before the field name so it can never match inside a
 * differently-named key that merely ends in "...id" (e.g. `roleId`,
 * `retiredId`) — a word-to-word transition has no `\b`. Neither `id` nor
 * `publishedAt` values contain quote characters in this schema, so a
 * non-greedy `[^'"]*` is sufficient without escape handling.
 */
const FIELD_RE = /\b(id|publishedAt)\s*:\s*(['"])([^'"]*)\2/g;

/**
 * The live-entries declaration every reader of the catalog anchors on — the
 * same anchor `check-whats-new-catalog.sh` and `whats-new-gate.yml` use.
 *
 * The catalog's own module docblock documents the marker semantics and
 * therefore CONTAINS the literal `publishedAt: 'on-promotion'` in prose
 * ABOVE this declaration. Scanning the whole file (the original behaviour)
 * resolved that prose as a phantom first entry on the first real run
 * (2026-09-11): it took the merge timestamp itself, shifted every real entry
 * one extra hour back, rewrote a doc comment in the committed catalog, and
 * put `'(unknown id)'` first in the PR body. Everything before the
 * declaration is documentation and is never touched.
 */
const ENTRIES_DECLARATION = 'export const whatsNewEntries';

/** One resolved marker occurrence, positioned in the original content. */
interface MarkerOccurrence {
    readonly start: number;
    readonly end: number;
    readonly quote: string;
    readonly id: string | null;
}

export interface ResolvePublishedAtMarkersInput {
    /** The full source of `whats-new.ts` (or an equivalent fixture). */
    readonly content: string;
    /** ISO 8601 timestamp of the merge that resolves the markers. */
    readonly mergedAt: string;
    /**
     * Hours to step back per marker, preserving declared (newest-first)
     * order. Defaults to 1h, which comfortably fits any realistic batch size
     * for a single day (HOS-964 used 3h gaps for four entries).
     */
    readonly hoursApart?: number;
    /**
     * When set, only markers whose entry id is in this set are resolved; the
     * rest are left untouched and reported in `skippedIds`. A marker with no
     * readable id is never in the set, so it is skipped too. When omitted,
     * every marker is resolved.
     */
    readonly onlyIds?: ReadonlySet<string>;
}

export interface ResolvePublishedAtMarkersResult {
    /** The content with every marker replaced; identical to the input when `resolvedCount` is 0. */
    readonly updatedContent: string;
    /** How many `'on-promotion'` markers were found and resolved. */
    readonly resolvedCount: number;
    /**
     * The `id` of each resolved entry, in the order resolved (newest-first,
     * matching declared order). `'(unknown id)'` for the pathological case of
     * a marker with no preceding `id` field in the same scan.
     */
    readonly resolvedIds: readonly string[];
    /**
     * Ids of the markers left untouched because they were not in `onlyIds`,
     * in declared order. Always empty when `onlyIds` is omitted.
     */
    readonly skippedIds: readonly string[];
}

/**
 * Formats a timestamp the same way the catalog's hand-written entries do:
 * whole seconds, no milliseconds (`toISOString()` always emits `.000Z` when
 * the millisecond component is zero, which it always is here since every
 * input offset is a whole number of hours).
 */
function toCatalogIsoString({ ms }: { readonly ms: number }): string {
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Finds every `'on-promotion'` marker in the live entries of `content`, in
 * declared order, with the id of the entry it belongs to.
 */
function findMarkers({ content }: { readonly content: string }): MarkerOccurrence[] {
    return findPublishedAtFields({ content })
        .filter((field) => field.value === ON_PROMOTION_MARKER)
        .map(({ value: _value, ...marker }) => marker);
}

/**
 * Finds every `publishedAt` field in the live entries of `content`, marker or
 * date, in declared order, with the id of the entry it belongs to.
 */
function findPublishedAtFields({
    content
}: {
    readonly content: string;
}): (MarkerOccurrence & { readonly value: string })[] {
    const fields: (MarkerOccurrence & { readonly value: string })[] = [];
    let currentId: string | null = null;
    let match: RegExpExecArray | null;

    // Scan only from the live-entries declaration. Content above it (the
    // module docblock) documents the marker and must never be rewritten. A
    // file without the declaration (synthetic unit-test fixtures only) is
    // scanned whole, preserving the function's behaviour on minimal inputs.
    const declarationIndex = content.indexOf(ENTRIES_DECLARATION);
    const scanStart = declarationIndex === -1 ? 0 : declarationIndex;
    const scanContent = content.slice(scanStart);

    // Reset lastIndex explicitly — this is a module-level `g` regex reused
    // across calls, and a leftover lastIndex from a prior (e.g. thrown-mid-way)
    // call would silently skip a prefix of the next one.
    FIELD_RE.lastIndex = 0;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard exec-loop idiom
    while ((match = FIELD_RE.exec(scanContent)) !== null) {
        const [full, key, quote, value] = match;
        if (key === 'id') {
            currentId = value ?? null;
            continue;
        }
        // key === 'publishedAt'
        fields.push({
            start: scanStart + match.index,
            end: scanStart + match.index + full.length,
            quote: quote ?? "'",
            id: currentId,
            value: value ?? ''
        });
    }
    return fields;
}

/**
 * Returns the ids of every entry whose `publishedAt` is already a real date
 * (anything but the `'on-promotion'` marker) in `content`.
 *
 * This is how an open resolve-dates PR is read: what it DATES is being
 * resolved; what it does not contain is simply newer than its branch, and
 * says nothing either way.
 *
 * @param input.content - A version of the catalog source (e.g. an open PR's).
 * @returns The set of already-dated entry ids.
 */
export function collectDatedIds({ content }: { readonly content: string }): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const field of findPublishedAtFields({ content })) {
        if (field.id !== null && field.value !== ON_PROMOTION_MARKER) {
            ids.add(field.id);
        }
    }
    return ids;
}

/**
 * Returns the ids of every entry whose `publishedAt` is still the
 * `'on-promotion'` marker in `content`. Markers with no readable id are left
 * out — an id is what lets two versions of the catalog be compared.
 *
 * @param input.content - A version of the catalog source (e.g. `staging`'s).
 * @returns The set of still-pending entry ids; empty when nothing is pending.
 */
export function collectPendingMarkerIds({
    content
}: {
    readonly content: string;
}): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const marker of findMarkers({ content })) {
        if (marker.id !== null) {
            ids.add(marker.id);
        }
    }
    return ids;
}

/**
 * Rewrites every `publishedAt: 'on-promotion'` marker in `content` to a real
 * date derived from `mergedAt`, preserving declared newest-first order with
 * hours spread descending (AC-14). Pure and side-effect free — the caller
 * (`resolve-dates-cli.ts`) owns reading/writing the actual file.
 *
 * @param input.content    - The catalog source.
 * @param input.mergedAt   - ISO 8601 merge timestamp; every resolved date is
 *                            derived from this instant.
 * @param input.hoursApart - Hour step between consecutive resolved markers
 *                            (default 1).
 * @param input.onlyIds    - Optional allow-list of entry ids; markers outside
 *                            it are left untouched and reported as skipped.
 * @returns The rewritten content plus a count, the ordered resolved ids and
 *          the skipped ids. When nothing is resolved,
 *          `updatedContent === content` exactly (a true no-op).
 */
export function resolvePublishedAtMarkers({
    content,
    mergedAt,
    hoursApart = 1,
    onlyIds
}: ResolvePublishedAtMarkersInput): ResolvePublishedAtMarkersResult {
    const mergedAtMs = new Date(mergedAt).getTime();
    if (Number.isNaN(mergedAtMs)) {
        throw new Error(`resolvePublishedAtMarkers: mergedAt is not a valid date: ${mergedAt}`);
    }

    const skippedIds: string[] = [];
    const markers = findMarkers({ content }).filter((marker) => {
        if (onlyIds === undefined) {
            return true;
        }
        if (marker.id !== null && onlyIds.has(marker.id)) {
            return true;
        }
        skippedIds.push(marker.id ?? '(unknown id)');
        return false;
    });

    if (markers.length === 0) {
        return { updatedContent: content, resolvedCount: 0, resolvedIds: [], skippedIds };
    }

    let updatedContent = '';
    let cursor = 0;
    const resolvedIds: string[] = [];

    // Hours step over RESOLVED markers only, so a skipped one leaves no gap.
    markers.forEach((marker, index) => {
        const resolvedMs = mergedAtMs - index * hoursApart * 60 * 60 * 1000;
        const resolvedIso = toCatalogIsoString({ ms: resolvedMs });
        updatedContent += content.slice(cursor, marker.start);
        updatedContent += `publishedAt: ${marker.quote}${resolvedIso}${marker.quote}`;
        cursor = marker.end;
        resolvedIds.push(marker.id ?? '(unknown id)');
    });
    updatedContent += content.slice(cursor);

    return { updatedContent, resolvedCount: markers.length, resolvedIds, skippedIds };
}
