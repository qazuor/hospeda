/**
 * WinAnsi text encoding and Helvetica metrics for the PDF writer (HOS-1058).
 *
 * ---
 * WHY THIS FILE EXISTS
 *
 * A PDF that uses one of the fourteen standard fonts embeds no font program at
 * all: the viewer already has Helvetica. What it does NOT have is any idea how
 * wide a string is — that lives here, and it is what lets the layout wrap a
 * paragraph instead of running it off the page.
 *
 * Two facts make a hand-written table viable rather than reckless:
 *
 *   1. **The widths are frozen.** The Adobe standard-14 metrics have not moved
 *      since 1985 and cannot: a viewer that rendered them differently would
 *      re-flow every legacy document in the world.
 *   2. **A composed glyph is exactly as wide as its base letter.** `aacute` is
 *      556 because `a` is 556. So the Spanish/Portuguese accents this brochure
 *      is full of need no table of their own — {@link LATIN1_BASE_LETTER} maps
 *      them onto the letter they are built from.
 *
 * A wrong width costs a ragged line. It cannot corrupt the file, and it cannot
 * change what the reader sees written.
 *
 * ## Encoding
 *
 * The page declares `/WinAnsiEncoding`, i.e. CP1252, so a JS string has to
 * become CP1252 bytes before it reaches a content stream. ASCII and Latin-1
 * pass through by codepoint; the 0x80–0x9F window holds the typographic
 * punctuation CP1252 puts there (curly quotes, dashes, the ellipsis) and is
 * mapped explicitly. Anything else — CJK, emoji, an em space — has no byte in
 * this encoding and is replaced rather than dropped, so a name written in a
 * script this font cannot draw degrades to visible placeholders instead of
 * silently vanishing.
 *
 * @module utils/pdf/helvetica
 */

/** The two faces this writer can use. Both are standard-14, neither is embedded. */
export type PdfFontName = 'Helvetica' | 'Helvetica-Bold';

/** Byte substituted for a character CP1252 cannot represent. */
const REPLACEMENT_BYTE = 0x3f; // '?'

/**
 * The CP1252-only window, 0x80–0x9F, keyed by Unicode codepoint.
 *
 * Latin-1 leaves this range to control characters; CP1252 fills it with
 * punctuation, which is precisely the punctuation a copy-pasted description
 * arrives carrying (`’`, `“`, `–`, `…`).
 */
const CP1252_HIGH_WINDOW: Readonly<Record<number, number>> = {
    8364: 0x80, // €
    8218: 0x82, // ‚
    402: 0x83, // ƒ
    8222: 0x84, // „
    8230: 0x85, // …
    8224: 0x86, // †
    8225: 0x87, // ‡
    710: 0x88, // ˆ
    8240: 0x89, // ‰
    352: 0x8a, // Š
    8249: 0x8b, // ‹
    338: 0x8c, // Œ
    381: 0x8e, // Ž
    8216: 0x91, // ‘
    8217: 0x92, // ’
    8220: 0x93, // “
    8221: 0x94, // ”
    8226: 0x95, // •
    8211: 0x96, // –
    8212: 0x97, // —
    732: 0x98, // ˜
    8482: 0x99, // ™
    353: 0x9a, // š
    8250: 0x9b, // ›
    339: 0x9c, // œ
    382: 0x9e, // ž
    376: 0x9f // Ÿ
};

/**
 * Encodes a JS string as WinAnsi (CP1252) bytes.
 *
 * @param input.text - The text to encode.
 * @returns One byte per representable character; {@link REPLACEMENT_BYTE} for
 *   the rest. Never throws — a brochure must render even when a field carries
 *   a character this font cannot draw.
 */
export function encodeWinAnsi(input: { text: string }): number[] {
    const bytes: number[] = [];
    for (const char of input.text) {
        const code = char.codePointAt(0) ?? 0;
        if (code === 0x0a || code === 0x0d || code === 0x09) {
            // Line structure is the layout's business, never the encoder's: a
            // raw newline inside a PDF literal string is legal but positions
            // nothing, so it would silently run two lines together.
            bytes.push(0x20);
        } else if (code >= 0x20 && code <= 0x7e) {
            bytes.push(code);
        } else if (code >= 0xa0 && code <= 0xff) {
            bytes.push(code);
        } else {
            bytes.push(CP1252_HIGH_WINDOW[code] ?? REPLACEMENT_BYTE);
        }
    }
    return bytes;
}

/**
 * Adobe Helvetica advance widths for ASCII 0x20–0x7E, in 1/1000 em.
 *
 * Index 0 is the space at 0x20.
 */
const HELVETICA_ASCII_WIDTHS: readonly number[] = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
    611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
    222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

/** Adobe Helvetica-Bold advance widths for ASCII 0x20–0x7E, in 1/1000 em. */
const HELVETICA_BOLD_ASCII_WIDTHS: readonly number[] = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
    611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
    278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
];

/**
 * The base letter each composed Latin-1 glyph is built from.
 *
 * Only the letters appear here. A composed glyph carries the advance of its
 * base in every standard-14 font, so `ñ` measures as `n` and the table needs no
 * numbers of its own.
 */
