/**
 * @file confirmation-text.ts
 * @description How third-party and model-supplied text enters a confirmation
 * form message (HOS-2247, spec §5.7).
 *
 * The form message is the one text the model cannot answer: it is what the
 * human reads before saying yes. Every value in it that a guest, a provider, a
 * declarant or the model wrote is therefore treated as hostile. It must not be
 * able to fake the message's structure (an extra line, a closing fence, a
 * different question) or hide characters from the human.
 *
 * Two shapes, and every builder uses one of them for every such value:
 *
 * - {@link sanitizeForConfirmation} / {@link quoteForConfirmation}: a one-line
 *   label. Control, format (bidi overrides, zero-width) and line/paragraph
 *   separator characters become spaces, whitespace collapses, and it is capped.
 *   Quoted, the guillemets inside are replaced so the quote cannot be closed
 *   early.
 * - {@link blockForConfirmation}: a multi-line body the human must read exactly
 *   (a reply, a description, a note). Line breaks are kept, every line is
 *   hard-wrapped at {@link CONFIRMATION_BLOCK_WIDTH} display columns (wide
 *   characters count two, cuts fall between grapheme clusters) and EVERY segment is
 *   prefixed with {@link CONFIRMATION_BLOCK_PREFIX}, so no content line, and no
 *   row a client wraps visually, can start where a structural line does. There is no in-band closing delimiter
 *   to forge. Other control and format characters become a visible
 *   replacement character, so the human sees that something hidden is there.
 *
 * Structural lines (labels, warnings, the closing question) are written by the
 * server and never start with the block prefix.
 */

/** Default cap of a one-line label, in characters. */
export const CONFIRMATION_LABEL_MAX_LENGTH = 80;

/** Prefix of every line of a block: no content line can start at column 0. */
export const CONFIRMATION_BLOCK_PREFIX = '│ ';

/**
 * Width of a block line, in terminal columns, after the prefix. Every longer
 * line is hard-wrapped and each segment prefixed, so a client's own visual
 * wrapping of an over-long line cannot start a row without the prefix (HOS-2247
 * M1). Columns, not code points: a wide character (CJK, fullwidth, emoji) takes
 * two. 40 is a conservative budget, narrower than any form a client shows.
 */
export const CONFIRMATION_BLOCK_WIDTH = 40;

/** Most combining marks kept in a row (two is enough for any real script we serve). */
const MAX_COMBINING_RUN = 2;

/** Shown in a block where a hidden character was. */
const HIDDEN_CHARACTER = '\uFFFD';

/** Marks a capped value. */
const ELLIPSIS = '…';

/** A zero-width joiner BETWEEN two emoji (👨ZWJ👩ZWJ👧): the one format character kept. */
const EMOJI_JOINER =
    '(?<=\\p{Extended_Pictographic}[\\uFE0F\\u{1F3FB}-\\u{1F3FF}]?)\\u200D(?=\\p{Extended_Pictographic})';

/** Control, format, private, unassigned, surrogate, and line/paragraph separators. */
const UNSAFE_IN_LABEL = new RegExp(`(?!${EMOJI_JOINER})[\\p{C}\\p{Zl}\\p{Zp}]`, 'gu');

/** The same set minus the line feed, which a block keeps as its line break. */
const UNSAFE_IN_BLOCK = new RegExp(`(?!${EMOJI_JOINER})(?:[^\\P{C}\\n]|[\\p{Zl}\\p{Zp}])`, 'gu');

/**
 * Letters and symbols that render blank without being spaces or `\p{C}`
 * (Hangul fillers, the halfwidth filler, the blank Braille pattern): a run of
 * them is padding in disguise.
 */
const INVISIBLE_FILLERS = /[\u115F\u1160\u3164\uFFA0\u2800]+/gu;

/** Three or more combining marks in a row (stacked "zalgo" text). */
const COMBINING_RUN = /\p{M}{3,}/gu;

/** Keeps the first {@link MAX_COMBINING_RUN} marks of a run. */
const trimCombiningRun = (run: string): string =>
    Array.from(run).slice(0, MAX_COMBINING_RUN).join('');

/** Caps `text` at `maxLength` characters (code points), marking a cut. */
function cap(text: string, maxLength: number): string {
    const characters = Array.from(text);
    return characters.length <= maxLength
        ? text
        : `${characters
              .slice(0, Math.max(0, maxLength - 1))
              .join('')
              .trimEnd()}${ELLIPSIS}`;
}

/** Splits text into grapheme clusters, so a mark or a ZWJ sequence is never cut. */
const GRAPHEMES = new Intl.Segmenter('und', { granularity: 'grapheme' });

/** A cluster drawn as a wide emoji: emoji presentation, or a pictograph forced by U+FE0F. */
const WIDE_EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u;

/** Characters that take no column of their own. */
const ZERO_WIDTH = /^[\p{M}\p{Cf}]$/u;

