/**
 * JPEG inspection for PDF image embedding (HOS-1058).
 *
 * ---
 * WHY A PARSER AND NOT A DECODER
 *
 * PDF's `DCTDecode` filter takes a JPEG's compressed bytes VERBATIM — the
 * viewer runs the same decoder it already has. So embedding a photo needs no
 * pixel work at all; it needs the three facts the image dictionary must
 * declare, and those live in the frame header: width, height, and how many
 * colour components the data carries.
 *
 * That also fixes what this module must REFUSE, because a wrong answer here
 * does not fail — it produces a file that opens with a black or inverted
 * rectangle where the photo should be:
 *
 * - **Progressive JPEG (SOF2).** Legal on the web, and not supported by
 *   `DCTDecode`. Acrobat renders it blank.
 * - **CMYK / YCCK (4 components).** Needs `/DeviceCMYK` plus, for
 *   Adobe-marked files, an inverted `/Decode` array. Photos from a phone are
 *   never CMYK, so the case is not worth carrying.
 * - **12-bit samples.** `/BitsPerComponent 8` would be a lie.
 *
 * Every refusal returns `null` rather than throwing: a brochure without its
 * photo is still a brochure, and a listing whose cover image happens to be
 * progressive must not lose its PDF over it.
 *
 * @module utils/pdf/jpeg
 */

import type { PdfJpeg } from './pdf-document.js';

/** Start-of-image marker, the first two bytes of every JPEG. */
const SOI = 0xd8;

/**
 * Start-of-frame markers this module accepts.
 *
 * `SOF0` baseline and `SOF1` extended sequential are the two `DCTDecode`
 * handles. Everything else in the `0xC0`–`0xCF` block — progressive, lossless,
 * arithmetic-coded, hierarchical — is refused.
 */
const ACCEPTED_SOF = new Set([0xc0, 0xc1]);

/**
 * Markers that carry no payload length, so the scan steps over them by two
 * bytes rather than reading a segment length: the standalone `RSTn` restart
 * markers, plus `SOI` and `TEM`.
 */
const STANDALONE_MARKERS = new Set([0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0x01]);

/**
 * Reads a JPEG's frame header.
 *
 * Walks the marker chain — every segment is `0xFF`, a marker byte, then a
 * big-endian length that INCLUDES its own two bytes — until it reaches a
 * start-of-frame. Fill bytes (a run of `0xFF` before a marker) are legal and
 * skipped.
 *
 * @param input.bytes - The complete JPEG file.
 * @returns The facts the PDF image dictionary needs, or `null` when the input
 *   is not a JPEG this writer can embed. Never throws.
 */
export function readJpeg(input: { bytes: Uint8Array }): PdfJpeg | null {
    const { bytes } = input;

    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) {
        return null;
    }

    let cursor = 2;
    while (cursor < bytes.length - 1) {
        if (bytes[cursor] !== 0xff) {
            // Not at a marker boundary. A well-formed file never lands here
            // before the frame header; a truncated or mislabelled one does.
            return null;
        }

        // Skip fill bytes: any number of 0xFF may precede the marker code.
        let markerPos = cursor + 1;
        while (markerPos < bytes.length && bytes[markerPos] === 0xff) {
            markerPos += 1;
        }
        const marker = bytes[markerPos];
        if (marker === undefined) {
            return null;
        }

        if (STANDALONE_MARKERS.has(marker)) {
            cursor = markerPos + 1;
            continue;
        }

        // `SOS` (0xDA) begins the entropy-coded scan. Reaching it without a
        // frame header means the file is malformed.
        if (marker === 0xda) {
            return null;
        }

        const lengthPos = markerPos + 1;
        if (lengthPos + 1 >= bytes.length) {
            return null;
        }
        const length = ((bytes[lengthPos] as number) << 8) | (bytes[lengthPos + 1] as number);
        if (length < 2) {
            return null;
        }

        if (
            marker >= 0xc0 &&
            marker <= 0xcf &&
            marker !== 0xc4 &&
            marker !== 0xc8 &&
            marker !== 0xcc
        ) {
            // A start-of-frame. `0xC4` (DHT), `0xC8` (JPG) and `0xCC` (DAC)
            // share the block but are not frames.
            if (!ACCEPTED_SOF.has(marker)) {
                return null;
            }
            // SOF payload: precision(1) height(2) width(2) components(1).
            const precision = bytes[lengthPos + 2];
            const height =
                ((bytes[lengthPos + 3] as number) << 8) | (bytes[lengthPos + 4] as number);
            const width =
                ((bytes[lengthPos + 5] as number) << 8) | (bytes[lengthPos + 6] as number);
            const components = bytes[lengthPos + 7];

            if (precision !== 8) {
                return null;
            }
            if (components !== 1 && components !== 3) {
                return null;
            }
            if (width <= 0 || height <= 0) {
                return null;
            }

            return { bytes, width, height, components };
        }

        cursor = lengthPos + length;
    }

    return null;
}
