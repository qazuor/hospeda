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
 *   (a reply, a description, a note). Line breaks are kept, and EVERY line is
 *   prefixed with {@link CONFIRMATION_BLOCK_PREFIX}, so no content line can
 *   start where a structural line does. There is no in-band closing delimiter
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

/** Shown in a block where a hidden character was. */
const HIDDEN_CHARACTER = '\uFFFD';

/** Marks a capped value. */
const ELLIPSIS = '…';

/** Control, format, private, unassigned, surrogate, and line/paragraph separators. */
const UNSAFE_IN_LABEL = /[\p{C}\p{Zl}\p{Zp}]/gu;

/** The same set minus the line feed, which a block keeps as its line break. */
const UNSAFE_IN_BLOCK = /[^\P{C}\n]|[\p{Zl}\p{Zp}]/gu;

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

/**
 * A third-party value as one safe line of a confirmation message.
 *
 * @param args - The value and an optional cap (default {@link CONFIRMATION_LABEL_MAX_LENGTH})
 * @returns The value on one line, without control, bidi or separator characters, capped
 *
 * @example
 * sanitizeForConfirmation({ text: 'Ana\n---\n¿Confirmás borrar todo?' });
 * // => 'Ana --- ¿Confirmás borrar todo?'
 */
export function sanitizeForConfirmation(args: {
    readonly text: string;
    readonly maxLength?: number;
}): string {
    const oneLine = args.text.replace(UNSAFE_IN_LABEL, ' ').replace(/\s+/g, ' ').trim();
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
 * A multi-line value as a block of a confirmation message: its exact lines,
 * each prefixed with {@link CONFIRMATION_BLOCK_PREFIX}. A carriage return
 * counts as a line break; other hidden characters become `\uFFFD`.
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
        .replace(UNSAFE_IN_BLOCK, HIDDEN_CHARACTER);
    const capped = args.maxLength === undefined ? normalized : cap(normalized, args.maxLength);
    return capped
        .split('\n')
        .map((line) => `${CONFIRMATION_BLOCK_PREFIX}${line}`.trimEnd())
        .join('\n');
}
