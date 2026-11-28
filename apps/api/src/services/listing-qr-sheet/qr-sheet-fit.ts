/**
 * Fits one line of type into a fixed width: shrink to a floor, then cut (HOS-2688).
 *
 * ---
 * WHY THIS IS A PURE FUNCTION OF ITS OWN
 *
 * The sticker's blue pill is a fixed box printed in the artwork. The business
 * name that goes in it is owner-typed and has no length the box can rely on —
 * three letters or a hundred and twenty. The rule the owner chose is the one
 * here: the type shrinks down to a minimum and, past that, the name is cut and
 * the cut is marked with «…». It never overflows the pill, because ink outside
 * the pill prints white-on-white and silently loses the name.
 *
 * Kept free of pdf-lib on purpose: the caller passes the width measurement as a
 * function, so the fitting rule is tested directly with any metric and the
 * renderer only supplies the real font's.
 *
 * @module services/listing-qr-sheet/qr-sheet-fit
 */

/**
 * The mark that says a line was cut.
 *
 * A single character rather than three dots: it is in WinAnsi, so the standard
 * faces draw it rather than substituting a `?`, and it reads as a typographic
 * elision instead of as part of the name.
 */
export const ELLIPSIS = '…';

/** Measures `text` at `size` points and returns its drawn width, in points. */
export type WidthOf = (input: { readonly text: string; readonly size: number }) => number;

/** The result of fitting one line. */
export interface FittedLine {
    /** The text to draw — the input, or a prefix of it ending in {@link ELLIPSIS}. */
    readonly text: string;
    /** The font size to draw it at, in points. Never below the floor asked for. */
    readonly size: number;
    /** Whether the text had to be cut. */
    readonly truncated: boolean;
}

/**
 * Fits `text` into `maxWidth`.
 *
 * 1. The largest size between `maxSize` and `minSize` (stepping down by `step`)
 *    at which the whole text fits wins.
 * 2. If it does not fit even at `minSize`, the text is cut code point by
 *    code point (never inside a surrogate pair) until it plus {@link ELLIPSIS} fits at `minSize`.
 *
 * It cuts by characters rather than by words on purpose: the string that needs
 * this is already an outlier, and trimming to the last whole word can throw
 * away a third of the line.
 *
 * @param input - Input parameters.
 * @param input.text - The line to fit. Surrounding whitespace is dropped.
 * @param input.maxWidth - The width it must fit in, in points.
 * @param input.maxSize - The size to try first, in points.
 * @param input.minSize - The floor, in points. The size never goes below it.
 * @param input.step - How much the size drops per attempt. Defaults to 0.5pt.
 * @param input.widthOf - Width measurement of the face the line is drawn with.
 * @returns The text and size to draw, and whether it was cut.
 *
 * @example
 * ```ts
 * fitLine({ text: 'LA PARRILLA', maxWidth: 200, maxSize: 20, minSize: 10, widthOf });
 * // → { text: 'LA PARRILLA', size: 20, truncated: false }
 * ```
 */
export function fitLine(input: {
    readonly text: string;
    readonly maxWidth: number;
    readonly maxSize: number;
    readonly minSize: number;
    readonly step?: number;
    readonly widthOf: WidthOf;
}): FittedLine {
    const { maxWidth, maxSize, minSize, widthOf } = input;
    const step = input.step ?? 0.5;
    const text = input.text.trim();

    // Integer-indexed so floating-point accumulation cannot skip the floor.
    const attempts = Math.max(0, Math.floor((maxSize - minSize) / step));
    for (let index = 0; index <= attempts; index += 1) {
        const size = maxSize - index * step;
        if (widthOf({ text, size }) <= maxWidth) {
            return { text, size, truncated: false };
        }
    }

    // Cut by code point, never by UTF-16 unit: slicing a surrogate pair would
    // leave half an emoji, which no face can draw.
    const codePoints = [...text];
    let keep = codePoints.length;
    const keptText = (): string => codePoints.slice(0, keep).join('').trimEnd();
    while (keep > 0 && widthOf({ text: `${keptText()}${ELLIPSIS}`, size: minSize }) > maxWidth) {
        keep -= 1;
    }
    return { text: `${keptText()}${ELLIPSIS}`, size: minSize, truncated: true };
}
