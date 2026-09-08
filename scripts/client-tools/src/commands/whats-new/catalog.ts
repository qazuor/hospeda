/**
 * Reads the What's New catalog (`apps/api/src/data/whats-new/whats-new.ts`) as
 * data, without executing it (HOS-1214 D-7).
 *
 * ## Why parse instead of import
 *
 * The catalog is TypeScript, not JSON, and it imports `@repo/schemas` — so
 * importing it from a bun CLI would drag the whole workspace's build graph in
 * for four object literals. It is also the file `drop` REWRITES, and a rewrite
 * has to preserve every byte it did not mean to change (formatting, comments,
 * the module docblock), which an import-and-serialize round trip cannot do.
 *
 * ## Why a scanner and not a regex
 *
 * `scripts/check-whats-new-catalog.sh` reads this same file positionally with
 * `grep`, which is fine for the single-field questions it asks. This module
 * needs whole entries — including `body.es`, free Spanish prose that legally
 * contains apostrophes, braces and commas — so it tracks string state and
 * brace depth instead of trusting `[^']*`. A single escaped quote in one
 * entry's body would otherwise shift every field of every entry after it, and
 * the failure would look like data corruption rather than a parse bug.
 */

/** Path, relative to the repository root, of the catalog this module reads. */
export const CATALOG_FILE_PATH = 'apps/api/src/data/whats-new/whats-new.ts';

/** The literal unresolved-date marker (mirrors `resolve-dates.ts`). */
export const ON_PROMOTION_MARKER = 'on-promotion';

/** The comment convention that records which PRs an entry was written for. */
export const ORIGIN_COMMENT_PREFIX = '// origin:';

/** One entry, as it appears in the catalog source. */
export interface CatalogEntry {
    /** The entry's `id`. */
    readonly id: string;
    /** Its `publishedAt`, which may be {@link ON_PROMOTION_MARKER}. */
    readonly publishedAt: string;
    /** Its `roles`, or `null` when the key is absent (a universal broadcast). */
    readonly roles: readonly string[] | null;
    /** Its `highlight` flag; `false` when absent. */
    readonly highlight: boolean;
    /** Its `title.es`, or `''` when unreadable. */
    readonly titleEs: string;
    /** Its `body.es`, or `''` when unreadable. */
    readonly bodyEs: string;
    /**
     * PR numbers from the `// origin: #N, #M` comment above the entry.
     *
     * Empty when the entry carries no such comment — every entry written
     * before the convention existed, and every hand-written one.
     */
    readonly originPrs: readonly number[];
    /** Index in the source where the entry starts (its leading comments included). */
    readonly start: number;
    /** Index in the source just past the entry's closing `}` and its comma. */
    readonly end: number;
}

/** Quote characters a string literal can open with. */
const QUOTES = new Set(["'", '"', '`']);

/**
 * Reads a string literal starting at `index` (which must be its opening
 * quote), honouring backslash escapes.
 *
 * @param input.content - The full source.
 * @param input.index   - Index of the opening quote.
 * @returns The decoded-enough value and the index just past the closing quote,
 *          or `null` when the literal is unterminated.
 */
function readStringLiteral({
    content,
    index
}: {
    readonly content: string;
    readonly index: number;
}): { readonly value: string; readonly end: number } | null {
    const quote = content[index];
    if (quote === undefined || !QUOTES.has(quote)) return null;

    let value = '';
    for (let i = index + 1; i < content.length; i += 1) {
        const char = content[i] as string;
        if (char === '\\') {
            const next = content[i + 1];
            // Only the escapes this catalog can actually contain are decoded;
            // anything else is passed through with its backslash, which is
            // enough for display and exact for the fields that matter.
            if (next === 'n') value += '\n';
            else if (next !== undefined) value += next;
            i += 1;
            continue;
        }
        if (char === quote) return { value, end: i + 1 };
        value += char;
    }
    return null;
}