const LATIN1_BASE_LETTER: Readonly<Record<number, string>> = {
    192: 'A',
    193: 'A',
    194: 'A',
    195: 'A',
    196: 'A',
    197: 'A',
    199: 'C',
    200: 'E',
    201: 'E',
    202: 'E',
    203: 'E',
    204: 'I',
    205: 'I',
    206: 'I',
    207: 'I',
    209: 'N',
    210: 'O',
    211: 'O',
    212: 'O',
    213: 'O',
    214: 'O',
    216: 'O',
    217: 'U',
    218: 'U',
    219: 'U',
    220: 'U',
    221: 'Y',
    224: 'a',
    225: 'a',
    226: 'a',
    227: 'a',
    228: 'a',
    229: 'a',
    231: 'c',
    232: 'e',
    233: 'e',
    234: 'e',
    235: 'e',
    236: 'i',
    237: 'i',
    238: 'i',
    239: 'i',
    241: 'n',
    242: 'o',
    243: 'o',
    244: 'o',
    245: 'o',
    246: 'o',
    248: 'o',
    249: 'u',
    250: 'u',
    251: 'u',
    252: 'u',
    253: 'y',
    255: 'y'
};

/**
 * Widths for the non-letter bytes above 0x7E that this brochure actually emits:
 * the punctuation CP1252 puts in the 0x80–0x9F window, plus the Latin-1 marks
 * a Spanish or Portuguese listing uses (`¡`, `¿`, `°`, `·`).
 *
 * Keyed by WinAnsi BYTE, not by codepoint, because that is what the caller has
 * by the time it measures.
 */
const HIGH_BYTE_WIDTHS: Readonly<Record<number, readonly [number, number]>> = {
    // byte: [Helvetica, Helvetica-Bold]
    128: [556, 556], // €
    133: [1000, 1000], // …
    145: [222, 278], // ‘
    146: [222, 278], // ’
    147: [333, 500], // “
    148: [333, 500], // ”
    149: [350, 350], // •
    150: [556, 556], // –
    151: [1000, 1000], // —
    153: [1000, 1000], // ™
    160: [278, 278], // NBSP
    161: [333, 333], // ¡
    169: [737, 737], // ©
    171: [556, 556], // «
    174: [737, 737], // ®
    176: [400, 400], // °
    183: [278, 278], // ·
    187: [556, 556], // »
    191: [611, 611], // ¿
    215: [584, 584], // ×
    247: [584, 584] // ÷
};

/**
 * Width used when a byte is in none of the tables above.
 *
 * The width of a lowercase `o` — mid-range for this face, so an unrecognised
 * byte biases a line neither long nor short.
 */
const FALLBACK_WIDTH = 556;

/** Advance width of one WinAnsi byte, in 1/1000 em. */
function byteWidth(input: { byte: number; font: PdfFontName }): number {
    const { byte, font } = input;
    const bold = font === 'Helvetica-Bold';
    const asciiTable = bold ? HELVETICA_BOLD_ASCII_WIDTHS : HELVETICA_ASCII_WIDTHS;

    if (byte >= 0x20 && byte <= 0x7e) {
        return asciiTable[byte - 0x20] ?? FALLBACK_WIDTH;
    }

    const base = LATIN1_BASE_LETTER[byte];
    if (base) {
        return asciiTable[(base.codePointAt(0) ?? 0x6f) - 0x20] ?? FALLBACK_WIDTH;
    }

    const pair = HIGH_BYTE_WIDTHS[byte];
    if (pair) {
        return pair[bold ? 1 : 0];
    }

    return FALLBACK_WIDTH;
}

/**
 * Measures a string as it will be drawn.
 *
 * @param input.text - The text to measure.
 * @param input.font - The face it will be drawn in.
 * @param input.size - Font size in points.
 * @returns Its advance width in points.
 */
export function measureText(input: { text: string; font: PdfFontName; size: number }): number {
    const bytes = encodeWinAnsi({ text: input.text });
    let thousandths = 0;
    for (const byte of bytes) {
        thousandths += byteWidth({ byte, font: input.font });
    }
    return (thousandths * input.size) / 1000;
}

/**
 * Breaks text into lines that fit a column.
 *
 * Wraps on spaces; a single word wider than the column is broken mid-word
 * rather than allowed to overflow, because the alternative on a printed page is
 * a phone number or a URL running off the paper. Explicit newlines in the input
 * are honoured as paragraph breaks.
 *
 * @param input.text - The text to wrap.
 * @param input.font - The face it will be drawn in.
 * @param input.size - Font size in points.
 * @param input.maxWidth - Column width in points.
 * @returns The lines, in order. Empty input yields an empty array.
 */
export function wrapText(input: {
    text: string;
    font: PdfFontName;
    size: number;
    maxWidth: number;
}): string[] {
    const { font, size, maxWidth } = input;
    const lines: string[] = [];

    for (const paragraph of input.text.split(/\r?\n/)) {
        const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
        if (words.length === 0) {
            continue;
        }

        let current = '';
        for (const word of words) {
            const candidate = current.length === 0 ? word : `${current} ${word}`;
            if (measureText({ text: candidate, font, size }) <= maxWidth) {
                current = candidate;
                continue;
            }

            if (current.length > 0) {
                lines.push(current);
                current = '';
            }

            // The word alone may still not fit. Break it by character rather
            // than emit a line wider than the column.
            let chunk = '';
            for (const char of word) {
                const next = chunk + char;
                if (chunk.length > 0 && measureText({ text: next, font, size }) > maxWidth) {
                    lines.push(chunk);
                    chunk = char;
                } else {
                    chunk = next;
                }
            }
            current = chunk;
        }

        if (current.length > 0) {
            lines.push(current);
        }
    }

    return lines;
}