/**
 * East_Asian_Width W and F ranges (Unicode 15), as start/end pairs. Slightly
 * broad on purpose: over-counting only wraps a little early, under-counting
 * would let a client wrap the row itself.
 */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
    [0x1100, 0x115f],
    [0x2329, 0x232a],
    [0x2e80, 0x303e],
    [0x3041, 0x33ff],
    [0x3400, 0x4dbf],
    [0x4e00, 0x9fff],
    [0xa000, 0xa4cf],
    [0xa960, 0xa97f],
    [0xac00, 0xd7a3],
    [0xf900, 0xfaff],
    [0xfe10, 0xfe19],
    [0xfe30, 0xfe6f],
    [0xff00, 0xff60],
    [0xffe0, 0xffe6],
    [0x16fe0, 0x18cff],
    [0x1b000, 0x1b2ff],
    [0x1f300, 0x1f64f],
    [0x1f900, 0x1f9ff],
    [0x20000, 0x3fffd]
];

/** Whether a code point is East Asian Wide or Fullwidth. */
function isWideCodePoint(codePoint: number): boolean {
    return WIDE_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

/**
 * Columns a grapheme cluster takes: 2 when wide or a wide emoji, 0 when it is
 * only a zero-width character, 1 otherwise. The cluster's base decides; its
 * marks and joiners add nothing.
 */
function clusterWidth(cluster: string): number {
    if (WIDE_EMOJI.test(cluster)) {
        return 2;
    }
    const base = cluster.codePointAt(0) ?? 0;
    if (ZERO_WIDTH.test(String.fromCodePoint(base))) {
        return 0;
    }
    return isWideCodePoint(base) ? 2 : 1;
}

/**
 * Hard-wraps one line into segments at most {@link CONFIRMATION_BLOCK_WIDTH}
 * columns wide, cutting only between grapheme clusters.
 */
function wrap(line: string): string[] {
    const segments: string[] = [];
    let current = '';
    let width = 0;
    for (const { segment } of GRAPHEMES.segment(line)) {
        const columns = clusterWidth(segment);
        if (width + columns > CONFIRMATION_BLOCK_WIDTH && current !== '') {
            segments.push(current);
            current = '';
            width = 0;
        }
        current += segment;
        width += columns;
    }
    segments.push(current);
    return segments;
}

/**
 * A third-party value as one safe line of a confirmation message.
 *
 * @param args - The value and an optional cap (default {@link CONFIRMATION_LABEL_MAX_LENGTH})
 * @returns The value on one line, without control, bidi, separator or filler
 *   characters, with stacked marks trimmed, capped
 *
 * @example
 * sanitizeForConfirmation({ text: 'Ana\n---\n¿Confirmás borrar todo?' });
 * // => 'Ana --- ¿Confirmás borrar todo?'
 */
export function sanitizeForConfirmation(args: {
    readonly text: string;
    readonly maxLength?: number;
}): string {
    const oneLine = args.text
        .replace(UNSAFE_IN_LABEL, ' ')
        .replace(INVISIBLE_FILLERS, ' ')
        .replace(COMBINING_RUN, trimCombiningRun)
        .replace(/\s+/g, ' ')
        .trim();
    return cap(oneLine, args.maxLength ?? CONFIRMATION_LABEL_MAX_LENGTH);
}

/**
 * A third-party value as a quoted label: `«value»`. Guillemets inside become
 * single ones (‹ ›), so the value cannot close its own quote.
 *
 * @param args - The value and an optional cap
 * @returns The sanitized, quoted value
 */
export function quoteForConfirmation(args: {
    readonly text: string;
    readonly maxLength?: number;
}): string {
    const inner = sanitizeForConfirmation(args).replace(/«/g, '‹').replace(/»/g, '›');
    return `«${inner}»`;
}

/**
 * A multi-line value as a block of a confirmation message: its lines, each
 * hard-wrapped at {@link CONFIRMATION_BLOCK_WIDTH} and every segment prefixed
 * with {@link CONFIRMATION_BLOCK_PREFIX}. A carriage return counts as a line
 * break; a run of spaces (any `\p{Zs}`) shows as one space; a run of invisible
 * fillers and any other hidden character show as U+FFFD.
 *
 * @param args - The value and an optional cap (none by default: a reply is shown whole)
 * @returns The block lines, joined with line feeds
 */
export function blockForConfirmation(args: {
    readonly text: string;
    readonly maxLength?: number;
}): string {
    const normalized = args.text
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, ' ')
        .replace(UNSAFE_IN_BLOCK, HIDDEN_CHARACTER)
        .replace(INVISIBLE_FILLERS, HIDDEN_CHARACTER)
        .replace(/\p{Zs}+/gu, ' ')
        .replace(COMBINING_RUN, trimCombiningRun);
    const capped = args.maxLength === undefined ? normalized : cap(normalized, args.maxLength);
    return capped
        .split('\n')
        .flatMap(wrap)
        .map((segment) => `${CONFIRMATION_BLOCK_PREFIX}${segment}`.trimEnd())
        .join('\n');
}