/**
 * Finds the span of the `whatsNewEntries` array literal.
 *
 * @param input.content - The catalog source.
 * @returns The index just past the opening `[` and the index of the closing
 *          `]`, or `null` when the declaration is not present.
 */
function findEntriesArray({
    content
}: {
    readonly content: string;
}): { readonly open: number; readonly close: number } | null {
    const declaration = content.indexOf('export const whatsNewEntries');
    if (declaration === -1) return null;
    // Anchor past the `=`: the declaration's own TYPE annotation is
    // `WhatsNewEntry[]`, so "the first `[` after the declaration" finds an
    // empty array that is not the catalog and silently reports zero entries.
    const assignment = content.indexOf('=', declaration);
    if (assignment === -1) return null;
    const open = content.indexOf('[', assignment);
    if (open === -1) return null;

    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < content.length; i += 1) {
        const char = content[i] as string;
        if (quote !== null) {
            if (char === '\\') i += 1;
            else if (char === quote) quote = null;
            continue;
        }
        if (QUOTES.has(char)) {
            quote = char;
            continue;
        }
        if (char === '[' || char === '{') depth += 1;
        else if (char === '}') depth -= 1;
        else if (char === ']') {
            depth -= 1;
            if (depth === 0) return { open: open + 1, close: i };
        }
    }
    return null;
}

/**
 * Collects the top-level object literals inside an array span.
 *
 * @param input.content - The catalog source.
 * @param input.open    - Index just past the array's `[`.
 * @param input.close   - Index of the array's `]`.
 * @returns One `{ start, end }` per entry object, in declared order.
 */
function collectObjectSpans({
    content,
    open,
    close
}: {
    readonly content: string;
    readonly open: number;
    readonly close: number;
}): readonly { readonly start: number; readonly end: number }[] {
    const spans: { start: number; end: number }[] = [];
    let depth = 0;
    let start = -1;
    let quote: string | null = null;

    for (let i = open; i < close; i += 1) {
        const char = content[i] as string;
        if (quote !== null) {
            if (char === '\\') i += 1;
            else if (char === quote) quote = null;
            continue;
        }
        if (QUOTES.has(char)) {
            quote = char;
            continue;
        }
        if (char === '{') {
            if (depth === 0) start = i;
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0 && start !== -1) {
                // Swallow the separating comma — and only it — so a removal
                // never leaves `,,` behind, and never eats the whitespace of
                // an entry that has no comma after it (the last one).
                let cursor = i + 1;
                while (cursor < close && /\s/.test(content[cursor] as string)) cursor += 1;
                const end = content[cursor] === ',' ? cursor + 1 : i + 1;
                spans.push({ start, end });
                start = -1;
            }
        }
    }
    return spans;
}

/**
 * Walks backwards from an entry's `{` over the comment lines attached to it.
 *
 * Those lines belong to the entry — they carry the `// origin:` record — so a
 * removal must take them with it, and a listing must read them.
 *
 * @param input.content - The catalog source.
 * @param input.start   - Index of the entry's `{`.
 * @returns The index where the entry's own text begins.
 */
function expandToLeadingComments({
    content,
    start
}: {
    readonly content: string;
    readonly start: number;
}): number {
    let lineStart = content.lastIndexOf('\n', start - 1) + 1;
    let earliest = lineStart;

    while (lineStart > 0) {
        const previousEnd = lineStart - 1;
        const previousStart = content.lastIndexOf('\n', previousEnd - 1) + 1;
        const line = content.slice(previousStart, previousEnd).trim();
        if (!line.startsWith('//')) break;
        earliest = previousStart;
        lineStart = previousStart;
    }
    return earliest;
}

/** Reads a top-level `key: '<value>'` field out of one entry's text. */
function readStringField({
    text,
    key
}: {
    readonly text: string;
    readonly key: string;
}): string | null {
    const match = new RegExp(`\\b${key}\\s*:\\s*`).exec(text);
    if (match === null) return null;
    const literal = readStringLiteral({ content: text, index: match.index + match[0].length });
    return literal === null ? null : literal.value;
}

/** Reads `outer: { inner: '<value>' }` out of one entry's text. */
function readNestedStringField({
    text,
    outer,
    inner
}: {
    readonly text: string;
    readonly outer: string;
    readonly inner: string;
}): string | null {
    const match = new RegExp(`\\b${outer}\\s*:\\s*\\{`).exec(text);
    if (match === null) return null;
    const scoped = text.slice(match.index + match[0].length);
    return readStringField({ text: scoped, key: inner });
}

/** Reads `roles: ['A', 'B']`, or `null` when the key is absent. */
function readRoles({ text }: { readonly text: string }): readonly string[] | null {
    const match = /\broles\s*:\s*\[/.exec(text);
    if (match === null) return null;
    const open = match.index + match[0].length;
    const close = text.indexOf(']', open);
    if (close === -1) return null;
    return Array.from(text.slice(open, close).matchAll(/['"]([^'"]*)['"]/g)).map(
        (item) => item[1] as string
    );
}

/**
 * Reads the PR numbers out of an entry's `// origin:` comment lines.
 *
 * @param input.text - The entry's text, leading comments included.
 * @returns Every PR number found, deduplicated, in the order written.
 */
export function parseOriginPrs({ text }: { readonly text: string }): readonly number[] {
    const numbers: number[] = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(ORIGIN_COMMENT_PREFIX)) continue;
        for (const match of trimmed.slice(ORIGIN_COMMENT_PREFIX.length).matchAll(/#(\d+)/g)) {
            const value = Number(match[1]);
            if (Number.isFinite(value) && !numbers.includes(value)) numbers.push(value);
        }
    }
    return numbers;
}

/**
 * Parses the catalog source into entries.
 *
 * Never throws: a file it cannot recognise yields an empty list, which every
 * caller reports as "nothing found" rather than treating as "no entries
 * exist". The two are told apart by {@link findEntriesArray} returning `null`,
 * which callers check via {@link hasEntriesArray}.
 *
 * @param input.content - The full catalog source.
 * @returns One {@link CatalogEntry} per object literal, in declared order.
 */
export function parseCatalog({ content }: { readonly content: string }): readonly CatalogEntry[] {
    const array = findEntriesArray({ content });
    if (array === null) return [];

    const entries: CatalogEntry[] = [];
    for (const span of collectObjectSpans({ content, open: array.open, close: array.close })) {
        const objectText = content.slice(span.start, span.end);
        const id = readStringField({ text: objectText, key: 'id' });
        if (id === null) continue;

        const start = expandToLeadingComments({ content, start: span.start });
        const fullText = content.slice(start, span.end);

        entries.push({
            id,
            publishedAt: readStringField({ text: objectText, key: 'publishedAt' }) ?? '',
            roles: readRoles({ text: objectText }),
            highlight: /\bhighlight\s*:\s*true\b/.test(objectText),
            titleEs: readNestedStringField({ text: objectText, outer: 'title', inner: 'es' }) ?? '',
            bodyEs: readNestedStringField({ text: objectText, outer: 'body', inner: 'es' }) ?? '',
            originPrs: parseOriginPrs({ text: fullText }),
            start,
            end: span.end
        });
    }
    return entries;
}

/**
 * Whether the source declares the entries array at all.
 *
 * Separate from {@link parseCatalog} so a renamed declaration is reported as
 * "I could not read this file", never as "the catalog is empty" — the same
 * distinction the gate's shell scan makes with its own UNKNOWN branch.
 *
 * @param input.content - The full catalog source.
 * @returns `true` when `export const whatsNewEntries` and its array were found.
 */
export function hasEntriesArray({ content }: { readonly content: string }): boolean {
    return findEntriesArray({ content }) !== null;
}

/**
 * Whether an entry is still unresolved — written, but not yet published.
 *
 * @param input.entry - The entry to test.
 * @returns `true` while its `publishedAt` is the literal marker.
 */
export function isUnpublished({ entry }: { readonly entry: CatalogEntry }): boolean {
    return entry.publishedAt === ON_PROMOTION_MARKER;
}
